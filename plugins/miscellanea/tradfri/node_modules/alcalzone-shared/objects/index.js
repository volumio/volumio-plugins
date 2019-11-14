"use strict";
/** @module objects */
Object.defineProperty(exports, "__esModule", { value: true });
/** Provides a polyfill for Object.entries */
function entries(obj) {
    return Object.keys(obj)
        .map(key => [key, obj[key]]);
}
exports.entries = entries;
/** Provides a polyfill for Object.values */
function values(obj) {
    return Object.keys(obj)
        .map(key => obj[key]);
}
exports.values = values;
/**
 * Returns a subset of an object, whose properties match the given predicate
 * @param obj The object whose properties should be filtered
 * @param predicate A predicate function which is applied to the object's properties
 */
function filter(obj, predicate) {
    return composeObject(entries(obj).filter(([key, value]) => predicate(value, key)));
}
exports.filter = filter;
/**
 * Combines multiple key value pairs into an object
 * @param properties The key value pairs to combine into an object
 */
function composeObject(properties) {
    return properties.reduce((acc, [key, value]) => {
        acc[key] = value;
        return acc;
    }, {});
}
exports.composeObject = composeObject;
/**
 * Deep merges multiple objects onto the target object.
 * This modifies the target object, so pass undefined or {}
 * to create a new object.
 */
function extend(target, 
// tslint:disable-next-line:trailing-comma
...sources) {
    if (target == null)
        target = {};
    for (const source of sources) {
        for (const [prop, val] of entries(source)) {
            if (val === null) {
                // copy null values
                target[prop] = val;
            }
            else if (typeof target[prop] === "object" && typeof val === "object") {
                // merge objects if both properties are objects
                target[prop] = extend(target[prop], val);
            }
            else if (typeof val === "object") {
                // create a copy of the source object if the target is primitive
                target[prop] = extend({}, val);
            }
            else {
                // copy primitive values
                target[prop] = val;
            }
        }
    }
    return target;
}
exports.extend = extend;
// // Kopiert Eigenschaften rekursiv von einem Objekt auf ein anderes
// export function extend(target: any, source: any) {
// 	target = target || {};
// 	for (const [prop, val] of entries(source)) {
// 		if (val instanceof Object) {
// 			target[prop] = extend(target[prop], val);
// 		} else {
// 			target[prop] = val;
// 		}
// 	}
// 	return target;
// }
