/// <reference types="node" />
import { HashAlgorithm } from "../TLS/CipherSuite";
export interface HMACDelegate {
    /**
     * Generates a HMAC hash from the given secret and data.
     * @param secret - The secret used to hash the data
     * @param data - The data to be hashed
     */
    (secret: Buffer, data: Buffer): Buffer;
    /**
     * The key and hash output length of this hash function
     */
    keyAndHashLenth: number;
}
export declare const HMAC: {
    [algorithm in HashAlgorithm]: HMACDelegate;
};
export interface HashDelegate {
    /**
     * Generates a Hash hash from the given data.
     * @param data - The data to be hashed
     */
    (data: Buffer): Buffer;
    /**
     * The hash output length of this hash function
     */
    hashLength: number;
}
export interface PRFDelegate {
    /**
     * (D)TLS v1.2 pseudorandom function. Earlier versions are not supported.
     * @param secret - The secret to be hashed
     * @param label - used together with seed to generate a hash from secret. Denotes the usage of this hash.
     * @param seed - used together with label to generate a hash from secret
     * @param length - the desired length of the output
     */
    (secret: Buffer, label: string, seed: Buffer, length?: number): Buffer;
    /**
     * The underlying hash function
     */
    hashFunction: HashDelegate;
}
export declare const PRF: {
    [algorithm in HashAlgorithm]: PRFDelegate;
};
