/// <reference types="node" />
import { Option } from "./Option";
export declare enum MessageType {
    CON = 0,
    NON = 1,
    ACK = 2,
    RST = 3
}
export declare class MessageCode {
    readonly major: number;
    readonly minor: number;
    constructor(major: number, minor: number);
    static fromValue(value: number): MessageCode;
    readonly value: number;
    isEmpty(): boolean;
    isRequest(): boolean;
    isResponse(): boolean;
    toString(): string;
}
/**
 * all defined message codes
 */
export declare const MessageCodes: Readonly<{
    empty: MessageCode;
    request: {
        __major: number;
        get: MessageCode;
        post: MessageCode;
        put: MessageCode;
        delete: MessageCode;
    };
    success: {
        __major: number;
        created: MessageCode;
        deleted: MessageCode;
        valid: MessageCode;
        changed: MessageCode;
        content: MessageCode;
        continue: MessageCode;
    };
    clientError: {
        __major: number;
        badRequest: MessageCode;
        unauthorized: MessageCode;
        badOption: MessageCode;
        forbidden: MessageCode;
        notFound: MessageCode;
        methodNotAllowed: MessageCode;
        notAcceptable: MessageCode;
        requestEntityIncomplete: MessageCode;
        preconditionFailed: MessageCode;
        requestEntityTooLarge: MessageCode;
        unsupportedContentFormat: MessageCode;
    };
    serverError: {
        __major: number;
        internalServerError: MessageCode;
        notImplemented: MessageCode;
        badGateway: MessageCode;
        serviceUnavailable: MessageCode;
        gatewayTimeout: MessageCode;
        proxyingNotSupported: MessageCode;
    };
}>;
/**
 * represents a CoAP message
 */
export declare class Message {
    version: number;
    type: MessageType;
    code: MessageCode;
    messageId: number;
    token: Buffer;
    options: Option[];
    payload: Buffer;
    constructor(version: number, type: MessageType, code: MessageCode, messageId: number, token: Buffer, options: Option[], payload: Buffer);
    /**
     * parses a CoAP message from the given buffer
     * @param buf - the buffer to read from
     */
    static parse(buf: Buffer): Message;
    /**
     * serializes this message into a buffer
     */
    serialize(): Buffer;
    /**
     * Checks if this message is part of a blockwise transfer
     */
    isPartialMessage(): boolean;
}
