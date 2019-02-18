import { BrsType } from './BrsType';
import { DynamicType } from './DynamicType';

export class FunctionType implements BrsType {
    constructor(
        public paramTypes: BrsType[],
        public returnType: BrsType
    ) {

    }
    public isEquivalentTo(targetType: BrsType) {
        if (targetType instanceof DynamicType) {
            return true;
        } else if (targetType instanceof FunctionType) {
            //compare all parameters
            var len = Math.max(this.paramTypes.length, targetType.paramTypes.length);
            for (let i = 0; i < len; i++) {
                let myParam = this.paramTypes[i];
                let targetParam = targetType.paramTypes[i];
                if (!myParam || !targetParam || !myParam.isEquivalentTo(targetParam)) {
                    return false;
                }
            }

            //compare return type
            if (!this.returnType || !targetType.returnType || !this.returnType.isEquivalentTo(targetType.returnType)) {
                return false;
            }

            //made it here, all params and return type are equivalent
            return true;
        } else {
            return false;
        }
    }

    public isConvertibleTo(targetType: BrsType) {
        return this.isEquivalentTo(targetType);
    }
}
