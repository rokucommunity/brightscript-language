import { expect } from 'chai';
import { StringType } from './StringType';
import { DynamicType } from './DynamicType';

describe('DynamicType', () => {
    it('is equivalent to dynamic types', () => {
        expect(new DynamicType().isEquivalentTo(new StringType())).to.be.true;
        expect(new DynamicType().isEquivalentTo(new DynamicType())).to.be.true;
    });
});