"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
function HMAC_factory(algorithm, length) {
    const ret = ((secret, data) => {
        const hmac = crypto.createHmac(algorithm, secret);
        hmac.update(data);
        return hmac.digest();
    });
    // add length information
    ret.keyAndHashLenth = length;
    return ret;
}
exports.HMAC = {
    md5: HMAC_factory("md5", 16),
    sha1: HMAC_factory("sha1", 20),
    sha256: HMAC_factory("sha256", 32),
    sha384: HMAC_factory("sha384", 48),
    sha512: HMAC_factory("sha512", 64),
};
function Hash_factory(algorithm, length) {
    const ret = ((data) => {
        const hash = crypto.createHash(algorithm);
        hash.update(data);
        return hash.digest();
    });
    // add length information
    ret.hashLength = length;
    return ret;
}
const Hash = {
    md5: Hash_factory("md5", 16),
    sha1: Hash_factory("sha1", 20),
    sha256: Hash_factory("sha256", 32),
    sha384: Hash_factory("sha384", 48),
    sha512: Hash_factory("sha512", 64),
};
/**
 * Data expansion function: Turns a secret into an arbitrary quantity of output using a hash function and a seed.
 * @param algorithm - The algorithm to be used for hashing
 * @param secret - The secret to be expanded
 * @param seed - The seed used in the data expansion
 * @param length - The desired amount of data.
 * @see https://tools.ietf.org/html/rfc5246#section-5
 */
function P(algorithm, secret, seed, length = 32) {
    const _HMAC = exports.HMAC[algorithm];
    const _A = [seed];
    function A(i) {
        if (i >= _A.length) {
            // need to generate the value first
            _A.push(_HMAC(secret, A(i - 1)));
        }
        return _A[i];
    }
    const hashes = [];
    let hashesLength = 0;
    // iterate through the hash function
    for (let i = 1; hashesLength < length; i++) {
        const newHash = _HMAC(secret, Buffer.concat([A(i), seed]));
        hashes.push(newHash);
        hashesLength += newHash.length;
    }
    // concatenate the individual hashes and trim it to the desired length
    return Buffer.concat(hashes, length);
}
exports.PRF = {
    md5: PRF_factory("md5"),
    sha1: PRF_factory("sha1"),
    sha256: PRF_factory("sha256"),
    sha384: PRF_factory("sha384"),
    sha512: PRF_factory("sha512"),
};
function PRF_factory(algorithm) {
    const ret = ((secret, label, seed, length = 32) => {
        return P(algorithm, secret, Buffer.concat([Buffer.from(label, "ascii"), seed]), length);
    });
    ret.hashFunction = Hash[algorithm];
    return ret;
}
