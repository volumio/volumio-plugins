/// <reference types="node" />
/**
 * Starting with NodeJS 10, we can use the official crypto API to do AEAD encryption
 * because authTagLength is now configurable. This module is a wrapper around either
 * node-aead-crypto or the native methods
 */
export interface EncryptionResult {
    ciphertext: Buffer;
    auth_tag: Buffer;
}
export interface DecryptionResult {
    plaintext: Buffer;
    auth_ok: boolean;
}
export interface AEADEncryptionInterface {
    encrypt: (key: Buffer, iv: Buffer, plaintext: Buffer, additionalData: Buffer, authTagLength?: number) => EncryptionResult;
    decrypt: (key: Buffer, iv: Buffer, ciphertext: Buffer, additionalData: Buffer, authTag: Buffer) => DecryptionResult;
}
export declare const ccm: AEADEncryptionInterface;
export declare const gcm: AEADEncryptionInterface;
