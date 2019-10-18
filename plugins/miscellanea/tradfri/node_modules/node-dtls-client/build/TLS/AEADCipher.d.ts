import { GenericCipherDelegate, GenericDecipherDelegate } from "./CipherSuite";
export declare type AEADCipherAlgorithm = "aes-128-ccm" | "aes-256-ccm" | "aes-128-ccm8" | "aes-256-ccm8" | "aes-128-gcm" | "aes-256-gcm";
export interface AEADCipherDelegate extends GenericCipherDelegate {
    /**
     * The length of nonces for each record
     */
    nonceLength: number;
    /**
     * The block size of this algorithm
     */
    blockSize: number;
    /**
     * The length of the authentication tag in bytes.
     */
    authTagLength: number;
}
export interface AEADDecipherDelegate extends GenericDecipherDelegate {
    /**
     * The length of nonces for each record
     */
    nonceLength: number;
    /**
     * The block size of this algorithm
     */
    blockSize: number;
    /**
     * The length of the authentication tag in bytes.
     */
    authTagLength: number;
}
/**
 * Creates an AEAD cipher delegate used to encrypt packet fragments.
 * @param algorithm - The AEAD cipher algorithm to be used
 */
export declare function createCipher(algorithm: AEADCipherAlgorithm): AEADCipherDelegate;
/**
 * Creates an AEAD cipher delegate used to decrypt packet fragments.
 * @param algorithm - The AEAD cipher algorithm to be used
 */
export declare function createDecipher(algorithm: AEADCipherAlgorithm): AEADDecipherDelegate;
