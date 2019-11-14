"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ContentType_1 = require("../TLS/ContentType");
const ProtocolVersion_1 = require("../TLS/ProtocolVersion");
const TLSStruct_1 = require("../TLS/TLSStruct");
const TypeSpecs = require("../TLS/TypeSpecs");
const DTLSPlaintext_1 = require("./DTLSPlaintext");
class DTLSCompressed extends TLSStruct_1.TLSStruct {
    constructor(type, version = new ProtocolVersion_1.ProtocolVersion(), epoch, sequence_number, fragment) {
        super(DTLSCompressed.__spec);
        this.type = type;
        this.version = version;
        this.epoch = epoch;
        this.sequence_number = sequence_number;
        this.fragment = fragment;
    }
    static createEmpty() {
        return new DTLSCompressed(null, null, null, null, null);
    }
    /**
     * Compresses the given plaintext packet
     * @param packet - The plaintext packet to be compressed
     * @param compressor - The compressor function used to compress the given packet
     */
    static compress(packet, compressor) {
        return new DTLSCompressed(packet.type, packet.version, packet.epoch, packet.sequence_number, compressor(packet.fragment));
    }
    /**
     * Decompresses this packet into a plaintext packet
     * @param decompressor - The decompressor function used to decompress this packet
     */
    decompress(decompressor) {
        return new DTLSPlaintext_1.DTLSPlaintext(this.type, this.version, this.epoch, this.sequence_number, decompressor(this.fragment));
    }
    /**
     * Computes the MAC header representing this packet. The MAC header is the input buffer of the MAC calculation minus the actual fragment buffer.
     */
    computeMACHeader() {
        return (new MACHeader(this.epoch, this.sequence_number, this.type, this.version, this.fragment.length)).serialize();
    }
}
DTLSCompressed.__spec = {
    type: ContentType_1.ContentType.__spec,
    version: TypeSpecs.define.Struct(ProtocolVersion_1.ProtocolVersion),
    epoch: TypeSpecs.uint16,
    sequence_number: TypeSpecs.uint48,
    // length field is implied in the variable length vector
    fragment: TypeSpecs.define.Buffer(0, 1024 + Math.pow(2, 14)),
};
DTLSCompressed.spec = TypeSpecs.define.Struct(DTLSCompressed);
exports.DTLSCompressed = DTLSCompressed;
class MACHeader extends TLSStruct_1.TLSStruct {
    constructor(epoch, sequence_number, type, version, fragment_length) {
        super(MACHeader.__spec);
        this.epoch = epoch;
        this.sequence_number = sequence_number;
        this.type = type;
        this.version = version;
        this.fragment_length = fragment_length;
    }
    static createEmpty() {
        return new MACHeader(null, null, null, null, null);
    }
}
MACHeader.__spec = {
    epoch: TypeSpecs.uint16,
    sequence_number: TypeSpecs.uint48,
    type: ContentType_1.ContentType.__spec,
    version: TypeSpecs.define.Struct(ProtocolVersion_1.ProtocolVersion),
    fragment_length: TypeSpecs.uint16,
};
exports.MACHeader = MACHeader;
