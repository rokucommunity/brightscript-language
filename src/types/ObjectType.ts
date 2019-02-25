import { BrsType } from './BrsType';
import { DynamicType } from './DynamicType';

export class ObjectType implements BrsType {
    /**
     * The list of properties for this object
     */
    public properties = [] as { name: string; type: BrsType }[];

    /**
     * Add a property to this object
     * @param name 
     * @param type 
     */
    public addProperty(name: string, type: BrsType) {
        this.properties.push({
            name: name,
            type: type
        })
    }

    /**
     * Get the property with the specified name, or undefined if not found
     * @param name 
     */
    public getProperty(name: string) {
        for (let prop of this.properties) {
            if (prop.name === name) {
                return prop;
            }
        }
    }

    public isAssignableTo(targetType: BrsType) {
        if (targetType instanceof DynamicType) {
            return true;
        } else if (targetType instanceof ObjectType) {
            //the target must have all properties that this object has
            for (let prop of this.properties) {
                let targetProp = targetType.getProperty(prop.name);

                //the target does not have this property
                if (!targetProp) {
                    return false;
                }

                //if the types are not same-like
                if (targetProp.type.isAssignableTo(prop.type) === false) {
                    return false;
                }
            }
            //there were no issues with the type comparison, the objects are same-like
            return true;
        } else {
            return false;
        }
    }

    public isConvertibleTo(targetType: BrsType) {
        return this.isAssignableTo(targetType);
    }

    public toString() {
        return 'object';
    }
}