import { BrsType } from './BrsType';
import { DynamicType } from './DynamicType';

export class VoidType implements BrsType {
    public isEquivalentTo(targetType: BrsType) {
        return (
            targetType instanceof VoidType ||
            targetType instanceof DynamicType
        );
    }

    public isConvertibleTo(targetType: BrsType) {
        return this.isEquivalentTo(targetType);
    }
}