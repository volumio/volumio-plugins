'use strict';

class Server {

    constructor(settings) {
        this._volumioInternal = {
            url: settings.url,
            username: settings.username,
            password: settings.password
        }
        this.ManualAddress = settings.url;
    }

    getUrl() {
        return this._volumioInternal.url;
    }

    getId() {
        if (this.Id != undefined) {
            return this.Id;
        }

        return null;
    }

    getUsername() {
        return this._volumioInternal.username;
    }

    getPassword() {
        return this._volumioInternal.password;
    }

    getName() {
        if (this.Name != undefined) {
            return this.Name;
        }
        else {
            return this.getUrl();
        }
    }

    isAvailable() {
        return this.getId() !== null;
    }

}

Server.fromPluginSettings = (serverSettings) => {
    let servers = [];

    serverSettings.forEach(setting => {
        servers.push(new Server(setting));
    });

    return servers;
}

module.exports = Server;