var binding = require("bindings")("node-aead-crypto.node");

module.exports = {
    ccm: {
        encrypt: binding.CcmEncrypt,
        decrypt: binding.CcmDecrypt,
    },
    gcm: {
        encrypt: binding.GcmEncrypt,
        decrypt: binding.GcmDecrypt,
    }
}