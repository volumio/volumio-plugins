'use strict';

const libQ = require('kew');
const NodeCache = require('node-cache');

class Cache {
    constructor(ttl, maxEntries) {
        this._ttl = ttl;
        this._maxEntries = maxEntries;
        this._cache = new NodeCache({
            checkperiod: 600
        });
    }

    setTTL(ttl) {
        if (this._ttl != ttl) {
            let keys = this._cache.keys();
            keys.forEach( (key) => {
                this._cache.ttl(key, ttl);
            })
        }
        this._ttl = ttl;
    }

    setMaxEntries(maxEntries) {
        let keyCount = this._cache.keys().length;
        if (keyCount > maxEntries) {
            let keys = this._cache.keys();
            for (let i = 0; i < keyCount - maxEntries; i++) {
                this._cache.del(keys[i]);
            }
        }
        this._maxEntries = maxEntries;
    }

    get(key) {
        return this._cache.get(key);
    }

    put(key, value) {
        let keys = this._cache.keys();
        if (keys.length === this._maxEntries) {
            this._cache.del(keys[0]);
        }
        return this._cache.set(key, value, this._ttl);
    }

    clear() {
        this._cache.flushAll();
    }

    close() {
        this._cache.close();
    }

    getEntryCount() {
        return this._cache.getStats().keys;
    }

    getMemoryUsageInKB() {
        return (this._cache.getStats().vsize + this._cache.getStats().ksize) / 1000;
    }

    cacheOrPromise(key, promiseCallback) {
        let self = this;
        let cachedValue = self.get(key);
        if (cachedValue !== undefined) {
            return libQ.resolve(cachedValue);
        }
        else {
        }
        if (promiseCallback) {
            let promise = promiseCallback();
            if (libQ.isPromise(promise)) {
                let defer = libQ.defer();
                promise.then( (value) => {
                    self.put(key, value);
                    defer.resolve(value);
                }).fail( (error) => {
                    defer.reject(error);
                });
                return defer.promise;
            }
            else if (promise.then) {
                let defer = libQ.defer();
                promise.then( (value) => {
                    self.put(key, value);
                    defer.resolve(value);
                }).catch( (error) => {
                    defer.reject(error);
                });
                return defer.promise;
            }
        }
        return libQ.resolve(null);
    }
}

module.exports = Cache;