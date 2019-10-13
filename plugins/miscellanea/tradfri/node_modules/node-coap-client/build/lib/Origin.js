"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nodeUrl = require("url");
/**
 * Identifies another endpoint (similar to the new WhatWG URL API "origin" property)
 */
class Origin {
    constructor(protocol, hostname, port) {
        this.protocol = protocol;
        this.hostname = hostname;
        this.port = port;
    }
    toString() {
        return `${this.protocol}//${this.hostname}:${this.port}`;
    }
    static fromUrl(url) {
        return new Origin(url.protocol, url.hostname, +url.port);
    }
    static parse(origin) {
        return Origin.fromUrl(nodeUrl.parse(origin));
    }
}
exports.Origin = Origin;
