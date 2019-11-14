"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TypeSpecs = require("../TLS/TypeSpecs");
var Cookie;
(function (Cookie) {
    Cookie.spec = TypeSpecs.define.Buffer(0, Math.pow(2, 8) - 1);
})(Cookie = exports.Cookie || (exports.Cookie = {}));
