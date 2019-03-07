import { BrsType } from './BrsType';

export class UninitializedType implements BrsType {
    public isAssignableTo(targetType: BrsType) {
        //this type is never assignable to anything
        return false;
    }

    public isConvertibleTo(targetType: BrsType) {
        return this.isAssignableTo(targetType);
    }

    public toString() {
        return 'uninitialized';
    }
    public clone() {
        //no need to waste memory on a copy, these are all identical
        return this;
    }
}
