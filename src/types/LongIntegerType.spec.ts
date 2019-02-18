import { expect } from 'chai';
import { DynamicType } from './DynamicType';
import { LongIntegerType } from './LongIntegerType';

describe('LongIntegerType', () => {
    it('is equivalent to other long integer types', () => {
        expect(new LongIntegerType().isEquivalentTo(new LongIntegerType())).to.be.true;
        expect(new LongIntegerType().isEquivalentTo(new DynamicType())).to.be.true;
    });
});