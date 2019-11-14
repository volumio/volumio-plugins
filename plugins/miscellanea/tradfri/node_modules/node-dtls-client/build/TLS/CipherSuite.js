"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DTLSCiphertext_1 = require("../DTLS/DTLSCiphertext");
const DTLSCompressed_1 = require("../DTLS/DTLSCompressed");
const AEADCipher = require("./AEADCipher");
const BlockCipher = require("./BlockCipher");
const PRF_1 = require("./PRF");
const TLSStruct_1 = require("./TLSStruct");
const TypeSpecs = require("./TypeSpecs");
/**
 * Creates a block cipher delegate used to encrypt packet fragments.
 * @param algorithm - The block cipher algorithm to be used
 */
function createMAC(algorithm) {
    // const keyLength = MACKeyLengths[algorithm];
    const MAC = PRF_1.HMAC[algorithm];
    const ret = ((data, keyMaterial, sourceConnEnd) => {
        // find the right hash params
        const mac_key = (sourceConnEnd === "server") ? keyMaterial.server_write_MAC_key : keyMaterial.client_write_MAC_key;
        // and return the hash
        return MAC(mac_key, data);
    });
    // append length information
    ret.keyAndHashLength = MAC.keyAndHashLenth;
    return ret;
}
exports.createMAC = createMAC;
/** Creates a dummy cipher which is just an identity operation */
function createNullCipher() {
    const ret = ((packet, _1, _2) => new DTLSCiphertext_1.DTLSCiphertext(packet.type, packet.version, packet.epoch, packet.sequence_number, packet.fragment));
    ret.keyLength = 0;
    ret.fixedIvLength = 0;
    ret.recordIvLength = 0;
    return ret;
}
/** Creates a dummy decipher which is just an identity operation */
function createNullDecipher() {
    const ret = ((packet, _1, _2) => new DTLSCompressed_1.DTLSCompressed(packet.type, packet.version, packet.epoch, packet.sequence_number, packet.fragment));
    ret.keyLength = 0;
    ret.fixedIvLength = 0;
    ret.recordIvLength = 0;
    return ret;
}
/** Creates a dummy MAC which just returns an empty Buffer */
function createNullMAC() {
    const ret = ((data, _1, _2) => Buffer.from([]));
    ret.keyAndHashLength = 0;
    return ret;
}
// TODO: Documentation
class CipherSuite extends TLSStruct_1.TLSStruct {
    constructor(id, keyExchange, macAlgorithm, prfAlgorithm, cipherType, algorithm, verify_data_length = 12) {
        super(CipherSuite.__spec);
        this.id = id;
        this.keyExchange = keyExchange;
        this.macAlgorithm = macAlgorithm;
        this.prfAlgorithm = prfAlgorithm;
        this.cipherType = cipherType;
        this.algorithm = algorithm;
        this.verify_data_length = verify_data_length;
    }
    static createEmpty() {
        return new CipherSuite(null, null, null, null, null);
    }
    get Cipher() {
        if (this._cipher == undefined) {
            this._cipher = this.createCipher();
        }
        return this._cipher;
    }
    createCipher() {
        const ret = (() => {
            switch (this.cipherType) {
                case null:
                    return createNullCipher();
                case "block":
                    return BlockCipher.createCipher(this.algorithm, this.MAC);
                case "aead":
                    return AEADCipher.createCipher(this.algorithm);
                default:
                    throw new Error(`createCipher not implemented for ${this.cipherType} cipher`);
            }
        })();
        if (!ret.keyLength)
            ret.keyLength = 0;
        if (!ret.fixedIvLength)
            ret.fixedIvLength = 0;
        if (!ret.recordIvLength)
            ret.recordIvLength = 0;
        return ret;
    }
    specifyCipher(keyMaterial, connEnd) {
        const ret = ((plaintext) => this.Cipher(plaintext, keyMaterial, connEnd));
        ret.inner = this.Cipher;
        return ret;
    }
    get Decipher() {
        if (this._decipher == undefined) {
            this._decipher = this.createDecipher();
        }
        return this._decipher;
    }
    createDecipher() {
        const ret = (() => {
            switch (this.cipherType) {
                case null:
                    return createNullDecipher();
                case "block":
                    return BlockCipher.createDecipher(this.algorithm, this.MAC);
                case "aead":
                    return AEADCipher.createDecipher(this.algorithm);
                default:
                    throw new Error(`createDecipher not implemented for ${this.cipherType} cipher`);
            }
        })();
        if (!ret.keyLength)
            ret.keyLength = 0;
        if (!ret.fixedIvLength)
            ret.fixedIvLength = 0;
        if (!ret.recordIvLength)
            ret.recordIvLength = 0;
        return ret;
    }
    specifyDecipher(keyMaterial, connEnd) {
        const ret = ((packet) => this.Decipher(packet, keyMaterial, connEnd));
        ret.inner = this.Decipher;
        return ret;
    }
    get MAC() {
        if (this._mac == undefined) {
            this._mac = this.createMAC();
        }
        return this._mac;
    }
    createMAC() {
        switch (this.cipherType) {
            case null:
            case "aead":
                return createNullMAC();
            case "block":
                if (this.macAlgorithm == null) {
                    return createNullMAC();
                }
                return createMAC(this.macAlgorithm);
            default:
                throw new Error(`createMAC not implemented for ${this.cipherType} cipher`);
        }
    }
}
CipherSuite.__spec = {
    id: TypeSpecs.uint16,
};
CipherSuite.spec = TypeSpecs.define.Struct(CipherSuite);
exports.CipherSuite = CipherSuite;
