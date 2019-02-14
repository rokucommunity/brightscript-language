export interface BrsType {
    isEquivalentTo(type: BrsType): void;
}

export class BooleanType implements BrsType {
    public isEquivalentTo(type: BrsType) {
        return type instanceof BooleanType;
    }
}

export class IntegerType implements BrsType {

    public isEquivalentTo(type: BrsType) {
        return type instanceof IntegerType;
    }
}

export class LongIntegerType implements BrsType {

    public isEquivalentTo(type: BrsType) {
        return type instanceof LongIntegerType;
    }
}

export class FloatType implements BrsType {
    public isEquivalentTo(type: BrsType) {
        return type instanceof FloatType;
    }
}

export class DoubleType implements BrsType {

    public isEquivalentTo(type: BrsType) {
        return type instanceof FloatType;
    }
}

export class StringType implements BrsType {

    public isEquivalentTo(type: BrsType) {
        return type instanceof StringType;
    }
}

export class ObjectType implements BrsType {
    public isEquivalentTo(type: BrsType) {
        throw new Error('Not implemented');
    }
}

export class FunctionType implements BrsType {
    public isEquivalentTo(type: BrsType) {
        return type instanceof FunctionType;
    }
}

export class InvalidType implements BrsType {
    public isEquivalentTo(type: BrsType) {
        return type instanceof InvalidType;
    }
}

export class DynamicType implements BrsType {
    public isEquivalentTo(type: BrsType) {
        //everything can be dynamic
        return true;
    }
}

export class UninitializedType implements BrsType {
    public isEquivalentTo(type: BrsType) {
        return type instanceof UninitializedType;
    }
}

export class VoidType implements BrsType {
    public isEquivalentTo(type: BrsType) {
        return type instanceof VoidType;
    }
}
