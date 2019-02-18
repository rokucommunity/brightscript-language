import { BrsType } from './BrsType';

export class DynamicType implements BrsType {
    public isEquivalentTo(targetType: BrsType) {
        //everything can be dynamic
        return true;
    }

    /**
     * The dynamic type is convertible to everything.
     * @param targetType
     */
    public isConvertibleTo(targetType: BrsType) {
        return true;
    }
}