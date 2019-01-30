import { Callable, ExpressionCall, BRSType, Diagnostic, CallableArg, CallableParam } from './interfaces';
import * as fsExtra from 'fs-extra';

import * as brs from 'brs';
import { FILE } from 'dns';
import util from './util';

/**
 * Holds all details about this file within the context of the whole program
 */
export class File {
    constructor(
        public pathAbsolute: string,
        public pathRelative: string
    ) {

    }

    /**
     * Indicates if this file was processed by the program yet. 
     */
    public wasProcessed = false;

    public diagnostics = [] as Diagnostic[];

    public callables = [] as Callable[]

    public expressionCalls = [] as ExpressionCall[];

    /**
     * The AST for this file
     */
    private ast: brs.parser.Stmt.Statement[];

    public reset() {
        this.wasProcessed = false;
        this.diagnostics = [];
        this.callables = [];
        this.expressionCalls = [];
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
            fileContents = (await fsExtra.readFile(this.pathAbsolute)).toString();
        }
        //split the text into lines
        let lines = fileContents.split(/\r?\n/);

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

        this.wasProcessed = true;
    }

    private standardizeLexParseErrors(errors: { message: string, stack: string }[], lines: string[]) {
        let standardizedErrors = [] as Diagnostic[];
        for (let error of errors) {
            //"[Line 267] Expected statement or function call, but received an expression"
            let match = /\[Line (\d+)\]\s*(.*)/.exec(error.message);
            if (match) {
                let lineIndex = parseInt(match[1]) - 1;
                let message = match[2];
                let line = lines[lineIndex];
                standardizedErrors.push({
                    lineIndex: lineIndex,
                    columnIndexBegin: 0,
                    columnIndexEnd: line.length,
                    file: this,
                    message: message,
                    severity: 'error'
                });
            }
        }

        return standardizedErrors;
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

            let returnType = 'object';

            let match = /^(\s*(?:function|sub)\s+)([\w\d_]*)(?:.*)(as\s+.*)*/i.exec(line);
            if (match) {
                let preceedingText = match[1];
                let lineFunctionName = match[2];
                returnType = match[3] ? match[3] : returnType;
                if (lineFunctionName === functionName) {
                    columnBeginIndex = preceedingText.length
                    columnEndIndex = columnBeginIndex + functionName.length;
                }
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
                lineIndex: lineIndex,
                columnIndexBegin: columnBeginIndex,
                columnIndexEnd: columnEndIndex,
                file: this,
                params: params,
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
                    let functionName = bodyStatement.expression.callee.name.text;

                    //filter out non-global function invocations (not currently supported. TODO support it)
                    if (bodyStatement.expression.callee.obj) {
                        continue;
                    }
                    let lineIndex = bodyStatement.expression.callee.name.line - 1;
                    let line = lines[lineIndex];
                    let columnIndexBegin = 0;
                    let columnIndexEnd = line.length;

                    //find the invocation on this line
                    let regexp = new RegExp(`^(.*)${functionName}\s*\()`);
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
                            let callableArg = {
                                type: util.valueKindToString(arg.value.kind),
                                //TODO figure out why value is undefined sometimes
                                text: arg.value.value ? arg.value.value.toString() : ''
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
}