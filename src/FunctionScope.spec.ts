import { FunctionScope } from './FunctionScope';
import { expect } from 'chai';

describe('FunctionScope', () => {
    let scope: FunctionScope;
    beforeEach(() => {
        scope = new FunctionScope(null);
    })
    describe('getVariablesAbove', () => {
        it('returns empty array when there are no variables found', () => {
            let variables = scope.getVariablesAbove(10);
            expect(variables).to.be.lengthOf(0);
        });
    });
});