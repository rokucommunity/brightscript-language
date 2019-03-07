import { BrsType } from './BrsType';
import { DynamicType } from './DynamicType';
import { FloatType } from './FloatType';
import { IntegerType } from './IntegerType';
import { LongIntegerType } from './LongIntegerType';
import { UninitializedType } from './UninitializedType';

export class DoubleType implements BrsType {
    public isAssignableTo(targetType: BrsType) {
        return (
            targetType instanceof DoubleType ||
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
        return 'double';
    }

    public clone() {
        //no need to waste memory on a copy, these are all identical
        return this;
    }
}
