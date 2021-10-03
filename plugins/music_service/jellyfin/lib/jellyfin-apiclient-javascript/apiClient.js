const events = require('./events');
const appStorage = require('./appStorage');
const fetch = require('node-fetch');

/** Report rate limits in ms for different events */
const reportRateLimits = {
    timeupdate: 10000,
    volumechange: 3000
};

function redetectBitrate(instance) {
    stopBitrateDetection(instance);

    if (instance.accessToken() && instance.enableAutomaticBitrateDetection !== false) {
        setTimeout(redetectBitrateInternal.bind(instance), 6000);
    }
}

function redetectBitrateInternal() {
    if (this.accessToken()) {
        this.detectBitrate();
    }
}

function stopBitrateDetection(instance) {
    if (instance.detectTimeout) {
        clearTimeout(instance.detectTimeout);
    }
}

function replaceAll(originalString, strReplace, strWith) {
    const reg = new RegExp(strReplace, 'ig');
    return originalString.replace(reg, strWith);
}

function onFetchFail(instance, url, response) {
    events.trigger(instance, 'requestfail', [
        {
            url,
            status: response.status,
            errorCode: response.headers ? response.headers.get('X-Application-Error-Code') : null
        }
    ]);
}

function paramsToString(params) {
    const values = [];

    for (const key in params) {
        const value = params[key];

        if (value !== null && value !== undefined && value !== '') {
            values.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        }
    }
    return values.join('&');
}

function fetchWithTimeout(url, options, timeoutMs) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(reject, timeoutMs);

        options = options || {};
        options.credentials = 'same-origin';

        fetch(url, options)
            .then((response) => {
                clearTimeout(timeout);
                resolve(response);
            })
            .catch((error) => {
                clearTimeout(timeout);
                reject(error);
            });
    });
}

function getFetchPromise(request) {
    const headers = request.headers || {};

    if (request.dataType === 'json') {
        headers.accept = 'application/json';
    }

    const fetchRequest = {
        headers,
        method: request.type,
        credentials: 'same-origin'
    };

    let contentType = request.contentType;

    if (request.data) {
        if (typeof request.data === 'string') {
            fetchRequest.body = request.data;
        } else {
            fetchRequest.body = paramsToString(request.data);

            contentType = contentType || 'application/x-www-form-urlencoded; charset=UTF-8';
        }
    }

    if (contentType) {
        headers['Content-Type'] = contentType;
    }

    if (!request.timeout) {
        return fetch(request.url, fetchRequest);
    }

    return fetchWithTimeout(request.url, fetchRequest, request.timeout);
}

function cancelReportPlaybackProgressPromise(instance) {
    if (typeof instance.reportPlaybackProgressCancel === 'function') instance.reportPlaybackProgressCancel();
}

/**
 * Creates a new api client instance
 * @param {String} serverAddress
 * @param {String} appName
 * @param {String} appVersion
 */
class ApiClient {
    constructor(serverAddress, appName, appVersion, deviceName, deviceId) {
        if (!serverAddress) {
            throw new Error('Must supply a serverAddress');
        }

        console.debug(`ApiClient serverAddress: ${serverAddress}`);
        console.debug(`ApiClient appName: ${appName}`);
        console.debug(`ApiClient appVersion: ${appVersion}`);
        console.debug(`ApiClient deviceName: ${deviceName}`);
        console.debug(`ApiClient deviceId: ${deviceId}`);

        this._serverInfo = {};
        this._serverAddress = serverAddress;
        this._deviceId = deviceId;
        this._deviceName = deviceName;
        this._appName = appName;
        this._appVersion = appVersion;
    }

    appName() {
        return this._appName;
    }

    setRequestHeaders(headers) {
        const currentServerInfo = this.serverInfo();
        const appName = this._appName;
        const accessToken = currentServerInfo.AccessToken;

        const values = [];

        if (appName) {
            values.push(`Client="${appName}"`);
        }

        if (this._deviceName) {
            values.push(`Device="${this._deviceName}"`);
        }

        if (this._deviceId) {
            values.push(`DeviceId="${this._deviceId}"`);
        }

        if (this._appVersion) {
            values.push(`Version="${this._appVersion}"`);
        }

        if (accessToken) {
            values.push(`Token="${accessToken}"`);
        }

        if (values.length) {
            const auth = `MediaBrowser ${values.join(', ')}`;
            //headers.Authorization = auth;
            headers['X-Emby-Authorization'] = auth;
        }
    }

    appVersion() {
        return this._appVersion;
    }

    deviceName() {
        return this._deviceName;
    }

    deviceId() {
        return this._deviceId;
    }

    /**
     * Gets the server address.
     */
    serverAddress(val) {
        if (val != null) {
            if (val.toLowerCase().indexOf('http') !== 0) {
                throw new Error(`Invalid url: ${val}`);
            }

            const changed = val !== this._serverAddress;

            this._serverAddress = val;

            this.onNetworkChange();

            if (changed) {
                events.trigger(this, 'serveraddresschanged');
            }
        }

        return this._serverAddress;
    }

    onNetworkChange() {
        this.lastDetectedBitrate = 0;
        this.lastDetectedBitrateTime = 0;
        setSavedEndpointInfo(this, null);

        redetectBitrate(this);
    }

    /**
     * Creates an api url based on a handler name and query string parameters
     * @param {String} name
     * @param {Object} params
     */
    getUrl(name, params, serverAddress) {
        if (!name) {
            throw new Error('Url name cannot be empty');
        }

        let url = serverAddress || this._serverAddress;

        if (!url) {
            throw new Error('serverAddress is yet not set');
        }

        if (name.charAt(0) !== '/') {
            url += '/';
        }

        url += name;

        if (params) {
            params = paramsToString(params);
            if (params) {
                url += `?${params}`;
            }
        }

        return url;
    }

    fetchWithFailover(request, enableReconnection) {
        console.log(`Requesting ${request.url}`);

        request.timeout = 30000;
        const instance = this;

        return getFetchPromise(request)
            .then((response) => {
                instance.lastFetch = new Date().getTime();

                if (response.status < 400) {
                    if (request.dataType === 'json' || request.headers.accept === 'application/json') {
                        return response.json();
                    } else if (
                        request.dataType === 'text' ||
                        (response.headers.get('Content-Type') || '').toLowerCase().indexOf('text/') === 0
                    ) {
                        return response.text();
                    } else {
                        return response;
                    }
                } else {
                    onFetchFail(instance, request.url, response);
                    return Promise.reject(response);
                }
            })
            .catch((error) => {
                if (error) {
                    console.log(`Request failed to ${request.url} ${error.toString()}`);
                } else {
                    console.log(`Request timed out to ${request.url}`);
                }

                // http://api.jquery.com/jQuery.ajax/
                if ((!error || !error.status) && enableReconnection) {
                    console.log('Attempting reconnection');

                    const previousServerAddress = instance.serverAddress();

                    return tryReconnect(instance)
                        .then(() => {
                            console.log('Reconnect succeesed');
                            request.url = request.url.replace(previousServerAddress, instance.serverAddress());

                            return instance.fetchWithFailover(request, false);
                        })
                        .catch((innerError) => {
                            console.log('Reconnect failed');
                            onFetchFail(instance, request.url, {});
                            throw innerError;
                        });
                } else {
                    console.log('Reporting request failure');

                    onFetchFail(instance, request.url, {});
                    throw error;
                }
            });
    }

    /**
     * Wraps around jQuery ajax methods to add additional info to the request.
     */
    fetch(request, includeAuthorization) {
        if (!request) {
            return Promise.reject('Request cannot be null');
        }

        request.headers = request.headers || {};

        if (includeAuthorization !== false) {
            this.setRequestHeaders(request.headers);
        }

        if (this.enableAutomaticNetworking === false || request.type !== 'GET') {
            console.log(`Requesting url without automatic networking: ${request.url}`);

            const instance = this;
            return getFetchPromise(request)
                .then((response) => {
                    instance.lastFetch = new Date().getTime();

                    if (response.status < 400) {
                        if (request.dataType === 'json' || request.headers.accept === 'application/json') {
                            return response.json();
                        } else if (
                            request.dataType === 'text' ||
                            (response.headers.get('Content-Type') || '').toLowerCase().indexOf('text/') === 0
                        ) {
                            return response.text();
                        } else {
                            return response;
                        }
                    } else {
                        onFetchFail(instance, request.url, response);
                        return Promise.reject(response);
                    }
                })
                .catch((error) => {
                    onFetchFail(instance, request.url, {});
                    return Promise.reject(error);
                });
        }

        return this.fetchWithFailover(request, true);
    }

    setAuthenticationInfo(accessKey, userId) {
        this._currentUser = null;

        this._serverInfo.AccessToken = accessKey;
        this._serverInfo.UserId = userId;
        redetectBitrate(this);
    }

    serverInfo(info) {
        if (info) {
            this._serverInfo = info;
        }

        return this._serverInfo;
    }

    /**
     * Gets or sets the current user id.
     */
    getCurrentUserId() {
        return this._serverInfo.UserId;
    }

    accessToken() {
        return this._serverInfo.AccessToken;
    }

    serverId() {
        return this.serverInfo().Id;
    }

    serverName() {
        return this.serverInfo().Name;
    }

    /**
     * Wraps around jQuery ajax methods to add additional info to the request.
     */
    ajax(request, includeAuthorization) {
        if (!request) {
            return Promise.reject('Request cannot be null');
        }

        return this.fetch(request, includeAuthorization);
    }

    /**
     * Gets or sets the current user id.
     */
    getCurrentUser(enableCache) {
        if (this._currentUser) {
            return Promise.resolve(this._currentUser);
        }

        const userId = this.getCurrentUserId();

        if (!userId) {
            return Promise.reject();
        }

        const instance = this;
        let user;

        const serverPromise = this.getUser(userId)
            .then((userObject) => {
                appStorage.setItem(`user-${userObject.Id}-${userObject.ServerId}`, JSON.stringify(userObject));

                instance._currentUser = userObject;
                return userObject;
            })
            .catch((response) => {
                // if timed out, look for cached value
                if (!response.status) {
                    if (userId && instance.accessToken()) {
                        user = getCachedUser(instance, userId);
                        if (user) {
                            return Promise.resolve(user);
                        }
                    }
                }

                throw response;
            });

        if (!this.lastFetch && enableCache !== false) {
            user = getCachedUser(instance, userId);
            if (user) {
                return Promise.resolve(user);
            }
        }

        return serverPromise;
    }

    isLoggedIn() {
        const info = this.serverInfo();
        if (info) {
            if (info.UserId && info.AccessToken) {
                return true;
            }
        }

        return false;
    }

    /**
     * Logout current user
     */
    logout() {
        stopBitrateDetection(this);
        this.closeWebSocket();

        const done = () => {
            const info = this.serverInfo();
            if (info && info.UserId && info.Id) {
                appStorage.removeItem(`user-${info.UserId}-${info.Id}`);
            }
            this.setAuthenticationInfo(null, null);
        };

        if (this.accessToken()) {
            const url = this.getUrl('Sessions/Logout');

            return this.ajax({
                type: 'POST',
                url
            }).then(done, done);
        }

        done();
        return Promise.resolve();
    }

    /**
     * Authenticates a user
     * @param {String} name
     * @param {String} password
     */
    authenticateUserByName(name, password) {
        if (!name) {
            return Promise.reject();
        }

        const url = this.getUrl('Users/authenticatebyname');

        return new Promise((resolve, reject) => {
            const postData = {
                Username: name,
                Pw: password || ''
            };

            this.ajax({
                type: 'POST',
                url: url,
                data: JSON.stringify(postData),
                dataType: 'json',
                contentType: 'application/json'
            })
                .then((result) => {
                    const afterOnAuthenticated = () => {
                        redetectBitrate(this);
                        resolve(result);
                    };

                    if (this.onAuthenticated) {
                        this.onAuthenticated(this, result).then(afterOnAuthenticated);
                    } else {
                        afterOnAuthenticated();
                    }
                })
                .catch(reject);
        });
    }

    /**
     * Authenticates a user using quick connect
     * @param {String} token
     */
    quickConnect(token) {
        if (!token) {
            return Promise.reject();
        }

        const url = this.getUrl('Users/AuthenticateWithQuickConnect');

        return new Promise((resolve, reject) => {
            const postData = {
                Token: token
            };

            this.ajax({
                type: 'POST',
                url: url,
                data: JSON.stringify(postData),
                dataType: 'json',
                contentType: 'application/json'
            })
                .then((result) => {
                    const afterOnAuthenticated = () => {
                        redetectBitrate(this);
                        resolve(result);
                    };

                    if (this.onAuthenticated) {
                        this.onAuthenticated(this, result).then(afterOnAuthenticated);
                    } else {
                        afterOnAuthenticated();
                    }
                })
                .catch(() => {
                    throw new Error('quickConnect: error authenticating with the server');
                });
        });
    }

    /**
     * Retrieves quick connect information for the provided verb
     * @param {String} verb
     */
    getQuickConnect(verb) {
        var url = this.getUrl("/QuickConnect/" + verb);
        return this.getJSON(url);
    }

    ensureWebSocket() {
        if (this.isWebSocketOpenOrConnecting() || !this.isWebSocketSupported()) {
            return;
        }

        try {
            this.openWebSocket();
        } catch (err) {
            console.log(`Error opening web socket: ${err}`);
        }
    }

    openWebSocket() {
        const accessToken = this.accessToken();

        if (!accessToken) {
            throw new Error('Cannot open web socket without access token.');
        }

        let url = this.getUrl('socket');

        url = replaceAll(url, 'emby/socket', 'embywebsocket');
        url = replaceAll(url, 'https:', 'wss:');
        url = replaceAll(url, 'http:', 'ws:');

        url += `?api_key=${accessToken}`;
        url += `&deviceId=${this.deviceId()}`;

        console.log(`opening web socket with url: ${url}`);

        const webSocket = new WebSocket(url);

        webSocket.onmessage = onWebSocketMessage.bind(this);
        webSocket.onopen = onWebSocketOpen.bind(this);
        webSocket.onerror = onWebSocketError.bind(this);
        setSocketOnClose(this, webSocket);

        this._webSocket = webSocket;
    }

    closeWebSocket() {
        const socket = this._webSocket;

        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.close();
        }
    }

    sendWebSocketMessage(name, data) {
        console.log(`Sending web socket message: ${name}`);

        let msg = { MessageType: name };

        if (data) {
            msg.Data = data;
        }

        msg = JSON.stringify(msg);

        this._webSocket.send(msg);
    }

    sendMessage(name, data) {
        if (this.isWebSocketOpen()) {
            this.sendWebSocketMessage(name, data);
        }
    }

    isMessageChannelOpen() {
        return this.isWebSocketOpen();
    }

    isWebSocketOpen() {
        const socket = this._webSocket;

        if (socket) {
            return socket.readyState === WebSocket.OPEN;
        }
        return false;
    }

    isWebSocketOpenOrConnecting() {
        const socket = this._webSocket;

        if (socket) {
            return socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING;
        }
        return false;
    }

    get(url) {
        return this.ajax({
            type: 'GET',
            url
        });
    }

    getJSON(url, includeAuthorization) {
        return this.fetch(
            {
                url,
                type: 'GET',
                dataType: 'json',
                headers: {
                    accept: 'application/json'
                }
            },
            includeAuthorization
        );
    }

    updateServerInfo(server, serverUrl) {
        if (server == null) {
            throw new Error('server cannot be null');
        }

        this.serverInfo(server);

        if (!serverUrl) {
            throw new Error(`serverUrl cannot be null. serverInfo: ${JSON.stringify(server)}`);
        }
        console.log(`Setting server address to ${serverUrl}`);
        this.serverAddress(serverUrl);
    }

    isWebSocketSupported() {
        try {
            return WebSocket != null;
        } catch (err) {
            return false;
        }
    }

    clearAuthenticationInfo() {
        this.setAuthenticationInfo(null, null);
    }

    encodeName(name) {
        name = name.split('/').join('-');
        name = name.split('&').join('-');
        name = name.split('?').join('-');

        const val = paramsToString({ name });
        return val.substring(val.indexOf('=') + 1).replace("'", '%27');
    }

    /**
     * Gets the server time as a UTC formatted string.
     * @returns {Promise} Promise that it's fulfilled on request completion.
     * @since 10.6.0
     */
    getServerTime() {
        const url = this.getUrl('GetUTCTime');

        return this.ajax({
            type: 'GET',
            url: url
        });
    }

    getDownloadSpeed(byteSize) {
        const url = this.getUrl('Playback/BitrateTest', {
            Size: byteSize
        });

        const now = new Date().getTime();

        return this.ajax({
            type: 'GET',
            url,
            timeout: 5000
        }).then(() => {
            const responseTimeSeconds = (new Date().getTime() - now) / 1000;
            const bytesPerSecond = byteSize / responseTimeSeconds;
            const bitrate = Math.round(bytesPerSecond * 8);

            return bitrate;
        });
    }

    detectBitrate(force) {
        if (
            !force &&
            this.lastDetectedBitrate &&
            new Date().getTime() - (this.lastDetectedBitrateTime || 0) <= 3600000
        ) {
            return Promise.resolve(this.lastDetectedBitrate);
        }

        const instance = this;

        return this.getEndpointInfo().then(
            (info) => detectBitrateWithEndpointInfo(instance, info),
            (info) => detectBitrateWithEndpointInfo(instance, {})
        );
    }

    /**
     * Gets an item from the server
     * Omit itemId to get the root folder.
     */
    getItem(userId, itemId) {
        if (!itemId) {
            throw new Error('null itemId');
        }

        const url = userId ? this.getUrl(`Users/${userId}/Items/${itemId}`) : this.getUrl(`Items/${itemId}`);

        return this.getJSON(url);
    }

    /**
     * Gets the root folder from the server
     */
    getRootFolder(userId) {
        if (!userId) {
            throw new Error('null userId');
        }

        const url = this.getUrl(`Users/${userId}/Items/Root`);

        return this.getJSON(url);
    }

    getNotificationSummary(userId) {
        if (!userId) {
            throw new Error('null userId');
        }

        const url = this.getUrl(`Notifications/${userId}/Summary`);

        return this.getJSON(url);
    }

    getNotifications(userId, options) {
        if (!userId) {
            throw new Error('null userId');
        }

        const url = this.getUrl(`Notifications/${userId}`, options || {});

        return this.getJSON(url);
    }

    markNotificationsRead(userId, idList, isRead) {
        if (!userId) {
            throw new Error('null userId');
        }

        if (!idList) {
            throw new Error('null idList');
        }

        const suffix = isRead ? 'Read' : 'Unread';

        const params = {
            UserId: userId,
            Ids: idList.join(',')
        };

        const url = this.getUrl(`Notifications/${userId}/${suffix}`, params);

        return this.ajax({
            type: 'POST',
            url
        });
    }

    getRemoteImageProviders(options) {
        if (!options) {
            throw new Error('null options');
        }

        const urlPrefix = getRemoteImagePrefix(this, options);

        const url = this.getUrl(`${urlPrefix}/RemoteImages/Providers`, options);

        return this.getJSON(url);
    }

    getAvailableRemoteImages(options) {
        if (!options) {
            throw new Error('null options');
        }

        const urlPrefix = getRemoteImagePrefix(this, options);

        const url = this.getUrl(`${urlPrefix}/RemoteImages`, options);

        return this.getJSON(url);
    }

    downloadRemoteImage(options) {
        if (!options) {
            throw new Error('null options');
        }

        const urlPrefix = getRemoteImagePrefix(this, options);

        const url = this.getUrl(`${urlPrefix}/RemoteImages/Download`, options);

        return this.ajax({
            type: 'POST',
            url
        });
    }

    getRecordingFolders(userId) {
        const url = this.getUrl('LiveTv/Recordings/Folders', { userId: userId });

        return this.getJSON(url);
    }

    getLiveTvInfo(options) {
        const url = this.getUrl('LiveTv/Info', options || {});

        return this.getJSON(url);
    }

    getLiveTvGuideInfo(options) {
        const url = this.getUrl('LiveTv/GuideInfo', options || {});

        return this.getJSON(url);
    }

    getLiveTvChannel(id, userId) {
        if (!id) {
            throw new Error('null id');
        }

        const options = {};

        if (userId) {
            options.userId = userId;
        }

        const url = this.getUrl(`LiveTv/Channels/${id}`, options);

        return this.getJSON(url);
    }

    getLiveTvChannels(options) {
        const url = this.getUrl('LiveTv/Channels', options || {});

        return this.getJSON(url);
    }

    getLiveTvPrograms(options = {}) {
        if (options.channelIds && options.channelIds.length > 1800) {
            return this.ajax({
                type: 'POST',
                url: this.getUrl('LiveTv/Programs'),
                data: JSON.stringify(options),
                contentType: 'application/json',
                dataType: 'json'
            });
        } else {
            return this.ajax({
                type: 'GET',
                url: this.getUrl('LiveTv/Programs', options),
                dataType: 'json'
            });
        }
    }

    getLiveTvRecommendedPrograms(options = {}) {
        return this.ajax({
            type: 'GET',
            url: this.getUrl('LiveTv/Programs/Recommended', options),
            dataType: 'json'
        });
    }

    getLiveTvRecordings(options) {
        const url = this.getUrl('LiveTv/Recordings', options || {});

        return this.getJSON(url);
    }

    getLiveTvRecordingSeries(options) {
        const url = this.getUrl('LiveTv/Recordings/Series', options || {});

        return this.getJSON(url);
    }

    getLiveTvRecordingGroups(options) {
        const url = this.getUrl('LiveTv/Recordings/Groups', options || {});

        return this.getJSON(url);
    }

    getLiveTvRecordingGroup(id) {
        if (!id) {
            throw new Error('null id');
        }

        const url = this.getUrl(`LiveTv/Recordings/Groups/${id}`);

        return this.getJSON(url);
    }

    getLiveTvRecording(id, userId) {
        if (!id) {
            throw new Error('null id');
        }

        const options = {};

        if (userId) {
            options.userId = userId;
        }

        const url = this.getUrl(`LiveTv/Recordings/${id}`, options);

        return this.getJSON(url);
    }

    getLiveTvProgram(id, userId) {
        if (!id) {
            throw new Error('null id');
        }

        const options = {};

        if (userId) {
            options.userId = userId;
        }

        const url = this.getUrl(`LiveTv/Programs/${id}`, options);

        return this.getJSON(url);
    }

    deleteLiveTvRecording(id) {
        if (!id) {
            throw new Error('null id');
        }

        const url = this.getUrl(`LiveTv/Recordings/${id}`);

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    cancelLiveTvTimer(id) {
        if (!id) {
            throw new Error('null id');
        }

        const url = this.getUrl(`LiveTv/Timers/${id}`);

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    getLiveTvTimers(options) {
        const url = this.getUrl('LiveTv/Timers', options || {});

        return this.getJSON(url);
    }

    getLiveTvTimer(id) {
        if (!id) {
            throw new Error('null id');
        }

        const url = this.getUrl(`LiveTv/Timers/${id}`);

        return this.getJSON(url);
    }

    getNewLiveTvTimerDefaults(options = {}) {
        const url = this.getUrl('LiveTv/Timers/Defaults', options);

        return this.getJSON(url);
    }

    createLiveTvTimer(item) {
        if (!item) {
            throw new Error('null item');
        }

        const url = this.getUrl('LiveTv/Timers');

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(item),
            contentType: 'application/json'
        });
    }

    updateLiveTvTimer(item) {
        if (!item) {
            throw new Error('null item');
        }

        const url = this.getUrl(`LiveTv/Timers/${item.Id}`);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(item),
            contentType: 'application/json'
        });
    }

    resetLiveTvTuner(id) {
        if (!id) {
            throw new Error('null id');
        }

        const url = this.getUrl(`LiveTv/Tuners/${id}/Reset`);

        return this.ajax({
            type: 'POST',
            url
        });
    }

    getLiveTvSeriesTimers(options) {
        const url = this.getUrl('LiveTv/SeriesTimers', options || {});

        return this.getJSON(url);
    }

    getLiveTvSeriesTimer(id) {
        if (!id) {
            throw new Error('null id');
        }

        const url = this.getUrl(`LiveTv/SeriesTimers/${id}`);

        return this.getJSON(url);
    }

    cancelLiveTvSeriesTimer(id) {
        if (!id) {
            throw new Error('null id');
        }

        const url = this.getUrl(`LiveTv/SeriesTimers/${id}`);

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    createLiveTvSeriesTimer(item) {
        if (!item) {
            throw new Error('null item');
        }

        const url = this.getUrl('LiveTv/SeriesTimers');

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(item),
            contentType: 'application/json'
        });
    }

    updateLiveTvSeriesTimer(item) {
        if (!item) {
            throw new Error('null item');
        }

        const url = this.getUrl(`LiveTv/SeriesTimers/${item.Id}`);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(item),
            contentType: 'application/json'
        });
    }

    getRegistrationInfo(feature) {
        const url = this.getUrl(`Registrations/${feature}`);

        return this.getJSON(url);
    }

    /**
     * Gets the current server status
     */
    getSystemInfo(itemId) {
        const url = this.getUrl('System/Info');

        const instance = this;

        return this.getJSON(url).then((info) => {
            instance.setSystemInfo(info);
            return Promise.resolve(info);
        });
    }

    getSyncStatus() {
        const url = this.getUrl('Sync/' + itemId + '/Status');

        return this.ajax({
            url: url,
            type: 'POST',
            dataType: 'json',
            contentType: 'application/json',
            data: JSON.stringify({
                TargetId: this.deviceId()
            })
        });
    }

    /**
     * Gets the current server status
     */
    getPublicSystemInfo() {
        const url = this.getUrl('System/Info/Public');

        const instance = this;

        return this.getJSON(url).then((info) => {
            instance.setSystemInfo(info);
            return Promise.resolve(info);
        });
    }

    getInstantMixFromItem(itemId, options) {
        const url = this.getUrl(`Items/${itemId}/InstantMix`, options);

        return this.getJSON(url);
    }

    getEpisodes(itemId, options) {
        const url = this.getUrl(`Shows/${itemId}/Episodes`, options);

        return this.getJSON(url);
    }

    getDisplayPreferences(id, userId, app) {
        const url = this.getUrl(`DisplayPreferences/${id}`, {
            userId,
            client: app
        });

        return this.getJSON(url);
    }

    updateDisplayPreferences(id, obj, userId, app) {
        const url = this.getUrl(`DisplayPreferences/${id}`, {
            userId,
            client: app
        });

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(obj),
            contentType: 'application/json'
        });
    }

    getSeasons(itemId, options) {
        const url = this.getUrl(`Shows/${itemId}/Seasons`, options);

        return this.getJSON(url);
    }

    getSimilarItems(itemId, options) {
        const url = this.getUrl(`Items/${itemId}/Similar`, options);

        return this.getJSON(url);
    }

    /**
     * Gets all cultures known to the server
     */
    getCultures() {
        const url = this.getUrl('Localization/cultures');

        return this.getJSON(url);
    }

    /**
     * Gets all countries known to the server
     */
    getCountries() {
        const url = this.getUrl('Localization/countries');

        return this.getJSON(url);
    }

    getPlaybackInfo(itemId, options, deviceProfile) {
        const postData = {
            DeviceProfile: deviceProfile
        };

        return this.ajax({
            url: this.getUrl(`Items/${itemId}/PlaybackInfo`, options),
            type: 'POST',
            data: JSON.stringify(postData),
            contentType: 'application/json',
            dataType: 'json'
        });
    }

    getLiveStreamMediaInfo(liveStreamId) {
        const postData = {
            LiveStreamId: liveStreamId
        };

        return this.ajax({
            url: this.getUrl('LiveStreams/MediaInfo'),
            type: 'POST',
            data: JSON.stringify(postData),
            contentType: 'application/json',
            dataType: 'json'
        });
    }

    getIntros(itemId) {
        return this.getJSON(this.getUrl(`Users/${this.getCurrentUserId()}/Items/${itemId}/Intros`));
    }

    /**
     * Gets the directory contents of a path on the server
     */
    getDirectoryContents(path, options) {
        if (!path) {
            throw new Error('null path');
        }
        if (typeof path !== 'string') {
            throw new Error('invalid path');
        }

        options = options || {};

        options.path = path;

        const url = this.getUrl('Environment/DirectoryContents', options);

        return this.getJSON(url);
    }

    /**
     * Gets shares from a network device
     */
    getNetworkShares(path) {
        if (!path) {
            throw new Error('null path');
        }

        const options = {};
        options.path = path;

        const url = this.getUrl('Environment/NetworkShares', options);

        return this.getJSON(url);
    }

    /**
     * Gets the parent of a given path
     */
    getParentPath(path) {
        if (!path) {
            throw new Error('null path');
        }

        const options = {};
        options.path = path;

        const url = this.getUrl('Environment/ParentPath', options);

        return this.ajax({
            type: 'GET',
            url,
            dataType: 'text'
        });
    }

    /**
     * Gets a list of physical drives from the server
     */
    getDrives() {
        const url = this.getUrl('Environment/Drives');

        return this.getJSON(url);
    }

    /**
     * Gets a list of network devices from the server
     */
    getNetworkDevices() {
        const url = this.getUrl('Environment/NetworkDevices');

        return this.getJSON(url);
    }

    /**
     * Cancels a package installation
     */
    cancelPackageInstallation(installationId) {
        if (!installationId) {
            throw new Error('null installationId');
        }

        const url = this.getUrl(`Packages/Installing/${installationId}`);

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    /**
     * Refreshes metadata for an item
     */
    refreshItem(itemId, options) {
        if (!itemId) {
            throw new Error('null itemId');
        }

        const url = this.getUrl(`Items/${itemId}/Refresh`, options || {});

        return this.ajax({
            type: 'POST',
            url
        });
    }

    /**
     * Installs or updates a new plugin
     */
    installPlugin(name, guid, version) {
        if (!name) {
            throw new Error('null name');
        }

        const options = {
            AssemblyGuid: guid
        };

        if (version) {
            options.version = version;
        }

        const url = this.getUrl(`Packages/Installed/${name}`, options);

        return this.ajax({
            type: 'POST',
            url
        });
    }

    /**
     * Instructs the server to perform a restart.
     */
    restartServer() {
        const url = this.getUrl('System/Restart');

        return this.ajax({
            type: 'POST',
            url
        });
    }

    /**
     * Instructs the server to perform a shutdown.
     */
    shutdownServer() {
        const url = this.getUrl('System/Shutdown');

        return this.ajax({
            type: 'POST',
            url
        });
    }

    /**
     * Gets information about an installable package
     */
    getPackageInfo(name, guid) {
        if (!name) {
            throw new Error('null name');
        }

        const options = {
            AssemblyGuid: guid
        };

        const url = this.getUrl(`Packages/${name}`, options);

        return this.getJSON(url);
    }

    /**
     * Gets the virtual folder list
     */
    getVirtualFolders() {
        let url = 'Library/VirtualFolders';

        url = this.getUrl(url);

        return this.getJSON(url);
    }

    /**
     * Gets all the paths of the locations in the physical root.
     */
    getPhysicalPaths() {
        const url = this.getUrl('Library/PhysicalPaths');

        return this.getJSON(url);
    }

    /**
     * Gets the current server configuration
     */
    getServerConfiguration() {
        const url = this.getUrl('System/Configuration');

        return this.getJSON(url);
    }

    /**
     * Gets the current server configuration
     */
    getDevicesOptions() {
        const url = this.getUrl('System/Configuration/devices');

        return this.getJSON(url);
    }

    /**
     * Deletes the device from the devices list, forcing any active sessions
     * to re-authenticate.
     * @param {String} deviceId 
     */
    deleteDevice(deviceId) {
        const url = this.getUrl('Devices', {
            Id: deviceId
        });

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    /**
     * Gets the current server configuration
     */
    getContentUploadHistory() {
        const url = this.getUrl('Devices/CameraUploads', {
            DeviceId: this.deviceId()
        });

        return this.getJSON(url);
    }

    getNamedConfiguration(name) {
        const url = this.getUrl(`System/Configuration/${name}`);

        return this.getJSON(url);
    }

    /**
     * Gets the server's scheduled tasks
     */
    getScheduledTasks(options = {}) {
        const url = this.getUrl('ScheduledTasks', options);

        return this.getJSON(url);
    }

    /**
     * Starts a scheduled task
     */
    startScheduledTask(id) {
        if (!id) {
            throw new Error('null id');
        }

        const url = this.getUrl(`ScheduledTasks/Running/${id}`);

        return this.ajax({
            type: 'POST',
            url
        });
    }

    /**
     * Gets a scheduled task
     */
    getScheduledTask(id) {
        if (!id) {
            throw new Error('null id');
        }

        const url = this.getUrl(`ScheduledTasks/${id}`);

        return this.getJSON(url);
    }

    getNextUpEpisodes(options) {
        const url = this.getUrl('Shows/NextUp', options);

        return this.getJSON(url);
    }

    /**
     * Stops a scheduled task
     */
    stopScheduledTask(id) {
        if (!id) {
            throw new Error('null id');
        }

        const url = this.getUrl(`ScheduledTasks/Running/${id}`);

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    /**
     * Gets the configuration of a plugin
     * @param {String} Id
     */
    getPluginConfiguration(id) {
        if (!id) {
            throw new Error('null Id');
        }

        const url = this.getUrl(`Plugins/${id}/Configuration`);

        return this.getJSON(url);
    }

    /**
     * Gets a list of plugins that are available to be installed
     */
    getAvailablePlugins(options = {}) {
        options.PackageType = 'UserInstalled';

        const url = this.getUrl('Packages', options);

        return this.getJSON(url);
    }

    /**
     * Uninstalls a plugin
     * @param {String} Id
     */
    uninstallPlugin(id) {
        if (!id) {
            throw new Error('null Id');
        }

        const url = this.getUrl(`Plugins/${id}`);

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    /**
     * Removes a virtual folder
     * @param {String} name
     */
    removeVirtualFolder(name, refreshLibrary) {
        if (!name) {
            throw new Error('null name');
        }

        let url = 'Library/VirtualFolders';

        url = this.getUrl(url, {
            refreshLibrary: refreshLibrary ? true : false,
            name
        });

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    /**
     * Adds a virtual folder
     * @param {String} name
     */
    addVirtualFolder(name, type, refreshLibrary, libraryOptions) {
        if (!name) {
            throw new Error('null name');
        }

        const options = {};

        if (type) {
            options.collectionType = type;
        }

        options.refreshLibrary = refreshLibrary ? true : false;
        options.name = name;

        let url = 'Library/VirtualFolders';

        url = this.getUrl(url, options);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify({
                LibraryOptions: libraryOptions
            }),
            contentType: 'application/json'
        });
    }

    updateVirtualFolderOptions(id, libraryOptions) {
        if (!id) {
            throw new Error('null name');
        }

        let url = 'Library/VirtualFolders/LibraryOptions';

        url = this.getUrl(url);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify({
                Id: id,
                LibraryOptions: libraryOptions
            }),
            contentType: 'application/json'
        });
    }

    /**
     * Renames a virtual folder
     * @param {String} name
     */
    renameVirtualFolder(name, newName, refreshLibrary) {
        if (!name) {
            throw new Error('null name');
        }

        let url = 'Library/VirtualFolders/Name';

        url = this.getUrl(url, {
            refreshLibrary: refreshLibrary ? true : false,
            newName,
            name
        });

        return this.ajax({
            type: 'POST',
            url
        });
    }

    /**
     * Adds an additional mediaPath to an existing virtual folder
     * @param {String} name
     */
    addMediaPath(virtualFolderName, mediaPath, networkSharePath, refreshLibrary) {
        if (!virtualFolderName) {
            throw new Error('null virtualFolderName');
        }

        if (!mediaPath) {
            throw new Error('null mediaPath');
        }

        let url = 'Library/VirtualFolders/Paths';

        const pathInfo = {
            Path: mediaPath
        };
        if (networkSharePath) {
            pathInfo.NetworkPath = networkSharePath;
        }

        url = this.getUrl(url, {
            refreshLibrary: refreshLibrary ? true : false
        });

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify({
                Name: virtualFolderName,
                PathInfo: pathInfo
            }),
            contentType: 'application/json'
        });
    }

    updateMediaPath(virtualFolderName, pathInfo) {
        if (!virtualFolderName) {
            throw new Error('null virtualFolderName');
        }

        if (!pathInfo) {
            throw new Error('null pathInfo');
        }

        let url = 'Library/VirtualFolders/Paths/Update';

        url = this.getUrl(url);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify({
                Name: virtualFolderName,
                PathInfo: pathInfo
            }),
            contentType: 'application/json'
        });
    }

    /**
     * Removes a media path from a virtual folder
     * @param {String} name
     */
    removeMediaPath(virtualFolderName, mediaPath, refreshLibrary) {
        if (!virtualFolderName) {
            throw new Error('null virtualFolderName');
        }

        if (!mediaPath) {
            throw new Error('null mediaPath');
        }

        let url = 'Library/VirtualFolders/Paths';

        url = this.getUrl(url, {
            refreshLibrary: refreshLibrary ? true : false,
            path: mediaPath,
            name: virtualFolderName
        });

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    /**
     * Deletes a user
     * @param {String} id
     */
    deleteUser(id) {
        if (!id) {
            throw new Error('null id');
        }

        const url = this.getUrl(`Users/${id}`);

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    /**
     * Deletes a user image
     * @param {String} userId
     * @param {String} imageType The type of image to delete, based on the server-side ImageType enum.
     */
    deleteUserImage(userId, imageType, imageIndex) {
        if (!userId) {
            throw new Error('null userId');
        }

        if (!imageType) {
            throw new Error('null imageType');
        }

        let url = this.getUrl(`Users/${userId}/Images/${imageType}`);

        if (imageIndex != null) {
            url += `/${imageIndex}`;
        }

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    deleteItemImage(itemId, imageType, imageIndex) {
        if (!imageType) {
            throw new Error('null imageType');
        }

        let url = this.getUrl(`Items/${itemId}/Images`);

        url += `/${imageType}`;

        if (imageIndex != null) {
            url += `/${imageIndex}`;
        }

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    deleteItem(itemId) {
        if (!itemId) {
            throw new Error('null itemId');
        }

        const url = this.getUrl(`Items/${itemId}`);

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    stopActiveEncodings(playSessionId) {
        const options = {
            deviceId: this.deviceId()
        };

        if (playSessionId) {
            options.PlaySessionId = playSessionId;
        }

        const url = this.getUrl('Videos/ActiveEncodings', options);

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    reportCapabilities(options) {
        const url = this.getUrl('Sessions/Capabilities/Full');

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(options),
            contentType: 'application/json'
        });
    }

    updateItemImageIndex(itemId, imageType, imageIndex, newIndex) {
        if (!imageType) {
            throw new Error('null imageType');
        }

        const options = { newIndex };

        const url = this.getUrl(`Items/${itemId}/Images/${imageType}/${imageIndex}/Index`, options);

        return this.ajax({
            type: 'POST',
            url
        });
    }

    getItemImageInfos(itemId) {
        const url = this.getUrl(`Items/${itemId}/Images`);

        return this.getJSON(url);
    }

    getCriticReviews(itemId, options) {
        if (!itemId) {
            throw new Error('null itemId');
        }

        const url = this.getUrl(`Items/${itemId}/CriticReviews`, options);

        return this.getJSON(url);
    }

    getItemDownloadUrl(itemId) {
        if (!itemId) {
            throw new Error('itemId cannot be empty');
        }

        const url = `Items/${itemId}/Download`;

        return this.getUrl(url, {
            api_key: this.accessToken()
        });
    }

    getSessions(options) {
        const url = this.getUrl('Sessions', options);

        return this.getJSON(url);
    }

    /**
     * Uploads a user image
     * @param {String} userId
     * @param {String} imageType The type of image to delete, based on the server-side ImageType enum.
     * @param {Object} file The file from the input element
     */
    uploadUserImage(userId, imageType, file) {
        if (!userId) {
            throw new Error('null userId');
        }

        if (!imageType) {
            throw new Error('null imageType');
        }

        if (!file) {
            throw new Error('File must be an image.');
        }

        if (!file.type.startsWith('image/')) {
            throw new Error('File must be an image.');
        }

        const instance = this;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onerror = () => {
                reject();
            };

            reader.onabort = () => {
                reject();
            };

            // Closure to capture the file information.
            reader.onload = (e) => {
                // Split by a comma to remove the url: prefix
                const data = e.target.result.split(',')[1];

                const url = instance.getUrl(`Users/${userId}/Images/${imageType}`);

                instance
                    .ajax({
                        type: 'POST',
                        url,
                        data,
                        contentType: `image/${file.name.substring(file.name.lastIndexOf('.') + 1)}`
                    })
                    .then(resolve, reject);
            };

            // Read in the image file as a data URL.
            reader.readAsDataURL(file);
        });
    }

    uploadItemImage(itemId, imageType, file) {
        if (!itemId) {
            throw new Error('null itemId');
        }

        if (!imageType) {
            throw new Error('null imageType');
        }

        if (!file) {
            throw new Error('File must be an image.');
        }

        if (!file.type.startsWith('image/')) {
            throw new Error('File must be an image.');
        }

        let url = this.getUrl(`Items/${itemId}/Images`);

        url += `/${imageType}`;
        const instance = this;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onerror = () => {
                reject();
            };

            reader.onabort = () => {
                reject();
            };

            // Closure to capture the file information.
            reader.onload = (e) => {
                // Split by a comma to remove the url: prefix
                const data = e.target.result.split(',')[1];

                instance
                    .ajax({
                        type: 'POST',
                        url,
                        data,
                        contentType: `image/${file.name.substring(file.name.lastIndexOf('.') + 1)}`
                    })
                    .then(resolve, reject);
            };

            // Read in the image file as a data URL.
            reader.readAsDataURL(file);
        });
    }

    uploadItemSubtitle(itemId, language, isForced, file) {
        if (!itemId) {
            throw new SyntaxError('Missing itemId');
        }

        if (!language) {
            throw new SyntaxError('Missing language');
        }

        if (typeof isForced !== 'boolean') {
            throw new TypeError('Parameter isForced must be a boolean.');
        }

        if (!file) {
            throw new SyntaxError('File must be a subtitle file.');
        }

        const format = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();

        if (!['sub', 'srt', 'vtt', 'ass', 'ssa'].includes(format)) {
            throw new Error('Invalid subtitle format.');
        }

        let url = this.getUrl(`Videos/${itemId}/Subtitles`);

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onerror = () => {
                reject();
            };

            reader.onabort = () => {
                reject();
            };

            // Closure to capture the file information.
            reader.onload = (e) => {
                // Split by a comma to remove the url: prefix
                const data = e.target.result.split(',')[1];

                this.ajax({
                        type: 'POST',
                        url,
                        data: {
                            language: language,
                            format: format,
                            isForced: isForced,
                            data: data
                        }
                    })
                    .then(resolve, reject);
            };

            // Read in the image file as a data URL.
            reader.readAsDataURL(file);
        });
    }

    /**
     * Gets the list of installed plugins on the server
     */
    getInstalledPlugins() {
        const options = {};

        const url = this.getUrl('Plugins', options);

        return this.getJSON(url);
    }

    /**
     * Gets a user by id
     * @param {String} id
     */
    getUser(id) {
        if (!id) {
            throw new Error('Must supply a userId');
        }

        const url = this.getUrl(`Users/${id}`);

        return this.getJSON(url);
    }

    /**
     * Gets a studio
     */
    getStudio(name, userId) {
        if (!name) {
            throw new Error('null name');
        }

        const options = {};

        if (userId) {
            options.userId = userId;
        }

        const url = this.getUrl(`Studios/${this.encodeName(name)}`, options);

        return this.getJSON(url);
    }

    /**
     * Gets a genre
     */
    getGenre(name, userId) {
        if (!name) {
            throw new Error('null name');
        }

        const options = {};

        if (userId) {
            options.userId = userId;
        }

        const url = this.getUrl(`Genres/${this.encodeName(name)}`, options);

        return this.getJSON(url);
    }

    getMusicGenre(name, userId) {
        if (!name) {
            throw new Error('null name');
        }

        const options = {};

        if (userId) {
            options.userId = userId;
        }

        const url = this.getUrl(`MusicGenres/${this.encodeName(name)}`, options);

        return this.getJSON(url);
    }

    /**
     * Gets an artist
     */
    getArtist(name, userId) {
        if (!name) {
            throw new Error('null name');
        }

        const options = {};

        if (userId) {
            options.userId = userId;
        }

        const url = this.getUrl(`Artists/${this.encodeName(name)}`, options);

        return this.getJSON(url);
    }

    /**
     * Gets a Person
     */
    getPerson(name, userId) {
        if (!name) {
            throw new Error('null name');
        }

        const options = {};

        if (userId) {
            options.userId = userId;
        }

        const url = this.getUrl(`Persons/${this.encodeName(name)}`, options);

        return this.getJSON(url);
    }

    getPublicUsers() {
        const url = this.getUrl('users/public');

        return this.ajax(
            {
                type: 'GET',
                url,
                dataType: 'json'
            },
            false
        );
    }

    /**
     * Gets all users from the server
     */
    getUsers(options) {
        const url = this.getUrl('users', options || {});

        return this.getJSON(url);
    }

    /**
     * Gets all available parental ratings from the server
     */
    getParentalRatings() {
        const url = this.getUrl('Localization/ParentalRatings');

        return this.getJSON(url);
    }

    getDefaultImageQuality(imageType) {
        return imageType.toLowerCase() === 'backdrop' ? 80 : 90;
    }

    /**
     * Constructs a url for a user image
     * @param {String} userId
     * @param {Object} options
     * Options supports the following properties:
     * width - download the image at a fixed width
     * height - download the image at a fixed height
     * maxWidth - download the image at a maxWidth
     * maxHeight - download the image at a maxHeight
     * quality - A scale of 0-100. This should almost always be omitted as the default will suffice.
     * For best results do not specify both width and height together, as aspect ratio might be altered.
     */
    getUserImageUrl(userId, options) {
        if (!userId) {
            throw new Error('null userId');
        }

        options = options || {};

        let url = `Users/${userId}/Images/${options.type}`;

        if (options.index != null) {
            url += `/${options.index}`;
        }

        normalizeImageOptions(this, options);

        // Don't put these on the query string
        delete options.type;
        delete options.index;

        return this.getUrl(url, options);
    }

    /**
     * Constructs a url for an item image
     * @param {String} itemId
     * @param {Object} options
     * Options supports the following properties:
     * type - Primary, logo, backdrop, etc. See the server-side enum ImageType
     * index - When downloading a backdrop, use this to specify which one (omitting is equivalent to zero)
     * width - download the image at a fixed width
     * height - download the image at a fixed height
     * maxWidth - download the image at a maxWidth
     * maxHeight - download the image at a maxHeight
     * quality - A scale of 0-100. This should almost always be omitted as the default will suffice.
     * For best results do not specify both width and height together, as aspect ratio might be altered.
     */
    getImageUrl(itemId, options) {
        if (!itemId) {
            throw new Error('itemId cannot be empty');
        }

        options = options || {};

        let url = `Items/${itemId}/Images/${options.type}`;

        if (options.index != null) {
            url += `/${options.index}`;
        }

        options.quality = options.quality || this.getDefaultImageQuality(options.type);

        if (this.normalizeImageOptions) {
            this.normalizeImageOptions(options);
        }

        // Don't put these on the query string
        delete options.type;
        delete options.index;

        return this.getUrl(url, options);
    }

    getScaledImageUrl(itemId, options) {
        if (!itemId) {
            throw new Error('itemId cannot be empty');
        }

        options = options || {};

        let url = `Items/${itemId}/Images/${options.type}`;

        if (options.index != null) {
            url += `/${options.index}`;
        }

        normalizeImageOptions(this, options);

        // Don't put these on the query string
        delete options.type;
        delete options.index;
        delete options.minScale;

        return this.getUrl(url, options);
    }

    getThumbImageUrl(item, options) {
        if (!item) {
            throw new Error('null item');
        }

        options = options || {};

        options.imageType = 'thumb';

        if (item.ImageTags && item.ImageTags.Thumb) {
            options.tag = item.ImageTags.Thumb;
            return this.getImageUrl(item.Id, options);
        } else if (item.ParentThumbItemId) {
            options.tag = item.ImageTags.ParentThumbImageTag;
            return this.getImageUrl(item.ParentThumbItemId, options);
        } else {
            return null;
        }
    }

    /**
     * Updates a user's password
     * @param {String} userId
     * @param {String} currentPassword
     * @param {String} newPassword
     */
    updateUserPassword(userId, currentPassword, newPassword) {
        if (!userId) {
            return Promise.reject();
        }

        const url = this.getUrl(`Users/${userId}/Password`);

        return this.ajax({
            type: 'POST',
            url: url,
            data: JSON.stringify({
                CurrentPw: currentPassword || '',
                NewPw: newPassword
            }),
            contentType: 'application/json'
        });
    }

    /**
     * Updates a user's easy password
     * @param {String} userId
     * @param {String} newPassword
     */
    updateEasyPassword(userId, newPassword) {
        if (!userId) {
            Promise.reject();
            return;
        }

        const url = this.getUrl(`Users/${userId}/EasyPassword`);

        return this.ajax({
            type: 'POST',
            url,
            data: {
                NewPw: newPassword
            },
            contentType: 'application/json'
        });
    }

    /**
     * Resets a user's password
     * @param {String} userId
     */
    resetUserPassword(userId) {
        if (!userId) {
            throw new Error('null userId');
        }

        const url = this.getUrl(`Users/${userId}/Password`);

        const postData = {};

        postData.resetPassword = true;

        return this.ajax({
            type: 'POST',
            url,
            data: postData
        });
    }

    resetEasyPassword(userId) {
        if (!userId) {
            throw new Error('null userId');
        }

        const url = this.getUrl(`Users/${userId}/EasyPassword`);

        const postData = {};

        postData.resetPassword = true;

        return this.ajax({
            type: 'POST',
            url,
            data: postData
        });
    }

    /**
     * Updates the server's configuration
     * @param {Object} configuration
     */
    updateServerConfiguration(configuration) {
        if (!configuration) {
            throw new Error('null configuration');
        }

        const url = this.getUrl('System/Configuration');

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(configuration),
            contentType: 'application/json'
        });
    }

    updateNamedConfiguration(name, configuration) {
        if (!configuration) {
            throw new Error('null configuration');
        }

        const url = this.getUrl(`System/Configuration/${name}`);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(configuration),
            contentType: 'application/json'
        });
    }

    updateItem(item) {
        if (!item) {
            throw new Error('null item');
        }

        const url = this.getUrl(`Items/${item.Id}`);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(item),
            contentType: 'application/json'
        });
    }

    /**
     * Updates plugin security info
     */
    updatePluginSecurityInfo(info) {
        const url = this.getUrl('Plugins/SecurityInfo');

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(info),
            contentType: 'application/json'
        });
    }

    /**
     * Creates a user
     * @param {Object} user
     */
    createUser(user) {
        const url = this.getUrl('Users/New');
        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(user),
            contentType: 'application/json',
            headers: {
                accept: 'application/json'
            }
        });
    }

    /**
     * Updates a user
     * @param {Object} user
     */
    updateUser(user) {
        if (!user) {
            throw new Error('null user');
        }

        const url = this.getUrl(`Users/${user.Id}`);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(user),
            contentType: 'application/json'
        });
    }

    updateUserPolicy(userId, policy) {
        if (!userId) {
            throw new Error('null userId');
        }
        if (!policy) {
            throw new Error('null policy');
        }

        const url = this.getUrl(`Users/${userId}/Policy`);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(policy),
            contentType: 'application/json'
        });
    }

    updateUserConfiguration(userId, configuration) {
        if (!userId) {
            throw new Error('null userId');
        }
        if (!configuration) {
            throw new Error('null configuration');
        }

        const url = this.getUrl(`Users/${userId}/Configuration`);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(configuration),
            contentType: 'application/json'
        });
    }

    /**
     * Updates the Triggers for a ScheduledTask
     * @param {String} id
     * @param {Object} triggers
     */
    updateScheduledTaskTriggers(id, triggers) {
        if (!id) {
            throw new Error('null id');
        }

        if (!triggers) {
            throw new Error('null triggers');
        }

        const url = this.getUrl(`ScheduledTasks/${id}/Triggers`);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(triggers),
            contentType: 'application/json'
        });
    }

    /**
     * Updates a plugin's configuration
     * @param {String} Id
     * @param {Object} configuration
     */
    updatePluginConfiguration(id, configuration) {
        if (!id) {
            throw new Error('null Id');
        }

        if (!configuration) {
            throw new Error('null configuration');
        }

        const url = this.getUrl(`Plugins/${id}/Configuration`);

        return this.ajax({
            type: 'POST',
            url,
            data: JSON.stringify(configuration),
            contentType: 'application/json'
        });
    }

    getAncestorItems(itemId, userId) {
        if (!itemId) {
            throw new Error('null itemId');
        }

        const options = {};

        if (userId) {
            options.userId = userId;
        }

        const url = this.getUrl(`Items/${itemId}/Ancestors`, options);

        return this.getJSON(url);
    }

    /**
     * Gets items based on a query, typically for children of a folder
     * @param {String} userId
     * @param {Object} options
     * Options accepts the following properties:
     * itemId - Localize the search to a specific folder (root if omitted)
     * startIndex - Use for paging
     * limit - Use to limit results to a certain number of items
     * filter - Specify one or more ItemFilters, comma delimeted (see server-side enum)
     * sortBy - Specify an ItemSortBy (comma-delimeted list see server-side enum)
     * sortOrder - ascending/descending
     * fields - additional fields to include aside from basic info. This is a comma delimited list. See server-side enum ItemFields.
     * index - the name of the dynamic, localized index function
     * dynamicSortBy - the name of the dynamic localized sort function
     * recursive - Whether or not the query should be recursive
     * searchTerm - search term to use as a filter
     */
    getItems(userId, options) {
        let url;

        if ((typeof userId).toString().toLowerCase() === 'string') {
            url = this.getUrl(`Users/${userId}/Items`, options);
        } else {
            url = this.getUrl('Items', options);
        }

        return this.getJSON(url);
    }

    getResumableItems(userId, options) {
        if (this.isMinServerVersion('3.2.33')) {
            return this.getJSON(this.getUrl(`Users/${userId}/Items/Resume`, options));
        }

        return this.getItems(
            userId,
            Object.assign(
                {
                    SortBy: 'DatePlayed',
                    SortOrder: 'Descending',
                    Filters: 'IsResumable',
                    Recursive: true,
                    CollapseBoxSetItems: false,
                    ExcludeLocationTypes: 'Virtual'
                },
                options
            )
        );
    }

    getMovieRecommendations(options) {
        return this.getJSON(this.getUrl('Movies/Recommendations', options));
    }

    getUpcomingEpisodes(options) {
        return this.getJSON(this.getUrl('Shows/Upcoming', options));
    }

    getUserViews(options = {}, userId) {
        const url = this.getUrl(`Users/${userId || this.getCurrentUserId()}/Views`, options);

        return this.getJSON(url);
    }

    /**
        Gets artists from an item
    */
    getArtists(userId, options) {
        if (!userId) {
            throw new Error('null userId');
        }

        options = options || {};
        options.userId = userId;

        const url = this.getUrl('Artists', options);

        return this.getJSON(url);
    }

    /**
        Gets artists from an item
    */
    getAlbumArtists(userId, options) {
        if (!userId) {
            throw new Error('null userId');
        }

        options = options || {};
        options.userId = userId;

        const url = this.getUrl('Artists/AlbumArtists', options);

        return this.getJSON(url);
    }

    /**
        Gets genres from an item
    */
    getGenres(userId, options) {
        if (!userId) {
            throw new Error('null userId');
        }

        options = options || {};
        options.userId = userId;

        const url = this.getUrl('Genres', options);

        return this.getJSON(url);
    }

    getMusicGenres(userId, options) {
        if (!userId) {
            throw new Error('null userId');
        }

        options = options || {};
        options.userId = userId;

        const url = this.getUrl('MusicGenres', options);

        return this.getJSON(url);
    }

    /**
        Gets people from an item
    */
    getPeople(userId, options) {
        if (!userId) {
            throw new Error('null userId');
        }

        options = options || {};
        options.userId = userId;

        const url = this.getUrl('Persons', options);

        return this.getJSON(url);
    }

    /**
        Gets studios from an item
    */
    getStudios(userId, options) {
        if (!userId) {
            throw new Error('null userId');
        }

        options = options || {};
        options.userId = userId;

        const url = this.getUrl('Studios', options);

        return this.getJSON(url);
    }

    /**
     * Gets local trailers for an item
     */
    getLocalTrailers(userId, itemId) {
        if (!userId) {
            throw new Error('null userId');
        }
        if (!itemId) {
            throw new Error('null itemId');
        }

        const url = this.getUrl(`Users/${userId}/Items/${itemId}/LocalTrailers`);

        return this.getJSON(url);
    }

    getAdditionalVideoParts(userId, itemId) {
        if (!itemId) {
            throw new Error('null itemId');
        }

        const options = {};

        if (userId) {
            options.userId = userId;
        }

        const url = this.getUrl(`Videos/${itemId}/AdditionalParts`, options);

        return this.getJSON(url);
    }

    getThemeMedia(userId, itemId, inherit) {
        if (!itemId) {
            throw new Error('null itemId');
        }

        const options = {};

        if (userId) {
            options.userId = userId;
        }

        options.InheritFromParent = inherit || false;

        const url = this.getUrl(`Items/${itemId}/ThemeMedia`, options);

        return this.getJSON(url);
    }

    getSearchHints(options) {
        const url = this.getUrl('Search/Hints', options);
        const serverId = this.serverId();

        return this.getJSON(url).then((result) => {
            result.SearchHints.forEach((i) => {
                i.ServerId = serverId;
            });
            return result;
        });
    }

    /**
     * Gets special features for an item
     */
    getSpecialFeatures(userId, itemId) {
        if (!userId) {
            throw new Error('null userId');
        }
        if (!itemId) {
            throw new Error('null itemId');
        }

        const url = this.getUrl(`Users/${userId}/Items/${itemId}/SpecialFeatures`);

        return this.getJSON(url);
    }

    getDateParamValue(date) {
        function formatDigit(i) {
            return i < 10 ? `0${i}` : i;
        }

        const d = date;

        return `${d.getFullYear()}${formatDigit(d.getMonth() + 1)}${formatDigit(d.getDate())}${formatDigit(
            d.getHours()
        )}${formatDigit(d.getMinutes())}${formatDigit(d.getSeconds())}`;
    }

    markPlayed(userId, itemId, date) {
        if (!userId) {
            throw new Error('null userId');
        }

        if (!itemId) {
            throw new Error('null itemId');
        }

        const options = {};

        if (date) {
            options.DatePlayed = this.getDateParamValue(date);
        }

        const url = this.getUrl(`Users/${userId}/PlayedItems/${itemId}`, options);

        return this.ajax({
            type: 'POST',
            url,
            dataType: 'json'
        });
    }

    markUnplayed(userId, itemId) {
        if (!userId) {
            throw new Error('null userId');
        }

        if (!itemId) {
            throw new Error('null itemId');
        }

        const url = this.getUrl(`Users/${userId}/PlayedItems/${itemId}`);

        return this.ajax({
            type: 'DELETE',
            url,
            dataType: 'json'
        });
    }

    /**
     * Updates a user's favorite status for an item.
     * @param {String} userId
     * @param {String} itemId
     * @param {Boolean} isFavorite
     */
    updateFavoriteStatus(userId, itemId, isFavorite) {
        if (!userId) {
            throw new Error('null userId');
        }

        if (!itemId) {
            throw new Error('null itemId');
        }

        const url = this.getUrl(`Users/${userId}/FavoriteItems/${itemId}`);

        const method = isFavorite ? 'POST' : 'DELETE';

        return this.ajax({
            type: method,
            url,
            dataType: 'json'
        });
    }

    /**
     * Updates a user's personal rating for an item
     * @param {String} userId
     * @param {String} itemId
     * @param {Boolean} likes
     */
    updateUserItemRating(userId, itemId, likes) {
        if (!userId) {
            throw new Error('null userId');
        }

        if (!itemId) {
            throw new Error('null itemId');
        }

        const url = this.getUrl(`Users/${userId}/Items/${itemId}/Rating`, {
            likes
        });

        return this.ajax({
            type: 'POST',
            url,
            dataType: 'json'
        });
    }

    getItemCounts(userId) {
        const options = {};

        if (userId) {
            options.userId = userId;
        }

        const url = this.getUrl('Items/Counts', options);

        return this.getJSON(url);
    }

    /**
     * Clears a user's personal rating for an item
     * @param {String} userId
     * @param {String} itemId
     */
    clearUserItemRating(userId, itemId) {
        if (!userId) {
            throw new Error('null userId');
        }

        if (!itemId) {
            throw new Error('null itemId');
        }

        const url = this.getUrl(`Users/${userId}/Items/${itemId}/Rating`);

        return this.ajax({
            type: 'DELETE',
            url,
            dataType: 'json'
        });
    }

    /**
     * Reports the user has started playing something
     * @param {String} userId
     * @param {String} itemId
     */
    reportPlaybackStart(options) {
        if (!options) {
            throw new Error('null options');
        }

        this.lastPlaybackProgressReport = 0;
        this.lastPlaybackProgressReportTicks = null;
        stopBitrateDetection(this);

        cancelReportPlaybackProgressPromise(this);
        const url = this.getUrl('Sessions/Playing');

        return this.ajax({
            type: 'POST',
            data: JSON.stringify(options),
            contentType: 'application/json',
            url
        });
    }

    /**
     * Reports progress viewing an item
     * @param {String} userId
     * @param {String} itemId
     */
    reportPlaybackProgress(options) {
        if (!options) {
            throw new Error('null options');
        }

        const eventName = options.EventName || 'timeupdate';
        let reportRateLimitTime = reportRateLimits[eventName] || 0;

        const now = new Date().getTime();
        const msSinceLastReport = now - (this.lastPlaybackProgressReport || 0);
        const newPositionTicks = options.PositionTicks;

        if (msSinceLastReport < reportRateLimitTime && eventName === 'timeupdate' && newPositionTicks) {
            const expectedReportTicks = 1e4 * msSinceLastReport + (this.lastPlaybackProgressReportTicks || 0);
            if (Math.abs(newPositionTicks - expectedReportTicks) >= 5e7) reportRateLimitTime = 0;
        }

        if (
            reportRateLimitTime <
            (this.reportPlaybackProgressTimeout !== undefined ? this.reportPlaybackProgressTimeout : 1e6)
        ) {
            cancelReportPlaybackProgressPromise(this);
        }

        this.lastPlaybackProgressOptions = options;

        /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
        if (this.reportPlaybackProgressPromise) return Promise.resolve();

        let instance = this;
        let promise;
        let cancelled = false;

        let resetPromise = function () {
            if (instance.reportPlaybackProgressPromise !== promise) return;

            delete instance.lastPlaybackProgressOptions;
            delete instance.reportPlaybackProgressTimeout;
            delete instance.reportPlaybackProgressPromise;
            delete instance.reportPlaybackProgressCancel;
        };

        let sendReport = function (lastOptions) {
            resetPromise();

            if (!lastOptions) throw new Error('null options');

            instance.lastPlaybackProgressReport = new Date().getTime();
            instance.lastPlaybackProgressReportTicks = lastOptions.PositionTicks;

            const url = instance.getUrl('Sessions/Playing/Progress');
            return instance.ajax({
                type: 'POST',
                data: JSON.stringify(lastOptions),
                contentType: 'application/json',
                url: url
            });
        };

        let delay = Math.max(0, reportRateLimitTime - msSinceLastReport);

        promise = new Promise((resolve, reject) => setTimeout(resolve, delay))
            .then(() => {
                if (cancelled) return Promise.resolve();
                return sendReport(instance.lastPlaybackProgressOptions);
            })
            .finally(() => {
                resetPromise();
            });

        this.reportPlaybackProgressTimeout = reportRateLimitTime;
        this.reportPlaybackProgressPromise = promise;
        this.reportPlaybackProgressCancel = function () {
            cancelled = true;
            resetPromise();
        };

        return promise;
    }

    reportOfflineActions(actions) {
        if (!actions) {
            throw new Error('null actions');
        }

        const url = this.getUrl('Sync/OfflineActions');

        return this.ajax({
            type: 'POST',
            data: JSON.stringify(actions),
            contentType: 'application/json',
            url
        });
    }

    syncData(data) {
        if (!data) {
            throw new Error('null data');
        }

        const url = this.getUrl('Sync/Data');

        return this.ajax({
            type: 'POST',
            data: JSON.stringify(data),
            contentType: 'application/json',
            url,
            dataType: 'json'
        });
    }

    getReadySyncItems(deviceId) {
        if (!deviceId) {
            throw new Error('null deviceId');
        }

        const url = this.getUrl('Sync/Items/Ready', {
            TargetId: deviceId
        });

        return this.getJSON(url);
    }

    reportSyncJobItemTransferred(syncJobItemId) {
        if (!syncJobItemId) {
            throw new Error('null syncJobItemId');
        }

        const url = this.getUrl(`Sync/JobItems/${syncJobItemId}/Transferred`);

        return this.ajax({
            type: 'POST',
            url
        });
    }

    cancelSyncItems(itemIds, targetId) {
        if (!itemIds) {
            throw new Error('null itemIds');
        }

        const url = this.getUrl(`Sync/${targetId || this.deviceId()}/Items`, {
            ItemIds: itemIds.join(',')
        });

        return this.ajax({
            type: 'DELETE',
            url
        });
    }

    /**
     * Reports a user has stopped playing an item
     * @param {String} userId
     * @param {String} itemId
     */
    reportPlaybackStopped(options) {
        if (!options) {
            throw new Error('null options');
        }

        this.lastPlaybackProgressReport = 0;
        this.lastPlaybackProgressReportTicks = null;
        redetectBitrate(this);

        cancelReportPlaybackProgressPromise(this);
        const url = this.getUrl('Sessions/Playing/Stopped');

        return this.ajax({
            type: 'POST',
            data: JSON.stringify(options),
            contentType: 'application/json',
            url
        });
    }

    sendPlayCommand(sessionId, options) {
        if (!sessionId) {
            throw new Error('null sessionId');
        }

        if (!options) {
            throw new Error('null options');
        }

        const url = this.getUrl(`Sessions/${sessionId}/Playing`, options);

        return this.ajax({
            type: 'POST',
            url
        });
    }

    sendCommand(sessionId, command) {
        if (!sessionId) {
            throw new Error('null sessionId');
        }

        if (!command) {
            throw new Error('null command');
        }

        const url = this.getUrl(`Sessions/${sessionId}/Command`);

        const ajaxOptions = {
            type: 'POST',
            url
        };

        ajaxOptions.data = JSON.stringify(command);
        ajaxOptions.contentType = 'application/json';

        return this.ajax(ajaxOptions);
    }

    sendMessageCommand(sessionId, options) {
        if (!sessionId) {
            throw new Error('null sessionId');
        }

        if (!options) {
            throw new Error('null options');
        }

        const url = this.getUrl(`Sessions/${sessionId}/Message`);

        const ajaxOptions = {
            type: 'POST',
            url
        };

        ajaxOptions.data = JSON.stringify(options);
        ajaxOptions.contentType = 'application/json';

        return this.ajax(ajaxOptions);
    }

    sendPlayStateCommand(sessionId, command, options) {
        if (!sessionId) {
            throw new Error('null sessionId');
        }

        if (!command) {
            throw new Error('null command');
        }

        const url = this.getUrl(`Sessions/${sessionId}/Playing/${command}`, options || {});

        return this.ajax({
            type: 'POST',
            url
        });
    }

    /**
     * Gets a list of all the active SyncPlay groups from the server.
     * @returns {Promise} A Promise that resolves to the list of active groups.
     * @since 10.6.0
     */
    getSyncPlayGroups() {
        const url = this.getUrl(`SyncPlay/List`);

        return this.ajax({
            type: 'GET',
            url: url
        });
    }

    /**
     * Creates a SyncPlay group on the server with the current client as member.
     * @returns {Promise} A Promise fulfilled upon request completion.
     * @since 10.6.0
     */
    createSyncPlayGroup() {
        const url = this.getUrl(`SyncPlay/New`);

        return this.ajax({
            type: 'POST',
            url: url
        });
    }

    /**
     * Joins the client to a given SyncPlay group on the server.
     * @param {object} options Information about the SyncPlay group to join.
     * @returns {Promise} A Promise fulfilled upon request completion.
     * @since 10.6.0
     */
    joinSyncPlayGroup(options = {}) {
        const url = this.getUrl(`SyncPlay/Join`, options);

        return this.ajax({
            type: 'POST',
            url: url
        });
    }

    /**
     * Leaves the current SyncPlay group.
     * @returns {Promise} A Promise fulfilled upon request completion.
     * @since 10.6.0
     */
    leaveSyncPlayGroup() {
        const url = this.getUrl(`SyncPlay/Leave`);

        return this.ajax({
            type: 'POST',
            url: url
        });
    }

    /**
     * Sends a ping to the SyncPlay group on the server.
     * @param {object} options Information about the ping
     * @returns {Promise} A Promise fulfilled upon request completion.
     * @since 10.6.0
     */
    sendSyncPlayPing(options = {}) {
        const url = this.getUrl(`SyncPlay/Ping`, options);

        return this.ajax({
            type: 'POST',
            url: url
        });
    }

    /**
     * Requests a playback start for the SyncPlay group
     * @returns {Promise} A Promise fulfilled upon request completion.
     * @since 10.6.0
     */
    requestSyncPlayStart() {
        const url = this.getUrl(`SyncPlay/Play`);

        return this.ajax({
            type: 'POST',
            url: url
        });
    }

    /**
     * Requests a playback pause for the SyncPlay group
     * @returns {Promise} A Promise fulfilled upon request completion.
     * @since 10.6.0
     */
    requestSyncPlayPause() {
        const url = this.getUrl(`SyncPlay/Pause`);

        return this.ajax({
            type: 'POST',
            url: url
        });
    }

    /**
     * Requests a playback seek for the SyncPlay group
     * @param {object} options Object containing the requested seek position.
     * @returns {Promise} A Promise fulfilled upon request completion.
     * @since 10.6.0
     */
    requestSyncPlaySeek(options = {}) {
        const url = this.getUrl(`SyncPlay/Seek`, options);

        return this.ajax({
            type: 'POST',
            url: url
        });
    }

    createPackageReview(review) {
        const url = this.getUrl(`Packages/Reviews/${review.id}`, review);

        return this.ajax({
            type: 'POST',
            url
        });
    }

    getPackageReviews(packageId, minRating, maxRating, limit) {
        if (!packageId) {
            throw new Error('null packageId');
        }

        const options = {};

        if (minRating) {
            options.MinRating = minRating;
        }
        if (maxRating) {
            options.MaxRating = maxRating;
        }
        if (limit) {
            options.Limit = limit;
        }

        const url = this.getUrl(`Packages/${packageId}/Reviews`, options);

        return this.getJSON(url);
    }

    getSavedEndpointInfo() {
        return this._endPointInfo;
    }

    getEndpointInfo() {
        const savedValue = this._endPointInfo;
        if (savedValue) {
            return Promise.resolve(savedValue);
        }

        const instance = this;
        return this.getJSON(this.getUrl('System/Endpoint')).then((endPointInfo) => {
            setSavedEndpointInfo(instance, endPointInfo);
            return endPointInfo;
        });
    }

    getLatestItems(options = {}) {
        return this.getJSON(this.getUrl(`Users/${this.getCurrentUserId()}/Items/Latest`, options));
    }

    getFilters(options) {
        return this.getJSON(this.getUrl('Items/Filters2', options));
    }

    setSystemInfo(info) {
        this._serverVersion = info.Version;
    }

    serverVersion() {
        return this._serverVersion;
    }

    isMinServerVersion(version) {
        const serverVersion = this.serverVersion();

        if (serverVersion) {
            return compareVersions(serverVersion, version) >= 0;
        }

        return false;
    }

    handleMessageReceived(msg) {
        onMessageReceivedInternal(this, msg);
    }
}

function setSavedEndpointInfo(instance, info) {
    instance._endPointInfo = info;
}

function getTryConnectPromise(instance, url, state, resolve, reject) {
    console.log('getTryConnectPromise ' + url);

    fetchWithTimeout(
        instance.getUrl('system/info/public', null, url),
        {
            method: 'GET',
            accept: 'application/json'

            // Commenting this out since the fetch api doesn't have a timeout option yet
            //timeout: timeout
        },
        15000
    ).then(
        () => {
            if (!state.resolved) {
                state.resolved = true;

                console.log('Reconnect succeeded to ' + url);
                instance.serverAddress(url);
                resolve();
            }
        },
        () => {
            if (!state.resolved) {
                console.log('Reconnect failed to ' + url);

                state.rejects++;
                if (state.rejects >= state.numAddresses) {
                    reject();
                }
            }
        }
    );
}

function tryReconnectInternal(instance) {
    const addresses = [];
    const addressesStrings = [];

    const serverInfo = instance.serverInfo();
    if (serverInfo.LocalAddress && addressesStrings.indexOf(serverInfo.LocalAddress) === -1) {
        addresses.push({ url: serverInfo.LocalAddress, timeout: 0 });
        addressesStrings.push(addresses[addresses.length - 1].url);
    }
    if (serverInfo.ManualAddress && addressesStrings.indexOf(serverInfo.ManualAddress) === -1) {
        addresses.push({ url: serverInfo.ManualAddress, timeout: 100 });
        addressesStrings.push(addresses[addresses.length - 1].url);
    }
    if (serverInfo.RemoteAddress && addressesStrings.indexOf(serverInfo.RemoteAddress) === -1) {
        addresses.push({ url: serverInfo.RemoteAddress, timeout: 200 });
        addressesStrings.push(addresses[addresses.length - 1].url);
    }

    console.log('tryReconnect: ' + addressesStrings.join('|'));

    return new Promise((resolve, reject) => {
        const state = {};
        state.numAddresses = addresses.length;
        state.rejects = 0;

        addresses.map((url) => {
            setTimeout(() => {
                if (!state.resolved) {
                    getTryConnectPromise(instance, url.url, state, resolve, reject);
                }
            }, url.timeout);
        });
    });
}

function tryReconnect(instance, retryCount) {
    retryCount = retryCount || 0;

    if (retryCount >= 20) {
        return Promise.reject();
    }

    return tryReconnectInternal(instance).catch((err) => {
        console.log('error in tryReconnectInternal: ' + (err || ''));

        return new Promise((resolve, reject) => {
            setTimeout(() => {
                tryReconnect(instance, retryCount + 1).then(resolve, reject);
            }, 500);
        });
    });
}

function getCachedUser(instance, userId) {
    const serverId = instance.serverId();
    if (!serverId) {
        return null;
    }

    const json = appStorage.getItem(`user-${userId}-${serverId}`);

    if (json) {
        return JSON.parse(json);
    }

    return null;
}

function onWebSocketMessage(msg) {
    const instance = this;
    msg = JSON.parse(msg.data);
    onMessageReceivedInternal(instance, msg);
}

const messageIdsReceived = {};

function onMessageReceivedInternal(instance, msg) {
    const messageId = msg.MessageId;
    if (messageId) {
        // message was already received via another protocol
        if (messageIdsReceived[messageId]) {
            return;
        }

        messageIdsReceived[messageId] = true;
    }

    if (msg.MessageType === 'UserDeleted') {
        instance._currentUser = null;
    } else if (msg.MessageType === 'UserUpdated' || msg.MessageType === 'UserConfigurationUpdated') {
        const user = msg.Data;
        if (user.Id === instance.getCurrentUserId()) {
            instance._currentUser = null;
        }
    } else if (msg.MessageType === 'KeepAlive') {
        console.debug('Received KeepAlive from server.');
    } else if (msg.MessageType === 'ForceKeepAlive') {
        console.debug(`Received ForceKeepAlive from server. Timeout is ${msg.Data} seconds.`);
        instance.sendWebSocketMessage('KeepAlive');
        scheduleKeepAlive(instance, msg.Data);
    }

    events.trigger(instance, 'message', [msg]);
}

/**
 * Starts a poller that sends KeepAlive messages using a WebSocket connection.
 * @param {Object} instance The WebSocket connection.
 * @param {number} timeout The number of seconds after which the WebSocket is considered lost by the server.
 * @returns {number} The id of the interval.
 * @since 10.6.0
 */
function scheduleKeepAlive(instance, timeout) {
    clearKeepAlive(instance);
    instance.keepAliveInterval = setInterval(() => {
        instance.sendWebSocketMessage('KeepAlive');
    }, timeout * 1000 * 0.5);
    return instance.keepAliveInterval;
}

/**
 * Stops the poller that is sending KeepAlive messages on a WebSocket connection.
 * @param {Object} instance The WebSocket connection.
 * @since 10.6.0
 */
function clearKeepAlive(instance) {
    console.debug('Clearing KeepAlive for', instance);
    if (instance.keepAliveInterval) {
        clearInterval(instance.keepAliveInterval);
        instance.keepAliveInterval = null;
    }
}

function onWebSocketOpen() {
    const instance = this;
    console.log('web socket connection opened');
    events.trigger(instance, 'websocketopen');
}

function onWebSocketError() {
    const instance = this;
    clearKeepAlive(instance);
    events.trigger(instance, 'websocketerror');
}

function setSocketOnClose(apiClient, socket) {
    socket.onclose = () => {
        console.log('web socket closed');

        clearKeepAlive(socket);
        if (apiClient._webSocket === socket) {
            console.log('nulling out web socket');
            apiClient._webSocket = null;
        }

        setTimeout(() => {
            events.trigger(apiClient, 'websocketclose');
        }, 0);
    };
}

function normalizeReturnBitrate(instance, bitrate) {
    if (!bitrate) {
        if (instance.lastDetectedBitrate) {
            return instance.lastDetectedBitrate;
        }

        return Promise.reject();
    }

    let result = Math.round(bitrate * 0.7);

    // allow configuration of this
    if (instance.getMaxBandwidth) {
        const maxRate = instance.getMaxBandwidth();
        if (maxRate) {
            result = Math.min(result, maxRate);
        }
    }

    instance.lastDetectedBitrate = result;
    instance.lastDetectedBitrateTime = new Date().getTime();

    return result;
}

function detectBitrateInternal(instance, tests, index, currentBitrate) {
    if (index >= tests.length) {
        return normalizeReturnBitrate(instance, currentBitrate);
    }

    const test = tests[index];

    return instance.getDownloadSpeed(test.bytes).then(
        (bitrate) => {
            if (bitrate < test.threshold) {
                return normalizeReturnBitrate(instance, bitrate);
            } else {
                return detectBitrateInternal(instance, tests, index + 1, bitrate);
            }
        },
        () => normalizeReturnBitrate(instance, currentBitrate)
    );
}

function detectBitrateWithEndpointInfo(instance, endpointInfo) {
    if (endpointInfo.IsInNetwork) {
        const result = 140000000;
        instance.lastDetectedBitrate = result;
        instance.lastDetectedBitrateTime = new Date().getTime();
        return result;
    }

    return detectBitrateInternal(
        instance,
        [
            {
                bytes: 500000,
                threshold: 500000
            },
            {
                bytes: 1000000,
                threshold: 20000000
            },
            {
                bytes: 3000000,
                threshold: 50000000
            }
        ],
        0
    );
}

function getRemoteImagePrefix(instance, options) {
    let urlPrefix;

    if (options.artist) {
        urlPrefix = `Artists/${instance.encodeName(options.artist)}`;
        delete options.artist;
    } else if (options.person) {
        urlPrefix = `Persons/${instance.encodeName(options.person)}`;
        delete options.person;
    } else if (options.genre) {
        urlPrefix = `Genres/${instance.encodeName(options.genre)}`;
        delete options.genre;
    } else if (options.musicGenre) {
        urlPrefix = `MusicGenres/${instance.encodeName(options.musicGenre)}`;
        delete options.musicGenre;
    } else if (options.studio) {
        urlPrefix = `Studios/${instance.encodeName(options.studio)}`;
        delete options.studio;
    } else {
        urlPrefix = `Items/${options.itemId}`;
        delete options.itemId;
    }

    return urlPrefix;
}

function normalizeImageOptions(instance, options) {
    let ratio = window && window.devicePixelRatio || 1;

    if (ratio) {
        if (options.minScale) {
            ratio = Math.max(options.minScale, ratio);
        }

        if (options.width) {
            options.width = Math.round(options.width * ratio);
        }
        if (options.height) {
            options.height = Math.round(options.height * ratio);
        }
        if (options.maxWidth) {
            options.maxWidth = Math.round(options.maxWidth * ratio);
        }
        if (options.maxHeight) {
            options.maxHeight = Math.round(options.maxHeight * ratio);
        }
    }

    options.quality = options.quality || instance.getDefaultImageQuality(options.type);

    if (instance.normalizeImageOptions) {
        instance.normalizeImageOptions(options);
    }
}

function compareVersions(a, b) {
    // -1 a is smaller
    // 1 a is larger
    // 0 equal
    a = a.split('.');
    b = b.split('.');

    for (let i = 0, length = Math.max(a.length, b.length); i < length; i++) {
        const aVal = parseInt(a[i] || '0');
        const bVal = parseInt(b[i] || '0');

        if (aVal < bVal) {
            return -1;
        }

        if (aVal > bVal) {
            return 1;
        }
    }

    return 0;
}

module.exports = ApiClient;
