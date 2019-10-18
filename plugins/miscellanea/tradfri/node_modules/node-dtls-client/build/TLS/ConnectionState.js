"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CipherSuites_1 = require("../DTLS/CipherSuites");
const ProtocolVersion_1 = require("../TLS/ProtocolVersion");
const PRF_1 = require("./PRF");
const TypeSpecs = require("./TypeSpecs");
var CompressionMethod;
(function (CompressionMethod) {
    CompressionMethod[CompressionMethod["null"] = 0] = "null";
})(CompressionMethod = exports.CompressionMethod || (exports.CompressionMethod = {}));
// tslint:disable-next-line:no-namespace
(function (CompressionMethod) {
    CompressionMethod.spec = TypeSpecs.define.Enum("uint8", CompressionMethod);
})(CompressionMethod = exports.CompressionMethod || (exports.CompressionMethod = {}));
const master_secret_length = 48;
const client_random_length = 32;
const server_random_length = 32;
class ConnectionState {
    constructor() {
        // This doesn't seem to be used:
        // constructor(values?: Partial<ConnectionState>) {
        // 	if (values) {
        // 		for (const [key, value] of entries(values)) {
        // 			if (this.hasOwnProperty(key)) (this as any)[key] = value;
        // 		}
        // 	}
        // }
        this.entity = "client";
        this.cipherSuite = CipherSuites_1.CipherSuites.TLS_NULL_WITH_NULL_NULL;
        this.protocolVersion = new ProtocolVersion_1.ProtocolVersion(~1, ~0); // default to DTLSv1.0 during handshakes
        this.compression_algorithm = CompressionMethod.null;
    }
    get Cipher() {
        if (this._cipher == undefined) {
            this._cipher = this.cipherSuite.specifyCipher(this.key_material, this.entity);
        }
        return this._cipher;
    }
    get Decipher() {
        if (this._decipher == undefined) {
            this._decipher = this.cipherSuite.specifyDecipher(this.key_material, this.entity);
        }
        return this._decipher;
    }
    /**
     * Compute the master secret from a given premaster secret
     * @param preMasterSecret - The secret used to calculate the master secret
     * @param clientHelloRandom - The random data from the client hello message
     * @param serverHelloRandom - The random data from the server hello message
     */
    computeMasterSecret(preMasterSecret) {
        this.master_secret = PRF_1.PRF[this.cipherSuite.prfAlgorithm](preMasterSecret.serialize(), "master secret", Buffer.concat([this.client_random, this.server_random]), master_secret_length);
        // now we can compute the key material
        this.computeKeyMaterial();
    }
    /**
     * Calculates the key components
     */
    computeKeyMaterial() {
        const keyBlock = PRF_1.PRF[this.cipherSuite.prfAlgorithm](this.master_secret, "key expansion", Buffer.concat([this.server_random, this.client_random]), 2 * (this.cipherSuite.MAC.keyAndHashLength + this.cipherSuite.Cipher.keyLength + this.cipherSuite.Cipher.fixedIvLength));
        let offset = 0;
        function read(length) {
            const ret = keyBlock.slice(offset, offset + length);
            offset += length;
            return ret;
        }
        this.key_material = {
            client_write_MAC_key: read(this.cipherSuite.MAC.keyAndHashLength),
            server_write_MAC_key: read(this.cipherSuite.MAC.keyAndHashLength),
            client_write_key: read(this.cipherSuite.Cipher.keyLength),
            server_write_key: read(this.cipherSuite.Cipher.keyLength),
            client_write_IV: read(this.cipherSuite.Cipher.fixedIvLength),
            server_write_IV: read(this.cipherSuite.Cipher.fixedIvLength),
        };
    }
}
exports.ConnectionState = ConnectionState;
