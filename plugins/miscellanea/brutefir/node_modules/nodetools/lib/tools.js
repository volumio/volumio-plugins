"use strict";

var tools = {

	crypto: null,

	base64Decode: function(str) {
		return new Buffer(str, 'base64').toString('utf8');
	},

	base64Encode: function(str) {
		return new Buffer(str).toString('base64');
	},

	urlEncode: function(str) {
		return encodeURIComponent(str);
	},

	urlDecode: function(str) {
		return decodeURIComponent(str);
	},

	hash: function(str, algorthim) {

		if(this.crypto == null) {
			this.crypto = require('crypto');
		}

		algorthim = typeof algorthim !== 'undefined' ? algorthim : 'md5';

		return this.crypto.createHash(algorthim).update(str).digest("hex");
	},

	validateEmail: function(str) {
    	var emailReg = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
    	return emailReg.test(str);
	},

	isNumeric: function(str) {
		return !(isNaN(parseInt(str)));
	},

	isSet: function(str) {
		return (typeof str !== "undefined")
	}

}

module.exports = exports = {
					hash: tools.hash,
					base64Encode: tools.base64Encode,
					base64Decode: tools.base64Decode,
					urlEncode: tools.urlEncode,
					urlDecode: tools.urlDecode,
					validateEmail: tools.validateEmail,
					isNumeric: tools.isNumeric,
					isSet: tools.isSet
				};