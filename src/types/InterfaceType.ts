import { BrsType } from './BrsType';
import { DynamicType } from './DynamicType';

export class InterfaceType implements BrsType {
    public isAssignableTo(targetType: BrsType) {
        return (
            targetType instanceof InterfaceType ||
            targetType instanceof DynamicType
        );
    }

    public isConvertibleTo(targetType: BrsType) {
        return this.isAssignableTo(targetType);
    }

    public toString() {
        //TODO make this match the actual interface of the object
        return 'interface';
    }

    public clone() {
        //no need to waste memory on a copy, these are all identical
        return this;
    }
}
