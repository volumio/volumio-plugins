/// <reference types="node" />
import * as TypeSpecs from "./TypeSpecs";
export interface DeserializationResult<T> {
    result: T;
    readBytes: number;
}
export interface ISerializable {
    /**
     * Turns this object into a buffer according to the TLS RFCs
     */
    serialize(): Buffer;
}
export interface ISerializableConstructor {
    createEmpty(): ISerializable;
    /**
     * Constructs an object of the given type from the given buffer.
     */
    from(spec: TypeSpecs.All, buf: Buffer, offset?: number): DeserializationResult<ISerializable>;
}
