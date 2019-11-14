"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const DTLSCiphertext_1 = require("../DTLS/DTLSCiphertext");
const DTLSCompressed_1 = require("../DTLS/DTLSCompressed");
const BlockCipherParameters = {
    "aes-128-cbc": { keyLength: 16, blockSize: 16, recordIvLength: 16 },
    "aes-256-cbc": { keyLength: 32, blockSize: 16, recordIvLength: 16 },
    "des-ede3-cbc": { keyLength: 24, blockSize: 8, recordIvLength: 8 },
};
/**
 * Creates a block cipher delegate used to encrypt packet fragments.
 * @param algorithm - The block cipher algorithm to be used
 * @param mac - The MAC delegate to be used
 */
function createCipher(algorithm, mac) {
    const cipherParams = BlockCipherParameters[algorithm];
    const ret = ((packet, keyMaterial, connEnd) => {
        // compute the MAC for this packet
        const MAC = mac(Buffer.concat([
            packet.computeMACHeader(),
            packet.fragment,
        ]), keyMaterial, connEnd);
        // combine that with the MAC to form the plaintext and encrypt it
        const plaintext = Buffer.concat([
            packet.fragment,
            MAC,
        ]);
        // figure out how much padding we need
        const overflow = ((plaintext.length + 1) % cipherParams.blockSize);
        const padLength = (overflow > 0) ? (cipherParams.blockSize - overflow) : 0;
        const padding = Buffer.alloc(padLength + 1, /*fill=*/ padLength); // one byte is the actual length of the padding array
        // find the right encryption params
        const record_iv = crypto.pseudoRandomBytes(cipherParams.recordIvLength);
        const cipher_key = (connEnd === "server") ? keyMaterial.server_write_key : keyMaterial.client_write_key;
        const cipher = crypto.createCipheriv(algorithm, cipher_key, record_iv);
        cipher.setAutoPadding(false);
        // encrypt the plaintext
        const ciphertext = Buffer.concat([
            cipher.update(plaintext),
            cipher.update(padding),
            cipher.final(),
        ]);
        // prepend it with the iv
        const fragment = Buffer.concat([
            record_iv,
            ciphertext,
        ]);
        // and return the packet
        return new DTLSCiphertext_1.DTLSCiphertext(packet.type, packet.version, packet.epoch, packet.sequence_number, fragment);
    });
    // append key length information
    ret.keyLength = cipherParams.keyLength;
    ret.recordIvLength = cipherParams.recordIvLength;
    ret.blockSize = cipherParams.blockSize;
    return ret;
}
exports.createCipher = createCipher;
/**
 * Creates a block cipher delegate used to decrypt packet fragments.
 * @param algorithm - The block cipher algorithm to be used
 * @param mac - The MAC delegate to be used
 */
function createDecipher(algorithm, mac) {
    const decipherParams = BlockCipherParameters[algorithm];
    const ret = ((packet, keyMaterial, connEnd) => {
        function invalidMAC(deciphered) {
            // Even if we have an error, still return some plaintext.
            // This allows to prevent a CBC timing attack
            return {
                err: new Error("invalid MAC detected in DTLS packet"),
                result: deciphered,
            };
        }
        const ciphertext = packet.fragment;
        // decrypt in two steps. first try decrypting
        const decipherResult = (() => {
            // find the right decryption params
            const record_iv = ciphertext.slice(0, decipherParams.recordIvLength);
            const decipher_key = (connEnd === "client") ? keyMaterial.server_write_key : keyMaterial.client_write_key;
            const decipher = crypto.createDecipheriv(algorithm, decipher_key, record_iv);
            decipher.setAutoPadding(false);
            // decrypt the ciphertext
            const ciphered = ciphertext.slice(decipherParams.blockSize);
            const deciphered = Buffer.concat([
                decipher.update(ciphered),
                decipher.final(),
            ]);
            // check the padding
            const len = deciphered.length;
            if (len === 0)
                return invalidMAC(deciphered); // no data
            const paddingLength = deciphered[len - 1];
            if (len < paddingLength)
                return invalidMAC(deciphered); // not enough data
            for (let i = 1; i <= paddingLength; i++) {
                // wrong values in padding
                if (deciphered[len - 1 - i] !== paddingLength)
                    return invalidMAC(deciphered);
            }
            // strip off padding
            // tslint:disable-next-line:no-shadowed-variable
            const plaintext = Buffer.from(deciphered.slice(0, -1 - paddingLength));
            // contains fragment + MAC
            return { result: plaintext };
        })();
        const sourceConnEnd = (connEnd === "client") ? "server" : "client";
        // then verify the result/MAC
        if (decipherResult.err) {
            // calculate fake MAC to prevent a timing attack
            mac(decipherResult.result, keyMaterial, sourceConnEnd);
            // now throw the error
            throw decipherResult.err;
        }
        // split the plaintext into content and MAC
        const plaintext = decipherResult.result;
        let content;
        let receivedMAC;
        if (mac.keyAndHashLength > 0) {
            content = plaintext.slice(0, -mac.keyAndHashLength);
            receivedMAC = plaintext.slice(-mac.keyAndHashLength);
        }
        else {
            content = Buffer.from(plaintext);
            receivedMAC = Buffer.from([]);
        }
        // Create the compressed packet to return after verifying
        const result = new DTLSCompressed_1.DTLSCompressed(packet.type, packet.version, packet.epoch, packet.sequence_number, content);
        // compute the expected MAC for this packet
        const expectedMAC = mac(Buffer.concat([
            result.computeMACHeader(),
            result.fragment,
        ]), keyMaterial, sourceConnEnd);
        // and check if it matches the actual one
        if (!expectedMAC.equals(receivedMAC)) {
            throw invalidMAC().err;
        }
        return result;
    });
    // append key length information
    ret.keyLength = decipherParams.keyLength;
    ret.recordIvLength = decipherParams.recordIvLength;
    ret.blockSize = decipherParams.blockSize;
    return ret;
}
exports.createDecipher = createDecipher;
