"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ContentType_1 = require("../TLS/ContentType");
const ProtocolVersion_1 = require("../TLS/ProtocolVersion");
const TLSStruct_1 = require("../TLS/TLSStruct");
const TypeSpecs = require("../TLS/TypeSpecs");
class DTLSCiphertext extends TLSStruct_1.TLSStruct {
    constructor(type, version = new ProtocolVersion_1.ProtocolVersion(), epoch, sequence_number, fragment) {
        super(DTLSCiphertext.__spec);
        this.type = type;
        this.version = version;
        this.epoch = epoch;
        this.sequence_number = sequence_number;
        this.fragment = fragment;
    }
    static createEmpty() {
        return new DTLSCiphertext(null, null, null, null, null);
    }
}
DTLSCiphertext.__spec = {
    type: ContentType_1.ContentType.__spec,
    version: TypeSpecs.define.Struct(ProtocolVersion_1.ProtocolVersion),
    epoch: TypeSpecs.uint16,
    sequence_number: TypeSpecs.uint48,
    // length field is implied in the variable length vector
    fragment: TypeSpecs.define.Buffer(0, 2048 + Math.pow(2, 14)),
};
DTLSCiphertext.spec = TypeSpecs.define.Struct(DTLSCiphertext);
exports.DTLSCiphertext = DTLSCiphertext;
