/**
 * Provides protection against replay attacks by remembering received packets in a sliding window
 */
export declare class AntiReplayWindow {
    private window;
    private ceiling;
    constructor();
    /**
     * Initializes the anti replay window to its default state
     */
    reset(): void;
    /**
     * Checks if the packet with the given sequence number may be received or has to be discarded
     * @param seq_num - The sequence number of the packet to be checked
     */
    mayReceive(seq_num: number): boolean;
    /**
     * Checks if the packet with the given sequence number is marked as received
     * @param seq_num - The sequence number of the packet to be checked
     */
    hasReceived(seq_num: number): boolean;
    /**
     * Marks the packet with the given sequence number as received
     * @param seq_num - The sequence number of the packet
     */
    markAsReceived(seq_num: number): void;
}
