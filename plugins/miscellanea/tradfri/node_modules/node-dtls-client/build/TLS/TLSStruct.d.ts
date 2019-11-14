/// <reference types="node" />
import { DeserializationResult } from "./Serializable";
import * as TypeSpecs from "./TypeSpecs";
export interface PropertyDefinition {
    name: string;
    type: TypeSpecs.All;
}
/**
 * Basisklasse für TLS-Objekte
 */
export declare class TLSStruct {
    constructor(spec: TypeSpecs.StructSpec, initial?: Record<string, any>);
    private __spec__;
    private propertyDefinitions;
    /**
     * Deserialisiert die Eigenschaften dieses Objekts aus dem angegebenen Buffer
     * @param buf - Der Buffer, aus dem gelesen werden soll
     * @param offset - Der Index, ab dem gelesen werden soll
     */
    deserialize(buf: Buffer, offset?: number): number;
    /**
     * Erzeugt eine TLSStruct der angegebenen Definition aus einem Byte-Array
     * @param spec - Definiert, wie das deserialisierte Objekt aufgebaut ist
     * @param arr - Das Array, aus dem gelesen werden soll
     * @param offset - Der Index, ab dem gelesen werden soll
     */
    static from(spec: TypeSpecs.Struct, buf: Buffer, offset?: number): DeserializationResult<TLSStruct>;
    /**
     * Serialisiert das Objekt in ein ein Byte-Array
     */
    serialize(): Buffer;
}
