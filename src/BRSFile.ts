import { BRSError, BRSCallable, BRSExpressionCall } from './interfaces';
import * as fsExtra from 'fs-extra';
import { makeFilesAbsolute } from 'roku-deploy';

import * as brs from 'brs';
import { BRSContext } from './BRSContext';
import { EventEmitter } from 'events';

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

        //extract all callables from this file
        this.findCallables();

        //find all places where a sub/function is being called
        this.findCallableInvocations();

        this.wasProcessed = true;
    }

    private findCallables() {
        this.callables = [];
        for (let statement of this.ast as any) {
            if (!statement.func) {
                continue;
            }
            let func = statement as any;
            this.callables.push({
                name: func.name.text,
                lineIndex: func.name.line - 1,
                columnBeginIndex: 0,
                columnEndIndex: Number.MAX_VALUE,
                file: this,
                params: [],
                type: 'function'
            });
        }
    }

    private findCallableInvocations() {
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
                        columnBeginIndex: 0,
                        columnEndIndex: Number.MAX_VALUE,
                        lineIndex: 0,
                        params: []
                    };
                    this.expressionCalls.push(expCall);
                }
            }
        }
    }
}