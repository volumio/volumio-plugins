// @ts-check

'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new(require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var MicrosoftGraph = require('@microsoft/microsoft-graph-client');
var request = require('request');

const authInfo = {
    clientId: "ac1d2a92-fdc1-4d41-ba64-58ff0037a5b2",
    scope: "openid offline_access https://graph.microsoft.com/files.read",
    accessToken: null,
    refreshToken: null,
    redirectUri: "https://login.live.com/oauth20_desktop.srf",
    accessExpires: 0
}


module.exports = onedriveMusicLibrary;

function onedriveMusicLibrary(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}

onedriveMusicLibrary.prototype.onVolumioStart = function () {
    var self = this;
    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new(require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve(null);
}

onedriveMusicLibrary.prototype.onStart = function () {
    var self = this;

    authInfo.refreshToken = self.config.get("refreshToken");
    this.addToBrowseSources();
    this.graphClient = this.connectMSGraph();
    this.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
    
    return libQ.resolve();
};

onedriveMusicLibrary.prototype.onStop = function () {
    return libQ.resolve();
};


// Configuration Methods -----------------------------------------------------------------------------

onedriveMusicLibrary.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
            __dirname + '/i18n/strings_en.json',
            __dirname + '/UIConfig.json')
        .then(function (uiconf) {


            defer.resolve(uiconf);
        })
        .fail(function () {
            defer.reject(new Error());
        });

    return defer.promise;
};


onedriveMusicLibrary.prototype.setUIConfig = function (data) {
};

onedriveMusicLibrary.prototype.updateCredentials = function (data) {
    var self = this;

    self.logger.info("[ elmar-onedrive ] Authenticating now with this code: " + data["AuthCode"]);
    self.getNewAccessToken(data['AuthCode']).then(() => {
        // todo: check whether authentication actually succeeded, we're just assuming here...
        self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully authenticated Onedrive.");
    });
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


onedriveMusicLibrary.prototype.addToBrowseSources = function () {
    var self = this;

    // self.logger.info("[ elmar-onedrive ] start adding browse-sources");

    // Use this function to add your music service plugin to music sources
    var data = {
        name: 'Onedrive',
        uri: 'onedrive',
        plugin_type: 'music_service',
        plugin_name: 'onedrive_music_library',
        icon: "fa fa-cloud"
    };
    this.commandRouter.volumioAddToBrowseSources(data);

    // self.logger.info("[ elmar-onedrive ] done adding browse-sources");
};

onedriveMusicLibrary.prototype.getGraphChildrenPath = function(curUri) {
    if (curUri == 'onedrive') {
        return "/me/drive/root/children";
    } else {
        return "/me/drive/root:" + curUri.replace("onedrive", "") + ":/children";
    }
}

onedriveMusicLibrary.prototype.getGraphPath = function(curUri) {
    if (curUri == 'onedrive') {
        return "/me/drive/root";
    } else {
        return "/me/drive/root:" + curUri.replace("onedrive", "");
    }
}

onedriveMusicLibrary.prototype.getParentUri = function(curUri) {
    if (curUri == 'onedrive') {
        return "/"
    } else {
        return curUri.split('/').slice(0, -1).join('/');
    }
}

onedriveMusicLibrary.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    self.commandRouter.logger.info(curUri);

    if (curUri.startsWith('onedrive')) {
        var promise = libQ.defer();

        var graphPath = this.getGraphChildrenPath(curUri);
        var parentUri = this.getParentUri(curUri);

        self.logger.info("[ elmar-onedrive ] looking at path: " + graphPath);

        this.graphClient.api(graphPath).get().then(
            (rootFolderItems) => {
                // self.logger.info("[ elmar-onedrive ] got the root folder!");
                // self.logger.info(JSON.stringify(rootFolderItems));

                var folderItems = [];
                var audioItems = [];
                var fileItems = [];

                for (var item of rootFolderItems["value"]) {
                    // self.logger.info("[ elmar-onedrive ] " + item.name);
                    if (item.folder) {
                        folderItems.push({
                            "service": "onedrive_music_library",
                            "type": "folder",
                            "title": item.name,
                            "icon": "fa fa-folder-open-o",
                            "uri": curUri + "/" + item.name
                        });
                    } else if (item.audio) {
                        audioItems.push({
                            "service": "onedrive_music_library",
                            "type": "song",
                            "title": item.audio.title ? item.audio.title + " [" + item.name +  "]" : item.name,
                            "icon": "fa fa-music",
                            "uri": curUri + "/" + item.name,
                            "artist": item.audio.artist,
                            "album": item.audio.album
                        });
                    } else if (item.file) {
                        fileItems.push({
                            "service": "onedrive_music_library",
                            "type": "song",
                            "title": item.name,
                            "icon": "fa fa-music",
                            "uri": curUri + "/" + item.name
                        });
                    }
                }

                var contents = {
                    "navigation": {
                        "lists": [{
                                "title": "Folders",
                                "icon": "fa fa-folder",
                                "availableListViews": [
                                    "list",
                                    "grid"
                                ],
                                "items": folderItems
                            },
                            {
                                "title": "Audio Files",
                                "icon": "fa fa-file-audio-o",
                                "availableListViews": [
                                    "list"
                                ],
                                "items": audioItems
                            },
                            {
                                "title": "Other Files",
                                "icon": "fa fa-files-o",
                                "availableListViews": [
                                    "list"
                                ],
                                "items": fileItems
                            }
                        ],
                        "prev": {
                            "uri": parentUri
                        }
                    }
                }
                promise.resolve(contents);
            });
    }
    return promise;
};

// Define a method to clear, add, and play an array of tracks
onedriveMusicLibrary.prototype.clearAddPlayTrack = function(track) {

    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'onedriveMusicLibrary::clearAddPlayTrack');

	return self.mpdPlugin.sendMpdCommand('stop',[])
		.then(function()
		{
			return self.mpdPlugin.sendMpdCommand('clear',[]);
		})
		.then(function()
    {
        return self.mpdPlugin.sendMpdCommand('load "'+track.downloadUri+'"',[]);
    })
    .fail(function (e) {
        return self.mpdPlugin.sendMpdCommand('add "'+track.downloadUri+'"',[]);
    })
		.then(function()
		{
			self.commandRouter.stateMachine.setConsumeUpdateService('mpd', false, false);
			return self.mpdPlugin.sendMpdCommand('play',[]);
		});
};

// Spop stop
onedriveMusicLibrary.prototype.stop = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'onedriveMusicLibrary::stop');

    return self.mpdPlugin.sendMpdCommand('stop',[]);
};

// Spop pause
onedriveMusicLibrary.prototype.pause = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'onedriveMusicLibrary::pause');

    // TODO don't send 'toggle' if already paused
    return self.mpdPlugin.sendMpdCommand('pause',[]);
};

// Spop resume
onedriveMusicLibrary.prototype.resume = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'onedriveMusicLibrary::resume');

    // TODO don't send 'toggle' if already playing
    return self.mpdPlugin.sendMpdCommand('play',[]);
};

onedriveMusicLibrary.prototype.seek = function(position) {
    var self=this;
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'onedriveMusicLibrary::seek');

    return self.mpdPlugin.seek(position);
};

onedriveMusicLibrary.prototype.explodeUri = function(uri) {
    var self = this;
    
    var defer=libQ.defer();

    var graphPath = this.getGraphPath(uri);
    self.commandRouter.pushConsoleMessage("getting data from: " + graphPath);
    

        this.graphClient.api(graphPath).get().then((item) => {
        // If folder, return all items in the folder as tracks:
        if (item.folder){
            var graphChildrenPath = graphPath + ":/children";
            this.graphClient.api(graphChildrenPath).get().then((fileItems) => {
                var tracks = [];
                for (var fileItem of fileItems["value"]) {
                    if (fileItem.audio) {
                        tracks.push(this.getTrackFromOnedriveFileItem(fileItem, uri));
                    }
                }
                defer.resolve(tracks);
            });
        }
        else {
            // Else, simply return the file as a track.

            self.commandRouter.pushConsoleMessage(item);
            defer.resolve([this.getTrackFromOnedriveFileItem(item, uri)]);
        }
    });



    return defer.promise;
};

onedriveMusicLibrary.prototype.getTrackFromOnedriveFileItem = function(item, uri) {
    return {
                uri: uri,
                service: 'onedrive_music_library',
                type: "track",
                name:  item.audio ? (item.audio.title ? item.audio.title + " [" + item.name +  "]" : item.name) : item.name,
                title: item.audio ? (item.audio.title ? item.audio.title + " [" + item.name +  "]" : item.name) : item.name,
                icon: "fa fa-music",
                downloadUri: item["@microsoft.graph.downloadUrl"],
                artist: item.audio ? item.audio.artist : "",
                album: item.audio ? item.audio.album : "",
                tracknumber: item.audio ? item.audio.track : null,
                duration: item.audio ? item.audio.duration: null
            }
}

onedriveMusicLibrary.prototype.connectMSGraph = function () {
    var self = this;

    return MicrosoftGraph.Client.init({
        authProvider: (done) => {
            self.updateAccessToken().then(token => done(null, token));
        }
    });
}

onedriveMusicLibrary.prototype.getNewAccessToken = function (authorizationCode) {
    var self = this;
    var tokenUrl = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

    var promise = libQ.defer();

    var postBody = "client_id=" + encodeURIComponent(authInfo.clientId) +
        "&scope=" + encodeURIComponent(authInfo.scope) +
        "&code=" + encodeURIComponent(authorizationCode) +
        "&redirect_uri=" + encodeURIComponent(authInfo.redirectUri) +
        "&grant_type=" + encodeURIComponent("authorization_code");

    // self.logger.info("[ elmar-onedrive ] post: " + postBody);

    request.post(tokenUrl, {
            body: postBody,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        },
        (error, response, responseBody) => {
            // self.logger.info("[ elmar-onedrive ] response-body is: " + responseBody);
            // self.logger.info("[ elmar-onedrive ] response is: " + response);
            // self.logger.info("[ elmar-onedrive ] error is: " + error);
            var tokenResponse = JSON.parse(responseBody);
            authInfo.accessToken = tokenResponse.access_token;
            authInfo.refreshToken = tokenResponse.refresh_token;
            authInfo.accessExpires = Date.now() + (tokenResponse.expires_in * 1000);
            self.config.set("refreshToken", tokenResponse.refresh_token);
            promise.resolve(tokenResponse.access_token);
        });

    return promise;
}

onedriveMusicLibrary.prototype.refreshAccessToken = function () {
    var self = this;
    var tokenUrl = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

    var promise = libQ.defer();

    var postBody = "client_id=" + encodeURIComponent(authInfo.clientId) +
        "&scope=" + encodeURIComponent(authInfo.scope) +
        "&refresh_token=" + encodeURIComponent(authInfo.refreshToken) +
        "&redirect_uri=" + encodeURIComponent(authInfo.redirectUri) +
        "&grant_type=" + encodeURIComponent("refresh_token");

    // self.logger.info("[ elmar-onedrive ] post: " + postBody);

    request.post(tokenUrl, {
            body: postBody,
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        },
        (error, response, responseBody) => {
            // self.logger.info("[ elmar-onedrive ] response-body is: " + responseBody);
            // self.logger.info("[ elmar-onedrive ] response is: " + response);
            // self.logger.info("[ elmar-onedrive ] error is: " + error);
            var tokenResponse = JSON.parse(responseBody);
            authInfo.accessToken = tokenResponse.access_token;
            authInfo.refreshToken = tokenResponse.refresh_token;
            authInfo.accessExpires = Date.now() + (tokenResponse.expires_in * 1000);
            self.config.set("refreshToken", tokenResponse.refresh_token);
            promise.resolve(tokenResponse.access_token);
        });
    return promise;
}

onedriveMusicLibrary.prototype.updateAccessToken = function () {
    var self = this;

    // self.logger.info("[ elmar-onedrive ] update access token (Current time: " + Date.now().toString() + ", expiration time: " + authInfo.accessExpires.toString() + ")");

    if (authInfo.refreshToken) {
        if (Date.now() < authInfo.accessExpires) {
            // We still have a valid access token
            return libQ.resolve(authInfo.accessToken);
        }

        self.logger.info("[ elmar-onedrive ] refreshing access token");
        return self.refreshAccessToken();
    } else {
        self.commandRouter.pushToastMessage('error', "Need new authorization", "Onedrive is no longer signed in. Go to settings page to get new authorization token.");
    }
}