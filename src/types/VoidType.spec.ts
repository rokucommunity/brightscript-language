import { expect } from 'chai';
import { DynamicType } from './DynamicType';
import { VoidType } from './VoidType';

describe('VoidType', () => {
    it('is equivalent to dynamic types', () => {
        expect(new VoidType().isEquivalentTo(new VoidType())).to.be.true;
        expect(new VoidType().isEquivalentTo(new DynamicType())).to.be.true;
    });
});