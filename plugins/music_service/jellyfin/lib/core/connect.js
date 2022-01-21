'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const api = require(jellyfinPluginLibRoot + '/jellyfin-apiclient-javascript');

class ConnectionManager {

    constructor() {
        let deviceInfo = jellyfin.getDeviceInfo();
        this._connectionManagerApi = new api.ConnectionManager(
            new api.Credentials(),
            'Jellyfin plugin for Volumio',
            '0.1.0',
            deviceInfo.name,
            deviceInfo.uuid
        );
        this._authenticatePromises = {};
    }

    refreshServerInfo(server) {
        let defer = libQ.defer();

        jellyfin.getLogger().info('[jellyfin-connect] refreshServerInfo(' + server.getUrl() + '): Connecting...');

        // use apiClient's serverInfo if available, because that contains Access Token for enableAutoLogin (i.e. preserves any 'SignedIn' state)
        let apiClient = server.getId() !== null ? this._connectionManagerApi.getApiClient(server.getId()) : null;
        let apiServer = apiClient ? apiClient.serverInfo() : null;
        let connectServer = apiServer ? apiServer : server;
        connectServer.manualAddressOnly = true; // always connect to manual address (i.e. url specified in server settings rather than local address returned by server)

        this._connectionManagerApi.connectToServer(connectServer, { enableAutoLogin: true, enableAutomaticBitrateDetection: false }).then( // connectToServer() will update server with obtained info
            (result) => {
                jellyfin.getLogger().info('[jellyfin-connect] refreshServerInfo(' + server.getUrl() + '): Server info updated. Server state is \'' + result.State + '\'.');
                if (result.Servers && result.Servers[0]) {
                    server.Id = result.Servers[0].Id;
                    server.Name = result.Servers[0].Name;
                }
                else {
                    server.Id = undefined;
                    server.Name = undefined;
                }
// TODO: reset server info if "Unavailable" state
                defer.resolve(result.State);
            },
            (error) => {
                jellyfin.getLogger().error('[jellyfin-connect] refreshServerInfo(' + server.getUrl() + '): Error occurred while connecting to server: ' + error);
                defer.reject(error);
            }
        );

        return defer.promise;
    }

    authenticate(server) {
        let self = this;
        let defer = libQ.defer();

        if (server.getId() === null) {
            jellyfin.getLogger().error('[jellyfin-connect] authenticate(' + server.getUrl() + '): Cannot authenticate because server is missing Id.');
            jellyfin.toast('error', jellyfin.getI18n('JELLYFIN_CONN_FAILED'));
            defer.reject('Connection failed: missing Server Id');
        }
        else {
            let apiClient = self._connectionManagerApi.getApiClient(server.getId());
            if (apiClient == undefined || !apiClient) {
                jellyfin.getLogger().error('[jellyfin-connect] authenticate(' + server.getUrl() + '): Cannot authenticate because server does not have an apiClient.');
                jellyfin.toast('error', jellyfin.getI18n('JELLYFIN_CONN_FAILED'));
                defer.reject('Connection failed: no API Client available');
            }
            else if (apiClient.isLoggedIn()) {
                jellyfin.getLogger().info('[jellyfin-connect] authenticate(' + server.getUrl() + '): User \'' + server.getUsername() + '\' already logged in.');
                defer.resolve({
                    status: 'Authenticated',
                    apiClient: apiClient
                });
            }
            else {
                // Check if authentication is already in progress. If so, just return the Promise for that (avoids having multiple simultaneous authentications for the same server).
                let authenticatePromise = self._authenticatePromises[server.getId()];
                if (authenticatePromise) {
                    jellyfin.getLogger().info('[jellyfin-connect] authenticate(' + server.getUrl() + '): Authentication of user \'' + server.getUsername() + '\' already in progress.');
                    return authenticatePromise;
                }
                else {
                    jellyfin.getLogger().info('[jellyfin-connect] authenticate(' + server.getUrl() + '): Authenticating user \'' + server.getUsername() + '\'...');
                    jellyfin.toast('info', jellyfin.getI18n('JELLYFIN_LOGGING_INTO', server.getName()));
                    apiClient.authenticateUserByName(server.getUsername(), server.getPassword()).then(
                        (result) => {
                            jellyfin.toast('success', jellyfin.getI18n('JELLYFIN_LOGIN_SUCCESS'));
                            jellyfin.getLogger().info('[jellyfin-connect] authenticate(' + server.getUrl() + '): User \'' + server.getUsername() + '\' authenticated.');

                            self._authenticatePromises[server.getId()] = null;

                            // Set server Access Token from result. The refreshServerInfo(server) function 
                            // passes the server obj along with the 'enableAutoLogin' option to the API's connectToServer() function, and the Access Token is required to preserve the 'SignedIn' state.
                            server.AccessToken = result.AccessToken;
                            defer.resolve({
                                status: 'Authenticated',
                                apiClient: apiClient
                            });
                        },
                        (error) => {
                            jellyfin.toast('error', jellyfin.getI18n('JELLYFIN_AUTH_FAILED'));
                            jellyfin.getLogger().error('[jellyfin-connect] authenticate(' + server.getUrl() + '): Failed to authenticate user \'' + server.getUsername() + '\' - ' + error);

                            self._authenticatePromises[server.getId()] = null;

                            server.AccessToken = null;
                            defer.reject('Authentication failed');
                        }
                    );

                    self._authenticatePromises[server.getId()] = defer.promise;
                }
            }
        }

        return defer.promise;
    }

}

module.exports = ConnectionManager;