import { BrsType } from './BrsType';
import { DynamicType } from './DynamicType';
import { UninitializedType } from './UninitializedType';

export class ObjectType implements BrsType {
    /**
     * The list of properties for this object
     */
    public properties = [] as Array<{ name: string; type: BrsType }>;

    /**
     * Add a property to this object
     * @param name
     * @param type
     */
    public addProperty(name: string, type: BrsType) {
        this.properties.push({
            name: name,
            type: type
        });
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
        if (targetType instanceof DynamicType || targetType instanceof UninitializedType) {
            return true;
        } else if (targetType instanceof ObjectType) {
            //this object must have all the properties that the target has
            for (let targetProp of targetType.properties) {
                let thisProp = this.getProperty(targetProp.name);

                //this doesn't have the desired property from target
                if (!thisProp) {
                    return false;
                }

                //if the types are not same-like, fail
                if (thisProp.type.isAssignableTo(targetProp.type) === false) {
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
        let typeString = '{';
        let semicolon = '';
        for (let prop of this.properties) {
            typeString += `"${prop.name}": ${prop.type.toString()}${semicolon}`;
            semicolon = '; ';
        }
        return typeString + '}';
    }

    public clone(): BrsType {
        let theClone = new ObjectType();
        for (let prop of this.properties) {
            theClone.addProperty(prop.name, prop.type.clone());
        }
        return theClone;
    }
}
