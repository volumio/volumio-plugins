import { TLSStruct } from "./TLSStruct";
import * as TypeSpecs from "./TypeSpecs";
export declare enum ChangeCipherSpecTypes {
    change_cipher_spec = 1,
}
export declare namespace ChangeCipherSpecTypes {
    const __spec: TypeSpecs.Enum;
}
export declare class ChangeCipherSpec extends TLSStruct {
    type: ChangeCipherSpecTypes;
    static readonly __spec: {
        type: TypeSpecs.Enum;
    };
    constructor(type: ChangeCipherSpecTypes);
    static createEmpty(): ChangeCipherSpec;
}
