/// <reference types="node" />
import { ContentType } from "../TLS/ContentType";
import { ProtocolVersion } from "../TLS/ProtocolVersion";
export interface DTLSPacket {
    type: ContentType;
    version: ProtocolVersion;
    epoch: number;
    sequence_number: number;
    fragment: Buffer;
}
