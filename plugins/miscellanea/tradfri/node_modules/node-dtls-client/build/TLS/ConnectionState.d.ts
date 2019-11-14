/// <reference types="node" />
import { ProtocolVersion } from "../TLS/ProtocolVersion";
import { CipherDelegate, CipherSuite, DecipherDelegate, KeyMaterial } from "./CipherSuite";
import { PreMasterSecret } from "./PreMasterSecret";
import * as TypeSpecs from "./TypeSpecs";
export declare enum CompressionMethod {
    null = 0,
}
export declare namespace CompressionMethod {
    const spec: TypeSpecs.Enum;
}
export declare type ConnectionEnd = "server" | "client";
export declare class ConnectionState {
    entity: ConnectionEnd;
    cipherSuite: CipherSuite;
    protocolVersion: ProtocolVersion;
    compression_algorithm: CompressionMethod;
    master_secret: Buffer;
    client_random: Buffer;
    server_random: Buffer;
    key_material: KeyMaterial;
    private _cipher;
    readonly Cipher: CipherDelegate;
    private _decipher;
    readonly Decipher: DecipherDelegate;
    /**
     * Compute the master secret from a given premaster secret
     * @param preMasterSecret - The secret used to calculate the master secret
     * @param clientHelloRandom - The random data from the client hello message
     * @param serverHelloRandom - The random data from the server hello message
     */
    computeMasterSecret(preMasterSecret: PreMasterSecret): void;
    /**
     * Calculates the key components
     */
    private computeKeyMaterial();
}
