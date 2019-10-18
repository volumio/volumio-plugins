"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const TLSStruct_1 = require("./TLSStruct");
const TypeSpecs = require("./TypeSpecs");
class Random extends TLSStruct_1.TLSStruct {
    constructor(gmt_unix_time, random_bytes) {
        super(Random.__spec);
        this.gmt_unix_time = gmt_unix_time;
        this.random_bytes = random_bytes;
    }
    /**
     * Creates a new Random structure and initializes it.
     */
    static createNew() {
        return new Random(Math.floor(Date.now() / 1000), crypto.randomBytes(Random.__spec.random_bytes.maxLength));
    }
    static createEmpty() {
        return new Random(null, null);
    }
}
Random.__spec = {
    gmt_unix_time: TypeSpecs.uint32,
    random_bytes: TypeSpecs.define.Buffer(28),
};
exports.Random = Random;
