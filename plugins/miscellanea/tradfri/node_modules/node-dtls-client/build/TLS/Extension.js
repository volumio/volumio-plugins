"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const TLSStruct_1 = require("./TLSStruct");
const TypeSpecs = require("./TypeSpecs");
var ExtensionType;
(function (ExtensionType) {
    ExtensionType[ExtensionType["signature_algorithms"] = 13] = "signature_algorithms";
})(ExtensionType = exports.ExtensionType || (exports.ExtensionType = {}));
(function (ExtensionType) {
    ExtensionType.spec = TypeSpecs.define.Enum("uint16", ExtensionType);
})(ExtensionType = exports.ExtensionType || (exports.ExtensionType = {}));
class Extension extends TLSStruct_1.TLSStruct {
    constructor(extension_type, extension_data) {
        super(Extension.__spec);
        this.extension_type = extension_type;
        this.extension_data = extension_data;
    }
    static createEmpty() {
        return new Extension(null, null);
    }
}
Extension.__spec = {
    extension_type: ExtensionType.spec,
    extension_data: TypeSpecs.define.Buffer(0, Math.pow(2, 16) - 1),
};
Extension.spec = TypeSpecs.define.Struct(Extension);
exports.Extension = Extension;
