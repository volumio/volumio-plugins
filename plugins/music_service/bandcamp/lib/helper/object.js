'use strict';

class ObjectHelper {

    static assignProps(target, source, props) {
        props.forEach( (prop) => {
            if (source[prop] !== undefined) {
                target[prop] = source[prop];
            };
        });
        return target;
    }

    static getProp(obj, prop, defaultValue) {
        return obj && obj[prop] !== undefined ? obj[prop] : defaultValue;
    }
}

module.exports = ObjectHelper;