import * as brs from 'brs';
import * as path from 'path';

import { Callable, ExpressionCall, BRSType, Diagnostic, CallableArg, CallableParam } from '../interfaces';
import { Context } from '../Context';
import util from '../util';
import { Position, Range, CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { FunctionScope } from '../FunctionScope';
import { outputFile } from 'fs-extra';
import { diagnosticMessages } from '../DiagnosticMessages';

/**
 * Holds all details about this file within the context of the whole program
 */
export class BrsFile {
    constructor(
        public pathAbsolute: string,
        /**
         * The absolute path to the file, relative to the pkg
         */
        public pkgPath: string
    ) {
        this.extension = path.extname(pathAbsolute).toLowerCase();
    }

    /**
     * The extension for this file
     */
    public extension: string;

    /**
     * Indicates if this file was processed by the program yet. 
     */
    public wasProcessed = false;

    private diagnostics = [] as Diagnostic[];

    public getDiagnostics() {
        return [...this.diagnostics];
    }

    public callables = [] as Callable[]

    public expressionCalls = [] as ExpressionCall[];

    public functionScopes = [] as FunctionScope[];

    /**
     * The AST for this file
     */
    private ast: brs.parser.Stmt.Statement[];

    /**
     * Calculate the AST for this file
     * @param fileContents 
     */
    public async parse(fileContents?: string) {
        if (this.wasProcessed) {
            throw new Error(`File was already processed. Create a new file instead. ${this.pathAbsolute}`);
        }

        //load from disk if file contents are not provided
        if (typeof fileContents !== 'string') {
            fileContents = await util.getFileContents(this.pathAbsolute);
        }
        //split the text into lines
        let lines = util.getLines(fileContents);

        let lexResult = brs.lexer.Lexer.scan(fileContents);

        let parser = new brs.parser.Parser();
        let parseResult = parser.parse(lexResult.tokens);

        let errors = [...lexResult.errors, ...<any>parseResult.errors];

        //convert the brs library's errors into our format
        this.diagnostics = this.standardizeLexParseErrors(errors, lines);

        this.ast = <any>parseResult.statements;

        //extract all callables from this file
        this.findCallables(lines);

        //find all places where a sub/function is being called
        this.findCallableInvocations(lines);

        //traverse the ast and find all functions,
        //and create a scope object
        this.createFunctionScopes(lines, this.ast);

        this.wasProcessed = true;
    }

    public standardizeLexParseErrors(errors: brs.parser.ParseError[], lines: string[]) {
        let standardizedDiagnostics = [] as Diagnostic[];
        for (let error of errors) {
            let diagnostic = <Diagnostic>{
                code: 1000,
                location: util.locationToRange(error.location),
                file: this,
                severity: 'error',
                message: error.message
            };
            standardizedDiagnostics.push(diagnostic);
        }

        return standardizedDiagnostics;
    }

    public scopesByFunc = new Map<brs.parser.Expr.Function, FunctionScope>();

    /**
     * Create a scope for every function in this file
     */
    private createFunctionScopes(lines: string[], statements: any, parent?: FunctionScope) {
        //find every function
        let functions = util.findAllDeep<brs.parser.Expr.Function>(this.ast, (x) => x instanceof brs.parser.Expr.Function);

        //create a functionScope for every function
        for (let kvp of functions) {
            let func = kvp.value;
            let scope = new FunctionScope(func);

            let ancestors = this.getAncestors(statements, kvp.key);

            let parentFunc: brs.parser.Expr.Function;
            //find parent function, and add this scope to it if found
            {
                for (let i = ancestors.length - 1; i >= 0; i--) {
                    if (ancestors[i] instanceof brs.parser.Expr.Function) {
                        parentFunc = ancestors[i];
                        break;
                    }
                }
                let parentScope = this.scopesByFunc.get(parentFunc);

                //add this child scope to its parent
                if (parentScope) {
                    parentScope.childrenScopes.push(scope);
                }
            }

            //compute the range of this func
            scope.bodyRange = util.getBodyRangeForFunc(func);

            //add every parameter
            for (let param of func.parameters as any) {
                scope.variableDeclarations.push({
                    //TODO update these to use the actual token locations
                    lineIndex: scope.bodyRange.start.line,
                    name: param.name,
                    type: util.valueKindToString(param.kind)
                });
            }
            //add every variable assignment to the scope
            for (let statement of func.body.statements) {
                //if this is a variable assignment
                if (statement instanceof brs.parser.Stmt.Assignment) {
                    scope.variableDeclarations.push({
                        lineIndex: statement.name.location.start.line - 1,
                        name: statement.name.text,
                        type: this.getBRSTypeFromAssignment(statement, scope)
                    });
                }
                //TODO support things inside of loops, conditionals, etc
            }
            this.scopesByFunc.set(func, scope);

            //find every statement in the scope
            this.functionScopes.push(scope);
        }
    }

    private getClosestLineIndex(ancestors: any[]) {
        for (let i = ancestors.length - 1; i >= 0; i--) {
            let ancestor = ancestors[i];
            if (ancestor.name && typeof ancestor.name.line === 'number') {
                return ancestor.name.line - 1;
            }
        }
    }

    /**
     * Given a set of statements and top-level ast,
     * find the closest function ancestor for the given key
     * @param statements 
     * @param key 
     */
    private getAncestors(statements: any[], key: string) {
        let parts = key.split('.');
        //throw out the last part, because that is already a func (it's the "child")
        parts.pop();

        let current = statements;
        let ancestors = [];
        for (let part of parts) {
            current = current[part];
            ancestors.push(current);
        }
        return ancestors;
    }

    private getBRSTypeFromAssignment(assignment: brs.parser.Stmt.Assignment, scope: FunctionScope): BRSType {
        try {
            //function
            if (assignment.value instanceof brs.parser.Expr.Function) {
                return 'function';

                //literal
            } else if (assignment.value instanceof brs.parser.Expr.Literal) {
                return util.valueKindToString((assignment.value as any).value.kind);

                //function call
            } else if (assignment.value instanceof brs.parser.Expr.Call) {
                let calleeName = (assignment.value.callee as any).name.text;
                if (calleeName) {
                    let func = this.getFunctionByName(calleeName);
                    if (func) {
                        return func.returnType;
                    }
                }
            } else if (assignment.value instanceof brs.parser.Expr.Variable) {
                let variableName = assignment.value.name.text;
                let variable = scope.getVariableByName(variableName);
                return variable.type;
            }
        } catch (e) {
            //do nothing. Just return dynamic
        }
        //fallback to dynamic
        return 'dynamic';
    }

    private getFunctionByName(name: string) {
        name = name ? name.toLowerCase() : undefined;
        if (!name) {
            return;
        }
        for (let func of this.callables) {
            if (func.name.toLowerCase() === name) {
                return func;
            }
        }
    }

    private findCallables(lines: string[]) {
        this.callables = [];
        for (let statement of this.ast as any) {
            if (!(statement instanceof brs.parser.Stmt.Function)) {
                continue;
            }

            //extract the parameters
            let params = [] as CallableParam[];
            for (let param of statement.func.parameters) {
                params.push({
                    name: param.name,
                    type: util.valueKindToString(param.type),
                    isOptional: !!param.defaultValue,
                    isRestArgument: false
                });
            }

            this.callables.push({
                name: statement.name.text,
                returnType: util.valueKindToString(statement.func.returns),
                nameRange: util.locationToRange(statement.name.location),
                file: this,
                params: params,
                //the function body starts on the next line (since we can't have one-line functions)
                bodyRange: util.getBodyRangeForFunc(statement.func),
                type: 'function'
            });
        }
    }

    private findCallableInvocations(lines: string[]) {
        this.expressionCalls = [];

        //for now, just dig into top-level function declarations.
        for (let statement of this.ast as any) {
            if (!statement.func) {
                continue;
            }
            let func = statement as any;
            let bodyStatements = statement.func.body.statements;
            for (let bodyStatement of bodyStatements) {
                if (bodyStatement.expression && bodyStatement.expression instanceof brs.parser.Expr.Call) {
                    let expression: brs.parser.Expr.Call = bodyStatement.expression;
                    expression.callee
                    //filter out dotted function invocations (i.e. object.doSomething()) (not currently supported. TODO support it)
                    if (bodyStatement.expression.callee.obj) {
                        continue;
                    }
                    let functionName = (expression.callee as any).name.text;

                    //callee is the name of the function being called
                    let callee = expression.callee as brs.parser.Expr.Variable;

                    let calleeRange = util.locationToRange(callee.location);

                    let columnIndexBegin = calleeRange.start.character;
                    let columnIndexEnd = calleeRange.end.character

                    let args = [] as CallableArg[];
                    //TODO convert if stmts to use instanceof instead
                    for (let arg of expression.args as any) {
                        //is variable being passed into argument
                        if (arg.name) {
                            args.push({
                                range: util.locationToRange(arg.location),
                                //TODO - look up the data type of the actual variable
                                type: 'dynamic',
                                text: arg.name.text
                            });
                        } else if (arg.value) {
                            let text = '';
                            /* istanbul ignore next: TODO figure out why value is undefined sometimes */
                            if (arg.value.value) {
                                text = arg.value.value.toString();
                            }
                            let callableArg = {
                                range: util.locationToRange(arg.location),
                                type: util.valueKindToString(arg.value.kind),
                                text: text
                            };
                            //wrap the value in quotes because that's how it appears in the code
                            if (callableArg.type === "string") {
                                callableArg.text = '"' + callableArg.text + '"';
                            }
                            args.push(callableArg);
                        } else {
                            args.push({
                                range: util.locationToRange(arg.location),
                                type: 'dynamic',
                                //TODO get text from other types of args
                                text: ''
                            });
                        }
                    }

                    let expCall: ExpressionCall = {
                        file: this,
                        name: functionName,
                        //TODO convert this to a range
                        columnIndexBegin: columnIndexBegin,
                        columnIndexEnd: columnIndexEnd,
                        lineIndex: calleeRange.start.line,
                        //TODO keep track of parameters
                        args: args
                    };
                    this.expressionCalls.push(expCall);
                }
            }
        }
    }

    /**
     * Find the function scope at the given position.
     * @param position 
     * @param functionScopes 
     */
    private getFunctionScopeAtPosition(position: Position, functionScopes?: FunctionScope[]): FunctionScope {
        if (!functionScopes) {
            functionScopes = this.functionScopes;
        }
        for (let scope of functionScopes) {
            if (util.rangeContains(scope.bodyRange, position)) {
                //see if any of that scope's children match the position also, and give them priority
                let childScope = this.getFunctionScopeAtPosition(position, scope.childrenScopes);
                if (childScope) {
                    return childScope;
                } else {
                    return scope;
                }
            }
        }

    }

    public getCompletions(position: Position, context?: Context) {
        //determine if cursor is inside a function
        let functionScope = this.getFunctionScopeAtPosition(position);
        if (!functionScope) {
            //we aren't in any function scope, so just return an empty list
            return [];
        }

        let results = [] as CompletionItem[];
        let variables = functionScope.getVariablesAbove(position.line);
        for (let variable of variables) {
            results.push({
                label: variable.name,
                kind: variable.type === 'function' ? CompletionItemKind.Function : CompletionItemKind.Variable
            });
        }
        return results;
    }
}