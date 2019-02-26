import { expect } from 'chai';

import { DynamicType } from './DynamicType';
import { ObjectType } from './ObjectType';
import { StringType } from './StringType';

describe('ObjectType', () => {
    it('is equivalent to other object types', () => {
        expect(new ObjectType().isAssignableTo(new ObjectType())).to.be.true;
        expect(new ObjectType().isAssignableTo(new DynamicType())).to.be.true;
    });

    describe('custom objects', () => {
        it.only('matches objects with same properties', () => {
            let personType = new ObjectType();
            personType.addProperty('name', new StringType());

            let dogType = new ObjectType();
            dogType.addProperty('name', new StringType());
            dogType.addProperty('breed', new StringType());

            //person and dog both have "name", so dog can be used as person
            expect(dogType.isAssignableTo(personType)).to.be.true;
            //person does not have breed, so it cannot be used as dog
            expect(personType.isAssignableTo(dogType)).to.be.false;
        });
    });
});
