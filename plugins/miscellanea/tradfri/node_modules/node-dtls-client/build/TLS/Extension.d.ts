/// <reference types="node" />
import { TLSStruct } from "./TLSStruct";
import * as TypeSpecs from "./TypeSpecs";
export declare enum ExtensionType {
    signature_algorithms = 13,
}
export declare namespace ExtensionType {
    const spec: TypeSpecs.Enum;
}
export declare class Extension extends TLSStruct {
    extension_type: ExtensionType;
    extension_data: Buffer;
    static readonly __spec: {
        extension_type: TypeSpecs.Enum;
        extension_data: TypeSpecs.Buffer;
    };
    static readonly spec: TypeSpecs.Struct;
    constructor(extension_type: ExtensionType, extension_data: Buffer);
    static createEmpty(): Extension;
}
