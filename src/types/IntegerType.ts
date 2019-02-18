import { BrsType } from './BrsType';
import { DynamicType } from './DynamicType';
import { FloatType } from './FloatType';
import { DoubleType } from './DoubleType';
import { LongIntegerType } from './LongIntegerType';

export class IntegerType implements BrsType {
    public isAssignableTo(targetType: BrsType) {
        return (
            targetType instanceof IntegerType ||
            targetType instanceof DynamicType
        );
    }

    public isConvertibleTo(targetType: BrsType) {
        if (
            targetType instanceof DynamicType ||
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
}