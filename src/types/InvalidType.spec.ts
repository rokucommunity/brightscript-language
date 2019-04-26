import { expect } from 'chai';

import { DynamicType } from './DynamicType';
import { InvalidType } from './InvalidType';
import { StringType } from './StringType';

describe('InvalidType', () => {
    it('is equivalent to invalid types', () => {
        expect(new InvalidType().isAssignableTo(new InvalidType())).to.be.true;
        expect(new InvalidType().isAssignableTo(new DynamicType())).to.be.true;
    });

    it('can be assigned to every data type', () => {
        const typ = new InvalidType();
        expect(typ.isAssignableTo(new StringType())).to.be.true;
    });
});
