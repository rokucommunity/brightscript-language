import { expect } from 'chai';
import { StringType } from './StringType';
import { DynamicType } from './DynamicType';

describe('DynamicType', () => {
    it('is equivalent to dynamic types', () => {
        expect(new DynamicType().isAssignableTo(new StringType())).to.be.true;
        expect(new DynamicType().isAssignableTo(new DynamicType())).to.be.true;
    });
});