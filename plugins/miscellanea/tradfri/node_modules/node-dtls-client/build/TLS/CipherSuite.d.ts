/// <reference types="node" />
import { DTLSCiphertext } from "../DTLS/DTLSCiphertext";
import { DTLSCompressed } from "../DTLS/DTLSCompressed";
import * as AEADCipher from "./AEADCipher";
import * as BlockCipher from "./BlockCipher";
import { ConnectionEnd } from "./ConnectionState";
import { TLSStruct } from "./TLSStruct";
import * as TypeSpecs from "./TypeSpecs";
export declare type HashAlgorithm = "md5" | "sha1" | "sha256" | "sha384" | "sha512";
export declare type CipherType = "block" | "aead";
export declare type KeyExchangeAlgorithm = "dhe_dss" | "dhe_rsa" | "rsa" | "dh_dss" | "dh_rsa" | "psk" | "dhe_psk" | "rsa_psk";
export interface GenericMacDelegate {
    /**
     * Generates a MAC hash from the given data using the underlying HMAC function.
     * @param data - The data to be hashed
     * @param keyMaterial - The key material (mac and encryption keys and IVs) used in the encryption
     * @param sourceConnEnd - Denotes which connection end the packet is coming from
     */
    (data: Buffer, keyMaterial: KeyMaterial, sourceConnEnd: ConnectionEnd): Buffer;
    /**
     * The key and hash output length of this hash function
     */
    keyAndHashLength: number;
}
/**
 * Creates a block cipher delegate used to encrypt packet fragments.
 * @param algorithm - The block cipher algorithm to be used
 */
export declare function createMAC(algorithm: HashAlgorithm): GenericMacDelegate;
export interface CipherDelegate {
    /**
     * Encrypts the given plaintext packet using previously defined parameters
     * @param packet - The plaintext packet to be encrypted
     */
    (packet: DTLSCompressed): DTLSCiphertext;
    /**
     * The inner delegate. This can represent different cipher types like block and AEAD ciphers
     */
    inner: GenericCipherDelegate;
}
export interface GenericCipherDelegate {
    /**
     * Encrypts the given plaintext packet
     * @param packet - The plaintext packet to be encrypted
     * @param keyMaterial - The key material (mac and encryption keys and IVs) used in the encryption
     * @param connEnd - Denotes if the current entity is the server or client
     */
    (packet: DTLSCompressed, keyMaterial: KeyMaterial, connEnd: ConnectionEnd): DTLSCiphertext;
    /**
     * The length of encryption keys in bytes
     */
    keyLength: number;
    /**
     * The length of fixed (for each session) IVs in bytes
     */
    fixedIvLength: number;
    /**
     * The length of record IVs in bytes
     */
    recordIvLength: number;
    /**
     * The MAC delegate used to authenticate packets.
     * May be null for certain ciphers.
     */
    MAC: GenericMacDelegate;
}
export interface DecipherDelegate {
    /**
     * Decrypts the given ciphertext packet using previously defined parameters
     * @param packet - The ciphertext to be decrypted
     */
    (packet: DTLSCiphertext): DTLSCompressed;
    /**
     * The inner delegate. This can represent different cipher types like block and AEAD ciphers
     */
    inner: GenericDecipherDelegate;
}
export interface GenericDecipherDelegate {
    /**
     * Decrypts the given ciphertext packet
     * @param packet - The ciphertext packet to be decrypted
     * @param keyMaterial - The key material (mac and encryption keys and IVs) used in the decryption
     * @param connEnd - Denotes if the current entity is the server or client
     */
    (packet: DTLSCiphertext, keyMaterial: KeyMaterial, connEnd: ConnectionEnd): DTLSCompressed;
    /**
     * The length of decryption keys in bytes
     */
    keyLength: number;
    /**
     * The length of fixed (for each session) IVs in bytes
     */
    fixedIvLength: number;
    /**
     * The length of record IVs in bytes
     */
    recordIvLength: number;
    /**
     * The MAC delegate used to authenticate packets.
     * May be null for certain ciphers.
     */
    MAC: GenericMacDelegate;
}
export interface KeyMaterial {
    client_write_MAC_key: Buffer;
    server_write_MAC_key: Buffer;
    client_write_key: Buffer;
    server_write_key: Buffer;
    client_write_IV: Buffer;
    server_write_IV: Buffer;
}
export declare class CipherSuite extends TLSStruct {
    readonly id: number;
    readonly keyExchange: KeyExchangeAlgorithm;
    readonly macAlgorithm: HashAlgorithm;
    readonly prfAlgorithm: HashAlgorithm;
    readonly cipherType: CipherType;
    readonly algorithm: (BlockCipher.BlockCipherAlgorithm | AEADCipher.AEADCipherAlgorithm);
    readonly verify_data_length: number;
    static readonly __spec: {
        id: Readonly<TypeSpecs.Number>;
    };
    static readonly spec: TypeSpecs.Struct;
    constructor(id: number, keyExchange: KeyExchangeAlgorithm, macAlgorithm: HashAlgorithm, prfAlgorithm: HashAlgorithm, cipherType: CipherType, algorithm?: (BlockCipher.BlockCipherAlgorithm | AEADCipher.AEADCipherAlgorithm), verify_data_length?: number);
    static createEmpty(): CipherSuite;
    private _cipher;
    readonly Cipher: GenericCipherDelegate;
    private createCipher();
    specifyCipher(keyMaterial: KeyMaterial, connEnd: ConnectionEnd): CipherDelegate;
    private _decipher;
    readonly Decipher: GenericDecipherDelegate;
    private createDecipher();
    specifyDecipher(keyMaterial: KeyMaterial, connEnd: ConnectionEnd): DecipherDelegate;
    private _mac;
    readonly MAC: GenericMacDelegate;
    private createMAC();
}
