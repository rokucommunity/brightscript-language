import * as brs from 'brs';
import * as path from 'path';
import { CompletionItem, CompletionItemKind, Hover, Position, Range } from 'vscode-languageserver';

import { Context } from '../Context';
import { FunctionScope } from '../FunctionScope';
import { Callable, CallableArg, CallableParam, Diagnostic, ExpressionCall } from '../interfaces';
import { Program } from '../Program';
import { BrsType } from '../types/BrsType';
import { DynamicType } from '../types/DynamicType';
import { FunctionType } from '../types/FunctionType';
import { StringType } from '../types/StringType';
import { VoidType } from '../types/VoidType';
import util from '../util';

/**
 * Holds all details about this file within the context of the whole program
 */
export class BrsFile {
    constructor(
        public pathAbsolute: string,
        /**
         * The absolute path to the file, relative to the pkg
         */
        public pkgPath: string,
        public program: Program
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

    public callables = [] as Callable[];

    public functionCalls = [] as ExpressionCall[];

    public functionScopes = [] as FunctionScope[];

    /**
     * The AST for this file
     */
    private ast: brs.parser.Stmt.Statement[];
    private tokens: brs.lexer.Token[];

    /**
     * Get the token at the specified position
     * @param position
     */
    private getTokenAt(position: Position) {
        for (let token of this.tokens) {
            if (util.rangeContains(util.locationToRange(token.location), position)) {
                return token;
            }
        }
    }

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

        this.tokens = lexResult.tokens;

        let parser = new brs.parser.Parser();
        let parseResult = parser.parse(lexResult.tokens);

        let errors = [...lexResult.errors, ...<any>parseResult.errors];

        //convert the brs library's errors into our format
        this.diagnostics = this.standardizeLexParseErrors(errors, lines);

        this.ast = <any>parseResult.statements;

        //extract all callables from this file
        this.findCallables(lines);

        //traverse the ast and find all functions and create a scope object
        this.createFunctionScopes(lines, this.ast);

        //find all places where a sub/function is being called
        this.findFunctionCalls(lines);

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
                //store the parent scope for this scope
                scope.parentScope = parentScope;
            }

            //compute the range of this func
            scope.bodyRange = util.getBodyRangeForFunc(func);

            //add every parameter
            for (let param of func.parameters) {
                scope.variableDeclarations.push({
                    nameRange: util.locationToRange(param.name.location),
                    lineIndex: scope.bodyRange.start.line,
                    name: param.name.text,
                    type: util.valueKindToBrsType(param.type.kind)
                });
            }
            //add every variable assignment to the scope
            for (let statement of func.body.statements) {
                //if this is a variable assignment
                if (statement instanceof brs.parser.Stmt.Assignment) {
                    scope.variableDeclarations.push({
                        nameRange: util.locationToRange(statement.name.location),
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

    private getBRSTypeFromAssignment(assignment: brs.parser.Stmt.Assignment, scope: FunctionScope): BrsType {
        try {
            //function
            if (assignment.value instanceof brs.parser.Expr.Function) {
                let functionType = new FunctionType(util.valueKindToBrsType(assignment.value.returns));
                functionType.isSub = assignment.value.keyword.text === 'sub';
                if (functionType.isSub) {
                    functionType.returnType = new VoidType();
                }

                functionType.setName(assignment.name.text);
                for (let argument of assignment.value.parameters) {
                    let isRequired = !argument.defaultValue;
                    //TODO compute optional parameters
                    functionType.addParameter(argument.name.text, util.valueKindToBrsType(argument.type.kind), isRequired);
                }
                return functionType;

                //literal
            } else if (assignment.value instanceof brs.parser.Expr.Literal) {
                return util.valueKindToBrsType((assignment.value as any).value.kind);

                //function call
            } else if (assignment.value instanceof brs.parser.Expr.Call) {
                let calleeName = (assignment.value.callee as any).name.text;
                if (calleeName) {
                    let func = this.getCallableByName(calleeName);
                    if (func) {
                        return func.type.returnType;
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
        return new DynamicType();
    }

    private getCallableByName(name: string) {
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

            let functionType = new FunctionType(util.valueKindToBrsType(statement.func.returns));
            functionType.setName(statement.name.text);
            functionType.isSub = statement.func.keyword.text.toLowerCase() === 'sub';
            if (functionType.isSub) {
                functionType.returnType = new VoidType();
            }

            //extract the parameters
            let params = [] as CallableParam[];
            for (let param of statement.func.parameters) {
                let callableParam = {
                    name: param.name.text,
                    type: util.valueKindToBrsType(param.type.kind),
                    isOptional: !!param.defaultValue,
                    isRestArgument: false
                };
                params.push(callableParam);
                let isRequired = !param.defaultValue;
                functionType.addParameter(callableParam.name, callableParam.type, isRequired);
            }

            this.callables.push({
                isSub: statement.func.keyword.text.toLowerCase() === 'sub',
                name: statement.name.text,
                nameRange: util.locationToRange(statement.name.location),
                file: this,
                params: params,
                //the function body starts on the next line (since we can't have one-line functions)
                bodyRange: util.getBodyRangeForFunc(statement.func),
                type: functionType
            });
        }
    }

    private findFunctionCalls(lines: string[]) {
        this.functionCalls = [];

        //for now, just dig into top-level function declarations.
        for (let statement of this.ast as any) {
            if (!statement.func) {
                continue;
            }
            let bodyStatements = statement.func.body.statements;
            for (let bodyStatement of bodyStatements) {
                if (bodyStatement.expression && bodyStatement.expression instanceof brs.parser.Expr.Call) {
                    let expression: brs.parser.Expr.Call = bodyStatement.expression;

                    //filter out dotted function invocations (i.e. object.doSomething()) (not currently supported. TODO support it)
                    if (bodyStatement.expression.callee.obj) {
                        continue;
                    }
                    let functionName = (expression.callee as any).name.text;

                    //callee is the name of the function being called
                    let callee = expression.callee as brs.parser.Expr.Variable;

                    let calleeRange = util.locationToRange(callee.location);

                    let columnIndexBegin = calleeRange.start.character;
                    let columnIndexEnd = calleeRange.end.character;

                    let args = [] as CallableArg[];
                    //TODO convert if stmts to use instanceof instead
                    for (let arg of expression.args as any) {
                        //is variable being passed into argument
                        if (arg.name) {
                            args.push({
                                range: util.locationToRange(arg.location),
                                //TODO - look up the data type of the actual variable
                                type: new DynamicType(),
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
                                type: util.valueKindToBrsType(arg.value.kind),
                                text: text
                            };
                            //wrap the value in quotes because that's how it appears in the code
                            if (callableArg.type instanceof StringType) {
                                callableArg.text = '"' + callableArg.text + '"';
                            }
                            args.push(callableArg);
                        } else {
                            args.push({
                                range: util.locationToRange(arg.location),
                                type: new DynamicType(),
                                //TODO get text from other types of args
                                text: ''
                            });
                        }
                    }

                    let expCall: ExpressionCall = {
                        functionScope: this.getFunctionScopeAtPosition(Position.create(calleeRange.start.line, calleeRange.start.character)),
                        file: this,
                        name: functionName,
                        nameRange: Range.create(calleeRange.start.line, columnIndexBegin, calleeRange.start.line, columnIndexEnd),
                        //TODO keep track of parameters
                        args: args
                    };
                    this.functionCalls.push(expCall);
                }
            }
        }
    }

    /**
     * Find the function scope at the given position.
     * @param position
     * @param functionScopes
     */
    public getFunctionScopeAtPosition(position: Position, functionScopes?: FunctionScope[]): FunctionScope {
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
                kind: variable.type instanceof FunctionType ? CompletionItemKind.Function : CompletionItemKind.Variable
            });
        }
        return results;
    }

    public getHover(position: Position): Hover {
        //get the token at the position
        let token = this.getTokenAt(position);

        //if no token found or token does not look like an identifier, there's nothing to show
        if (!token || /[\w\d_]+/gi.test(token.text) === false) {
            return null;
        }

        let lowerTokenText = token.text.toLowerCase();

        //look through local variables first
        {
            //get the function scope for this position (if exists)
            let functionScope = this.getFunctionScopeAtPosition(position);
            if (functionScope) {
                //find any variable with this name
                for (let varDeclaration of functionScope.variableDeclarations) {
                    //we found a variable declaration with this token text!
                    if (varDeclaration.name.toLowerCase() === lowerTokenText) {
                        let typeText: string;
                        if (varDeclaration.type instanceof FunctionType) {
                            typeText = varDeclaration.type.toString();
                        } else {
                            typeText = `${varDeclaration.name} as ${varDeclaration.type.toString()}`;
                        }
                        return {
                            range: util.locationToRange(token.location),
                            //append the variable name to the front for context
                            contents: typeText
                        };
                    }
                }
            }
        }

        //look through all callables in relevant contexts
        {
            let contexts = this.program.getContextsForFile(this);
            for (let context of contexts) {
                let callable = context.getCallableByName(lowerTokenText);
                if (callable) {
                    return {
                        range: util.locationToRange(token.location),
                        contents: callable.type.toString()
                    };
                }
            }
        }
    }

    public dispose() {
    }
}
