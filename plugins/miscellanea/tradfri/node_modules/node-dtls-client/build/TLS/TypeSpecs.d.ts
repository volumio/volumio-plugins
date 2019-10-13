import { ISerializableConstructor } from "./Serializable";
export declare type Numbers = "uint8" | "uint16" | "uint24" | "uint32" | "uint48" | "uint64";
export interface Number {
    type: "number";
    size: Numbers;
}
export interface Enum {
    type: "enum";
    size: Numbers;
    enumType: any;
}
export declare type Primitive = Number | Enum;
export declare function getPrimitiveSize(spec: Primitive): number;
export interface IStruct extends ISerializableConstructor {
    readonly __spec: StructSpec;
}
export interface StructSpec {
    [propName: string]: All;
}
export interface Struct {
    type: "struct";
    structType: ISerializableConstructor;
}
export declare type Complex = Primitive | Struct;
export interface Vector {
    type: "vector";
    itemSpec: Complex;
    minLength: number;
    maxLength: number;
    optional: boolean;
}
export declare namespace Vector {
    function isVariableLength(spec: Vector): boolean;
}
/** Unparsed raw data */
export interface Buffer {
    type: "buffer";
    minLength: number;
    maxLength: number;
}
export declare namespace Buffer {
    function isVariableLength(spec: Buffer): boolean;
}
export declare type All = Complex | Vector | Buffer;
export declare const define: {
    Enum: (size: Numbers, enumType: any) => Enum;
    Number: (size: Numbers) => Number;
    Struct: (structType: any) => Struct;
    Vector: (itemSpec: Complex, minLength?: number, maxLength?: number, optional?: boolean) => Vector;
    Buffer: (minLength?: number, maxLength?: number) => Buffer;
};
export declare const uint8: Readonly<Number>;
export declare const uint16: Readonly<Number>;
export declare const uint24: Readonly<Number>;
export declare const uint32: Readonly<Number>;
export declare const uint48: Readonly<Number>;
export declare const uint64: Readonly<Number>;
