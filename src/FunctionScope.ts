import { VariableDeclaration } from './interfaces';
import { Context } from './Context';

export class FunctionScope {
    constructor(
        /**
         * Should be falsey for top-level functions
         */
        public parentScope?: FunctionScope
    ) {

    }
    public variableDeclarations = [] as VariableDeclaration[];

    /**
     * Find all variable declarations above the given line index
     * @param lineIndex 
     */
    public getVariablesAbove(lineIndex: number) {
        let results = [] as VariableDeclaration[];
        for (let variableDeclaration of this.variableDeclarations) {
            if (variableDeclaration.lineIndex < lineIndex) {
                results.push(variableDeclaration);
            } else {
                return results;
            }
        }
    }

    public getVariableByName(name: string) {
        name = name.toLowerCase();
        for (let variableDeclaration of this.variableDeclarations) {
            if (variableDeclaration.name.toLowerCase() === name) {
                return variableDeclaration;
            }
        }
    }

}