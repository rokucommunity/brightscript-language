import { expect } from 'chai';
import { DynamicType } from './DynamicType';
import { InvalidType } from './InvalidType';

describe('InvalidType', () => {
    it('is equivalent to invalid types', () => {
        expect(new InvalidType().isEquivalentTo(new InvalidType())).to.be.true;
        expect(new InvalidType().isEquivalentTo(new DynamicType())).to.be.true;
    });
});