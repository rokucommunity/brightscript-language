import * as brs from 'brs';
import * as path from 'path';

import { Callable, ExpressionCall, BRSType, Diagnostic, CallableArg, CallableParam } from '../interfaces';
import { Context } from '../Context';
import util from '../util';
import { Position, Range, CompletionItem, CompletionItemKind } from 'vscode-languageserver';
import { FunctionScope } from '../FunctionScope';
import { outputFile } from 'fs-extra';

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

    public diagnostics = [] as Diagnostic[];

    public callables = [] as Callable[]

    public expressionCalls = [] as ExpressionCall[];

    public functionScopes = [] as FunctionScope[];

    /**
     * The AST for this file
     */
    private ast: brs.parser.Stmt.Statement[];

    public reset() {
        this.wasProcessed = false;
        this.diagnostics = [];
        this.callables = [];
        this.expressionCalls = [];
        this.functionScopes = [];
        this.scopesByFunc.clear();
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

    public standardizeLexParseErrors(errors: { message: string, stack: string }[], lines: string[]) {
        let standardizedDiagnostics = [] as Diagnostic[];
        for (let error of errors) {
            let diagnostic = <Diagnostic>{
                code: 1000,
                lineIndex: 0,
                columnIndexBegin: 0,
                columnIndexEnd: Number.MAX_VALUE,
                file: this,
                severity: 'error',
                message: error.message
            };
            //extract the line number from the message
            let match = /\[Line (\d+)\]\s*(.*)/i.exec(error.message);
            if (match) {
                diagnostic.lineIndex = parseInt(match[1]) - 1;
                diagnostic.message = match[2];
            }
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

            scope.bodyRange = this.getBodyRangeForFunc(lines, func, ancestors);

            //add every parameter
            for (let param of func.parameters as any) {
                scope.variableDeclarations.push({
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
                        lineIndex: statement.name.line - 1,
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
     * Get the range for the specified function. 
     * @param lines 
     * @param func 
     * @param key - the key used to find the 
     */
    private getBodyRangeForFunc(lines: string[], func: brs.parser.Expr.Function, ancestors: any[]): Range {
        //find the closest ancestor with a line number
        let lineIndex = this.getClosestLineIndex(ancestors);

        //find the column index for this statement
        let line = lines[lineIndex];

        let match = /.*(?:function|sub)(?:\s+[\w\d_]*)?\(.*\)/i.exec(line);
        if (match) {
            let bodyPositionStart = Position.create(lineIndex, match[0].length);
            let bodyPositionEnd = this.findBodyEndPosition(lines, lineIndex + 1);
            let bodyRange = Range.create(bodyPositionStart, bodyPositionEnd);
            return bodyRange;
        }
    }

    private getClosestLineIndex(ancestors: any[]) {
        for (let i = ancestors.length - 1; i >= 0; i--) {
            let ancestor = ancestors[i];
            if (ancestor.name) {
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
            if (!statement.func) {
                continue;
            }
            let functionName = statement.name.text;

            let lineIndex = statement.name.line - 1;

            //find the column index for this statement
            let line = lines[lineIndex];

            //default to the beginning of the line
            let columnBeginIndex = 0;
            //default to the end of the line
            let columnEndIndex = line.length - 1;

            let returnType = 'dynamic';

            let bodyRange = Range.create(lineIndex, 0, lineIndex, columnEndIndex);

            let match = /^(\s*(?:function|sub)\s+)([\w\d_]*)\s*\(.*\)(?:\s*as\s*(.*))?/i.exec(line);
            if (match) {
                let preceedingText = match[1];
                let lineFunctionName = match[2];
                returnType = match[3] ? match[3] : returnType;
                columnBeginIndex = preceedingText.length
                columnEndIndex = columnBeginIndex + functionName.length;

                let bodyPositionStart = Position.create(lineIndex, match[0].length);
                let bodyPositionEnd = this.findBodyEndPosition(lines, lineIndex + 1);
                bodyRange = Range.create(bodyPositionStart, bodyPositionEnd);
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
                name: functionName,
                returnType: <BRSType>returnType,
                nameRange: Range.create(lineIndex, columnBeginIndex, lineIndex, columnEndIndex),
                file: this,
                params: params,
                bodyRange: bodyRange,
                type: 'function'
            });
        }
    }

    /**
     * Find the position where the function body ends
     * @param lines 
     * @param lineIndex - the index of the line AFTER the line where the callable was declared
     */
    findBodyEndPosition(lines: string[], startLineIndex: number) {
        let openedCount = 1;
        for (let lineIndex = startLineIndex; lineIndex < lines.length; lineIndex++) {
            let line = lines[lineIndex];

            //if a new function has been opened, move on to next line
            if (/(function|sub(?![\w\d_]))([ \t]*([\w\d]+))?\(.*\)/gi.exec(line)) {
                openedCount++;
                continue;
            }
            let closedMatch = /^(\s*)end\s+(sub|function)/gi.exec(line);
            if (closedMatch) {
                openedCount--;
                //if the last opened callable was just closed, compute the position 
                if (openedCount === 0) {
                    return Position.create(lineIndex, closedMatch[1].length);
                }
            }
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
                    let functionName = bodyStatement.expression.callee.name.text;

                    //filter out non-global function invocations (not currently supported. TODO support it)
                    if (bodyStatement.expression.callee.obj) {
                        continue;
                    }
                    let lineIndex = bodyStatement.expression.callee.name.line - 1;
                    let line = lines[lineIndex];
                    let columnIndexBegin = 0;
                    let columnIndexEnd = Number.MAX_VALUE;

                    //find the invocation on this line
                    let regexp = new RegExp(`^(.*)${functionName}\s*\()`, 'i');
                    let match = regexp.exec(line);
                    //if we found a match, fine-tune the column indexes
                    if (match) {
                        let junkBefore = match[1];
                        columnIndexBegin = junkBefore.length;
                        columnIndexEnd = columnIndexBegin + functionName.length;
                    }

                    let args = [] as CallableArg[];
                    for (let arg of bodyStatement.expression.args) {
                        //is variable being passed into argument
                        if (arg.name) {
                            args.push({
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
                                type: 'dynamic',
                                //TODO get text from other types of args
                                text: ''
                            });
                        }
                    }

                    let expCall: ExpressionCall = {
                        file: this,
                        name: functionName,
                        columnIndexBegin: columnIndexBegin,
                        columnIndexEnd: columnIndexEnd,
                        lineIndex: lineIndex,
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