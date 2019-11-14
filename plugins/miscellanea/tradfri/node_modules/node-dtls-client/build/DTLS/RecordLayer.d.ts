/// <reference types="node" />
import * as dgram from "dgram";
import { dtls } from "../dtls";
import { AntiReplayWindow } from "../TLS/AntiReplayWindow";
import { ConnectionState } from "../TLS/ConnectionState";
import { Message } from "../TLS/Message";
import { ProtocolVersion } from "../TLS/ProtocolVersion";
export interface Epoch {
    index: number;
    connectionState: ConnectionState;
    writeSequenceNumber: number;
    antiReplayWindow: AntiReplayWindow;
}
export declare class RecordLayer {
    private udpSocket;
    private options;
    constructor(udpSocket: dgram.Socket, options: dtls.Options);
    /**
     * Transforms the given message into a DTLSCiphertext packet and sends it via UDP
     * @param msg - The message to be sent
     * @param callback - The function to be called after sending the message.
     */
    send(msg: Message, callback?: dtls.SendCallback): void;
    /**
     * Transforms the given message into a DTLSCiphertext packet,
     * does neccessary processing and buffers it up for sending
     */
    private processOutgoingMessage(msg);
    /**
     * Sends all messages of a flight in one packet
     * @param messages - The messages to be sent
     */
    sendFlight(messages: Message[], callback?: dtls.SendCallback): void;
    /**
     * Receives DTLS messages from the given buffer.
     * @param buf The buffer containing DTLSCiphertext packets
     */
    receive(buf: Buffer): Message[];
    /**
     * All known connection epochs
     */
    private epochs;
    private _readEpochNr;
    readonly readEpochNr: number;
    /**
     * The current epoch used for reading data
     */
    readonly currentReadEpoch: Epoch;
    readonly nextReadEpoch: Epoch;
    private _writeEpochNr;
    readonly writeEpochNr: number;
    /**
     * The current epoch used for writing data
     */
    readonly currentWriteEpoch: Epoch;
    readonly nextWriteEpoch: Epoch;
    readonly nextEpochNr: number;
    /**
     * The next read and write epoch that will be used.
     * Be careful as this might point to the wrong epoch between ChangeCipherSpec messages
     */
    readonly nextEpoch: Epoch;
    /**
     * Ensure there's a next epoch to switch to
     */
    private ensureNextEpoch();
    private createEpoch(index);
    advanceReadEpoch(): void;
    advanceWriteEpoch(): void;
    /**
     * Maximum transfer unit of the underlying connection.
     * Note: Ethernet supports up to 1500 bytes, of which 20 bytes are reserved for the IP header and 8 for the UDP header
     */
    static MTU: number;
    static readonly MTU_OVERHEAD: number;
    static readonly MAX_PAYLOAD_SIZE: number;
    static DTLSVersion: ProtocolVersion;
}
