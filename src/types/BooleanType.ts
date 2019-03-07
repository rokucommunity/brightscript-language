import { BrsType } from './BrsType';
import { DynamicType } from './DynamicType';
import { UninitializedType } from './UninitializedType';

export class BooleanType implements BrsType {
    public isAssignableTo(targetType: BrsType) {
        return (
            targetType instanceof BooleanType ||
            targetType instanceof DynamicType ||
            targetType instanceof UninitializedType
        );
    }

    public isConvertibleTo(targetType: BrsType) {
        return this.isAssignableTo(targetType);
    }

    public toString() {
        return 'boolean';
    }

    public clone() {
        //no need to waste memory on a copy, these are all identical
        return this;
    }
}
