import { dtls } from "../dtls";
import { Alert } from "../TLS/Alert";
import * as Handshake from "./Handshake";
import { RecordLayer } from "./RecordLayer";
export declare type HandshakeFinishedCallback = (alert?: Alert, err?: Error) => void;
export declare class ClientHandshakeHandler {
    private recordLayer;
    private options;
    private finishedCallback;
    constructor(recordLayer: RecordLayer, options: dtls.Options, finishedCallback: HandshakeFinishedCallback);
    private _isHandshaking;
    readonly isHandshaking: boolean;
    /**
     * (Re)negotiates a DTLS session. Is automatically called when the Handshake handler is created
     */
    renegotiate(): void;
    /** The last message seq number that has been processed already */
    private lastProcessedSeqNum;
    /** The seq number of the last sent message */
    private lastSentSeqNum;
    /** The previously sent flight */
    private lastFlight;
    private incompleteMessages;
    private completeMessages;
    /** The currently expected flight, designated by the type of its last message */
    private expectedResponses;
    /** All handshake data sent so far, buffered for the Finished -> verify_data */
    private allHandshakeData;
    /**
     * Processes a received handshake message
     */
    processIncomingMessage(msg: Handshake.FragmentedHandshake): void;
    /**
     * Tries to assemble the fragmented messages in incompleteMessages
     */
    private tryAssembleFragments(reference);
    private bufferedOutgoingMessages;
    private sendFlight_begin_wasCalled;
    private sendFlight_begin();
    /**
     * Processes a flight (including giving the messages a seq_num), but does not actually send it.
     * @param flight - The flight to be sent.
     * @param retransmit - If the flight is retransmitted, i.e. no sequence numbers are increased
     */
    private sendFlight_processPartial(flight, retransmit?);
    /**
     * Sends the currently buffered flight of messages
     * @param flight The flight to be sent.
     * @param expectedResponses The types of possible responses we are expecting.
     * @param retransmit If the flight is retransmitted, i.e. no sequence numbers are increased
     */
    private sendFlight_finish(expectedResponses);
    /**
     * Sends the given flight of messages and remembers it for potential retransmission
     * @param flight The flight to be sent.
     * @param expectedResponses The types of possible responses we are expecting.
     * @param retransmit If the flight is retransmitted, i.e. no sequence numbers are increased
     */
    private sendFlight(flight, expectedResponses, retransmit?);
    /**
     * remembers the raw data of handshake messages for verification purposes
     * @param messages - the messages to be remembered
     */
    private bufferHandshakeData(...messages);
    /**
     * For a given message, check if it needs to be hashed
     */
    private needsToHashMessage(message);
    /**
     * computes the verify data for a Finished message
     * @param handshakeMessages - the concatenated messages received so far
     */
    private computeVerifyData(handshakeMessages, source);
    /**
     * handles server messages
     */
    private handle;
}
