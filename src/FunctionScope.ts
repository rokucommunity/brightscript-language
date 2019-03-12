import * as brs from 'brs';
import { Range } from 'vscode-languageserver';

import { Assignment, CallableParam } from './interfaces';

export class FunctionScope {
    constructor(
        public func: brs.parser.Expr.Function
    ) {

    }

    /**
     * The range that the body of this scope covers
     */
    public bodyRange: Range;

    /**
     * The full range of this function. Starts at the position of the `f` in function or `s` in sub,
     * and ends after the final `n` in `end function` or `b` in end sub.
     */
    public range: Range;

    /**
     * The scopes that are children of this scope
     */
    public childrenScopes = [] as FunctionScope[];
    /**
     * The parent scope of this scope
     */
    public parentScope: FunctionScope;
    public parameters = [] as CallableParam[];
    public assignments = [] as Assignment[];

    /**
     * Find all variable declarations above the given line index
     * @param lineIndex
     */
    public getVariablesAbove(lineIndex: number) {
        let results = [] as Assignment[];
        for (let variable of this.assignments) {
            if (variable.nameRange.start.line < lineIndex) {
                results.push(variable);
            } else {
                break;
            }
        }
        return results;
    }

    public getVariableByName(name: string) {
        name = name.toLowerCase();
        for (let variableDeclaration of this.assignments) {
            if (variableDeclaration.name.toLowerCase() === name) {
                return variableDeclaration;
            }
        }
    }

}
