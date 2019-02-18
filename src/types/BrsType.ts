export interface BrsType {
    isEquivalentTo(targetType: BrsType): boolean;
    isConvertibleTo(targetType: BrsType): boolean;
}
