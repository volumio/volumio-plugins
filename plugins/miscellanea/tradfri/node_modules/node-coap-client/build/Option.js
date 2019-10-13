"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function numberToBuffer(value) {
    const ret = [];
    while (value > 0) {
        ret.unshift(value & 0xff);
        value >>>= 8;
    }
    return Buffer.from(ret);
}
/**
 * Abstract base class for all message options. Provides methods to parse and serialize.
 */
class Option {
    constructor(code, name, rawValue) {
        this.code = code;
        this.name = name;
        this.rawValue = rawValue;
    }
    /*
          0   1   2   3   4   5   6   7
        +---+---+---+---+---+---+---+---+
        |           | NoCacheKey| U | C |
        +---+---+---+---+---+---+---+---+
    */
    get noCacheKey() {
        return (this.code & 0b11100) === 0b11100;
    }
    get unsafe() {
        return (this.code & 0b10) === 0b10;
    }
    get critical() {
        return (this.code & 0b1) === 0b1;
    }
    /*
    
         0   1   2   3   4   5   6   7
       +---------------+---------------+
       |  Option Delta | Option Length |   1 byte
       +---------------+---------------+
       /         Option Delta          /   0-2 bytes
       \          (extended)           \
       +-------------------------------+
       /         Option Length         /   0-2 bytes
       \          (extended)           \
       +-------------------------------+
       \                               \
       /         Option Value          /   0 or more bytes
       \                               \
       +-------------------------------+
    */
    /**
     * parses a CoAP option from the given buffer. The buffer must start at the option
     * @param buf - the buffer to read from
     * @param prevCode - The option code of the previous option
     */
    static parse(buf, prevCode = 0) {
        let delta = (buf[0] >>> 4) & 0b1111;
        let length = buf[0] & 0b1111;
        let dataStart = 1;
        // handle special cases for the delta
        switch (delta) {
            case 13:
                delta = buf[dataStart] + 13;
                dataStart += 1;
                break;
            case 14:
                delta = buf.readUInt16BE(dataStart) + 269;
                dataStart += 2;
                break;
            case 15:
                throw new Error("invalid option format");
            default:
            // all good
        }
        // handle special cases for the length
        switch (length) {
            case 13:
                length = buf[dataStart] + 13;
                dataStart += 1;
                break;
            case 14:
                length = buf.readUInt16BE(dataStart) + 269;
                dataStart += 2;
                break;
            case 15:
                throw new Error("invalid option format");
            default:
            // all good
        }
        const rawValue = Buffer.from(buf.slice(dataStart, dataStart + length));
        const code = prevCode + delta;
        return {
            result: optionConstructors[code](rawValue),
            readBytes: dataStart + length,
        };
    }
    /**
     * serializes this option into a buffer
     * @param prevCode - The option code of the previous option
     */
    serialize(prevCode) {
        let delta = this.code - prevCode;
        let extraDelta = -1;
        let length = this.rawValue.length;
        let extraLength = -1;
        const totalLength = 1
            + (delta >= 13 ? 1 : 0)
            + (delta >= 269 ? 1 : 0)
            + (length >= 13 ? 1 : 0)
            + (length >= 269 ? 1 : 0)
            + length;
        const ret = Buffer.allocUnsafe(totalLength);
        let dataStart = 1;
        // check if we need to split the delta in 2 parts
        if (delta < 13) { /* all good */
        }
        else if (delta < 269) {
            extraDelta = delta - 13;
            delta = 13;
            ret[dataStart] = extraDelta;
            dataStart += 1;
        }
        else {
            extraDelta = delta - 14;
            delta = 14;
            ret.writeUInt16BE(extraDelta, dataStart);
            dataStart += 2;
        }
        // check if we need to split the length in 2 parts
        if (length < 13) { /* all good */
        }
        else if (length < 269) {
            extraLength = length - 13;
            length = 13;
            ret[dataStart] = extraLength;
            dataStart += 1;
        }
        else {
            extraLength = length - 14;
            length = 14;
            ret.writeUInt16BE(extraLength, dataStart);
            dataStart += 2;
        }
        // write the delta and length
        ret[0] = (delta << 4) + length;
        // copy the data
        this.rawValue.copy(ret, dataStart, 0);
        return ret;
    }
}
exports.Option = Option;
/**
 * Specialized Message option for numeric contents
 */
class NumericOption extends Option {
    constructor(code, name, repeatable, maxLength, rawValue) {
        super(code, name, rawValue);
        this.name = name;
        this.repeatable = repeatable;
        this.maxLength = maxLength;
    }
    get value() {
        return this.rawValue.reduce((acc, cur) => acc * 256 + cur, 0);
    }
    set value(value) {
        const ret = [];
        while (value > 0) {
            ret.unshift(value & 0xff);
            value >>>= 8;
        }
        if (ret.length > this.maxLength) {
            throw new Error("cannot serialize this value because it is too large");
        }
        this.rawValue = Buffer.from(ret);
    }
    static create(code, name, repeatable, maxLength, rawValue) {
        return new NumericOption(code, name, repeatable, maxLength, rawValue);
    }
    toString() {
        return `${this.name} (${this.code}): ${this.value}`;
    }
}
exports.NumericOption = NumericOption;
/**
 * Specialized Message optionis for blockwise transfer
 */
class BlockOption extends NumericOption {
    static create(code, name, repeatable, maxLength, rawValue) {
        return new BlockOption(code, name, repeatable, maxLength, rawValue);
    }
    /**
     * The size exponent of this block in the range 0..6
     * The actual block size is calculated by 2**(4 + exp)
     */
    get sizeExponent() {
        return this.value & 0b111;
    }
    set sizeExponent(value) {
        if (value < 0 || value > 6) {
            throw new Error("the size exponent must be in the range of 0..6");
        }
        // overwrite the last 3 bits
        this.value = (this.value & ~0b111) | value;
    }
    /**
     * The size of this block in bytes
     */
    get blockSize() {
        return 1 << (this.sizeExponent + 4);
    }
    /**
     * Indicates if there are more blocks following after this one.
     */
    get isLastBlock() {
        const moreBlocks = (this.value & 0b1000) === 0b1000;
        return !moreBlocks;
    }
    set isLastBlock(value) {
        const moreBlocks = !value;
        // overwrite the 4th bit
        this.value = (this.value & ~0b1000) | (moreBlocks ? 0b1000 : 0);
    }
    /**
     * The sequence number of this block.
     * When present in a request message, this determines the number of the block being requested
     * When present in a response message, this indicates the number of the provided block
     */
    get blockNumber() {
        return this.value >>> 4;
    }
    set blockNumber(value) {
        // TODO: check if we need to update the value length
        this.value = (value << 4) | (this.value & 0b1111);
    }
    /**
     * Returns the position of the first byte of this block in the complete message
     */
    get byteOffset() {
        // from the spec:
        // Implementation note:  As an implementation convenience, "(val & ~0xF)
        // << (val & 7)", i.e., the option value with the last 4 bits masked
        // out, shifted to the left by the value of SZX, gives the byte
        // position of the first byte of the block being transferred.
        return (this.value & ~0b1111) << (this.value & 0b111);
    }
    toString() {
        return `${this.name} (${this.code}): ${this.blockNumber}/${this.isLastBlock ? 0 : 1}/${this.blockSize}`;
    }
}
exports.BlockOption = BlockOption;
/**
 * Specialized Message options for binary (and empty) content.
 */
class BinaryOption extends Option {
    constructor(code, name, repeatable, minLength, maxLength, rawValue) {
        super(code, name, rawValue);
        this.name = name;
        this.repeatable = repeatable;
        this.minLength = minLength;
        this.maxLength = maxLength;
    }
    get value() {
        return this.rawValue;
    }
    set value(value) {
        if (value == null) {
            if (this.minLength > 0)
                throw new Error("cannot assign null to a Buffer with minimum length");
        }
        else {
            if (value.length < this.minLength || value.length > this.maxLength) {
                throw new Error("The length of the Buffer is outside the specified bounds");
            }
        }
        this.rawValue = value;
    }
    static create(code, name, repeatable, minLength, maxLength, rawValue) {
        return new BinaryOption(code, name, repeatable, minLength, maxLength, rawValue);
    }
    toString() {
        return `${this.name} (${this.code}): 0x${this.rawValue.toString("hex")}`;
    }
}
exports.BinaryOption = BinaryOption;
/**
 * Specialized Message options for string content.
 */
class StringOption extends Option {
    constructor(code, name, repeatable, minLength, maxLength, rawValue) {
        super(code, name, rawValue);
        this.name = name;
        this.repeatable = repeatable;
        this.minLength = minLength;
        this.maxLength = maxLength;
    }
    get value() {
        return this.rawValue.toString("utf8");
    }
    set value(value) {
        if (value == null) {
            if (this.minLength > 0)
                throw new Error("cannot assign null to a string with minimum length");
        }
        else {
            if (value.length < this.minLength || value.length > this.maxLength) {
                throw new Error("The length of the string is outside the specified bounds");
            }
        }
        this.rawValue = Buffer.from(value, "utf8");
    }
    static create(code, name, repeatable, minLength, maxLength, rawValue) {
        return new StringOption(code, name, repeatable, minLength, maxLength, rawValue);
    }
    toString() {
        return `${this.name} (${this.code}): "${this.value}"`;
    }
}
exports.StringOption = StringOption;
/**
 * all defined assignments for instancing Options
 */
const optionConstructors = {};
// tslint:disable:ban-types
// tslint:disable:trailing-comma
function defineOptionConstructor(constructor, code, name, repeatable, ...args) {
    optionConstructors[code] = optionConstructors[name] =
        constructor.create.bind(constructor, ...[code, name, repeatable, ...args]);
}
// tslint:enable:ban-types
// tslint:enable:trailing-comma
defineOptionConstructor(NumericOption, 6, "Observe", false, 3);
defineOptionConstructor(NumericOption, 7, "Uri-Port", false, 2);
defineOptionConstructor(NumericOption, 12, "Content-Format", false, 2);
defineOptionConstructor(NumericOption, 14, "Max-Age", false, 4);
defineOptionConstructor(NumericOption, 17, "Accept", false, 2);
defineOptionConstructor(BlockOption, 23, "Block2", false, 3);
defineOptionConstructor(BlockOption, 27, "Block1", false, 3);
defineOptionConstructor(NumericOption, 28, "Size2", false, 4);
defineOptionConstructor(NumericOption, 60, "Size1", false, 4);
defineOptionConstructor(BinaryOption, 1, "If-Match", true, 0, 8);
defineOptionConstructor(BinaryOption, 4, "ETag", true, 1, 8);
defineOptionConstructor(BinaryOption, 5, "If-None-Match", false, 0, 0);
defineOptionConstructor(StringOption, 3, "Uri-Host", false, 1, 255);
defineOptionConstructor(StringOption, 8, "Location-Path", true, 0, 255);
defineOptionConstructor(StringOption, 11, "Uri-Path", true, 0, 255);
defineOptionConstructor(StringOption, 15, "Uri-Query", true, 0, 255);
defineOptionConstructor(StringOption, 20, "Location-Query", true, 0, 255);
defineOptionConstructor(StringOption, 35, "Proxy-Uri", true, 1, 1034);
defineOptionConstructor(StringOption, 39, "Proxy-Scheme", true, 1, 255);
// tslint:disable:no-string-literal
// tslint:disable-next-line:variable-name
exports.Options = Object.freeze({
    UriHost: (hostname) => optionConstructors["Uri-Host"](Buffer.from(hostname)),
    UriPort: (port) => optionConstructors["Uri-Port"](numberToBuffer(port)),
    UriPath: (pathname) => optionConstructors["Uri-Path"](Buffer.from(pathname)),
    UriQuery: (query) => optionConstructors["Uri-Query"](Buffer.from(query)),
    LocationPath: (pathname) => optionConstructors["Location-Path"](Buffer.from(pathname)),
    ContentFormat: (format) => optionConstructors["Content-Format"](numberToBuffer(format)),
    Observe: (observe) => optionConstructors["Observe"](Buffer.from([observe ? 0 : 1])),
    Block1: (num, isLast, size) => {
        // Warning: we're not checking for a valid size here, do that in advance!
        const sizeExp = Math.log2(size) - 4;
        const value = (num << 4) | (isLast ? 0 : 0b1000) | (sizeExp & 0b111);
        return optionConstructors["Block1"](numberToBuffer(value));
    },
    Block2: (num, isLast, size) => {
        // Warning: we're not checking for a valid size here, do that in advance!
        const sizeExp = Math.log2(size) - 4;
        const value = (num << 4) | (isLast ? 0 : 0b1000) | (sizeExp & 0b111);
        return optionConstructors["Block2"](numberToBuffer(value));
    },
});
// tslint:enable:no-string-literal
/**
 * Searches for a single option in an array of options
 * @param opts The options array to search for the option
 * @param name The name of the option to search for
 */
function findOption(opts, name) {
    return opts.find(o => o.name === name);
}
exports.findOption = findOption;
/**
 * Searches for a repeatable option in an array of options
 * @param opts The options array to search for the option
 * @param name The name of the option to search for
 */
function findOptions(opts, name) {
    return opts.filter(o => o.name === name);
}
exports.findOptions = findOptions;
