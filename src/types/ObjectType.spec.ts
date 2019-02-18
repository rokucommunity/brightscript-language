import { expect } from 'chai';
import { DynamicType } from './DynamicType';
import { ObjectType } from './ObjectType';

describe('ObjectType', () => {
    it('is equivalent to other object types', () => {
        expect(new ObjectType().isEquivalentTo(new ObjectType())).to.be.true;
        expect(new ObjectType().isEquivalentTo(new DynamicType())).to.be.true;
    });
});