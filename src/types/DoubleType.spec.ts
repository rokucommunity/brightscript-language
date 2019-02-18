import { expect } from 'chai';
import { DynamicType } from './DynamicType';
import { DoubleType } from './DoubleType';

describe('DoubleType', () => {
    it('is equivalent to double types', () => {
        expect(new DoubleType().isEquivalentTo(new DoubleType())).to.be.true;
        expect(new DoubleType().isEquivalentTo(new DynamicType())).to.be.true;
    });
});