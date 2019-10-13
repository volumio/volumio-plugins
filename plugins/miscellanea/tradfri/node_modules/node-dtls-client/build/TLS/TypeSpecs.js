"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getPrimitiveSize(spec) {
    return +spec.size.substr("uint".length);
}
exports.getPrimitiveSize = getPrimitiveSize;
var Vector;
(function (Vector) {
    function isVariableLength(spec) {
        return spec.maxLength !== spec.minLength;
    }
    Vector.isVariableLength = isVariableLength;
})(Vector = exports.Vector || (exports.Vector = {}));
var Buffer;
(function (Buffer) {
    function isVariableLength(spec) {
        return spec.maxLength !== spec.minLength;
    }
    Buffer.isVariableLength = isVariableLength;
})(Buffer = exports.Buffer || (exports.Buffer = {}));
// Shortcuts:
exports.define = {
    Enum: (size, enumType) => ({ type: "enum", size, enumType }),
    Number: (size) => ({ type: "number", size }),
    Struct: (structType) => ({
        type: "struct",
        structType: structType,
    }),
    Vector: (itemSpec, minLength = 0, maxLength = minLength, optional = false) => ({
        type: "vector",
        itemSpec,
        minLength, maxLength,
        optional,
    }),
    Buffer: (minLength = Number.POSITIVE_INFINITY, maxLength = minLength) => ({
        type: "buffer",
        minLength, maxLength,
    }),
};
exports.uint8 = Object.freeze(exports.define.Number("uint8"));
exports.uint16 = Object.freeze(exports.define.Number("uint16"));
exports.uint24 = Object.freeze(exports.define.Number("uint24"));
exports.uint32 = Object.freeze(exports.define.Number("uint32"));
exports.uint48 = Object.freeze(exports.define.Number("uint48"));
exports.uint64 = Object.freeze(exports.define.Number("uint64"));
