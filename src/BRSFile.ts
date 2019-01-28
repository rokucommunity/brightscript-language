import { BRSError, BRSCallable, BRSExpressionCall } from './interfaces';
import * as fsExtra from 'fs-extra';

import * as brs from 'brs';

/**
 * Holds all details about this file within the context of the whole program
 */
export class BRSFile {
    constructor(
        public pathAbsolute: string,
        public pathRelative: string
    ) {

    }

    /**
     * Indicates if this file was processed by the program yet. 
     */
    public wasProcessed = false;

    public errors = [] as BRSError[];

    public callables = [] as BRSCallable[]

    public expressionCalls = [] as BRSExpressionCall[];

    /**
     * The AST for this file
     */
    private ast: brs.parser.Stmt.Statement[];

    public reset() {
        this.wasProcessed = false;
        this.errors = [];
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
        let lexResult = brs.lexer.Lexer.scan(fileContents);

        let parser = new brs.parser.Parser();
        let parseResult = parser.parse(lexResult.tokens);

        this.errors = [...lexResult.errors, ...<any>parseResult.errors];

        this.ast = <any>parseResult.statements;

        //split the text into lines
        let lines = fileContents.split(/\r?\n/);

        //extract all callables from this file
        this.findCallables(lines);

        //find all places where a sub/function is being called
        this.findCallableInvocations(lines);

        this.wasProcessed = true;
    }

    private findCallables(lines: string[]) {


        this.callables = [];
        for (let statement of this.ast as any) {
            if (!statement.func) {
                continue;
            }
            let func = statement as any;
            let functionName = func.name.text;

            let lineIndex = func.name.line - 1;

            //find the column index for this statement
            let line = lines[lineIndex];

            //default to the beginning of the line
            let columnBeginIndex = 0;
            //default to the end of the line
            let columnEndIndex = line.length - 1;

            let match = /^(\s*(?:function|sub)\s+)([\w\d_]*)/i.exec(line);
            if (match) {
                let preceedingText = match[1];
                let lineFunctionName = match[2];
                if (lineFunctionName === functionName) {
                    columnBeginIndex = preceedingText.length
                    columnEndIndex = columnBeginIndex + functionName.length;
                }
            }
            this.callables.push({
                name: functionName,
                lineIndex: lineIndex,
                columnIndexBegin: columnBeginIndex,
                columnIndexEnd: columnEndIndex,
                file: this,
                params: [],
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
                    let expCall: BRSExpressionCall = {
                        file: this,
                        name: functionName,
                        columnIndexBegin: 0,
                        columnIndexEnd: Number.MAX_VALUE,
                        lineIndex: 0,
                        params: []
                    };
                    this.expressionCalls.push(expCall);
                }
            }
        }
    }
}