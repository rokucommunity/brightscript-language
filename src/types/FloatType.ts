import { BrsType } from './BrsType';
import { DynamicType } from './DynamicType';
import { IntegerType } from './IntegerType';
import { DoubleType } from './DoubleType';
import { LongIntegerType } from './LongIntegerType';

export class FloatType implements BrsType {
    public isAssignableTo(targetType: BrsType) {
        return (
            targetType instanceof FloatType ||
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
        return 'float';
    }
}