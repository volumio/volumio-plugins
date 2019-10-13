"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const BitConverter_1 = require("../lib/BitConverter");
const object_polyfill_1 = require("../lib/object-polyfill");
const util = require("../lib/util");
const TypeSpecs = require("./TypeSpecs");
const Vector_1 = require("./Vector");
/**
 * Basisklasse für TLS-Objekte
 */
class TLSStruct {
    constructor(spec, initial) {
        this.propertyDefinitions = [];
        // Eigenschaften aus Spec kopieren
        this.__spec__ = spec;
        for (const [key, value] of object_polyfill_1.entries(spec)) {
            this.propertyDefinitions.push({
                name: key,
                type: value,
            });
            if (initial != undefined && initial.hasOwnProperty(key)) {
                // sonst evtl. die Eigenschaft initialisieren
                this[key] = initial[key];
            }
        }
    }
    /**
     * Deserialisiert die Eigenschaften dieses Objekts aus dem angegebenen Buffer
     * @param buf - Der Buffer, aus dem gelesen werden soll
     * @param offset - Der Index, ab dem gelesen werden soll
     */
    deserialize(buf, offset = 0) {
        let delta = 0;
        for (const def of this.propertyDefinitions) {
            // Welche Eigenschaft wird ausgelesen?
            const propName = def.name;
            const type = def.type;
            let result;
            switch (type.type) {
                case "number":
                case "enum":
                    const bitSize = TypeSpecs.getPrimitiveSize(type);
                    result = { result: BitConverter_1.bufferToNumber(buf, bitSize, offset + delta), readBytes: bitSize / 8 };
                    break;
                case "vector":
                    result = Vector_1.Vector.from(type, buf, offset + delta);
                    break;
                case "struct":
                    result = type.structType.from(type, buf, offset + delta);
                    break;
                case "buffer":
                    if (type.maxLength === Number.POSITIVE_INFINITY) {
                        // unbound Buffer, copy the remaining bytes
                        const ret = Buffer.allocUnsafe(buf.length - (offset + delta));
                        buf.copy(ret, 0, offset + delta);
                        result = { result: ret, readBytes: ret.length };
                    }
                    else {
                        // normal Buffer (essentially Vector<uint8>)
                        let length = type.maxLength;
                        let lengthBytes = 0;
                        // for variable length Buffers, read the actual length first
                        if (TypeSpecs.Buffer.isVariableLength(type)) {
                            const lengthBits = (8 * util.fitToWholeBytes(type.maxLength));
                            length = BitConverter_1.bufferToNumber(buf, lengthBits, offset + delta);
                            lengthBytes += lengthBits / 8;
                        }
                        // copy the data into the new buffer
                        const ret = Buffer.allocUnsafe(length);
                        buf.copy(ret, 0, offset + delta + lengthBytes, offset + delta + lengthBytes + length);
                        result = { result: ret, readBytes: lengthBytes + length };
                    }
                    break;
            }
            // Wert merken und im Array voranschreiten
            this[propName] = result.result;
            delta += result.readBytes;
        }
        return delta;
    }
    /**
     * Erzeugt eine TLSStruct der angegebenen Definition aus einem Byte-Array
     * @param spec - Definiert, wie das deserialisierte Objekt aufgebaut ist
     * @param arr - Das Array, aus dem gelesen werden soll
     * @param offset - Der Index, ab dem gelesen werden soll
     */
    static from(spec, buf, offset) {
        const ret = spec.structType.createEmpty();
        return { result: ret, readBytes: ret.deserialize(buf, offset) };
    }
    /**
     * Serialisiert das Objekt in ein ein Byte-Array
     */
    serialize() {
        const ret = this.propertyDefinitions
            .map(def => {
            // Welche Eigenschaft wird ausgelesen?
            const propName = def.name;
            const type = def.type;
            const propValue = this[propName];
            switch (type.type) {
                case "number":
                case "enum":
                    const bitSize = TypeSpecs.getPrimitiveSize(type);
                    return BitConverter_1.numberToBuffer(propValue, bitSize);
                case "vector":
                    // we know propValue is a Vector<T> but we don't know or care about T
                    return propValue.serialize(type);
                case "struct":
                    return propValue.serialize();
                case "buffer":
                    // just return a copy of the buffer
                    let result = Buffer.from(propValue);
                    // for variable length buffers prepend the length
                    if (TypeSpecs.Buffer.isVariableLength(type)) {
                        const lengthBits = (8 * util.fitToWholeBytes(type.maxLength));
                        result = Buffer.concat([
                            BitConverter_1.numberToBuffer(result.length, lengthBits),
                            result,
                        ]);
                    }
                    return result;
            }
        });
        return Buffer.concat(ret);
    }
}
exports.TLSStruct = TLSStruct;
