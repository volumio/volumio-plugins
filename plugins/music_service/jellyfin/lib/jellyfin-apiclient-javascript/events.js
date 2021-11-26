function getCallbacks(obj, name) {
    if (!obj) {
        throw new Error('obj cannot be null!');
    }

    obj._callbacks = obj._callbacks || {};

    let list = obj._callbacks[name];

    if (!list) {
        obj._callbacks[name] = [];
        list = obj._callbacks[name];
    }

    return list;
}

let Events = {
    on(obj, eventName, fn) {
        const list = getCallbacks(obj, eventName);

        list.push(fn);
    },

    off(obj, eventName, fn) {
        const list = getCallbacks(obj, eventName);

        const i = list.indexOf(fn);
        if (i !== -1) {
            list.splice(i, 1);
        }
    },

    trigger(obj, eventName) {
        const eventObject = {
            type: eventName
        };

        const eventArgs = [];
        eventArgs.push(eventObject);

        const additionalArgs = arguments[2] || [];
        for (let i = 0, length = additionalArgs.length; i < length; i++) {
            eventArgs.push(additionalArgs[i]);
        }

        const callbacks = getCallbacks(obj, eventName).slice(0);

        callbacks.forEach((c) => {
            c.apply(obj, eventArgs);
        });
    }
};

module.exports = Events;
