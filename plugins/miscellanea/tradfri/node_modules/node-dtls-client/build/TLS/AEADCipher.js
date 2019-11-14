"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const DTLSCiphertext_1 = require("../DTLS/DTLSCiphertext");
const DTLSCompressed_1 = require("../DTLS/DTLSCompressed");
const ContentType_1 = require("../TLS/ContentType");
const ProtocolVersion_1 = require("../TLS/ProtocolVersion");
const TLSStruct_1 = require("./TLSStruct");
const TypeSpecs = require("./TypeSpecs");
const AEADCrypto_1 = require("../lib/AEADCrypto");
const AEADCipherParameters = {
    "aes-128-ccm": { interface: AEADCrypto_1.ccm, keyLength: 16, blockSize: 16, fixedIvLength: 4, recordIvLength: 8, authTagLength: 16 },
    "aes-128-ccm8": { interface: AEADCrypto_1.ccm, keyLength: 16, blockSize: 16, fixedIvLength: 4, recordIvLength: 8, authTagLength: 8 },
    "aes-256-ccm": { interface: AEADCrypto_1.ccm, keyLength: 32, blockSize: 16, fixedIvLength: 4, recordIvLength: 8, authTagLength: 16 },
    "aes-256-ccm8": { interface: AEADCrypto_1.ccm, keyLength: 32, blockSize: 16, fixedIvLength: 4, recordIvLength: 8, authTagLength: 8 },
    "aes-128-gcm": { interface: AEADCrypto_1.gcm, keyLength: 16, blockSize: 16, fixedIvLength: 4, recordIvLength: 8, authTagLength: 16 },
    "aes-256-gcm": { interface: AEADCrypto_1.gcm, keyLength: 32, blockSize: 16, fixedIvLength: 4, recordIvLength: 8, authTagLength: 16 },
};
class AdditionalData extends TLSStruct_1.TLSStruct {
    constructor(epoch, sequence_number, type, version, fragment_length) {
        super(AdditionalData.__spec);
        this.epoch = epoch;
        this.sequence_number = sequence_number;
        this.type = type;
        this.version = version;
        this.fragment_length = fragment_length;
    }
    static createEmpty() {
        return new AdditionalData(null, null, null, null, null);
    }
}
AdditionalData.__spec = {
    epoch: TypeSpecs.uint16,
    sequence_number: TypeSpecs.uint48,
    type: ContentType_1.ContentType.__spec,
    version: TypeSpecs.define.Struct(ProtocolVersion_1.ProtocolVersion),
    fragment_length: TypeSpecs.uint16,
};
/**
 * Creates an AEAD cipher delegate used to encrypt packet fragments.
 * @param algorithm - The AEAD cipher algorithm to be used
 */
function createCipher(algorithm) {
    const cipherParams = AEADCipherParameters[algorithm];
    const ret = ((packet, keyMaterial, connEnd) => {
        const plaintext = packet.fragment;
        // find the right encryption params
        const salt = (connEnd === "server") ? keyMaterial.server_write_IV : keyMaterial.client_write_IV;
        const nonce_explicit = crypto.pseudoRandomBytes(cipherParams.recordIvLength);
        // alternatively:
        // const nonce_explicit = Buffer.concat([
        // 	BitConverter.numberToBuffer(packet.epoch, 16),
        // 	BitConverter.numberToBuffer(packet.sequence_number, 48)
        // ]);
        const nonce = Buffer.concat([salt, nonce_explicit]);
        const additionalData = new AdditionalData(packet.epoch, packet.sequence_number, packet.type, packet.version, packet.fragment.length).serialize();
        const cipher_key = (connEnd === "server") ? keyMaterial.server_write_key : keyMaterial.client_write_key;
        // Find the right function to encrypt
        const encrypt = cipherParams.interface.encrypt;
        // encrypt and concat the neccessary pieces
        const encryptionResult = encrypt(cipher_key, nonce, plaintext, additionalData, cipherParams.authTagLength);
        const fragment = Buffer.concat([
            nonce_explicit,
            encryptionResult.ciphertext,
            encryptionResult.auth_tag,
        ]);
        // and return the packet
        return new DTLSCiphertext_1.DTLSCiphertext(packet.type, packet.version, packet.epoch, packet.sequence_number, fragment);
    });
    // append key length information
    ret.keyLength = cipherParams.keyLength;
    ret.blockSize = cipherParams.blockSize;
    ret.authTagLength = cipherParams.authTagLength;
    ret.fixedIvLength = cipherParams.fixedIvLength;
    ret.recordIvLength = cipherParams.recordIvLength;
    return ret;
}
exports.createCipher = createCipher;
/**
 * Creates an AEAD cipher delegate used to decrypt packet fragments.
 * @param algorithm - The AEAD cipher algorithm to be used
 */
function createDecipher(algorithm) {
    const decipherParams = AEADCipherParameters[algorithm];
    const ret = ((packet, keyMaterial, connEnd) => {
        const ciphertext = packet.fragment;
        const sourceConnEnd = (connEnd === "client") ? "server" : "client";
        // find the right decryption params
        const salt = (sourceConnEnd === "server") ? keyMaterial.server_write_IV : keyMaterial.client_write_IV;
        const nonce_explicit = ciphertext.slice(0, decipherParams.recordIvLength);
        const nonce = Buffer.concat([salt, nonce_explicit]);
        const additionalData = new AdditionalData(packet.epoch, packet.sequence_number, packet.type, packet.version, 
        // subtract the AEAD overhead from the packet length for authentication
        packet.fragment.length - decipherParams.recordIvLength - decipherParams.authTagLength).serialize();
        const authTag = ciphertext.slice(-decipherParams.authTagLength);
        const decipher_key = (sourceConnEnd === "server") ? keyMaterial.server_write_key : keyMaterial.client_write_key;
        // Find the right function to decrypt
        const decrypt = decipherParams.interface.decrypt;
        // decrypt the ciphertext and check the result
        const ciphered = ciphertext.slice(decipherParams.recordIvLength, -decipherParams.authTagLength);
        const decryptionResult = decrypt(decipher_key, nonce, ciphered, additionalData, authTag);
        if (!decryptionResult.auth_ok) {
            throw new Error("Authenticated decryption of the packet failed.");
        }
        // everything good, return the decrypted packet
        return new DTLSCompressed_1.DTLSCompressed(packet.type, packet.version, packet.epoch, packet.sequence_number, decryptionResult.plaintext);
    });
    // append key length information
    ret.keyLength = decipherParams.keyLength;
    ret.blockSize = decipherParams.blockSize;
    ret.authTagLength = decipherParams.authTagLength;
    ret.fixedIvLength = decipherParams.fixedIvLength;
    ret.recordIvLength = decipherParams.recordIvLength;
    return ret;
}
exports.createDecipher = createDecipher;
