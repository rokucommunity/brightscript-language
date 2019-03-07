import { BrsType } from './BrsType';
import { DynamicType } from './DynamicType';
import { UninitializedType } from './UninitializedType';

export class InvalidType implements BrsType {
    public isAssignableTo(targetType: BrsType) {
        return (
            targetType instanceof InvalidType ||
            targetType instanceof DynamicType ||
            targetType instanceof UninitializedType
        );
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
