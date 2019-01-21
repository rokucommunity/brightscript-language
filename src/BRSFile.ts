import { BRSError, BRSCallable } from './interfaces';
import { Lexer, Parser } from 'brs';
import * as fsExtra from 'fs-extra';

/**
 * Holds all details about this file within the context of the whole program
 */
export class BRSFile {
    constructor(
        public filePath: string
    ) {

    }

    /**
     * Indicates if this file was processed by the program yet. 
     */
    public wasProcessed = false;

    public errors: BRSError[] = [];

    /**
     * The AST for this file
     */
    private ast: Parser.Stmt.Statement[];


    /**
     * Calculate the AST for this file
     * @param fileContents 
     */
    public async parse(fileContents?: string) {
        //reset the parsed status since we are reloading the file
        this.wasProcessed = false;

        //load from disk if file contents are not provided
        if (!fileContents) {
            fileContents = (await fsExtra.readFile(this.filePath)).toString();
        }
        let tokens = Lexer.scan(fileContents);
        this.ast = Parser.parse(tokens);
    }

    public getGlobalCallables() {
        let result = [] as BRSCallable[];
        for (let statement of this.ast as any) {
            if (statement.func) {
                let func = statement as ParserFunction;
                result.push({
                    name: func.name.text,
                    lineIndex: func.name.line,
                    columnBeginIndex: 1,
                    columnEndIndex: Number.MAX_VALUE,
                    file: this,
                    params: [],
                    type: 'function'
                });
            }
        }
        return result;
    }
}