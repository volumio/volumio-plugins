"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TLSStruct_1 = require("./TLSStruct");
const TypeSpecs = require("./TypeSpecs");
var HashAlgorithm;
(function (HashAlgorithm) {
    HashAlgorithm[HashAlgorithm["none"] = 0] = "none";
    HashAlgorithm[HashAlgorithm["md5"] = 1] = "md5";
    HashAlgorithm[HashAlgorithm["sha1"] = 2] = "sha1";
    HashAlgorithm[HashAlgorithm["sha224"] = 3] = "sha224";
    HashAlgorithm[HashAlgorithm["sha256"] = 4] = "sha256";
    HashAlgorithm[HashAlgorithm["sha384"] = 5] = "sha384";
    HashAlgorithm[HashAlgorithm["sha512"] = 6] = "sha512";
})(HashAlgorithm = exports.HashAlgorithm || (exports.HashAlgorithm = {}));
(function (HashAlgorithm) {
    HashAlgorithm.__spec = TypeSpecs.define.Enum("uint8", HashAlgorithm);
})(HashAlgorithm = exports.HashAlgorithm || (exports.HashAlgorithm = {}));
var SignatureAlgorithm;
(function (SignatureAlgorithm) {
    SignatureAlgorithm[SignatureAlgorithm["anonymous"] = 0] = "anonymous";
    SignatureAlgorithm[SignatureAlgorithm["rsa"] = 1] = "rsa";
    SignatureAlgorithm[SignatureAlgorithm["dsa"] = 2] = "dsa";
    SignatureAlgorithm[SignatureAlgorithm["ecdsa"] = 3] = "ecdsa";
})(SignatureAlgorithm = exports.SignatureAlgorithm || (exports.SignatureAlgorithm = {}));
(function (SignatureAlgorithm) {
    SignatureAlgorithm.__spec = TypeSpecs.define.Enum("uint8", SignatureAlgorithm);
})(SignatureAlgorithm = exports.SignatureAlgorithm || (exports.SignatureAlgorithm = {}));
class SignatureAndHashAlgorithm extends TLSStruct_1.TLSStruct {
    constructor(hash, signature) {
        super(SignatureAndHashAlgorithm.__spec);
        this.hash = hash;
        this.signature = signature;
    }
    static createEmpty() {
        return new SignatureAndHashAlgorithm(null, null);
    }
}
SignatureAndHashAlgorithm.__spec = {
    hash: HashAlgorithm.__spec,
    signature: SignatureAlgorithm.__spec,
};
exports.default = SignatureAndHashAlgorithm;
