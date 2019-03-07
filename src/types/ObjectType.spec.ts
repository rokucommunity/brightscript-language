import { expect } from 'chai';

import { BooleanType } from './BooleanType';
import { DynamicType } from './DynamicType';
import { ObjectType } from './ObjectType';
import { StringType } from './StringType';

describe('ObjectType', () => {
    it('is equivalent to other object types', () => {
        expect(new ObjectType().isAssignableTo(new ObjectType())).to.be.true;
        expect(new ObjectType().isAssignableTo(new DynamicType())).to.be.true;
    });

    describe('custom objects', () => {
        it('matches objects with same properties', () => {
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

        it('matches objects with same deep object properties', () => {
            let jobType = new ObjectType();
            jobType.addProperty('name', new StringType());
            jobType.addProperty('city', new StringType());

            let personType = new ObjectType();
            personType.addProperty('job', jobType);

            let alienType = new ObjectType();
            alienType.addProperty('job', jobType);
            alienType.addProperty('hasThreeEyes', new BooleanType());

            //person and alien both have the same 'job' structure, so alien can be used as person
            expect(alienType.isAssignableTo(personType)).to.be.true;
            //person does not have 3 eyes, so it cannot be used as alien
            expect(personType.isAssignableTo(alienType)).to.be.false;
        });

        it('handles deep object same-like properties', () => {
            let personJobType = new ObjectType();
            personJobType.addProperty('name', new StringType());

            let personType = new ObjectType();
            personType.addProperty('job', personJobType);

            let alienJobType = new ObjectType();
            alienJobType.addProperty('name', new StringType());
            alienJobType.addProperty('planet', new StringType());

            let alienType = new ObjectType();
            alienType.addProperty('job', alienJobType);

            //person and alien jobs both share name, so alien can be used as person
            expect(alienType.isAssignableTo(personType)).to.be.true;
            //person's job does not have 'planet', so person cannot be used as alien
            expect(personType.isAssignableTo(alienType)).to.be.false;
        });
    });
});
