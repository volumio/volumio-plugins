"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dgram = require("dgram");
const events_1 = require("events");
const Handshake_1 = require("./DTLS/Handshake");
const HandshakeHandler_1 = require("./DTLS/HandshakeHandler");
const RecordLayer_1 = require("./DTLS/RecordLayer");
const Alert_1 = require("./TLS/Alert");
const ContentType_1 = require("./TLS/ContentType");
const TLSStruct_1 = require("./TLS/TLSStruct");
// enable debug output
const debugPackage = require("debug");
const debug = debugPackage("node-dtls-client");
var dtls;
(function (dtls) {
    /**
     * Creates a DTLS-secured socket.
     * @param options - The options used to create the socket
     * @param callback - If provided, callback is bound to the "message" event
     */
    function createSocket(options, callback) {
        checkOptions(options);
        const ret = new Socket(options);
        // bind "message" event after the handshake is finished
        if (callback != null) {
            ret.once("connected", () => {
                ret.on("message", callback);
            });
        }
        return ret;
    }
    dtls.createSocket = createSocket;
    /**
     * DTLS-secured UDP socket. Can be used as a drop-in replacement for dgram.Socket
     */
    class Socket extends events_1.EventEmitter {
        /**
         * INTERNAL USE, DON'T CALL DIRECTLY. use createSocket instead!
         */
        constructor(options) {
            super();
            this.options = options;
            this._handshakeFinished = false;
            // buffer messages while handshaking
            this.bufferedMessages = [];
            this._isClosed = false;
            // setup the connection
            this.udp = dgram
                .createSocket(options)
                .on("listening", this.udp_onListening.bind(this))
                .on("message", this.udp_onMessage.bind(this))
                .on("close", this.udp_onClose.bind(this))
                .on("error", this.udp_onError.bind(this));
            // setup a timeout watcher. Default: 1000ms timeout, minimum: 100ms
            this.options.timeout = Math.max(100, this.options.timeout || 1000);
            this._udpConnected = false;
            this._connectionTimeout = setTimeout(() => this.expectConnection(), this.options.timeout);
            // start the connection
            this.udp.bind();
        }
        /**
         * Send the given data. It is automatically compressed and encrypted.
         */
        send(data, callback) {
            if (this._isClosed) {
                throw new Error("The socket is closed. Cannot send data.");
            }
            if (!this._handshakeFinished) {
                throw new Error("DTLS handshake is not finished yet. Cannot send data.");
            }
            // send finished data over UDP
            const packet = {
                type: ContentType_1.ContentType.application_data,
                data: data,
            };
            this.recordLayer.send(packet, callback);
        }
        /**
         * Closes the connection
         */
        close(callback) {
            this.sendAlert(new Alert_1.Alert(Alert_1.AlertLevel.warning, Alert_1.AlertDescription.close_notify), (e) => {
                this.udp.close();
                if (callback)
                    this.once("close", callback);
            });
        }
        udp_onListening() {
            // connection successful
            this._udpConnected = true;
            if (this._connectionTimeout != null)
                clearTimeout(this._connectionTimeout);
            // initialize record layer
            this.recordLayer = new RecordLayer_1.RecordLayer(this.udp, this.options);
            // reuse the connection timeout for handshake timeout watching
            this._connectionTimeout = setTimeout(() => this.expectHandshake(), this.options.timeout);
            // also start handshake
            this.handshakeHandler = new HandshakeHandler_1.ClientHandshakeHandler(this.recordLayer, this.options, (alert, err) => {
                const nextStep = () => {
                    // if we have an error, terminate the connection
                    if (err) {
                        // something happened on the way to heaven
                        this.killConnection(err);
                    }
                    else {
                        // when done, emit "connected" event
                        this._handshakeFinished = true;
                        if (this._connectionTimeout != null)
                            clearTimeout(this._connectionTimeout);
                        this.emit("connected");
                        // also emit all buffered messages
                        for (const { msg, rinfo } of this.bufferedMessages) {
                            this.emit("message", msg.data, rinfo);
                        }
                        this.bufferedMessages = [];
                    }
                };
                // if we have an alert, send it to the other party
                if (alert) {
                    this.sendAlert(alert, nextStep);
                }
                else {
                    nextStep();
                }
            });
        }
        // is called after the connection timeout expired.
        // Check the connection and throws if it is not established yet
        expectConnection() {
            if (!this._isClosed && !this._udpConnected) {
                // connection timed out
                this.killConnection(new Error("The connection timed out"));
            }
        }
        expectHandshake() {
            if (!this._isClosed && !this._handshakeFinished) {
                // handshake timed out
                this.killConnection(new Error("The DTLS handshake timed out"));
            }
        }
        sendAlert(alert, callback) {
            // send alert to the other party
            const packet = {
                type: ContentType_1.ContentType.alert,
                data: alert.serialize(),
            };
            this.recordLayer.send(packet, callback);
        }
        udp_onMessage(udpMsg, rinfo) {
            // decode the messages
            const messages = this.recordLayer.receive(udpMsg);
            // TODO: implement retransmission.
            for (const msg of messages) {
                switch (msg.type) {
                    case ContentType_1.ContentType.handshake:
                        const handshake = TLSStruct_1.TLSStruct.from(Handshake_1.FragmentedHandshake.spec, msg.data).result;
                        this.handshakeHandler.processIncomingMessage(handshake);
                        break;
                    case ContentType_1.ContentType.change_cipher_spec:
                        this.recordLayer.advanceReadEpoch();
                        break;
                    case ContentType_1.ContentType.alert:
                        const alert = TLSStruct_1.TLSStruct.from(Alert_1.Alert.spec, msg.data).result;
                        if (alert.level === Alert_1.AlertLevel.fatal) {
                            // terminate the connection when receiving a fatal alert
                            const errorMessage = `received fatal alert: ${Alert_1.AlertDescription[alert.description]}`;
                            debug(errorMessage);
                            this.killConnection(new Error(errorMessage));
                        }
                        else if (alert.level === Alert_1.AlertLevel.warning) {
                            // not sure what to do with most warning alerts
                            switch (alert.description) {
                                case Alert_1.AlertDescription.close_notify:
                                    // except close_notify, which means we should terminate the connection
                                    this.close();
                                    break;
                            }
                        }
                        break;
                    case ContentType_1.ContentType.application_data:
                        if (!this._handshakeFinished) {
                            // if we are still shaking hands, buffer the message until we're done
                            this.bufferedMessages.push({ msg, rinfo });
                        }
                        else /* finished */ {
                            // else emit the message
                            // TODO: extend params?
                            // TODO: do we need to emit rinfo?
                            this.emit("message", msg.data, rinfo);
                        }
                        break;
                }
            }
        }
        udp_onClose() {
            // we no longer want to receive events
            this.udp.removeAllListeners();
            if (!this._isClosed) {
                this._isClosed = true;
                this.emit("close");
            }
        }
        udp_onError(exception) {
            this.killConnection(exception);
        }
        /** Kills the underlying UDP connection and emits an error if neccessary */
        killConnection(err) {
            if (this._isClosed)
                return;
            this._isClosed = true;
            if (this._connectionTimeout != null)
                clearTimeout(this._connectionTimeout);
            if (this.udp != null) {
                // keep the error handler around or we get spurious ENOTFOUND errors unhandled
                this.udp.removeAllListeners("listening");
                this.udp.removeAllListeners("message");
                this.udp.removeAllListeners("close");
                this.udp.close();
            }
            if (err != null)
                this.emit("error", err);
        }
    }
    dtls.Socket = Socket;
    /**
     * Checks if a given object adheres to the Options interface definition
     * Throws if it doesn't.
     */
    function checkOptions(opts) {
        if (opts == null)
            throw new Error("No connection options were given!");
        if (opts.type !== "udp4" && opts.type !== "udp6")
            throw new Error(`The connection options must have a "type" property with value "udp4" or "udp6"!`);
        if (typeof opts.address !== "string" || opts.address.length === 0)
            throw new Error(`The connection options must contain the remote address as a string!`);
        if (typeof opts.port !== "number" || opts.port < 1 || opts.port > 65535)
            throw new Error(`The connection options must contain a remote port from 1 to 65535!`);
        if (typeof opts.psk !== "object")
            throw new Error(`The connection options must contain a PSK dictionary object!`);
    }
})(dtls = exports.dtls || (exports.dtls = {}));
