"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const CipherSuites_1 = require("../DTLS/CipherSuites");
const Alert_1 = require("../TLS/Alert");
const ChangeCipherSpec_1 = require("../TLS/ChangeCipherSpec");
const ConnectionState_1 = require("../TLS/ConnectionState");
const ContentType_1 = require("../TLS/ContentType");
const PreMasterSecret_1 = require("../TLS/PreMasterSecret");
const PRF_1 = require("../TLS/PRF");
const ProtocolVersion_1 = require("../TLS/ProtocolVersion");
const Random_1 = require("../TLS/Random");
const Vector_1 = require("../TLS/Vector");
const Handshake = require("./Handshake");
class ClientHandshakeHandler {
    constructor(recordLayer, options, finishedCallback) {
        this.recordLayer = recordLayer;
        this.options = options;
        this.finishedCallback = finishedCallback;
        this.bufferedOutgoingMessages = [];
        this.sendFlight_begin_wasCalled = false;
        /**
         * handles server messages
         */
        this.handle = {
            /** Handles a HelloVerifyRequest message */
            [Handshake.HandshakeType.hello_verify_request]: (messages) => {
                // this flight should only contain a single message,
                // but to be sure extract the last one
                const hvr = messages[messages.length - 1];
                // add the cookie to the client hello and send it again
                const hello = this.lastFlight[0];
                hello.cookie = hvr.cookie;
                // TODO: do something with session id?
                this.sendFlight([hello], [Handshake.HandshakeType.server_hello_done]);
            },
            /** Handles a ServerHelloDone flight */
            [Handshake.HandshakeType.server_hello_done]: (messages) => {
                for (const msg of messages) {
                    switch (msg.msg_type) {
                        case Handshake.HandshakeType.server_hello:
                            const hello = msg;
                            // remember the random value
                            this.recordLayer.nextEpoch.connectionState.server_random = hello.random.serialize();
                            // set the cipher suite and compression method to be used
                            this.recordLayer.nextEpoch.connectionState.cipherSuite = CipherSuites_1.CipherSuites[hello.cipher_suite];
                            this.recordLayer.nextEpoch.connectionState.compression_algorithm = hello.compression_method;
                            this.recordLayer.currentWriteEpoch.connectionState.protocolVersion = hello.server_version;
                            this.recordLayer.nextWriteEpoch.connectionState.protocolVersion = hello.server_version;
                            // TODO: parse/support extensions?
                            // TODO: remember the session id?
                            break;
                        // TODO: support more messages (certificates etc.)
                        case Handshake.HandshakeType.server_key_exchange:
                            const srvKeyExchange = msg;
                            // parse the content depending on the key exchange algorithm
                            switch (this.recordLayer.nextEpoch.connectionState.cipherSuite.keyExchange) {
                                case "psk":
                                    const srvKeyExchange_PSK = Handshake.ServerKeyExchange_PSK.from(Handshake.ServerKeyExchange_PSK.spec, srvKeyExchange.raw_data).result;
                                    // TODO: do something with the identity hint
                                    break;
                                // TODO: support other algorithms
                            }
                            break;
                        case Handshake.HandshakeType.server_hello_done:
                            // its our turn, build flight depending on the key exchange algorithm
                            const connState = this.recordLayer.nextEpoch.connectionState;
                            // TODO: support multiple identities
                            const psk_identity = Object.keys(this.options.psk)[0];
                            let preMasterSecret;
                            const flight = [];
                            switch (connState.cipherSuite.keyExchange) {
                                case "psk":
                                    // for PSK, build the key exchange message
                                    const clKeyExchange = Handshake.ClientKeyExchange.createEmpty();
                                    const clKeyExchange_PSK = new Handshake.ClientKeyExchange_PSK(Buffer.from(psk_identity, "ascii"));
                                    clKeyExchange.raw_data = clKeyExchange_PSK.serialize();
                                    // and add it to the flight
                                    flight.push(clKeyExchange);
                                    // now we have everything, construct the pre master secret
                                    const psk = Buffer.from(this.options.psk[psk_identity], "ascii");
                                    preMasterSecret = new PreMasterSecret_1.PreMasterSecret(null, psk);
                                    break;
                                default:
                                    this.finishedCallback(new Alert_1.Alert(Alert_1.AlertLevel.fatal, Alert_1.AlertDescription.handshake_failure), new Error(`${connState.cipherSuite.keyExchange} key exchange not implemented`));
                                    return;
                            }
                            // we now have everything to compute the master secret
                            connState.computeMasterSecret(preMasterSecret);
                            // in order to build the finished message, we need to process the partial flight so far
                            this.sendFlight_begin();
                            this.sendFlight_processPartial(flight);
                            // now we can compute the verify_data
                            const handshake_messages = Buffer.concat(this.allHandshakeData);
                            const verify_data = this.computeVerifyData(handshake_messages, "client");
                            // now build the finished message and process it
                            const finished = new Handshake.Finished(verify_data);
                            this.sendFlight_processPartial([finished]);
                            // finish sending the flight
                            this.sendFlight_finish([Handshake.HandshakeType.finished]);
                            break;
                    }
                }
            },
            /** Handles a Finished flight */
            [Handshake.HandshakeType.finished]: (messages) => {
                // this flight should only contain a single message (server->client),
                // but to be sure extract the last one
                const finished = messages[messages.length - 1];
                // compute the expected verify data
                const handshake_messages = Buffer.concat(this.allHandshakeData);
                const expectedVerifyData = this.computeVerifyData(handshake_messages, "server");
                if (finished.verify_data.equals(expectedVerifyData)) {
                    // all good!
                    this._isHandshaking = false;
                    this.finishedCallback();
                }
                else {
                    this._isHandshaking = false;
                    this.finishedCallback(new Alert_1.Alert(Alert_1.AlertLevel.fatal, Alert_1.AlertDescription.decrypt_error), new Error("DTLS handshake failed"));
                    // connection is automatically canceled by the callback
                }
            },
        };
        this.renegotiate();
    }
    get isHandshaking() {
        return this._isHandshaking;
    }
    /**
     * (Re)negotiates a DTLS session. Is automatically called when the Handshake handler is created
     */
    renegotiate() {
        // reset variables
        // this._state = HandshakeStates.preparing;
        this._isHandshaking = true;
        this.lastProcessedSeqNum = -1;
        this.lastSentSeqNum = -1;
        this.incompleteMessages = [];
        this.completeMessages = {};
        this.expectedResponses = [];
        this.allHandshakeData = [];
        // this.cscReceived = false;
        // this.serverFinishedPending = false;
        // ==============================
        // start by sending a ClientHello
        const hello = Handshake.ClientHello.createEmpty();
        hello.client_version = new ProtocolVersion_1.ProtocolVersion(~1, ~2);
        hello.random = Random_1.Random.createNew();
        // remember this for crypto stuff
        this.recordLayer.nextEpoch.connectionState.client_random = hello.random.serialize();
        hello.session_id = Buffer.from([]);
        hello.cookie = Buffer.from([]);
        // TODO: dynamically check which ones we can support
        const cipherSuites = this.options.ciphers || [
            "TLS_PSK_WITH_3DES_EDE_CBC_SHA",
            "TLS_PSK_WITH_AES_128_CBC_SHA",
            "TLS_PSK_WITH_AES_256_CBC_SHA",
            "TLS_PSK_WITH_AES_128_CBC_SHA256",
            "TLS_PSK_WITH_AES_256_CBC_SHA384",
            "TLS_PSK_WITH_AES_128_GCM_SHA256",
            "TLS_PSK_WITH_AES_256_GCM_SHA384",
            "TLS_PSK_WITH_AES_128_CCM",
            "TLS_PSK_WITH_AES_256_CCM",
            "TLS_PSK_WITH_AES_128_CCM_8",
            "TLS_PSK_WITH_AES_256_CCM_8",
        ];
        hello.cipher_suites = new Vector_1.Vector(cipherSuites.map(cs => CipherSuites_1.CipherSuites[cs].id));
        hello.compression_methods = new Vector_1.Vector([ConnectionState_1.CompressionMethod.null]);
        hello.extensions = new Vector_1.Vector();
        this.sendFlight([hello], [
            Handshake.HandshakeType.server_hello_done,
            Handshake.HandshakeType.hello_verify_request,
        ]);
    }
    // special cases for reordering of "Finished" flights
    // TODO: add these special cases to general handling functions
    // private cscReceived: boolean;
    // private serverFinishedPending: boolean;
    /**
     * Processes a received handshake message
     */
    processIncomingMessage(msg) {
        let checkFlight;
        if (msg.isFragmented()) {
            // remember incomplete messages and try to assemble them afterwards
            this.incompleteMessages.push(msg);
            checkFlight = this.tryAssembleFragments(msg);
        }
        else {
            // the message is already complete, we only need to parse it
            this.completeMessages[msg.message_seq] = Handshake.Handshake.fromFragment(msg);
            checkFlight = true;
        }
        // check if the flight is the current one, and complete
        if (checkFlight) {
            const completeMsgIndizes = Object.keys(this.completeMessages).map(k => +k);
            // a flight is complete if it forms a non-interrupted sequence of seq-nums
            const isComplete = [this.lastProcessedSeqNum].concat(completeMsgIndizes).every((val, i, arr) => (i === 0) || (val === arr[i - 1] + 1));
            if (!isComplete)
                return;
            const lastMsg = this.completeMessages[Math.max(...completeMsgIndizes)];
            if (this.expectedResponses != null) {
                // if we expect a flight and this is the one, call the handler
                if (this.expectedResponses.indexOf(lastMsg.msg_type) > -1) {
                    this.expectedResponses = null;
                    // and remember the seq number
                    this.lastProcessedSeqNum = lastMsg.message_seq;
                    // call the handler and clear the buffer
                    const messages = completeMsgIndizes.map(i => this.completeMessages[i]);
                    this.completeMessages = {};
                    if (lastMsg.msg_type === Handshake.HandshakeType.finished) {
                        // for the finished flight, only buffer the finished message AFTER handling it
                        this.bufferHandshakeData(...(messages.slice(0, -1)
                            .filter(m => this.needsToHashMessage(m))
                            .map(m => m.toFragment()) // TODO: avoid unneccessary assembly and fragmentation of messages
                        ));
                    }
                    else {
                        this.bufferHandshakeData(...(messages
                            .filter(m => this.needsToHashMessage(m))
                            .map(m => m.toFragment()) // TODO: avoid unneccessary assembly and fragmentation of messages
                        ));
                    }
                    // handle the message
                    try {
                        this.handle[lastMsg.msg_type](messages);
                    }
                    catch (e) {
                        this._isHandshaking = false;
                        this.finishedCallback(null, e);
                        return;
                    }
                    if (lastMsg.msg_type === Handshake.HandshakeType.finished) {
                        // for the finished flight, only buffer the finished message AFTER handling it
                        this.bufferHandshakeData(lastMsg.toFragment());
                    }
                    // TODO: clear a retransmission timer
                }
            }
            else {
                // if we don't expect a flight, maybe do something depending on the type of the message
                // TODO: react to server sending us rehandshake invites
            }
        }
    }
    /**
     * Tries to assemble the fragmented messages in incompleteMessages
     */
    tryAssembleFragments(reference) {
        // find all matching fragments
        const allFragments = Handshake.FragmentedHandshake.findAllFragments(this.incompleteMessages, reference);
        if (Handshake.FragmentedHandshake.isComplete(allFragments)) {
            // if we found all, reassemble them
            const reassembled = Handshake.FragmentedHandshake.reassemble(allFragments);
            // add the message to the list of complete ones
            this.completeMessages[reassembled.message_seq] = Handshake.Handshake.fromFragment(reassembled);
            // and remove the other ones from the list of incomplete ones
            this.incompleteMessages = this.incompleteMessages.filter(fragment => allFragments.indexOf(fragment) === -1);
            return true;
        }
        return false;
    }
    sendFlight_begin() {
        this.sendFlight_begin_wasCalled = true;
        this.lastFlight = [];
    }
    /**
     * Processes a flight (including giving the messages a seq_num), but does not actually send it.
     * @param flight - The flight to be sent.
     * @param retransmit - If the flight is retransmitted, i.e. no sequence numbers are increased
     */
    sendFlight_processPartial(flight, retransmit = false) {
        if (!this.sendFlight_begin_wasCalled) {
            throw new Error("Need to call sendFlight_beginPartial() before using this function");
        }
        this.lastFlight.push(...flight);
        flight.forEach(handshake => {
            if (handshake.msg_type === Handshake.HandshakeType.finished) {
                // before finished messages, ALWAYS send a ChangeCipherSpec
                this.bufferedOutgoingMessages.push({
                    type: ContentType_1.ContentType.change_cipher_spec,
                    data: (ChangeCipherSpec_1.ChangeCipherSpec.createEmpty()).serialize(),
                });
                // TODO: how do we handle retransmission here?
            }
            if (!retransmit) {
                // for first-time messages, increment the sequence number
                handshake.message_seq = ++this.lastSentSeqNum;
            }
            const fragment = handshake.toFragment();
            if (!retransmit) {
                // for first-time messages, buffer the data for verification purposes
                if (this.needsToHashMessage(handshake)) {
                    this.bufferHandshakeData(fragment);
                }
            }
            // fragment the messages (TODO: make this dependent on previous messages in this flight)
            const fragments = fragment
                .split()
                .map(f => ({
                type: ContentType_1.ContentType.handshake,
                data: f.serialize(),
            }));
            this.bufferedOutgoingMessages.push(...fragments);
        });
    }
    /**
     * Sends the currently buffered flight of messages
     * @param flight The flight to be sent.
     * @param expectedResponses The types of possible responses we are expecting.
     * @param retransmit If the flight is retransmitted, i.e. no sequence numbers are increased
     */
    sendFlight_finish(expectedResponses) {
        this.expectedResponses = expectedResponses;
        this.recordLayer.sendFlight(this.bufferedOutgoingMessages);
        // clear the buffers for future use
        this.bufferedOutgoingMessages = [];
        this.sendFlight_begin_wasCalled = false;
    }
    /**
     * Sends the given flight of messages and remembers it for potential retransmission
     * @param flight The flight to be sent.
     * @param expectedResponses The types of possible responses we are expecting.
     * @param retransmit If the flight is retransmitted, i.e. no sequence numbers are increased
     */
    sendFlight(flight, expectedResponses, retransmit = false) {
        // this is actually just a convenience function for sending complete flights
        this.sendFlight_begin();
        this.sendFlight_processPartial(flight, retransmit);
        this.sendFlight_finish(expectedResponses);
    }
    /**
     * remembers the raw data of handshake messages for verification purposes
     * @param messages - the messages to be remembered
     */
    bufferHandshakeData(...messages) {
        this.allHandshakeData.push(...(messages.map(m => m.serialize())));
    }
    /**
     * For a given message, check if it needs to be hashed
     */
    needsToHashMessage(message) {
        switch (message.msg_type) {
            // hello (verify) requests
            case Handshake.HandshakeType.hello_verify_request: return false;
            case Handshake.HandshakeType.hello_request: return false;
            // client hello without cookie (TODO only if verify request is used)
            case Handshake.HandshakeType.client_hello:
                const cookie = message.cookie;
                return (cookie != null) && (cookie.length > 0);
            // everything else will be hashed
            default: return true;
        }
    }
    /**
     * computes the verify data for a Finished message
     * @param handshakeMessages - the concatenated messages received so far
     */
    computeVerifyData(handshakeMessages, source) {
        const connState = (source === "client")
            ? this.recordLayer.nextWriteEpoch.connectionState
            : this.recordLayer.currentReadEpoch.connectionState;
        const PRF_fn = PRF_1.PRF[connState.cipherSuite.prfAlgorithm];
        const handshakeHash = PRF_fn.hashFunction(handshakeMessages);
        // and use it to compute the verify data
        const verify_data = PRF_fn(connState.master_secret, `${source} finished`, handshakeHash, connState.cipherSuite.verify_data_length);
        return verify_data;
    }
}
exports.ClientHandshakeHandler = ClientHandshakeHandler;
/* Client                                          Server
   ------                                          ------

   ClientHello             -------->                           Flight 1

                           <-------    HelloVerifyRequest      Flight 2

   ClientHello             -------->                           Flight 3

                                              ServerHello    \
                                             Certificate*     \
                                       ServerKeyExchange*      Flight 4
                                      CertificateRequest*     /
                           <--------      ServerHelloDone    /

   Certificate*                                              \
   ClientKeyExchange                                          \
   CertificateVerify*                                          Flight 5
   [ChangeCipherSpec]                                         /
   Finished                -------->                         /

                                       [ChangeCipherSpec]    \ Flight 6
                           <--------             Finished    /

               Figure 1. Message Flights for Full Handshake

=======================================================================

   Client                                           Server
   ------                                           ------

   ClientHello             -------->                          Flight 1

                                              ServerHello    \
                                       [ChangeCipherSpec]     Flight 2
                            <--------             Finished    /

   [ChangeCipherSpec]                                         \Flight 3
   Finished                 -------->                         /

         Figure 2. Message Flights for Session-Resuming Handshake
                           (No Cookie Exchange)
*/
