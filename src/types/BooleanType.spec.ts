import { expect } from 'chai';
import { BooleanType } from './BooleanType';
import { DynamicType } from './DynamicType';

describe('BooleanType', () => {
    it('is equivalent to boolean types', () => {
        expect(new BooleanType().isEquivalentTo(new BooleanType())).to.be.true;
        expect(new BooleanType().isEquivalentTo(new DynamicType())).to.be.true;
    });
});