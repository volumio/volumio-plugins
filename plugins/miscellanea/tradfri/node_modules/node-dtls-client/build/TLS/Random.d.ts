/// <reference types="node" />
import { TLSStruct } from "./TLSStruct";
import * as TypeSpecs from "./TypeSpecs";
export declare class Random extends TLSStruct {
    gmt_unix_time: number;
    random_bytes: Buffer;
    static readonly __spec: {
        gmt_unix_time: Readonly<TypeSpecs.Number>;
        random_bytes: TypeSpecs.Buffer;
    };
    constructor(gmt_unix_time: number, random_bytes: Buffer);
    /**
     * Creates a new Random structure and initializes it.
     */
    static createNew(): Random;
    static createEmpty(): Random;
}
