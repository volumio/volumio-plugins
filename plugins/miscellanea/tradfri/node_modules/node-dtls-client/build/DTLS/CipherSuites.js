"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const object_polyfill_1 = require("../lib/object-polyfill");
const CipherSuite_1 = require("../TLS/CipherSuite");
// block sizes etc. see https://tools.ietf.org/html/rfc5246 page 83
exports.CipherSuites = {
    TLS_NULL_WITH_NULL_NULL: new CipherSuite_1.CipherSuite(0x0000, null, null, null, null),
    TLS_RSA_WITH_NULL_MD5: new CipherSuite_1.CipherSuite(0x0001, "rsa", "md5", "sha256", null),
    TLS_RSA_WITH_NULL_SHA: new CipherSuite_1.CipherSuite(0x0002, "rsa", "sha1", "sha256", null),
    TLS_RSA_WITH_NULL_SHA256: new CipherSuite_1.CipherSuite(0x003B, "rsa", "sha256", "sha256", null),
    TLS_RSA_WITH_3DES_EDE_CBC_SHA: new CipherSuite_1.CipherSuite(0x000A, "rsa", "sha1", "sha256", "block", "des-ede3-cbc"),
    TLS_RSA_WITH_AES_128_CBC_SHA: new CipherSuite_1.CipherSuite(0x002F, "rsa", "sha1", "sha256", "block", "aes-128-cbc"),
    TLS_RSA_WITH_AES_256_CBC_SHA: new CipherSuite_1.CipherSuite(0x0035, "rsa", "sha1", "sha256", "block", "aes-256-cbc"),
    TLS_RSA_WITH_AES_128_CBC_SHA256: new CipherSuite_1.CipherSuite(0x003C, "rsa", "sha256", "sha256", "block", "aes-128-cbc"),
    TLS_RSA_WITH_AES_256_CBC_SHA256: new CipherSuite_1.CipherSuite(0x003D, "rsa", "sha256", "sha256", "block", "aes-256-cbc"),
    TLS_DH_DSS_WITH_3DES_EDE_CBC_SHA: new CipherSuite_1.CipherSuite(0x000D, "dh_dss", "sha1", "sha256", "block", "des-ede3-cbc"),
    TLS_DH_RSA_WITH_3DES_EDE_CBC_SHA: new CipherSuite_1.CipherSuite(0x0010, "dh_rsa", "sha1", "sha256", "block", "des-ede3-cbc"),
    TLS_DHE_DSS_WITH_3DES_EDE_CBC_SHA: new CipherSuite_1.CipherSuite(0x0013, "dhe_dss", "sha1", "sha256", "block", "des-ede3-cbc"),
    TLS_DHE_RSA_WITH_3DES_EDE_CBC_SHA: new CipherSuite_1.CipherSuite(0x0016, "dhe_rsa", "sha1", "sha256", "block", "des-ede3-cbc"),
    TLS_DH_DSS_WITH_AES_128_CBC_SHA: new CipherSuite_1.CipherSuite(0x0030, "dh_dss", "sha1", "sha256", "block", "aes-128-cbc"),
    TLS_DH_RSA_WITH_AES_128_CBC_SHA: new CipherSuite_1.CipherSuite(0x0031, "dh_rsa", "sha1", "sha256", "block", "aes-128-cbc"),
    TLS_DHE_DSS_WITH_AES_128_CBC_SHA: new CipherSuite_1.CipherSuite(0x0032, "dhe_dss", "sha1", "sha256", "block", "aes-128-cbc"),
    TLS_DHE_RSA_WITH_AES_128_CBC_SHA: new CipherSuite_1.CipherSuite(0x0033, "dhe_rsa", "sha1", "sha256", "block", "aes-128-cbc"),
    TLS_DH_DSS_WITH_AES_256_CBC_SHA: new CipherSuite_1.CipherSuite(0x0036, "dh_dss", "sha1", "sha256", "block", "aes-256-cbc"),
    TLS_DH_RSA_WITH_AES_256_CBC_SHA: new CipherSuite_1.CipherSuite(0x0037, "dh_rsa", "sha1", "sha256", "block", "aes-256-cbc"),
    TLS_DHE_DSS_WITH_AES_256_CBC_SHA: new CipherSuite_1.CipherSuite(0x0038, "dhe_dss", "sha1", "sha256", "block", "aes-256-cbc"),
    TLS_DHE_RSA_WITH_AES_256_CBC_SHA: new CipherSuite_1.CipherSuite(0x0039, "dhe_rsa", "sha1", "sha256", "block", "aes-256-cbc"),
    TLS_DH_DSS_WITH_AES_128_CBC_SHA256: new CipherSuite_1.CipherSuite(0x003E, "dh_dss", "sha256", "sha256", "block", "aes-128-cbc"),
    TLS_DH_RSA_WITH_AES_128_CBC_SHA256: new CipherSuite_1.CipherSuite(0x003F, "dh_rsa", "sha256", "sha256", "block", "aes-128-cbc"),
    TLS_DHE_DSS_WITH_AES_128_CBC_SHA256: new CipherSuite_1.CipherSuite(0x0040, "dhe_dss", "sha256", "sha256", "block", "aes-128-cbc"),
    TLS_DHE_RSA_WITH_AES_128_CBC_SHA256: new CipherSuite_1.CipherSuite(0x0067, "dhe_rsa", "sha256", "sha256", "block", "aes-128-cbc"),
    TLS_DH_DSS_WITH_AES_256_CBC_SHA256: new CipherSuite_1.CipherSuite(0x0068, "dh_dss", "sha256", "sha256", "block", "aes-256-cbc"),
    TLS_DH_RSA_WITH_AES_256_CBC_SHA256: new CipherSuite_1.CipherSuite(0x0069, "dh_rsa", "sha256", "sha256", "block", "aes-256-cbc"),
    TLS_DHE_DSS_WITH_AES_256_CBC_SHA256: new CipherSuite_1.CipherSuite(0x006A, "dhe_dss", "sha256", "sha256", "block", "aes-256-cbc"),
    TLS_DHE_RSA_WITH_AES_256_CBC_SHA256: new CipherSuite_1.CipherSuite(0x006B, "dhe_rsa", "sha256", "sha256", "block", "aes-256-cbc"),
    // PSK cipher suites from https://tools.ietf.org/html/rfc4279
    TLS_PSK_WITH_3DES_EDE_CBC_SHA: new CipherSuite_1.CipherSuite(0x008B, "psk", "sha1", "sha256", "block", "des-ede3-cbc"),
    TLS_PSK_WITH_AES_128_CBC_SHA: new CipherSuite_1.CipherSuite(0x008C, "psk", "sha1", "sha256", "block", "aes-128-cbc"),
    TLS_PSK_WITH_AES_256_CBC_SHA: new CipherSuite_1.CipherSuite(0x008D, "psk", "sha1", "sha256", "block", "aes-256-cbc"),
    TLS_DHE_PSK_WITH_3DES_EDE_CBC_SHA: new CipherSuite_1.CipherSuite(0x008F, "dhe_psk", "sha1", "sha256", "block", "des-ede3-cbc"),
    TLS_DHE_PSK_WITH_AES_128_CBC_SHA: new CipherSuite_1.CipherSuite(0x0090, "dhe_psk", "sha1", "sha256", "block", "aes-128-cbc"),
    TLS_DHE_PSK_WITH_AES_256_CBC_SHA: new CipherSuite_1.CipherSuite(0x0091, "dhe_psk", "sha1", "sha256", "block", "aes-256-cbc"),
    TLS_RSA_PSK_WITH_3DES_EDE_CBC_SHA: new CipherSuite_1.CipherSuite(0x0093, "rsa_psk", "sha1", "sha256", "block", "des-ede3-cbc"),
    TLS_RSA_PSK_WITH_AES_128_CBC_SHA: new CipherSuite_1.CipherSuite(0x0094, "rsa_psk", "sha1", "sha256", "block", "aes-128-cbc"),
    TLS_RSA_PSK_WITH_AES_256_CBC_SHA: new CipherSuite_1.CipherSuite(0x0095, "rsa_psk", "sha1", "sha256", "block", "aes-256-cbc"),
    // forbidden in DTLS:
    // TLS_PSK_WITH_RC4_128_SHA:			0x008A,
    // TLS_DHE_PSK_WITH_RC4_128_SHA:		0x008E,
    // TLS_RSA_PSK_WITH_RC4_128_SHA:		0x0092,
    // PSK cipher suites from https://tools.ietf.org/html/rfc5487
    TLS_PSK_WITH_AES_128_CBC_SHA256: new CipherSuite_1.CipherSuite(0x00AE, "psk", "sha256", "sha256", "block", "aes-128-cbc"),
    TLS_PSK_WITH_AES_256_CBC_SHA384: new CipherSuite_1.CipherSuite(0x00AF, "psk", "sha384", "sha384", "block", "aes-256-cbc"),
    TLS_DHE_PSK_WITH_AES_128_CBC_SHA256: new CipherSuite_1.CipherSuite(0x00B2, "dhe_psk", "sha256", "sha256", "block", "aes-128-cbc"),
    TLS_DHE_PSK_WITH_AES_256_CBC_SHA384: new CipherSuite_1.CipherSuite(0x00B3, "dhe_psk", "sha384", "sha384", "block", "aes-256-cbc"),
    TLS_RSA_PSK_WITH_AES_128_CBC_SHA256: new CipherSuite_1.CipherSuite(0x00B6, "rsa_psk", "sha256", "sha256", "block", "aes-128-cbc"),
    TLS_RSA_PSK_WITH_AES_256_CBC_SHA384: new CipherSuite_1.CipherSuite(0x00B7, "rsa_psk", "sha384", "sha384", "block", "aes-256-cbc"),
    // AEAD-GCM
    TLS_PSK_WITH_AES_128_GCM_SHA256: new CipherSuite_1.CipherSuite(0x00A8, "psk", null, "sha256", "aead", "aes-128-gcm"),
    TLS_PSK_WITH_AES_256_GCM_SHA384: new CipherSuite_1.CipherSuite(0x00A9, "psk", null, "sha384", "aead", "aes-256-gcm"),
    // PSK cipher suites from https://tools.ietf.org/html/rfc6655
    TLS_PSK_WITH_AES_128_CCM: new CipherSuite_1.CipherSuite(0xC0A4, "psk", null, "sha256", "aead", "aes-128-ccm"),
    TLS_PSK_WITH_AES_256_CCM: new CipherSuite_1.CipherSuite(0xC0A5, "psk", null, "sha256", "aead", "aes-256-ccm"),
    TLS_DHE_PSK_WITH_AES_128_CCM: new CipherSuite_1.CipherSuite(0xC0A6, "dhe_psk", null, "sha256", "aead", "aes-128-ccm"),
    TLS_DHE_PSK_WITH_AES_256_CCM: new CipherSuite_1.CipherSuite(0xC0A7, "dhe_psk", null, "sha256", "aead", "aes-256-ccm"),
    TLS_PSK_WITH_AES_128_CCM_8: new CipherSuite_1.CipherSuite(0xC0A8, "psk", null, "sha256", "aead", "aes-128-ccm8"),
    TLS_PSK_WITH_AES_256_CCM_8: new CipherSuite_1.CipherSuite(0xC0A9, "psk", null, "sha256", "aead", "aes-256-ccm8"),
    TLS_PSK_DHE_WITH_AES_128_CCM_8: new CipherSuite_1.CipherSuite(0xC0AA, "dhe_psk", null, "sha256", "aead", "aes-128-ccm8"),
    TLS_PSK_DHE_WITH_AES_256_CCM_8: new CipherSuite_1.CipherSuite(0xC0AB, "dhe_psk", null, "sha256", "aead", "aes-256-ccm8"),
};
// define index accessors
for (const [key, cs] of object_polyfill_1.entries(exports.CipherSuites)) {
    if (!exports.CipherSuites.hasOwnProperty("" + cs.id)) {
        exports.CipherSuites[cs.id] = cs;
    }
}
