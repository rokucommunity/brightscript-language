import { VariableDeclaration } from './interfaces';
import { Range } from 'vscode-languageserver';
import * as brs from 'brs';

export class FunctionScope {
    constructor(
        public func: brs.parser.Expr.Function
    ) {

    }

    /**
     * The range that the body of this scope covers
     */
    public bodyRange: Range;

    public childrenScopes = [] as FunctionScope[];
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
                break;
            }
        }
        return results;
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