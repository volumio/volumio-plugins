"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BitConverter_1 = require("../lib/BitConverter");
const util_1 = require("../lib/util");
const TypeSpecs = require("./TypeSpecs");
class Vector {
    constructor(items = []) {
        this.items = items;
    }
    serialize(spec) {
        // optional, empty vectors resolve to empty buffers
        if (this.items.length === 0 && spec.optional) {
            return Buffer.allocUnsafe(0);
        }
        // serialize all the items into single buffers
        let serializedItems;
        let bitSize;
        switch (spec.itemSpec.type) {
            case "number":
            case "enum":
                bitSize = TypeSpecs.getPrimitiveSize(spec.itemSpec);
                serializedItems = this.items.map(v => BitConverter_1.numberToBuffer(v, bitSize));
                break;
            case "struct":
                serializedItems = this.items.map(v => v.serialize());
        }
        let ret = Buffer.concat(serializedItems);
        // for variable length vectors, prepend the maximum length
        if (TypeSpecs.Vector.isVariableLength(spec)) {
            const lengthBits = (8 * util_1.fitToWholeBytes(spec.maxLength));
            ret = Buffer.concat([
                BitConverter_1.numberToBuffer(ret.length, lengthBits),
                ret,
            ]);
        }
        return ret;
    }
    deserialize(spec, buf, offset = 0) {
        // for variable length vectors, read the length first
        let length = spec.maxLength;
        let delta = 0;
        if (TypeSpecs.Vector.isVariableLength(spec)) {
            const lengthBits = (8 * util_1.fitToWholeBytes(spec.maxLength));
            length = BitConverter_1.bufferToNumber(buf, lengthBits, offset);
            delta += lengthBits / 8;
        }
        let i;
        switch (spec.itemSpec.type) {
            case "number":
            case "enum":
                const bitSize = TypeSpecs.getPrimitiveSize(spec.itemSpec);
                for (i = 0; i < length; i += bitSize / 8) {
                    this.items.push(BitConverter_1.bufferToNumber(buf, bitSize, offset + delta)); // we know this is a number!
                    delta += bitSize / 8;
                }
                break;
            case "struct":
                i = 0;
                while (i < length) {
                    const item = spec.itemSpec.structType.from(spec.itemSpec, buf, offset + delta);
                    if (item.readBytes <= 0) {
                        // this shouldn't happen, but we don't want to introduce an infinite loop
                        throw new Error(`Zero or less bytes read while parsing TLS struct.`);
                    }
                    i += item.readBytes;
                    delta += item.readBytes;
                    this.items.push(item.result); // we know this is a struct/ISerializable
                }
        }
        return delta;
    }
    static from(spec, buf, offset) {
        const ret = new Vector();
        if (buf.length === 0) {
            if (spec.optional)
                return { result: ret, readBytes: 0 };
            throw new Error("nothing to deserialize");
        }
        else {
            return { result: ret, readBytes: ret.deserialize(spec, buf, offset) };
        }
    }
}
exports.Vector = Vector;
