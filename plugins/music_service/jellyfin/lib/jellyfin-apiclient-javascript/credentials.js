const events = require('./events');
const appStorage = require('./appStorage');

function ensure(instance, data) {
    if (!instance._credentials) {
        const json = instance.appStorage.getItem(instance.key) || '{}';

        // console.log(`credentials initialized with: ${json}`);
        console.log(`credentials initialized`);
        instance._credentials = JSON.parse(json);
        instance._credentials.Servers = instance._credentials.Servers || [];
    }
}

function set(instance, data) {
    if (data) {
        instance._credentials = data;
        instance.appStorage.setItem(instance.key, JSON.stringify(data));
    } else {
        instance.clear();
    }

    events.trigger(instance, 'credentialsupdated');
}

class Credentials {
    constructor(key) {
        this.key = key || 'jellyfin_credentials';
        this.appStorage = appStorage;
    }

    clear() {
        this._credentials = null;
        this.appStorage.removeItem(this.key);
    }

    credentials(data) {
        if (data) {
            set(this, data);
        }

        ensure(this);
        return this._credentials;
    }

    addOrUpdateServer(list, server) {
        if (!server.Id) {
            throw new Error('Server.Id cannot be null or empty');
        }

        const existing = list.filter(({ Id }) => Id === server.Id)[0];

        if (existing) {
            // Merge the data
            existing.DateLastAccessed = Math.max(existing.DateLastAccessed || 0, server.DateLastAccessed || 0);

            existing.UserLinkType = server.UserLinkType;

            if (server.AccessToken) {
                existing.AccessToken = server.AccessToken;
                existing.UserId = server.UserId;
            }
            if (server.ExchangeToken) {
                existing.ExchangeToken = server.ExchangeToken;
            }
            if (server.RemoteAddress) {
                existing.RemoteAddress = server.RemoteAddress;
            }
            if (server.ManualAddress) {
                existing.ManualAddress = server.ManualAddress;
            }
            if (server.LocalAddress) {
                existing.LocalAddress = server.LocalAddress;
            }
            if (server.Name) {
                existing.Name = server.Name;
            }
            if (server.LastConnectionMode != null) {
                existing.LastConnectionMode = server.LastConnectionMode;
            }
            if (server.ConnectServerId) {
                existing.ConnectServerId = server.ConnectServerId;
            }

            return existing;
        } else {
            list.push(server);
            return server;
        }
    }
}

module.exports = Credentials;