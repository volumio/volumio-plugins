"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ContentType_1 = require("../TLS/ContentType");
const ProtocolVersion_1 = require("../TLS/ProtocolVersion");
const TLSStruct_1 = require("../TLS/TLSStruct");
const TypeSpecs = require("../TLS/TypeSpecs");
class DTLSPlaintext extends TLSStruct_1.TLSStruct {
    constructor(type, version = new ProtocolVersion_1.ProtocolVersion(), epoch, sequence_number, fragment) {
        super(DTLSPlaintext.__spec);
        this.type = type;
        this.version = version;
        this.epoch = epoch;
        this.sequence_number = sequence_number;
        this.fragment = fragment;
    }
    static createEmpty() {
        return new DTLSPlaintext(null, null, null, null, null);
    }
}
DTLSPlaintext.__spec = {
    type: TypeSpecs.define.Struct(ContentType_1.ContentType),
    version: TypeSpecs.define.Struct(ProtocolVersion_1.ProtocolVersion),
    epoch: TypeSpecs.uint16,
    sequence_number: TypeSpecs.uint48,
    // length field is implied in the variable length vector
    fragment: TypeSpecs.define.Buffer(0, Math.pow(2, 14)),
};
DTLSPlaintext.spec = TypeSpecs.define.Struct(DTLSPlaintext);
exports.DTLSPlaintext = DTLSPlaintext;
