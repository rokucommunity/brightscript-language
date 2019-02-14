import { expect } from 'chai';
import { BooleanType, DynamicType } from './BrsTypes';

describe('BrsTypes', () => {

    describe('BooleanType', () => {
        it('is equal to other boolean types', () => {
            expect(new BooleanType().isEquivalentTo(new BooleanType())).to.be.true;
            expect(new BooleanType().isEquivalentTo(new DynamicType())).to.be.true;
        });
    });
});