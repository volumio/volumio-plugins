/// <reference types="node" />
import { ContentType } from "../TLS/ContentType";
import { ProtocolVersion } from "../TLS/ProtocolVersion";
import { TLSStruct } from "../TLS/TLSStruct";
import * as TypeSpecs from "../TLS/TypeSpecs";
import { DTLSPacket } from "./DTLSPacket";
import { DTLSPlaintext } from "./DTLSPlaintext";
export declare class DTLSCompressed extends TLSStruct implements DTLSPacket {
    type: ContentType;
    version: ProtocolVersion;
    epoch: number;
    sequence_number: number;
    fragment: Buffer;
    static readonly __spec: {
        type: TypeSpecs.Enum;
        version: TypeSpecs.Struct;
        epoch: Readonly<TypeSpecs.Number>;
        sequence_number: Readonly<TypeSpecs.Number>;
        fragment: TypeSpecs.Buffer;
    };
    static readonly spec: TypeSpecs.Struct;
    constructor(type: ContentType, version: ProtocolVersion, epoch: number, sequence_number: number, fragment: Buffer);
    static createEmpty(): DTLSCompressed;
    /**
     * Compresses the given plaintext packet
     * @param packet - The plaintext packet to be compressed
     * @param compressor - The compressor function used to compress the given packet
     */
    static compress(packet: DTLSPlaintext, compressor: CompressorDelegate): DTLSCompressed;
    /**
     * Decompresses this packet into a plaintext packet
     * @param decompressor - The decompressor function used to decompress this packet
     */
    decompress(decompressor: DecompressorDelegate): DTLSPlaintext;
    /**
     * Computes the MAC header representing this packet. The MAC header is the input buffer of the MAC calculation minus the actual fragment buffer.
     */
    computeMACHeader(): Buffer;
}
export declare type CompressorDelegate = (plaintext: Buffer) => Buffer;
export declare type DecompressorDelegate = (compressed: Buffer) => Buffer;
export declare class MACHeader extends TLSStruct {
    epoch: number;
    sequence_number: number;
    type: ContentType;
    version: ProtocolVersion;
    fragment_length: number;
    static readonly __spec: {
        epoch: Readonly<TypeSpecs.Number>;
        sequence_number: Readonly<TypeSpecs.Number>;
        type: TypeSpecs.Enum;
        version: TypeSpecs.Struct;
        fragment_length: Readonly<TypeSpecs.Number>;
    };
    constructor(epoch: number, sequence_number: number, type: ContentType, version: ProtocolVersion, fragment_length: number);
    static createEmpty(): MACHeader;
}
