"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TLSStruct_1 = require("./TLSStruct");
const TypeSpecs = require("./TypeSpecs");
class PreMasterSecret extends TLSStruct_1.TLSStruct {
    constructor(other_secret, psk) {
        super(PreMasterSecret.__spec);
        this.other_secret = other_secret;
        this.psk = psk;
        if (this.other_secret == null) {
            // create fake contents
            this.other_secret = Buffer.alloc(this.psk.length, 0);
        }
    }
    static createEmpty() {
        return new PreMasterSecret(null, null);
    }
}
PreMasterSecret.__spec = {
    other_secret: TypeSpecs.define.Buffer(0, Math.pow(2, 16) - 1),
    psk: TypeSpecs.define.Buffer(0, Math.pow(2, 16) - 1),
};
exports.PreMasterSecret = PreMasterSecret;
