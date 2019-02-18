import { expect } from 'chai';
import { DynamicType } from './DynamicType';
import { IntegerType } from './IntegerType';

describe('IntegerType', () => {
    it('is equivalent to other integer types', () => {
        expect(new IntegerType().isEquivalentTo(new IntegerType())).to.be.true;
        expect(new IntegerType().isEquivalentTo(new DynamicType())).to.be.true;
    });
});