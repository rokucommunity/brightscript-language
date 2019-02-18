import { expect } from 'chai';
import { DynamicType } from './DynamicType';
import { FunctionType } from './FunctionType';
import { VoidType } from './VoidType';
import { IntegerType } from './IntegerType';
import { StringType } from './StringType';

describe('FunctionType', () => {
    it('is equivalent to dynamic type', () => {
        expect(new FunctionType([], new VoidType()).isEquivalentTo(new DynamicType())).to.be.true;
    });

    it('validates using param and return types', () => {
        expect(new FunctionType([], new VoidType()).isEquivalentTo(new FunctionType([], new VoidType()))).to.be.true;
        //different parameter count
        expect(new FunctionType([new IntegerType()], new VoidType()).isEquivalentTo(new FunctionType([], new VoidType()))).to.be.false;
        //different parameter types
        expect(new FunctionType([new IntegerType()], new VoidType()).isEquivalentTo(new FunctionType([new StringType()], new VoidType()))).to.be.false;
        //different return type
        expect(new FunctionType([], new VoidType()).isEquivalentTo(new FunctionType([], new IntegerType()))).to.be.false;
    });
});