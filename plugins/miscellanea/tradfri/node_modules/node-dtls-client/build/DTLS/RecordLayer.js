"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AntiReplayWindow_1 = require("../TLS/AntiReplayWindow");
const ConnectionState_1 = require("../TLS/ConnectionState");
const ContentType_1 = require("../TLS/ContentType");
const ProtocolVersion_1 = require("../TLS/ProtocolVersion");
const DTLSCiphertext_1 = require("./DTLSCiphertext");
const DTLSCompressed_1 = require("./DTLSCompressed");
const DTLSPlaintext_1 = require("./DTLSPlaintext");
// enable debug output
const debugPackage = require("debug");
const debug = debugPackage("node-dtls-client");
class RecordLayer {
    // TODO: specify connection end
    constructor(udpSocket, options) {
        this.udpSocket = udpSocket;
        this.options = options;
        /**
         * All known connection epochs
         */
        this.epochs = [];
        this._readEpochNr = 0;
        this._writeEpochNr = 0;
        // initialize with NULL cipherspec
        // current state
        this.epochs[0] = this.createEpoch(0);
        // pending state
        this.epochs[1] = this.createEpoch(1);
    }
    /**
     * Transforms the given message into a DTLSCiphertext packet and sends it via UDP
     * @param msg - The message to be sent
     * @param callback - The function to be called after sending the message.
     */
    send(msg, callback) {
        const buf = this.processOutgoingMessage(msg);
        this.udpSocket.send(buf, 0, buf.length, this.options.port, this.options.address, callback);
    }
    /**
     * Transforms the given message into a DTLSCiphertext packet,
     * does neccessary processing and buffers it up for sending
     */
    processOutgoingMessage(msg) {
        const epoch = this.epochs[this.writeEpochNr];
        let packet = new DTLSPlaintext_1.DTLSPlaintext(msg.type, epoch.connectionState.protocolVersion || RecordLayer.DTLSVersion, this._writeEpochNr, ++epoch.writeSequenceNumber, // sequence number increased by 1
        msg.data);
        // compress packet
        const compressor = (identity) => identity; // TODO: only valid for NULL compression, check it!
        packet = DTLSCompressed_1.DTLSCompressed.compress(packet, compressor);
        if (epoch.connectionState.cipherSuite.cipherType != null) {
            // encrypt packet
            packet = epoch.connectionState.Cipher(packet);
        }
        // get send buffer
        const ret = packet.serialize();
        // advance the write epoch, so we use the new params for sending the next messages
        if (msg.type === ContentType_1.ContentType.change_cipher_spec) {
            this.advanceWriteEpoch();
        }
        return ret;
    }
    /**
     * Sends all messages of a flight in one packet
     * @param messages - The messages to be sent
     */
    sendFlight(messages, callback) {
        const buf = Buffer.concat(messages.map(msg => this.processOutgoingMessage(msg)));
        this.udpSocket.send(buf, 0, buf.length, this.options.port, this.options.address, callback);
    }
    /**
     * Receives DTLS messages from the given buffer.
     * @param buf The buffer containing DTLSCiphertext packets
     */
    receive(buf) {
        let offset = 0;
        let packets = [];
        while (offset < buf.length) {
            try {
                const packet = DTLSCiphertext_1.DTLSCiphertext.from(DTLSCiphertext_1.DTLSCiphertext.spec, buf, offset);
                if (packet.readBytes <= 0) {
                    // this shouldn't happen, but we don't want to introduce an infinite loop
                    throw new Error(`Zero or less bytes read while parsing DTLS packet.`);
                }
                packets.push(packet.result);
                offset += packet.readBytes;
            }
            catch (e) {
                // TODO: cancel connection or what?
                debug(`Error in RecordLayer.receive: ${e}`);
                break;
            }
        }
        // now filter packets
        const knownEpochs = Object.keys(this.epochs).map(k => +k);
        packets = packets
            .filter(p => {
            if (!(p.epoch in knownEpochs)) {
                // discard packets from an unknown epoch
                // this will keep packets from the upcoming one
                return false;
            }
            else if (p.epoch < this.readEpochNr) {
                // discard old packets
                return false;
            }
            // discard packets that are not supposed to be received
            if (!this.epochs[p.epoch].antiReplayWindow.mayReceive(p.sequence_number)) {
                return false;
            }
            // parse the packet
            return true;
        });
        // decompress and decrypt packets
        const decompressor = (identity) => identity; // TODO: only valid for NULL compression, check it!
        packets = packets
            .map((p) => {
            const connectionState = this.epochs[p.epoch].connectionState;
            try {
                return connectionState.Decipher(p);
            }
            catch (e) {
                // decryption can fail because of bad MAC etc...
                // TODO: terminate connection if some threshold is passed (bad_record_mac)
                return null;
            }
        })
            .filter(p => p != null) // filter out packets that couldn't be decrypted
            .map(p => p.decompress(decompressor));
        // update the anti replay window
        for (const p of packets) {
            this.epochs[p.epoch].antiReplayWindow.markAsReceived(p.sequence_number);
        }
        return packets.map(p => ({
            type: p.type,
            data: p.fragment,
        }));
    }
    get readEpochNr() { return this._readEpochNr; }
    /**
     * The current epoch used for reading data
     */
    get currentReadEpoch() { return this.epochs[this._readEpochNr]; }
    get nextReadEpoch() { return this.epochs[this._readEpochNr + 1]; }
    get writeEpochNr() { return this._writeEpochNr; }
    /**
     * The current epoch used for writing data
     */
    get currentWriteEpoch() { return this.epochs[this._writeEpochNr]; }
    get nextWriteEpoch() { return this.epochs[this._writeEpochNr + 1]; }
    get nextEpochNr() {
        return Math.max(this.readEpochNr, this.writeEpochNr) + 1;
    }
    /**
     * The next read and write epoch that will be used.
     * Be careful as this might point to the wrong epoch between ChangeCipherSpec messages
     */
    get nextEpoch() { return this.epochs[this.nextEpochNr]; }
    /**
     * Ensure there's a next epoch to switch to
     */
    ensureNextEpoch() {
        // makes sure a pending state exists
        if (!this.epochs[this.nextEpochNr]) {
            this.epochs[this.nextEpochNr] = this.createEpoch(this.nextEpochNr);
        }
    }
    createEpoch(index) {
        return {
            index: index,
            connectionState: new ConnectionState_1.ConnectionState(),
            antiReplayWindow: new AntiReplayWindow_1.AntiReplayWindow(),
            writeSequenceNumber: -1,
        };
    }
    advanceReadEpoch() {
        this._readEpochNr++;
        this.ensureNextEpoch();
    }
    advanceWriteEpoch() {
        this._writeEpochNr++;
        this.ensureNextEpoch();
    }
    static get MAX_PAYLOAD_SIZE() { return RecordLayer.MTU - RecordLayer.MTU_OVERHEAD; }
}
/**
 * Maximum transfer unit of the underlying connection.
 * Note: Ethernet supports up to 1500 bytes, of which 20 bytes are reserved for the IP header and 8 for the UDP header
 */
RecordLayer.MTU = 1280;
RecordLayer.MTU_OVERHEAD = 20 + 8;
// Default to DTLSv1.2
RecordLayer.DTLSVersion = new ProtocolVersion_1.ProtocolVersion(~1, ~2);
exports.RecordLayer = RecordLayer;
