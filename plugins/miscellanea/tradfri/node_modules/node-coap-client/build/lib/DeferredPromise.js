"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function normalizeReason(reason) {
    if (typeof reason === "string")
        return new Error(reason);
    return reason;
}
function createDeferredPromise() {
    let res;
    let rej;
    const promise = new Promise((resolve, reject) => {
        res = resolve;
        rej = (reason) => reject(normalizeReason(reason));
    });
    promise.resolve = res;
    promise.reject = rej;
    return promise;
}
exports.createDeferredPromise = createDeferredPromise;
