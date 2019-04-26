import * as brs from 'brs';
const Lexeme = brs.lexer.Lexeme;
import * as path from 'path';
import { CompletionItem, CompletionItemKind, Hover, Position, Range } from 'vscode-languageserver';

import { Context } from '../Context';
import { diagnosticCodes, diagnosticMessages } from '../DiagnosticMessages';
import { FunctionScope } from '../FunctionScope';
import { Assignment, Callable, CallableArg, CallableParam, CommentFlag, Diagnostic, FunctionCall } from '../interfaces';
import { Program } from '../Program';
import { ArrayType } from '../types/ArrayType';
import { BooleanType } from '../types/BooleanType';
import { BrsType } from '../types/BrsType';
import { DoubleType } from '../types/DoubleType';
import { DynamicType } from '../types/DynamicType';
import { FloatType } from '../types/FloatType';
import { FunctionType } from '../types/FunctionType';
import { IntegerType } from '../types/IntegerType';
import { InvalidType } from '../types/InvalidType';
import { LongIntegerType } from '../types/LongIntegerType';
import { ObjectType } from '../types/ObjectType';
import { StringType } from '../types/StringType';
import { UninitializedType } from '../types/UninitializedType';
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

    public commentFlags = [] as CommentFlag[];

    public callables = [] as Callable[];

    public functionCalls = [] as FunctionCall[];

    public functionScopes = [] as FunctionScope[];

    /**
     * The AST for this file
     */
    private ast: brs.parser.Stmt.Statement[];
    /**
     * An array of the lines of the file.
     * TODO - find a way to NOT need this because it uses extra ram
     */
    private lines: string[];
    private tokens = [] as brs.lexer.Token[];

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
     */
    public async parse(fileContents: string) {
        if (this.wasProcessed) {
            throw new Error(`File was already processed. Create a new file instead. ${this.pathAbsolute}`);
        }

        //split the text into lines
        this.lines = util.getLines(fileContents);

        this.getIgnores(this.lines);

        let lexResult = brs.lexer.Lexer.scan(fileContents);

        this.tokens = lexResult.tokens;

        let parser = new brs.parser.Parser();
        let parseResult = parser.parse(lexResult.tokens);

        let errors = [...lexResult.errors, ...<any>parseResult.errors];

        //convert the brs library's errors into our format
        this.diagnostics.push(...this.standardizeLexParseErrors(errors, this.lines));

        this.ast = <any>parseResult.statements;

        //extract all callables from this file
        this.findCallables(this.lines);

        //traverse the ast and find all functions and create a scope object
        this.createFunctionScopes(this.lines, this.ast);

        //find all places where a sub/function is being called
        this.findFunctionCalls(this.lines);

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

    /**
     * Find all comment flags in the source code. These enable or disable diagnostic messages.
     * @param lines - the lines of the program
     */
    public getIgnores(lines: string[]) {
        let allCodesExcept1014 = diagnosticCodes.filter((x) => x !== diagnosticMessages.Unknown_diagnostic_code_1014(0).code);
        this.commentFlags = [];
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            let line = lines[lineIndex];
            let nextLineLength = lines[lineIndex + 1] ? lines[lineIndex + 1].length : Number.MAX_SAFE_INTEGER;

            //brs:disable-next-line and brs:disable-line
            {
                let searches = [{
                    text: `'brs:disable-next-line`,
                    lineOffset: 1,
                    getAffectedRange: () => {
                        return Range.create(lineIndex + 1, 0, lineIndex + 1, nextLineLength);
                    }
                }, {
                    text: `'brs:disable-line`,
                    lineOffset: 0,
                    getAffectedRange: (idx: number) => {
                        return Range.create(lineIndex, 0, lineIndex, idx);
                    }
                }];

                for (let search of searches) {
                    //find the disable-next-line
                    let idx = line.indexOf(search.text);
                    if (idx > -1) {
                        let affectedRange = search.getAffectedRange(idx);
                        let stmt = line.substring(idx).trim();
                        stmt = stmt.replace(search.text, '');
                        stmt = stmt.trim();

                        let commentFlag: CommentFlag;

                        //statement to disable EVERYTHING
                        if (stmt.length === 0) {
                            commentFlag = {
                                file: this,
                                //null means all codes
                                codes: null,
                                range: Range.create(lineIndex, idx, lineIndex, idx + search.text.length),
                                affectedRange: affectedRange
                            };

                            //disable specific rules on the next line
                        } else if (stmt.indexOf(':') === 0) {
                            stmt = stmt.replace(':', '');
                            let codes = [] as number[];
                            //starting position + search.text length + 1 for the colon
                            let offset = idx + search.text.length + 1;
                            let codeTokens = util.tokenizeByWhitespace(stmt);
                            for (let codeToken of codeTokens) {
                                let codeInt = parseInt(codeToken.text);
                                //add a warning for unknown codes
                                if (diagnosticCodes.indexOf(codeInt) === -1) {
                                    this.diagnostics.push({
                                        ...diagnosticMessages.Unknown_diagnostic_code_1014(codeInt),
                                        file: this,
                                        location: Range.create(lineIndex, offset + codeToken.startIndex, lineIndex, offset + codeToken.startIndex + codeToken.text.length),
                                        severity: 'warning'
                                    });
                                } else {
                                    codes.push(codeInt);
                                }
                            }
                            if (codes.length > 0) {
                                commentFlag = {
                                    file: this,
                                    codes: codes,
                                    range: Range.create(lineIndex, idx, lineIndex, line.length),
                                    affectedRange: affectedRange,
                                };
                            }
                        }

                        if (commentFlag) {
                            this.commentFlags.push(commentFlag);

                            //add an ignore for everything in this comment except for Unknown_diagnostic_code_1014
                            this.commentFlags.push({
                                affectedRange: commentFlag.range,
                                range: commentFlag.range,
                                codes: allCodesExcept1014,
                                file: this
                            });
                        }
                    }
                }
            }
        }
    }

    public scopesByFunc = new Map<brs.parser.Expr.Function, FunctionScope>();

    /**
     * Create a scope for every function in this file
     */
    private createFunctionScopes(lines: string[], statements: any, parent?: FunctionScope) {
        //find every function
        let functions = util.findAllDeep<brs.parser.Expr.Function>(this.ast, (x) => x instanceof brs.parser.Expr.Function);
        let nameListByScope = new Map<FunctionScope, NameList<Assignment>>();

        //create a functionScope for every function
        for (let kvp of functions) {
            let func = kvp.value;
            let scope = new FunctionScope(func);

            //keeps track of assignments for this function
            let nameList = new NameList<Assignment>();
            nameListByScope.set(scope, nameList);

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
            scope.range = Range.create(
                func.keyword.location.start.line - 1,
                func.keyword.location.start.column,
                func.end.location.end.line - 1,
                func.end.location.end.column
            );

            //add every parameter
            for (let param of func.parameters) {
                let callableParam = {
                    nameRange: util.locationToRange(param.name.location),
                    isOptional: !!param.defaultValue,
                    name: param.name.text,
                    //TODO which is it? `type` or `kind`?
                    type: util.valueKindToBrsType(param.type.kind)
                } as CallableParam;

                scope.parameters.push(callableParam);

                let assignment = {
                    currentType: new UninitializedType(),
                    incomingType: callableParam.type,
                    nameRange: callableParam.nameRange,
                    name: callableParam.name
                } as Assignment;

                //TODO - should we detect duplicate parameter names here, or does `brs` already do that?
                nameList.add(assignment);
                scope.assignments.push(assignment);
            }
            //variable assignments will be handled outside of the loop

            this.scopesByFunc.set(func, scope);

            //find every statement in the scope
            this.functionScopes.push(scope);
        }
        this.setAssignmentsForFunctionScopes(nameListByScope);
    }

    private setAssignmentsForFunctionScopes(nameListByScope: Map<FunctionScope, NameList<Assignment>>) {

        //keep track of every variable so we know which assignemnts are the "initialization" and which ones are "set new value"

        //find every variable assignment in the whole file
        let assignmentStatements = util.findAllDeep<brs.parser.Stmt.Assignment>(this.ast, (x) => x instanceof brs.parser.Stmt.Assignment);

        for (let kvp of assignmentStatements) {
            let statement = kvp.value;
            let nameRange = util.locationToRange(statement.name.location);

            //find this statement's function scope
            let scope = this.getFunctionScopeAtPosition(nameRange.start);

            //skip variable declarations that are outside of any scope
            if (!scope) {
                continue;
            }
            let nameList = nameListByScope.get(scope);

            let previous: Assignment;
            //when in strict mode, the variable's FIRST assignment is enforced throughout all assignments
            if (this.program.options.strictTypeChecking) {
                previous = nameList.getFirst(statement.name.text);
            } else {
                //in non-strict mode, the type is fluid
                previous = nameList.getLast(statement.name.text);
            }
            //incoming type should be set to uninitialized when this is the first assignment
            let incomingType = previous ? previous.incomingType : new UninitializedType();
            let incomingBslType = this.assignmentToBrsType(statement, scope);
            //any variables initialized as "invalid" should be given type "dynamic"
            incomingBslType = incomingBslType instanceof InvalidType ? new DynamicType() : incomingBslType;

            let assignment = {
                nameRange: util.locationToRange(statement.name.location),
                lineIndex: statement.name.location.start.line - 1,
                name: statement.name.text,
                currentType: incomingType,
                incomingType: incomingBslType
            } as Assignment;

            //only do type checking in strict mode
            if (this.program.options.strictTypeChecking) {
                if (assignment.incomingType.isAssignableTo(assignment.currentType) === false) {
                    this.diagnostics.push({
                        ...diagnosticMessages.Type_a_is_not_assignable_to_type_b_1016(
                            assignment.incomingType.toString(),
                            assignment.currentType.toString()
                        ),
                        file: this,
                        location: assignment.nameRange,
                        severity: 'error'
                    });
                }
            }

            scope.assignments.push(assignment);
            nameList.add(assignment);
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

    private assignmentToBrsType(assignment: brs.parser.Stmt.Assignment, scope: FunctionScope): BrsType {
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

                //inline object literal
            } else if (assignment.value instanceof brs.parser.Expr.AALiteral) {
                return this.aaLiteralToBslType(assignment.value, scope);

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
                return variable.incomingType;
            }
        } catch (e) {
            //do nothing. Just return dynamic
        }
        //fallback to dynamic
        return new DynamicType();
    }

    private expressionToBslType(expression: brs.parser.Expr.Expression, scope: FunctionScope): BrsType {
        if (expression instanceof brs.parser.Expr.AALiteral) {
            return this.aaLiteralToBslType(expression, scope);
            //TODO figure out what types are contained in the array
        } else if (expression instanceof brs.parser.Expr.ArrayLiteral) {
            return new ArrayType([new DynamicType()]);
        } else if (expression instanceof brs.parser.Expr.Literal) {
            if (expression.value instanceof brs.types.BrsInvalid) {
                return new InvalidType();
            } else if (expression.value instanceof brs.types.BrsBoolean) {
                return new BooleanType();
            } else if (expression.value instanceof brs.types.BrsString) {
                return new StringType();
            } else if (expression.value instanceof brs.types.Int32) {
                return new IntegerType();
            } else if (expression.value instanceof brs.types.Int64) {
                return new LongIntegerType();
            } else if (expression.value instanceof brs.types.Float) {
                return new FloatType();
            } else if (expression.value instanceof brs.types.Double) {
                return new DoubleType();
            } else {
                //what else could it be?
            }
        } else if (expression instanceof brs.parser.Expr.Function) {
            //TODO - determine the return type of the function itself
            return new FunctionType(new DynamicType());
        }
        //return dynamic when we don't know what type it is
        return new DynamicType();
    }

    private aaLiteralToBslType(value: brs.parser.Expr.AALiteral, scope: FunctionScope) {
        let result = new ObjectType();
        for (let prop of value.elements) {
            let propType = this.expressionToBslType(prop.value, scope);
            result.addProperty(prop.name.value, propType);
        }
        return result;
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
                    isRestArgument: false,
                    nameRange: util.locationToRange(param.name.location)
                } as CallableParam;
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
                    let functionCall: FunctionCall = {
                        range: util.brsRangeFromPositions(expression.location.start, expression.closingParen.location.end),
                        functionScope: this.getFunctionScopeAtPosition(Position.create(calleeRange.start.line, calleeRange.start.character)),
                        file: this,
                        name: functionName,
                        nameRange: Range.create(calleeRange.start.line, columnIndexBegin, calleeRange.start.line, columnIndexEnd),
                        //TODO keep track of parameters
                        args: args
                    };
                    this.functionCalls.push(functionCall);
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
            if (util.rangeContains(scope.range, position)) {
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
        let result = {
            completions: [] as CompletionItem[],
            includeContextCallables: true,
        };

        //determine if cursor is inside a function
        let functionScope = this.getFunctionScopeAtPosition(position);
        if (!functionScope) {
            result.includeContextCallables = false;
            //we aren't in any function scope, so just return an empty list
            return result;
        }

        //if cursor is directly to the right of a period (ignoring whitespace), we should show object property results
        let line = this.lines[position.line];
        if (util.isToRightOfPeriod(position.character, line)) {
            //get the full variable name being referenced (like `person` or `person.name` or `person.child.name`)
            let variableReferenceParts = util.getVariableReferenceParts(position.character, line);

            //find the variable with the first part's name
            let variable = functionScope.getVariableByName(variableReferenceParts[0]);

            result.includeContextCallables = false;
            //add all of the variable's properties
            if (variable.incomingType instanceof ObjectType) {
                let theType = variable.incomingType;
                //if we have more reference parts, walk through the variable chain until we get to the desired prop type
                for (let i = 1; i < variableReferenceParts.length; i++) {
                    if (theType instanceof ObjectType) {
                        let prop = theType.getProperty(variableReferenceParts[i]);
                        if (prop.type instanceof ObjectType) {
                            theType = prop.type;
                        } else {
                            //the object property is not an object itself...so we cannot continue
                            return result;
                        }
                    } else {
                        return result;
                        // the object property is not an object itself...so we can't continue anymore
                    }
                }
                for (let prop of theType.properties) {
                    result.completions.push({
                        label: prop.name,
                        kind: prop.type instanceof FunctionType ? CompletionItemKind.Method : CompletionItemKind.Field
                    });
                }
            }

            //TODO handle complex scenarios (for now just handle objects with exact names (no array access or string keys)

            //get all in-scope completions
        } else {

            //TODO: if cursor is within a comment, disable completions
            let variables = functionScope.assignments;
            for (let variable of variables) {
                result.completions.push({
                    label: variable.name,
                    kind: variable.incomingType instanceof FunctionType ? CompletionItemKind.Function : CompletionItemKind.Variable
                });
            }
        }
        return result;
    }

    public getHover(position: Position): Hover {
        //get the token at the position
        let token = this.getTokenAt(position);

        let hoverTokenTypes = [
            Lexeme.Identifier,
            Lexeme.Function,
            Lexeme.EndFunction,
            Lexeme.Sub,
            Lexeme.EndSub
        ];

        //throw out invalid tokens and the wrong kind of tokens
        if (!token || hoverTokenTypes.indexOf(token.kind) === -1) {
            return null;
        }

        let lowerTokenText = token.text.toLowerCase();

        //look through local variables first
        {
            //get the function scope for this position (if exists)
            let functionScope = this.getFunctionScopeAtPosition(position);
            if (functionScope) {

                //find any variable with this name
                for (let variable of functionScope.assignments) {
                    //we found a variable declaration with this token text!
                    if (variable.name.toLowerCase() === lowerTokenText) {
                        let typeText: string;
                        if (variable.incomingType instanceof FunctionType) {
                            typeText = variable.incomingType.toString();
                        } else {
                            typeText = `${variable.name} as ${variable.incomingType.toString()}`;
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

class NameList<T extends { name: string }> {
    public data = {} as { [lowerName: string]: T[] };
    public add(value: T) {
        let lowerName = value.name.toLowerCase();
        if (!this.data[lowerName]) {
            this.data[lowerName] = [];
        }
        this.data[lowerName].push(value);
    }

    public getLast(name: string) {
        let lowerName = name.toLowerCase();
        let list = this.data[lowerName];
        return list && list.length > 0 ? list[list.length - 1] : undefined;
    }

    public getFirst(name: string) {
        let lowerName = name.toLowerCase();
        let list = this.data[lowerName];
        return list && list.length > 0 ? list[0] : undefined;
    }
}
