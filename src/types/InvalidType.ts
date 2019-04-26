import { BrsType } from './BrsType';

export class InvalidType implements BrsType {
    public isAssignableTo(targetType: BrsType) {
        //everything can be set to invalid
        return true;
    }

    public isConvertibleTo(targetType: BrsType) {
        return this.isAssignableTo(targetType);
    }

    public toString() {
        return 'invalid';
    }

    public clone() {
        //no need to waste memory on a copy, these are all identical
        return this;
    }
}
