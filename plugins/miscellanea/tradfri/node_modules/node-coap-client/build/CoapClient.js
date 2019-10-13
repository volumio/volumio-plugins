"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const dgram = require("dgram");
const node_dtls_client_1 = require("node-dtls-client");
const querystring = require("querystring");
const nodeUrl = require("url");
const ContentFormats_1 = require("./ContentFormats");
const DeferredPromise_1 = require("./lib/DeferredPromise");
const Origin_1 = require("./lib/Origin");
const SocketWrapper_1 = require("./lib/SocketWrapper");
const Message_1 = require("./Message");
const Option_1 = require("./Option");
// initialize debugging
const debugPackage = require("debug");
const LogMessage_1 = require("./lib/LogMessage");
const debug = debugPackage("node-coap-client");
// print version info
// tslint:disable-next-line:no-var-requires
const npmVersion = require("../package.json").version;
debug(`CoAP client version ${npmVersion}`);
function urlToString(url) {
    return `${url.protocol}//${url.hostname}:${url.port}${url.pathname}`;
}
class PendingRequest {
    constructor(initial) {
        if (!initial)
            return;
        this.connection = initial.connection;
        this.url = initial.url;
        this.originalMessage = initial.originalMessage;
        this.retransmit = initial.retransmit;
        this.promise = initial.promise;
        this.callback = initial.callback;
        this.keepAlive = initial.keepAlive;
        this.observe = initial.observe;
        this._concurrency = initial.concurrency;
    }
    set concurrency(value) {
        const changed = value !== this._concurrency;
        this._concurrency = value;
        if (changed)
            CoapClient.onConcurrencyChanged(this);
    }
    get concurrency() {
        return this._concurrency;
    }
    queueForRetransmission() {
        if (this.retransmit != null && typeof this.retransmit.action === "function") {
            this.retransmit.jsTimeout = setTimeout(this.retransmit.action, this.retransmit.timeout);
        }
    }
}
// TODO: make configurable
const RETRANSMISSION_PARAMS = {
    ackTimeout: 2,
    ackRandomFactor: 1.5,
    maxRetransmit: 4,
};
const TOKEN_LENGTH = 4;
/** How many concurrent messages are allowed. Should be 1 */
const MAX_CONCURRENCY = 1;
function incrementToken(token) {
    const len = token.length;
    const ret = Buffer.alloc(len, token);
    for (let i = len - 1; i >= 0; i--) {
        if (ret[i] < 0xff) {
            ret[i]++;
            break;
        }
        else {
            ret[i] = 0;
            // continue with the next digit
        }
    }
    return ret;
}
function incrementMessageID(msgId) {
    return (++msgId > 0xffff) ? 1 : msgId;
}
function validateBlockSize(size) {
    // block size is represented as 2**(4 + X) where X is an integer from 0..6
    const exp = Math.log2(size) - 4;
    // is the exponent an integer?
    if (exp % 1 !== 0)
        return false;
    // is the exponent in the range of 0..6?
    if (exp < 0 || exp > 6)
        return false;
    return true;
}
// Since coaps:// urls are parsed by the url package, the contained hostname is normalized.
// This function applies the same transformation to any given hostname. Fixes the issue mentioned in #30
/**
 * Normalizes a hostname so it matches between `setSecurityParameters` and `connect`
 * @param hostname The hostname to normalize
 */
function normalizeHostname(hostname) {
    // make sure noone gave us a full URI
    if (!hostname.startsWith("coap://") && !hostname.startsWith("coaps://")) {
        hostname = `coaps://${hostname}`;
    }
    return nodeUrl.parse(hostname).hostname;
}
/**
 * provides methods to access CoAP server resources
 */
class CoapClient {
    /**
     * Sets the security params to be used for the given hostname
     */
    static setSecurityParams(hostname, params) {
        hostname = normalizeHostname(hostname);
        CoapClient.dtlsParams.set(hostname, params);
    }
    /**
     * Sets the default options for requests
     * @param defaults The default options to use for requests when no options are given
     */
    static setDefaultRequestOptions(defaults) {
        if (defaults.confirmable != null)
            this.defaultRequestOptions.confirmable = defaults.confirmable;
        if (defaults.keepAlive != null)
            this.defaultRequestOptions.keepAlive = defaults.keepAlive;
        if (defaults.retransmit != null)
            this.defaultRequestOptions.retransmit = defaults.retransmit;
        if (defaults.preferredBlockSize != null) {
            if (!validateBlockSize(defaults.preferredBlockSize)) {
                throw new Error(`${defaults.preferredBlockSize} is not a valid block size. The value must be a power of 2 between 16 and 1024`);
            }
            this.defaultRequestOptions.preferredBlockSize = defaults.preferredBlockSize;
        }
    }
    static getRequestOptions(options) {
        // ensure we have options and set the default params
        options = options || {};
        if (options.confirmable == null)
            options.confirmable = this.defaultRequestOptions.confirmable;
        if (options.keepAlive == null)
            options.keepAlive = this.defaultRequestOptions.keepAlive;
        if (options.retransmit == null)
            options.retransmit = this.defaultRequestOptions.retransmit;
        if (options.preferredBlockSize == null) {
            options.preferredBlockSize = this.defaultRequestOptions.preferredBlockSize;
        }
        else {
            if (!validateBlockSize(options.preferredBlockSize)) {
                throw new Error(`${options.preferredBlockSize} is not a valid block size. The value must be a power of 2 between 16 and 1024`);
            }
        }
        return options;
    }
    /**
     * Closes and forgets about connections, useful if DTLS session is reset on remote end
     * @param originOrHostname - Origin (protocol://hostname:port) or Hostname to reset,
     * omit to reset all connections
     */
    static reset(originOrHostname) {
        debug(`reset(${originOrHostname || ""})`);
        let predicate;
        if (originOrHostname != null) {
            if (typeof originOrHostname === "string") {
                // we were given a hostname, forget the connection if the origin's hostname matches
                predicate = (originString) => Origin_1.Origin.parse(originString).hostname === originOrHostname;
            }
            else {
                // we were given an origin, forget the connection if its string representation matches
                const match = originOrHostname.toString();
                predicate = (originString) => originString === match;
            }
        }
        else {
            // we weren't given a filter, forget all connections
            predicate = (originString) => true;
        }
        // forget all pending requests matching the predicate
        for (const request of CoapClient.pendingRequestsByMsgID.values()) {
            // check if the request matches the predicate
            const originString = Origin_1.Origin.parse(request.url).toString();
            if (!predicate(originString))
                continue;
            // and forget it if so
            if (request.promise != null)
                request.promise.reject("CoapClient was reset");
            CoapClient.forgetRequest({ request });
        }
        debug(`${Object.keys(CoapClient.pendingRequestsByMsgID).length} pending requests remaining...`);
        // cancel all pending connections matching the predicate
        for (const [originString, connection] of CoapClient.pendingConnections) {
            if (!predicate(originString))
                continue;
            connection.reject("CoapClient was reset");
            CoapClient.pendingConnections.delete(originString);
        }
        debug(`${Object.keys(CoapClient.pendingConnections).length} pending connections remaining...`);
        // forget all connections matching the predicate
        for (const [originString, connection] of CoapClient.connections) {
            if (!predicate(originString))
                continue;
            debug(`closing connection to ${originString}`);
            if (connection.socket != null) {
                connection.socket.close();
            }
            CoapClient.connections.delete(originString);
        }
        debug(`${Object.keys(CoapClient.connections).length} active connections remaining...`);
    }
    /**
     * Requests a CoAP resource
     * @param url - The URL to be requested. Must start with coap:// or coaps://
     * @param method - The request method to be used
     * @param payload - The optional payload to be attached to the request
     * @param options - Various options to control the request.
     */
    static request(url, method, payload, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // parse/convert url
            if (typeof url === "string") {
                url = nodeUrl.parse(url);
            }
            // ensure we have options and set the default params
            options = this.getRequestOptions(options);
            // retrieve or create the connection we're going to use
            const origin = Origin_1.Origin.fromUrl(url);
            const connection = yield CoapClient.getConnection(origin);
            // find all the message parameters
            const type = options.confirmable ? Message_1.MessageType.CON : Message_1.MessageType.NON;
            const code = Message_1.MessageCodes.request[method];
            const messageId = connection.lastMsgId = incrementMessageID(connection.lastMsgId);
            const token = connection.lastToken = incrementToken(connection.lastToken);
            payload = payload || Buffer.from([]);
            // create message options, be careful to order them by code, no sorting is implemented yet
            const msgOptions = [];
            // [11] path of the request
            let pathname = url.pathname || "";
            while (pathname.startsWith("/")) {
                pathname = pathname.slice(1);
            }
            while (pathname.endsWith("/")) {
                pathname = pathname.slice(0, -1);
            }
            const pathParts = pathname.split("/");
            msgOptions.push(...pathParts.map(part => Option_1.Options.UriPath(part)));
            // [12] content format
            msgOptions.push(Option_1.Options.ContentFormat(ContentFormats_1.ContentFormats.application_json));
            // [15] query
            if (url.query != null) {
                // unescape and split the querystring
                const queryParts = querystring.parse(url.query);
                for (const key of Object.keys(queryParts)) {
                    const part = queryParts[key];
                    if (Array.isArray(part)) {
                        msgOptions.push(...part.map(value => Option_1.Options.UriQuery(`${key}=${value}`)));
                    }
                    else {
                        msgOptions.push(Option_1.Options.UriQuery(`${key}=${part}`));
                    }
                }
            }
            // [23] Block2 (preferred response block size)
            if (options.preferredBlockSize != null) {
                msgOptions.push(Option_1.Options.Block2(0, true, options.preferredBlockSize));
            }
            // create the promise we're going to return
            const response = DeferredPromise_1.createDeferredPromise();
            // create the message we're going to send
            const message = CoapClient.createMessage(type, code, messageId, token, msgOptions, payload);
            // create the retransmission info
            let retransmit;
            if (options.retransmit && type === Message_1.MessageType.CON) {
                retransmit = CoapClient.createRetransmissionInfo(messageId);
            }
            // remember the request
            const req = new PendingRequest({
                connection,
                url: urlToString(url),
                originalMessage: message,
                retransmit,
                keepAlive: options.keepAlive,
                callback: null,
                observe: false,
                promise: response,
                concurrency: 0,
            });
            // remember the request
            CoapClient.rememberRequest(req);
            // now send the message
            CoapClient.send(connection, message);
            return response;
        });
    }
    /**
     * Creates a RetransmissionInfo to use for retransmission of lost packets
     * @param messageId The message id of the corresponding request
     */
    static createRetransmissionInfo(messageId) {
        return {
            timeout: CoapClient.getRetransmissionInterval(),
            action: () => CoapClient.retransmit(messageId),
            jsTimeout: null,
            counter: 0,
        };
    }
    /**
     * Pings a CoAP endpoint to check if it is alive
     * @param target - The target to be pinged. Must be a string, NodeJS.Url or Origin and has to contain the protocol, host and port.
     * @param timeout - (optional) Timeout in ms, after which the ping is deemed unanswered. Default: 5000ms
     */
    static ping(target, timeout = 5000) {
        return __awaiter(this, void 0, void 0, function* () {
            // parse/convert url
            if (typeof target === "string") {
                target = Origin_1.Origin.parse(target);
            }
            else if (!(target instanceof Origin_1.Origin)) { // is a nodeUrl
                target = Origin_1.Origin.fromUrl(target);
            }
            // retrieve or create the connection we're going to use
            const originString = target.toString();
            let connection;
            try {
                connection = yield CoapClient.getConnection(target);
            }
            catch (e) {
                // we didn't even get a connection, so fail the ping
                return false;
            }
            // create the promise we're going to return
            const response = DeferredPromise_1.createDeferredPromise();
            // create the message we're going to send.
            // An empty message with type CON equals a ping and provokes a RST from the server
            const messageId = connection.lastMsgId = incrementMessageID(connection.lastMsgId);
            const message = CoapClient.createMessage(Message_1.MessageType.CON, Message_1.MessageCodes.empty, messageId);
            // remember the request
            const req = new PendingRequest({
                connection,
                url: originString,
                originalMessage: message,
                retransmit: null,
                keepAlive: true,
                callback: null,
                observe: false,
                promise: response,
                concurrency: 0,
            });
            // remember the request
            CoapClient.rememberRequest(req);
            // now send the message
            CoapClient.send(connection, message);
            // fail the ping after the timeout has passed
            const failTimeout = setTimeout(() => response.reject(), timeout);
            let success;
            try {
                // now wait for success or failure
                yield response;
                success = true;
            }
            catch (e) {
                success = false;
            }
            finally {
                // cleanup
                clearTimeout(failTimeout);
                CoapClient.forgetRequest({ request: req });
            }
            return success;
        });
    }
    /**
     * Re-Sends a message in case it got lost
     * @param msgID
     */
    static retransmit(msgID) {
        // find the request with all the information
        const request = CoapClient.findRequest({ msgID });
        if (request == null || request.retransmit == null)
            return;
        // are we over the limit?
        if (request.retransmit.counter > RETRANSMISSION_PARAMS.maxRetransmit) {
            // if this is a one-time request, reject the response promise
            if (request.promise !== null) {
                request.promise.reject("Retransmit counter exceeded");
            }
            // then stop retransmitting and forget the request
            CoapClient.forgetRequest({ request });
            return;
        }
        debug(`retransmitting message ${msgID.toString(16)}, try #${request.retransmit.counter + 1}`);
        // resend the message
        CoapClient.send(request.connection, request.originalMessage, "immediate");
        // and increase the params
        request.retransmit.counter++;
        request.retransmit.timeout *= 2;
        request.queueForRetransmission();
    }
    static getRetransmissionInterval() {
        return Math.round(1000 /*ms*/ * RETRANSMISSION_PARAMS.ackTimeout *
            (1 + Math.random() * (RETRANSMISSION_PARAMS.ackRandomFactor - 1)));
    }
    static stopRetransmission(request) {
        if (request.retransmit == null)
            return;
        clearTimeout(request.retransmit.jsTimeout);
        request.retransmit = null;
    }
    /**
     * When the server responds with block-wise responses, this requests the next block.
     * @param request The original request which resulted in a block-wise response
     */
    static requestNextBlock(request) {
        const message = request.originalMessage;
        const connection = request.connection;
        // requests for the next block are a new message with a new message id
        const oldMsgID = message.messageId;
        message.messageId = connection.lastMsgId = incrementMessageID(connection.lastMsgId);
        // this means we have to update the dictionaries aswell, so the request is still found
        CoapClient.pendingRequestsByMsgID.set(message.messageId, request);
        CoapClient.pendingRequestsByMsgID.delete(oldMsgID);
        // even if the original request was an observe, the partial requests are not
        message.options = message.options.filter(o => o.name !== "Observe");
        // Change (or create) the Block2 option, so the server knows which block to send
        let block2Opt = Option_1.findOption(message.options, "Block2");
        if (block2Opt == null) {
            // respect the response options and request the next block
            const { blockNumber, blockSize } = Option_1.findOption(request.partialResponse.options, "Block2");
            block2Opt = Option_1.Options.Block2(blockNumber + 1, true, blockSize);
            message.options.push(block2Opt);
        }
        else {
            // we know the params to use, just request the next block
            block2Opt.isLastBlock = true;
            block2Opt.blockNumber++;
        }
        // enable retransmission for this updated request
        request.retransmit = CoapClient.createRetransmissionInfo(message.messageId);
        // and enqueue it for sending
        CoapClient.send(connection, message, "high");
    }
    /**
     * Observes a CoAP resource
     * @param url - The URL to be requested. Must start with coap:// or coaps://
     * @param method - The request method to be used
     * @param payload - The optional payload to be attached to the request
     * @param options - Various options to control the request.
     */
    static observe(url, method, callback, payload, options) {
        return __awaiter(this, void 0, void 0, function* () {
            // parse/convert url
            if (typeof url === "string") {
                url = nodeUrl.parse(url);
            }
            // ensure we have options and set the default params
            options = this.getRequestOptions(options);
            // retrieve or create the connection we're going to use
            const origin = Origin_1.Origin.fromUrl(url);
            const connection = yield CoapClient.getConnection(origin);
            // find all the message parameters
            const type = options.confirmable ? Message_1.MessageType.CON : Message_1.MessageType.NON;
            const code = Message_1.MessageCodes.request[method];
            const messageId = connection.lastMsgId = incrementMessageID(connection.lastMsgId);
            const token = connection.lastToken = incrementToken(connection.lastToken);
            payload = payload || Buffer.from([]);
            // create message options, be careful to order them by code, no sorting is implemented yet
            const msgOptions = [];
            // [6] observe?
            msgOptions.push(Option_1.Options.Observe(true));
            // [11] path of the request
            let pathname = url.pathname || "";
            while (pathname.startsWith("/")) {
                pathname = pathname.slice(1);
            }
            while (pathname.endsWith("/")) {
                pathname = pathname.slice(0, -1);
            }
            const pathParts = pathname.split("/");
            msgOptions.push(...pathParts.map(part => Option_1.Options.UriPath(part)));
            // [12] content format
            msgOptions.push(Option_1.Options.ContentFormat(ContentFormats_1.ContentFormats.application_json));
            // [15] query
            let query = url.query || "";
            while (query.startsWith("?")) {
                query = query.slice(1);
            }
            while (query.endsWith("&")) {
                query = query.slice(0, -1);
            }
            const queryParts = query.split("&");
            msgOptions.push(...queryParts.map(part => Option_1.Options.UriQuery(part)));
            // In contrast to requests, we don't work with a deferred promise when observing
            // Instead, we invoke a callback for *every* response.
            // create the message we're going to send
            const message = CoapClient.createMessage(type, code, messageId, token, msgOptions, payload);
            // create the retransmission info
            let retransmit;
            if (options.retransmit && type === Message_1.MessageType.CON) {
                retransmit = CoapClient.createRetransmissionInfo(messageId);
            }
            // remember the request
            const req = new PendingRequest({
                connection,
                url: urlToString(url),
                originalMessage: message,
                retransmit,
                keepAlive: options.keepAlive,
                callback,
                observe: true,
                promise: null,
                concurrency: 0,
            });
            // remember the request
            CoapClient.rememberRequest(req);
            // now send the message
            CoapClient.send(connection, message);
        });
    }
    /**
     * Stops observation of the given url
     */
    static stopObserving(url) {
        // parse/convert url
        if (typeof url === "string") {
            url = nodeUrl.parse(url);
        }
        // normalize the url
        const urlString = urlToString(url);
        // and forget the request if we have one remembered
        CoapClient.forgetRequest({ url: urlString });
    }
    static onMessage(origin, message, rinfo) {
        // parse the CoAP message
        const coapMsg = Message_1.Message.parse(message);
        LogMessage_1.logMessage(coapMsg);
        if (coapMsg.code.isEmpty()) {
            // ACK or RST
            // see if we have a request for this message id
            const request = CoapClient.findRequest({ msgID: coapMsg.messageId });
            if (request != null) {
                // reduce the request's concurrency, since it was handled on the server
                request.concurrency = 0;
                // handle the message
                switch (coapMsg.type) {
                    case Message_1.MessageType.ACK:
                        debug(`received ACK for message 0x${coapMsg.messageId.toString(16)}, stopping retransmission...`);
                        // the other party has received the message, stop resending
                        CoapClient.stopRetransmission(request);
                        break;
                    case Message_1.MessageType.RST:
                        if (request.originalMessage.type === Message_1.MessageType.CON &&
                            request.originalMessage.code === Message_1.MessageCodes.empty) { // this message was a ping (empty CON, answered by RST)
                            // resolve the promise
                            debug(`received response to ping with ID 0x${coapMsg.messageId.toString(16)}`);
                            request.promise.resolve();
                        }
                        else {
                            // the other party doesn't know what to do with the request, forget it
                            debug(`received RST for message 0x${coapMsg.messageId.toString(16)}, forgetting the request...`);
                            CoapClient.forgetRequest({ request });
                        }
                        break;
                }
            }
        }
        else if (coapMsg.code.isRequest()) {
            // we are a client implementation, we should not get requests
            // ignore them
        }
        else if (coapMsg.code.isResponse()) {
            // this is a response, find out what to do with it
            if (coapMsg.token && coapMsg.token.length) {
                // this message has a token, check which request it belongs to
                const tokenString = coapMsg.token.toString("hex");
                const request = CoapClient.findRequest({ token: tokenString });
                if (request) {
                    // if the message is an acknowledgement, stop resending
                    if (coapMsg.type === Message_1.MessageType.ACK) {
                        debug(`received ACK for message 0x${coapMsg.messageId.toString(16)}, stopping retransmission...`);
                        CoapClient.stopRetransmission(request);
                    }
                    // parse options
                    let contentFormat = null;
                    if (coapMsg.options && coapMsg.options.length) {
                        // see if the response contains information about the content format
                        const optCntFmt = Option_1.findOption(coapMsg.options, "Content-Format");
                        if (optCntFmt)
                            contentFormat = optCntFmt.value;
                    }
                    let responseIsComplete = true;
                    if (coapMsg.isPartialMessage()) {
                        // Check if we expect more blocks
                        const blockOption = Option_1.findOption(coapMsg.options, "Block2"); // we know this is != null
                        // TODO: check for outdated partial responses
                        // remember the most recent message, but extend the stored buffer beforehand
                        if (request.partialResponse != null) {
                            // TODO: we should check if we got the correct fragment
                            // https://github.com/AlCalzone/node-coap-client/issues/26
                            coapMsg.payload = Buffer.concat([request.partialResponse.payload, coapMsg.payload]);
                        }
                        request.partialResponse = coapMsg;
                        if (blockOption.isLastBlock) {
                            // delete the partial response, so we don't get false information on later observe updates
                            request.partialResponse = null;
                        }
                        else {
                            CoapClient.requestNextBlock(request);
                            responseIsComplete = false;
                        }
                    }
                    // Now that we have a response, also reduce the request's concurrency,
                    // so other requests can be fired off
                    if (coapMsg.type === Message_1.MessageType.ACK)
                        request.concurrency = 0;
                    // while we only have a partial response, we cannot return it to the caller yet
                    if (!responseIsComplete)
                        return;
                    // prepare the response
                    const response = {
                        code: coapMsg.code,
                        format: contentFormat,
                        payload: coapMsg.payload,
                    };
                    if (request.observe) {
                        // call the callback
                        request.callback(response);
                    }
                    else {
                        // resolve the promise
                        request.promise.resolve(response);
                        // after handling one-time requests, delete the info about them
                        CoapClient.forgetRequest({ request });
                    }
                    // also acknowledge the packet if neccessary
                    if (coapMsg.type === Message_1.MessageType.CON) {
                        debug(`sending ACK for message 0x${coapMsg.messageId.toString(16)}`);
                        const ACK = CoapClient.createMessage(Message_1.MessageType.ACK, Message_1.MessageCodes.empty, coapMsg.messageId);
                        CoapClient.send(request.connection, ACK, "immediate");
                    }
                }
                else { // request == null
                    // no request found for this token, send RST so the server stops sending
                    // try to find the connection that belongs to this origin
                    const originString = origin.toString();
                    if (CoapClient.connections.has(originString)) {
                        const connection = CoapClient.connections.get(originString);
                        // and send the reset
                        debug(`sending RST for message 0x${coapMsg.messageId.toString(16)}`);
                        const RST = CoapClient.createMessage(Message_1.MessageType.RST, Message_1.MessageCodes.empty, coapMsg.messageId);
                        CoapClient.send(connection, RST, "immediate");
                    }
                } // request != null?
            } // (coapMsg.token && coapMsg.token.length)
        } // (coapMsg.code.isResponse())
    }
    /**
     * Creates a message with the given parameters
     * @param type
     * @param code
     * @param messageId
     * @param token
     * @param options
     * @param payload
     */
    static createMessage(type, code, messageId, token = null, options = [], // do we need this?
    payload = null) {
        return new Message_1.Message(0x01, type, code, messageId, token, options, payload);
    }
    /**
     * Send a CoAP message to the given endpoint
     * @param connection The connection to send the message on
     * @param message The message to send
     * @param highPriority Whether the message should be prioritized
     */
    static send(connection, message, priority = "normal") {
        const request = CoapClient.findRequest({ msgID: message.messageId });
        switch (priority) {
            case "immediate": {
                // Send high-prio messages immediately
                // This is for ACKs, RSTs and retransmissions
                debug(`sending high priority message 0x${message.messageId.toString(16)}`);
                CoapClient.doSend(connection, request, message);
                break;
            }
            case "normal": {
                // Put the message in the queue
                CoapClient.sendQueue.push({ connection, message });
                debug(`added message to the send queue with normal priority, new length = ${CoapClient.sendQueue.length}`);
                break;
            }
            case "high": {
                // Put the message in the queue (in first position)
                // This is for subsequent requests to blockwise resources
                CoapClient.sendQueue.unshift({ connection, message });
                debug(`added message to the send queue with high priority, new length = ${CoapClient.sendQueue.length}`);
                break;
            }
        }
        // start working it off now (maybe)
        CoapClient.workOffSendQueue();
    }
    /**
     * Gets called whenever a request's concurrency has changed
     * @param req The pending request whose concurrency has changed
     * @internal
     */
    static onConcurrencyChanged(req) {
        // only handle requests with a message (in case there's an edge case without a message)
        const message = req.originalMessage;
        if (message == null)
            return;
        // only handle requests we haven't forgotten yet
        if (!CoapClient.pendingRequestsByMsgID.has(message.messageId))
            return;
        debug(`request 0x${message.messageId.toString(16)}: concurrency changed => ${req.concurrency}`);
        if (req.concurrency === 0)
            CoapClient.workOffSendQueue();
    }
    static workOffSendQueue() {
        // check if there are messages to send
        if (CoapClient.sendQueue.length === 0) {
            debug(`workOffSendQueue > queue empty`);
            return;
        }
        // check if we may send a message now
        debug(`workOffSendQueue > concurrency = ${CoapClient.calculateConcurrency()} (MAX ${MAX_CONCURRENCY})`);
        if (CoapClient.calculateConcurrency() < MAX_CONCURRENCY) {
            // get the next message to send
            const { connection, message } = CoapClient.sendQueue.shift();
            debug(`concurrency low enough, sending message 0x${message.messageId.toString(16)}`);
            // update the request's concurrency (it's now being handled)
            const request = CoapClient.findRequest({ msgID: message.messageId });
            CoapClient.doSend(connection, request, message);
        }
        // to avoid any deadlocks we didn't think of, re-call this later
        setTimeout(CoapClient.workOffSendQueue, 1000);
    }
    /**
     * Does the actual sending of a message and starts concurrency/retransmission handling
     */
    static doSend(connection, request, message) {
        // handle concurrency/retransmission if neccessary
        if (request != null) {
            request.concurrency = 1;
            request.queueForRetransmission();
        }
        // send the message
        connection.socket.send(message.serialize(), connection.origin);
    }
    /** Calculates the current concurrency, i.e. how many parallel requests are being handled */
    static calculateConcurrency() {
        return [...CoapClient.pendingRequestsByMsgID.values()] // find all requests
            .map(req => req.concurrency) // extract their concurrency
            .reduce((sum, item) => sum + item, 0) // and sum it up
        ;
    }
    /**
     * Remembers a request for resending lost messages and tracking responses and updates
     * @param request
     * @param byUrl
     * @param byMsgID
     * @param byToken
     */
    static rememberRequest(request, byUrl = true, byMsgID = true, byToken = true) {
        let tokenString = "";
        if (byToken && request.originalMessage.token != null) {
            tokenString = request.originalMessage.token.toString("hex");
            CoapClient.pendingRequestsByToken.set(tokenString, request);
        }
        if (byMsgID) {
            CoapClient.pendingRequestsByMsgID.set(request.originalMessage.messageId, request);
        }
        if (byUrl) {
            CoapClient.pendingRequestsByUrl.set(request.url, request);
        }
        debug(`remembering request: msgID=0x${request.originalMessage.messageId.toString(16)}, token=${tokenString}, url=${request.url}`);
    }
    /**
     * Forgets a pending request
     * @param request
     * @param byUrl
     * @param byMsgID
     * @param byToken
     */
    static forgetRequest(which) {
        // find the request
        const request = which.request || CoapClient.findRequest(which);
        // none found, return
        if (request == null)
            return;
        let tokenString = "";
        if (request.originalMessage.token != null) {
            tokenString = request.originalMessage.token.toString("hex");
        }
        const msgID = request.originalMessage.messageId;
        debug(`forgetting request: token=${tokenString}; msgID=0x${msgID.toString(16)}`);
        // stop retransmission if neccessary
        CoapClient.stopRetransmission(request);
        // delete all references
        if (CoapClient.pendingRequestsByToken.has(tokenString)) {
            CoapClient.pendingRequestsByToken.delete(tokenString);
        }
        if (CoapClient.pendingRequestsByMsgID.has(msgID)) {
            CoapClient.pendingRequestsByMsgID.delete(msgID);
        }
        if (CoapClient.pendingRequestsByUrl.has(request.url)) {
            CoapClient.pendingRequestsByUrl.delete(request.url);
        }
        // Set concurrency to 0, so the send queue can continue
        request.concurrency = 0;
        // If this request doesn't have the keepAlive option,
        // close the connection if it was the last one with the same origin
        if (!request.keepAlive) {
            const origin = Origin_1.Origin.parse(request.url);
            const requestsOnOrigin = CoapClient.findRequestsByOrigin(origin).length;
            if (requestsOnOrigin === 0) {
                // this was the last request, close the connection
                CoapClient.reset(origin);
            }
        }
    }
    /**
     * Finds a request we have remembered by one of its properties
     * @param which
     */
    static findRequest(which) {
        if (which.url != null) {
            if (CoapClient.pendingRequestsByUrl.has(which.url)) {
                return CoapClient.pendingRequestsByUrl.get(which.url);
            }
        }
        else if (which.msgID != null) {
            if (CoapClient.pendingRequestsByMsgID.has(which.msgID)) {
                return CoapClient.pendingRequestsByMsgID.get(which.msgID);
            }
        }
        else if (which.token != null) {
            if (CoapClient.pendingRequestsByToken.has(which.token)) {
                return CoapClient.pendingRequestsByToken.get(which.token);
            }
        }
        return null;
    }
    /**
     * Finds all pending requests of a given origin
     */
    static findRequestsByOrigin(origin) {
        const originString = origin.toString();
        return [...CoapClient.pendingRequestsByMsgID.values()]
            .filter((req) => Origin_1.Origin.parse(req.url).toString() === originString);
    }
    /**
     * Tries to establish a connection to the given target. Returns true on success, false otherwise.
     * @param target The target to connect to. Must be a string, NodeJS.Url or Origin and has to contain the protocol, host and port.
     */
    static tryToConnect(target) {
        return __awaiter(this, void 0, void 0, function* () {
            // parse/convert url
            if (typeof target === "string") {
                target = Origin_1.Origin.parse(target);
            }
            else if (!(target instanceof Origin_1.Origin)) { // is a nodeUrl
                target = Origin_1.Origin.fromUrl(target);
            }
            // retrieve or create the connection we're going to use
            try {
                yield CoapClient.getConnection(target);
                return true;
            }
            catch (e) {
                debug(`tryToConnect(${target}) => failed with error: ${e}`);
                if (/bad_record_mac/.test(e.message)) {
                    // as of DTLSv1.2 this means we provided invalid credentials
                    return "auth failed";
                }
                else if (/(dtls handshake timed out|enotfound)/i.test(e.message)) {
                    // The other party could not be reached or has no DTLS server running
                    return "timeout";
                }
                else {
                    return e;
                }
            }
        });
    }
    /**
     * Establishes a new or retrieves an existing connection to the given origin
     * @param origin - The other party
     * @internal
     */
    static getConnection(origin) {
        const originString = origin.toString();
        if (CoapClient.connections.has(originString)) {
            debug(`getConnection(${originString}) => found existing connection`);
            // return existing connection
            return Promise.resolve(CoapClient.connections.get(originString));
        }
        else if (CoapClient.pendingConnections.has(originString)) {
            debug(`getConnection(${originString}) => connection is pending`);
            // return the pending connection promise
            return CoapClient.pendingConnections.get(originString);
        }
        else {
            debug(`getConnection(${originString}) => establishing new connection`);
            // create a promise and start the connection queue
            const ret = DeferredPromise_1.createDeferredPromise();
            CoapClient.pendingConnections.set(originString, ret);
            setTimeout(CoapClient.workOffPendingConnections, 0);
            return ret;
        }
    }
    static workOffPendingConnections() {
        return __awaiter(this, void 0, void 0, function* () {
            if (CoapClient.pendingConnections.size === 0) {
                // no more pending connections, we're done
                CoapClient.isConnecting = false;
                return;
            }
            else if (CoapClient.isConnecting) {
                // we're already busy
                return;
            }
            CoapClient.isConnecting = true;
            // Get the connection to establish
            const originString = CoapClient.pendingConnections.keys().next().value;
            const origin = Origin_1.Origin.parse(originString);
            const promise = CoapClient.pendingConnections.get(originString);
            CoapClient.pendingConnections.delete(originString);
            // Try a few times to setup a working connection
            const maxTries = 3;
            let socket;
            for (let i = 1; i <= maxTries; i++) {
                try {
                    socket = yield CoapClient.getSocket(origin);
                    break; // it worked
                }
                catch (e) {
                    // if we are going to try again, ignore the error
                    // else throw it
                    if (i === maxTries) {
                        promise.reject(e);
                    }
                }
            }
            if (socket != null) {
                // add the event handler
                socket.on("message", CoapClient.onMessage.bind(CoapClient, originString));
                // initialize the connection params and remember them
                const ret = {
                    origin,
                    socket,
                    lastMsgId: 0,
                    lastToken: crypto.randomBytes(TOKEN_LENGTH),
                };
                CoapClient.connections.set(originString, ret);
                // and resolve the deferred promise
                promise.resolve(ret);
            }
            // continue working off the queue
            CoapClient.isConnecting = false;
            setTimeout(CoapClient.workOffPendingConnections, 0);
        });
    }
    /**
     * Establishes or retrieves a socket that can be used to send to and receive data from the given origin
     * @param origin - The other party
     */
    static getSocket(origin) {
        switch (origin.protocol) {
            case "coap:":
                // simply return a normal udp socket
                return Promise.resolve(new SocketWrapper_1.SocketWrapper(dgram.createSocket("udp4")));
            case "coaps:":
                // try to find security parameters
                if (!CoapClient.dtlsParams.has(origin.hostname)) {
                    return Promise.reject(new Error(`No security parameters given for the resource at ${origin.toString()}`));
                }
                const dtlsOpts = Object.assign({
                    type: "udp4",
                    address: origin.hostname,
                    port: origin.port,
                }, CoapClient.dtlsParams.get(origin.hostname));
                // return a promise we resolve as soon as the connection is secured
                const ret = DeferredPromise_1.createDeferredPromise();
                // try connecting
                const onConnection = () => {
                    debug("successfully created socket for origin " + origin.toString());
                    sock.removeListener("error", onError);
                    ret.resolve(new SocketWrapper_1.SocketWrapper(sock));
                };
                const onError = (e) => {
                    debug("socket creation for origin " + origin.toString() + " failed: " + e);
                    sock.removeListener("connected", onConnection);
                    ret.reject(e.message);
                };
                const sock = node_dtls_client_1.dtls
                    .createSocket(dtlsOpts)
                    .once("connected", onConnection)
                    .once("error", onError);
                return ret;
            default:
                throw new Error(`protocol type "${origin.protocol}" is not supported`);
        }
    }
}
CoapClient.connections = new Map();
/** Queue of the connections waiting to be established, sorted by the origin */
CoapClient.pendingConnections = new Map();
CoapClient.isConnecting = false;
/** Table of all known security params, sorted by the hostname */
CoapClient.dtlsParams = new Map();
/** All pending requests, sorted by the token */
CoapClient.pendingRequestsByToken = new Map();
CoapClient.pendingRequestsByMsgID = new Map();
CoapClient.pendingRequestsByUrl = new Map();
/** Queue of the messages waiting to be sent */
CoapClient.sendQueue = [];
/** Default values for request options */
CoapClient.defaultRequestOptions = {
    confirmable: true,
    keepAlive: true,
    retransmit: true,
    preferredBlockSize: null,
};
exports.CoapClient = CoapClient;
