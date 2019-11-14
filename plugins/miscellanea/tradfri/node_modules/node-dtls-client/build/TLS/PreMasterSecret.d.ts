/// <reference types="node" />
import { TLSStruct } from "./TLSStruct";
import * as TypeSpecs from "./TypeSpecs";
export declare class PreMasterSecret extends TLSStruct {
    other_secret: Buffer;
    psk: Buffer;
    static readonly __spec: {
        other_secret: TypeSpecs.Buffer;
        psk: TypeSpecs.Buffer;
    };
    constructor(other_secret: Buffer, psk: Buffer);
    static createEmpty(): PreMasterSecret;
}
