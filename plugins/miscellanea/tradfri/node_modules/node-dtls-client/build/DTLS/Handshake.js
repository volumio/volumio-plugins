"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CipherSuite_1 = require("../TLS/CipherSuite");
const ConnectionState_1 = require("../TLS/ConnectionState");
const Extension_1 = require("../TLS/Extension");
const ProtocolVersion_1 = require("../TLS/ProtocolVersion");
const Random_1 = require("../TLS/Random");
const SessionID_1 = require("../TLS/SessionID");
const TLSStruct_1 = require("../TLS/TLSStruct");
const TypeSpecs = require("../TLS/TypeSpecs");
const Cookie_1 = require("./Cookie");
const RecordLayer_1 = require("./RecordLayer");
var HandshakeType;
(function (HandshakeType) {
    HandshakeType[HandshakeType["hello_request"] = 0] = "hello_request";
    HandshakeType[HandshakeType["client_hello"] = 1] = "client_hello";
    HandshakeType[HandshakeType["server_hello"] = 2] = "server_hello";
    HandshakeType[HandshakeType["hello_verify_request"] = 3] = "hello_verify_request";
    HandshakeType[HandshakeType["certificate"] = 11] = "certificate";
    HandshakeType[HandshakeType["server_key_exchange"] = 12] = "server_key_exchange";
    HandshakeType[HandshakeType["certificate_request"] = 13] = "certificate_request";
    HandshakeType[HandshakeType["server_hello_done"] = 14] = "server_hello_done";
    HandshakeType[HandshakeType["certificate_verify"] = 15] = "certificate_verify";
    HandshakeType[HandshakeType["client_key_exchange"] = 16] = "client_key_exchange";
    HandshakeType[HandshakeType["finished"] = 20] = "finished";
})(HandshakeType = exports.HandshakeType || (exports.HandshakeType = {}));
class Handshake extends TLSStruct_1.TLSStruct {
    constructor(msg_type, bodySpec, initial) {
        super(bodySpec, initial);
        this.msg_type = msg_type;
    }
    /**
     * Converts this Handshake message into a fragment ready to be sent
     */
    toFragment() {
        // spec only contains the body, so serialize() will only return that
        const body = this.serialize();
        return new FragmentedHandshake(this.msg_type, body.length, this.message_seq, 0, body);
    }
    /**
     * Parses a re-assembled handshake message into the correct object struture
     * @param assembled - the re-assembled (or never-fragmented) message
     */
    static fromFragment(assembled) {
        if (assembled.isFragmented()) {
            throw new Error("the message to be parsed MUST NOT be fragmented");
        }
        if (exports.HandshakeMessages[assembled.msg_type] != undefined) {
            // find the right type for the body object
            const msgClass = exports.HandshakeMessages[assembled.msg_type];
            // turn it into the correct type
            const spec = TypeSpecs.define.Struct(msgClass);
            // parse the body object into a new Handshake instance
            const ret = TLSStruct_1.TLSStruct.from(spec, assembled.fragment).result;
            ret.message_seq = assembled.message_seq;
            return ret;
        }
        else {
            throw new Error(`unsupported message type ${assembled.msg_type}`);
        }
    }
}
exports.Handshake = Handshake;
class FragmentedHandshake extends TLSStruct_1.TLSStruct {
    constructor(msg_type, total_length, message_seq, fragment_offset, fragment) {
        super(FragmentedHandshake.__spec);
        this.msg_type = msg_type;
        this.total_length = total_length;
        this.message_seq = message_seq;
        this.fragment_offset = fragment_offset;
        this.fragment = fragment;
    }
    static createEmpty() {
        return new FragmentedHandshake(null, null, null, null, null);
    }
    /**
     * Checks if this message is actually fragmented, i.e. total_length > fragment_length
     */
    isFragmented() {
        return (this.fragment_offset !== 0) || (this.total_length > this.fragment.length);
    }
    /**
     * Enforces an array of fragments to belong to a single message
     * @throws Throws an error if the fragements belong to multiple messages. Passes otherwise.
     */
    static enforceSingleMessage(fragments) {
        // check if we are looking at a single message, i.e. compare type, seq_num and length
        const singleMessage = fragments.every((val, i, arr) => {
            if (i > 0) {
                return val.msg_type === arr[0].msg_type &&
                    val.message_seq === arr[0].message_seq &&
                    val.total_length === arr[0].total_length;
            }
            return true;
        });
        if (!singleMessage) {
            throw new Error("this series of fragments belongs to multiple messages");
        }
    }
    /**
     * In the given array of fragments, find all that belong to the reference fragment
     * @param fragments - Array of fragments to be searched
     * @param reference - The reference fragment whose siblings should be found
     */
    static findAllFragments(fragments, reference) {
        // ignore empty arrays
        if (!(fragments && fragments.length))
            return [];
        // return all fragments with matching msg_type, message_seq and total length
        return fragments.filter(f => {
            return f.msg_type === reference.msg_type &&
                f.message_seq === reference.message_seq &&
                f.total_length === reference.total_length;
        });
    }
    /**
     * Checks if the provided handshake fragments form a complete message
     */
    static isComplete(fragments) {
        // ignore empty arrays
        if (!(fragments && fragments.length))
            return false;
        FragmentedHandshake.enforceSingleMessage(fragments);
        const firstSeqNum = fragments[0].message_seq;
        const totalLength = fragments[0].total_length;
        const ranges = fragments
            // map to fragment range (start and end index)
            .map(f => ({ start: f.fragment_offset, end: f.fragment_offset + f.fragment.length - 1 }))
            // order the fragments by fragment offset
            .sort((a, b) => a.start - b.start);
        // check if the fragments have no holes
        const noHoles = ranges.every((val, i, arr) => {
            if (i === 0) {
                // first fragment should start at 0
                if (val.start !== 0)
                    return false;
            }
            else {
                // every other fragment should touch or overlap the previous one
                if (val.start - arr[i - 1].end > 1)
                    return false;
            }
            // last fragment should end at totalLength-1
            if (i === arr.length - 1) {
                if (val.end !== totalLength - 1)
                    return false;
            }
            // no problems
            return true;
        });
        return noHoles;
    }
    /**
     * Fragments this packet into a series of packets according to the configured MTU
     * @returns An array of fragmented handshake messages - or a single one if it is small enough.
     */
    split(maxFragmentLength) {
        let start = 0;
        const totalLength = this.fragment.length;
        const fragments = [];
        if (maxFragmentLength == null) {
            maxFragmentLength = RecordLayer_1.RecordLayer.MAX_PAYLOAD_SIZE - FragmentedHandshake.headerLength;
        }
        // loop through the message and fragment it
        while (!fragments.length && start < totalLength) {
            // calculate maximum length, limited by MTU - IP/UDP headers - handshake overhead
            const fragmentLength = Math.min(maxFragmentLength, totalLength - start);
            // slice and dice
            const data = Buffer.from(this.fragment.slice(start, start + fragmentLength));
            if (data.length <= 0) {
                // this shouldn't happen, but we don't want to introduce an infinite loop
                throw new Error(`Zero or less bytes processed while fragmenting handshake message.`);
            }
            // create the message
            fragments.push(new FragmentedHandshake(this.msg_type, totalLength, this.message_seq, start, data));
            // step forward by the actual fragment length
            start += data.length;
        }
        return fragments;
    }
    /**
     * Reassembles a series of fragmented handshake messages into a complete one.
     * Warning: doesn't check for validity, do that in advance!
     */
    static reassemble(messages) {
        // cannot reassemble empty arrays
        if (!(messages && messages.length)) {
            throw new Error("cannot reassemble handshake from empty array");
        }
        // sort by fragment start
        messages = messages.sort((a, b) => a.fragment_offset - b.fragment_offset);
        // combine into a single buffer
        const combined = Buffer.allocUnsafe(messages[0].total_length);
        for (const msg of messages) {
            msg.fragment.copy(combined, msg.fragment_offset);
        }
        // and return the complete message
        return new FragmentedHandshake(messages[0].msg_type, messages[0].total_length, messages[0].message_seq, 0, combined);
    }
}
FragmentedHandshake.__spec = {
    msg_type: TypeSpecs.define.Enum("uint8", HandshakeType),
    total_length: TypeSpecs.uint24,
    message_seq: TypeSpecs.uint16,
    fragment_offset: TypeSpecs.uint24,
    fragment: TypeSpecs.define.Buffer(0, Math.pow(2, 24) - 1),
};
FragmentedHandshake.spec = TypeSpecs.define.Struct(FragmentedHandshake);
/**
 * The amount of data consumed by a handshake message header (without the actual fragment)
 */
FragmentedHandshake.headerLength = 1 + 3 + 2 + 3 + 3; // TODO: dynamisch?
exports.FragmentedHandshake = FragmentedHandshake;
// Handshake message implementations
class HelloRequest extends Handshake {
    constructor() {
        super(HandshakeType.hello_request, HelloRequest.__spec);
    }
    static createEmpty() {
        return new HelloRequest();
    }
}
HelloRequest.__spec = {};
exports.HelloRequest = HelloRequest;
class ClientHello extends Handshake {
    constructor(client_version, random, session_id, cookie, cipher_suites, compression_methods, extensions) {
        super(HandshakeType.client_hello, ClientHello.__spec);
        this.client_version = client_version;
        this.random = random;
        this.session_id = session_id;
        this.cookie = cookie;
        this.cipher_suites = cipher_suites;
        this.compression_methods = compression_methods;
        this.extensions = extensions;
    }
    static createEmpty() {
        return new ClientHello(null, null, null, null, null, null, null);
    }
}
ClientHello.__spec = {
    client_version: TypeSpecs.define.Struct(ProtocolVersion_1.ProtocolVersion),
    random: TypeSpecs.define.Struct(Random_1.Random),
    session_id: SessionID_1.SessionID.spec,
    cookie: Cookie_1.Cookie.spec,
    cipher_suites: TypeSpecs.define.Vector(CipherSuite_1.CipherSuite.__spec.id, 2, Math.pow(2, 16) - 2),
    compression_methods: TypeSpecs.define.Vector(ConnectionState_1.CompressionMethod.spec, 1, Math.pow(2, 8) - 1),
    extensions: TypeSpecs.define.Vector(Extension_1.Extension.spec, 0, Math.pow(2, 16) - 1, true),
};
exports.ClientHello = ClientHello;
class ServerHello extends Handshake {
    constructor(server_version, random, session_id, cipher_suite, compression_method, extensions) {
        super(HandshakeType.server_hello, ServerHello.__spec);
        this.server_version = server_version;
        this.random = random;
        this.session_id = session_id;
        this.cipher_suite = cipher_suite;
        this.compression_method = compression_method;
        this.extensions = extensions;
    }
    static createEmpty() {
        return new ServerHello(null, null, null, null, null, null);
    }
}
ServerHello.__spec = {
    server_version: TypeSpecs.define.Struct(ProtocolVersion_1.ProtocolVersion),
    random: TypeSpecs.define.Struct(Random_1.Random),
    session_id: SessionID_1.SessionID.spec,
    cipher_suite: CipherSuite_1.CipherSuite.__spec.id,
    compression_method: ConnectionState_1.CompressionMethod.spec,
    extensions: TypeSpecs.define.Vector(Extension_1.Extension.spec, 0, Math.pow(2, 16) - 1, true),
};
exports.ServerHello = ServerHello;
class HelloVerifyRequest extends Handshake {
    constructor(server_version, cookie) {
        super(HandshakeType.hello_verify_request, HelloVerifyRequest.__spec);
        this.server_version = server_version;
        this.cookie = cookie;
    }
    static createEmpty() {
        return new HelloVerifyRequest(null, null);
    }
}
HelloVerifyRequest.__spec = {
    server_version: TypeSpecs.define.Struct(ProtocolVersion_1.ProtocolVersion),
    cookie: Cookie_1.Cookie.spec,
};
exports.HelloVerifyRequest = HelloVerifyRequest;
class ServerKeyExchange extends Handshake {
    constructor() {
        super(HandshakeType.server_key_exchange, ServerKeyExchange.__spec);
    }
    static createEmpty() {
        return new ServerKeyExchange();
    }
}
ServerKeyExchange.__spec = {
    raw_data: TypeSpecs.define.Buffer(),
};
exports.ServerKeyExchange = ServerKeyExchange;
class ServerKeyExchange_PSK extends TLSStruct_1.TLSStruct {
    constructor(psk_identity_hint) {
        super(ServerKeyExchange_PSK.__spec);
        this.psk_identity_hint = psk_identity_hint;
    }
    static createEmpty() {
        return new ServerKeyExchange_PSK(null);
    }
}
ServerKeyExchange_PSK.__spec = {
    psk_identity_hint: TypeSpecs.define.Buffer(0, Math.pow(2, 16) - 1),
};
ServerKeyExchange_PSK.spec = TypeSpecs.define.Struct(ServerKeyExchange_PSK);
exports.ServerKeyExchange_PSK = ServerKeyExchange_PSK;
class ClientKeyExchange extends Handshake {
    constructor() {
        super(HandshakeType.client_key_exchange, ClientKeyExchange.__spec);
    }
    static createEmpty() {
        return new ClientKeyExchange();
    }
}
ClientKeyExchange.__spec = {
    raw_data: TypeSpecs.define.Buffer(),
};
exports.ClientKeyExchange = ClientKeyExchange;
class ClientKeyExchange_PSK extends TLSStruct_1.TLSStruct {
    constructor(psk_identity) {
        super(ClientKeyExchange_PSK.__spec);
        this.psk_identity = psk_identity;
    }
    static createEmpty() {
        return new ClientKeyExchange_PSK(null);
    }
}
ClientKeyExchange_PSK.__spec = {
    psk_identity: TypeSpecs.define.Buffer(0, Math.pow(2, 16) - 1),
};
ClientKeyExchange_PSK.spec = TypeSpecs.define.Struct(ClientKeyExchange_PSK);
exports.ClientKeyExchange_PSK = ClientKeyExchange_PSK;
class ServerHelloDone extends Handshake {
    constructor() {
        super(HandshakeType.server_hello_done, ServerHelloDone.__spec);
    }
    static createEmpty() {
        return new ServerHelloDone();
    }
}
ServerHelloDone.__spec = {};
exports.ServerHelloDone = ServerHelloDone;
class Finished extends Handshake {
    constructor(verify_data) {
        super(HandshakeType.finished, Finished.__spec);
        this.verify_data = verify_data;
    }
    static createEmpty() {
        return new Finished(null);
    }
}
Finished.__spec = {
    verify_data: TypeSpecs.define.Buffer(),
};
exports.Finished = Finished;
// define handshake messages for lookup
exports.HandshakeMessages = {};
exports.HandshakeMessages[HandshakeType.hello_request] = HelloRequest;
exports.HandshakeMessages[HandshakeType.client_hello] = ClientHello;
exports.HandshakeMessages[HandshakeType.server_hello] = ServerHello;
exports.HandshakeMessages[HandshakeType.hello_verify_request] = HelloVerifyRequest;
exports.HandshakeMessages[HandshakeType.server_hello_done] = ServerHelloDone;
exports.HandshakeMessages[HandshakeType.finished] = Finished;
