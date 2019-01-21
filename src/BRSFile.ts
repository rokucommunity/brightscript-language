import { BRSError, BRSCallable } from './interfaces';
import * as fsExtra from 'fs-extra';
import * as bright from '@roku-road/bright';

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
    private ast;


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
        const { value, lexErrors, tokens, parseErrors } = bright.parse(fileContents, 'Program');
        this.ast = value;
    }

    public getGlobalCallables() {
        let result = [] as BRSCallable[];
        for (let child of this.ast.children.Declaration as any) {
            if (child.name === 'SubDeclaration' || child.name === 'FunctionDeclaration') {
                let identifier = child.children.id[0].children.IDENTIFIER[0];
                result.push({
                    name: identifier.image,
                    lineIndex: identifier.startLine - 1,
                    columnBeginIndex: identifier.startColumn - 1,
                    columnEndIndex: Number.MAX_VALUE,
                    file: this,
                    params: [],
                    type: child.name === 'SubDeclaration' ? 'sub' : 'function'
                });
            }
        }
        return result;
    }
}