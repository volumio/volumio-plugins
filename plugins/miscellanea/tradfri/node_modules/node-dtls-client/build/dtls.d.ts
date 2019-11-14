/// <reference types="node" />
import * as dgram from "dgram";
import { EventEmitter } from "events";
import { CipherSuites } from "./DTLS/CipherSuites";
import { Alert } from "./TLS/Alert";
export declare namespace dtls {
    /**
     * Creates a DTLS-secured socket.
     * @param options - The options used to create the socket
     * @param callback - If provided, callback is bound to the "message" event
     */
    function createSocket(options: Options, callback?: MessageEventHandler): Socket;
    /**
     * DTLS-secured UDP socket. Can be used as a drop-in replacement for dgram.Socket
     */
    class Socket extends EventEmitter {
        private options;
        /**
         * INTERNAL USE, DON'T CALL DIRECTLY. use createSocket instead!
         */
        constructor(options: Options);
        private recordLayer;
        private handshakeHandler;
        private _handshakeFinished;
        private _udpConnected;
        private _connectionTimeout;
        /**
         * Send the given data. It is automatically compressed and encrypted.
         */
        send(data: Buffer, callback?: SendCallback): void;
        /**
         * Closes the connection
         */
        close(callback?: CloseEventHandler): void;
        private bufferedMessages;
        private udp;
        private udp_onListening();
        private expectConnection();
        private expectHandshake();
        sendAlert(alert: Alert, callback?: SendCallback): void;
        private udp_onMessage(udpMsg, rinfo);
        private _isClosed;
        private udp_onClose();
        private udp_onError(exception);
        /** Kills the underlying UDP connection and emits an error if neccessary */
        private killConnection(err?);
    }
    interface Options {
        /** the type of the underlying socket */
        type: "udp4" | "udp6";
        /** ?? see NodeJS docs */
        reuseAddr?: boolean;
        /** The remote address to connect to */
        address: string;
        /** The remote port to connect to */
        port: number;
        /** Pre shared key information as a table <identity> => <psk> */
        psk: {
            [identity: string]: string;
        };
        /** Time after which a connection should successfully established */
        timeout?: number;
        /**
         * The cipher suites to offer to the server.
         * All supported cipher suites are used if not specified otherwise.
         */
        ciphers?: (keyof typeof CipherSuites)[];
    }
    type ListeningEventHandler = () => void;
    type MessageEventHandler = (msg: Buffer, rinfo: dgram.RemoteInfo) => void;
    type CloseEventHandler = () => void;
    type ErrorEventHandler = (exception: Error) => void;
    type SendCallback = (error: Error, bytes: number) => void;
}
