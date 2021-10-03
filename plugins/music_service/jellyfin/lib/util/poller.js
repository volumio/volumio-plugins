'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');

class ServerPoller {    

    constructor() {
        this._servers = [];
        this._pollInterval = null;
        this._worker = null;
    }

    start(servers, pollInterval = 30000) {
        let serversChanged = false,
            pollIntervalChanged = false;
            
        if (pollInterval !== this._pollInterval) {
            pollIntervalChanged = true;
            this._pollInterval = pollInterval;
        }

        // Jellyfin API adds information to server on successful connection.
        // We want to preserve this data for matching servers in the new set.
        let matchCount = 0;
        let mServers = [];
        for (let i = 0; i < servers.length; i++) {
            let server = servers[i];
            let match = this._findFromCurrentServers(server.getUrl());
            if (match) {
                mServers.push(match);
                matchCount++;
            }
            else {
                mServers.push(server);
                matchCount--;
            }
        }
        if (matchCount !== servers.length) {
            serversChanged = true;
            this._servers = mServers;
        }
        
        let paramsChanged = pollIntervalChanged || serversChanged;
        if (paramsChanged && this._worker !== null) {
            this._worker.abort();
            this._worker = null;
        }

        if (this._worker === null) {  
            jellyfin.set('availableServers', this._servers);      
            this._worker = new ServerPoller.Worker(this._servers, this._pollInterval);
            this._worker.start();
        }
    }

    stop() {
        if (this._worker !== null) {
            this._worker.abort();
            this._worker = null;
        }
    }

    _findFromCurrentServers(url) {
        for (let i = 0; i < this._servers.length; i++) {
            let server = this._servers[i];
            if (server.getUrl() === url) {
                return server;
            }
        }
        return false;
    }
}

ServerPoller.Worker = class {

    constructor(servers, pollInterval) {
        this._servers = servers;
        this._status = "idle";
        this._pollTimer = null;
        this._pollInterval = pollInterval;
    }

    start() {
        if (this._status === "idle") {
            this._doPoll();
            jellyfin.getLogger().info('[jellyfin-poller-worker] start(): Started polling...');
        }
    }

    abort() {
        if (this._pollTimer !== null) {
            clearTimeout(this._pollTimer);
            this._pollTimer = null;
        }
        this._status = "aborted";
        jellyfin.getLogger().info('[jellyfin-poller-worker] abort(): Stopped polling.');
    }

    _doPoll() {
        let self = this;

        let pollPromises = [];
        self._status = "polling";
        self._servers.forEach( (server) => {
            jellyfin.getLogger().info('[jellyfin-poller-worker] _doPoll(): Polling ' + server.getUrl());

            let promise = jellyfin.get('connectionManager').refreshServerInfo(server)
                .then( (result) => {
                    if (self._status !== "aborted") {
                        jellyfin.getLogger().info('[jellyfin-poller-worked] _doPoll(): Polled ' + server.getUrl() + '. Server state is \'' + result + '\'.');
                    }

                    // Update context
                    jellyfin.set('availableServers', self._servers.filter( (server) => server.isAvailable() ));

                    return libQ.resolve();
                }).fail( (error) => {
                    if (self._status !== "aborted") {
                        jellyfin.getLogger().error('[jellyfin-poller-worker] _doPoll(): Error occurred while polling ' + server.getUrl() + ' - ' + error);
                    }
                    return libQ.resolve();
                });

            pollPromises.push(promise);
        });

        libQ.all(pollPromises).then( () => {
            if (self._status !== "aborted") {
                jellyfin.getLogger().info('[jellyfin-poller-worker] _doPoll(): All servers polled. Will poll again in ' + self._pollInterval + 'ms.');
                self._status = "pending";
                self._pollTimer = setTimeout(() => {
                    self._doPoll();
                }, self._pollInterval);
            }
        });
    }

}

module.exports = ServerPoller;