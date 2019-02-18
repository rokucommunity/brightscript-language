import { expect } from 'chai';
import { DynamicType } from './DynamicType';
import { FloatType } from './FloatType';

describe('FloatType', () => {
    it('is equivalent to double types', () => {
        expect(new FloatType().isEquivalentTo(new FloatType())).to.be.true;
        expect(new FloatType().isEquivalentTo(new DynamicType())).to.be.true;
    });
});