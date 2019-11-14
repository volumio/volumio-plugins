/// <reference types="node" />
export declare type BitSizes = 8 | 16 | 24 | 32 | 48 | 64;
export declare function numberToBuffer(value: number, size: BitSizes): Buffer;
export declare function bufferToNumber(buf: Buffer, size: BitSizes, offset?: number): number;
export declare function bufferToByteArray(buf: Buffer, offset?: number): number[];
