import { BrsType } from './BrsType';
import { DoubleType } from './DoubleType';
import { DynamicType } from './DynamicType';
import { FloatType } from './FloatType';
import { LongIntegerType } from './LongIntegerType';
import { UninitializedType } from './UninitializedType';

export class IntegerType implements BrsType {
    public isAssignableTo(targetType: BrsType) {
        return (
            targetType instanceof IntegerType ||
            targetType instanceof DynamicType ||
            targetType instanceof UninitializedType
        );
    }

    public isConvertibleTo(targetType: BrsType) {
        if (
            targetType instanceof DynamicType ||
            targetType instanceof UninitializedType ||
            targetType instanceof IntegerType ||
            targetType instanceof FloatType ||
            targetType instanceof DoubleType ||
            targetType instanceof LongIntegerType
        ) {
            return true;
        } else {
            return false;
        }
    }

    public toString() {
        return 'integer';
    }

    public clone() {
        //no need to waste memory on a copy, these are all identical
        return this;
    }
}
