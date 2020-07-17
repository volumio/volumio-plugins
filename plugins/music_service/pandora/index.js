/* jshint node: true, esversion: 6, unused: false */
'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

// var url = require('url');
var dnsSync = require('dns-sync');
var anesidora = require('anesidora');

const { defer, setNextTickFunction } = require('kew');
const { REFUSED, SERVFAIL } = require('dns');
const { get } = require('https');
const { setFlagsFromString } = require('v8');


module.exports = ControllerPandora;
function ControllerPandora(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
    this.configManager = this.context.configManager;

    self.serviceName = 'pandora';
    self.currStation = {};
    self.lastUri = null;
}


ControllerPandora.prototype.onVolumioStart = function () {
	// var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
};

ControllerPandora.prototype.onStart = function () {
    var self = this;

    // loaded values may be type boolean or type string
    function validateBoolean (boolVar) {
        if (typeof boolVar === 'boolean') {
            return boolVar;
        }
        if (typeof boolVar === 'string') {
            return (boolVar == 'true');
        }
    }

    let loginData = {
        email: self.config.get('email'),
        password: self.config.get('password'),
        isPandoraOne: validateBoolean(self.config.get('isPandoraOne')),
        loggedIn: false
    };

    self.useCurl302WorkAround = validateBoolean(self.config.get('useCurl302WorkAround'));

    self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

    return self.checkConfValidity(loginData)
        .fail(err => {
            self.logError('Invalid Pandora Configuration', err);
            self.commandRouter.pushToastMessage('error',
                                        'Pandora Configuration',
                                        'Pandora failed to start.  Invalid configuration.');

            return self.generalReject('checkConfValidity', err);
        })
        .then(() => self.initialSetup(loginData))
        .fail(err => {
            self.logError('initialSetup error: ' + err);
            self.commandRouter.pushToastMessage('error',
                                    'Pandora',
                                    'Initial Pandora Setup failed.  Check configuration.');

            return self.generalReject('Failure to get stations.  Check configuration: ' + err);
        })
        .then(() => self.addToBrowseSources());
};

ControllerPandora.prototype.onStop = function () {
    // Once the Plugin has successfull stopped resolve the promise
    var self = this;

    return self.flushPandora()
        .then(() => self.mpdPlugin.sendMpdCommand('stop', []))
        .then(() => self.mpdPlugin.sendMpdCommand('clear', []))
        .then(() => self.commandRouter.volumioRemoveToBrowseSources(self.serviceName));
};

ControllerPandora.prototype.onRestart = function () {
    var self = this;
    // Optional, use if you need it
};

// Setup Methods -----------------------------------------------------------------------------

ControllerPandora.prototype.flushPandora = function () {
    var self = this;

    self.announceFn('flushPandora');

    let oldQ = self.commandRouter.stateMachine.getQueue();
    let newQ = oldQ.filter(item => item.service !== self.serviceName);

    if (newQ.length > 0) {
        self.commandRouter.stateMachine.playQueue.clearAddPlayQueue(newQ);
    }
    else {  
        self.commandRouter.stateMachine.playQueue.clearPlayQueue();
    }
    return libQ.resolve();
};

ControllerPandora.prototype.initialSetup = function (loginData) {
    var self = this;

    self.announceFn('initialSetup');

    if (self.pandoraHandler === undefined) {
        self.pandoraHandler = new PandoraHandler(self, loginData);
    }

    return self.pandoraHandler.pandoraLoginAndGetStations()
        .then(() => self.pandoraHandler.fillStationData())
        .then(() => self.flushPandora());
};

// Configuration Methods -----------------------------------------------------------------------------

ControllerPandora.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(uiconf => {
            uiconf.sections[0].content[0].value = self.config.get('email', '');
            uiconf.sections[0].content[1].value = self.config.get('password', '');
            uiconf.sections[0].content[2].value = self.config.get('isPandoraOne', '');
            uiconf.sections[1].content[0].value = self.config.get('useCurl302WorkAround', '');
            self.config.get();

            defer.resolve(uiconf);
        })
        .fail(err => {
            defer.reject(new Error('[Pandora] Failed to load UIConfig.json' + err));
        });

    return defer.promise;
};

ControllerPandora.prototype.getConfigurationFiles = function () {
	return ['config.json'];
};

ControllerPandora.prototype.setUIConfig = function (data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerPandora.prototype.getConf = function (varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerPandora.prototype.setAccountConf = function (options) {
	var self = this;

    self.config.set('email', options.email);
    self.config.set('password', options.password);
    self.config.set('isPandoraOne', options.isPandoraOne);
    let loginInfo = ({
        email: options.email,
        password: options.password,
        isPandoraOne: options.isPandoraOne
    });
    
    return self.checkConfValidity(loginInfo)
        .then(() => self.commandRouter.pushToastMessage('success', 'Pandora',
            'Login info saved.  If already logged in, restart plugin.'))
        .fail(err => self.generalReject('setAccountConf', err));
};

ControllerPandora.prototype.setOptionsConf = function (options) {
	var self = this;

    self.config.set('useCurl302WorkAround', options.useCurl302WorkAround);
    self.useCurl302WorkAround = options.useCurl302WorkAround;

    return self.checkConfValidity()
        .then(() => self.commandRouter.pushToastMessage('success', 'Pandora', 'Plugin options saved.'))
        .fail(err => self.generalReject('setOptionsConf',  err));
};

// checks Pandora plugin configuration validity
ControllerPandora.prototype.checkConfValidity = function (loginData) {
    var self = this;

    self.announceFn('checkConfValidity');

    if (!loginData.email || !loginData.password) { // not configured
        self.logError('Missing email or password');
        self.commandRouter.pushToastMessage('error',
                            'Pandora',
                            'Need email address and password. See plugin settings.');

        return libQ.reject(new Error('[Pandora] Need both email and password.'));
    }

    return self.initialSetup(loginData);
};

// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it

// Use this function to add your music service plugin to music sources
ControllerPandora.prototype.addToBrowseSources = function () {
    var data = {
        name: 'Pandora Radio',
        uri: '/pandora',
        albumart: '/albumart?sourceicon=music_service/pandora/pandora.png',
        icon: 'fa fa-microphone',
        plugin_type: 'music_service',
        plugin_name: 'pandora'
    };

    return this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerPandora.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    var staRe = new RegExp(/\/pandora\/station_id=(\d+)$/);
    var stationData = self.pandoraHandler.getStationData();

    var response = {
        navigation: {
            'prev': { uri: '/pandora' },
            'lists': [
                {
                    'availableListViews': ['list'],
                    'items': []
                }
            ]
        }
    };

    self.announceFn('handleBrowseUri');

    if (curUri === '/pandora') {
        for (let i in stationData) {
            response.navigation.lists[0].items.push({
                service: self.serviceName,
                type: 'station',
                artist: '',
                title: stationData[i].name,
                name: stationData[i].name,
                album: '',
                albumart: stationData[i].albumart,
                icon: 'fa fa-folder-open-o',
                uri: '/pandora/station_id=' + i
            });
        }

        return libQ.resolve(response);
    }
    else if (curUri.match(staRe) !== null) {
        let newStationId = curUri.match(staRe)[1];

        self.currStation.id = newStationId;
        self.currStation.name = stationData[newStationId].name;

        return self.flushPandora()
            .then(() => self.pandoraHandler.fetchTracks())
            .then(() => {
                self.lastUri = null;
                let newTracks = self.pandoraHandler.getNewTracks();

                response.navigation.lists[0].items = newTracks.map(item => ({
                    service: self.serviceName,
                    type: 'song',
                    artist: item.artist,
                    title: item.title,
                    name: item.name,
                    album: item.album,
                    albumart: item.albumart,
                    icon: 'fa fa-music',
                    uri: item.uri
                }));

                response.navigation.prev.uri = curUri;

                if (newTracks.length > 0) {
                    return libQ.resolve(response);
                }
                else {
                    return self.generalReject('handleBrowseUri',
                                        'failed to load tracks from ' +
                                        self.currStation.name);
                }
            });
    }
    else {
        return self.generalReject('handleBrowseUri', 'failed to match uri: ' + curUri);
    }
};

// // Removes Pandora tracks from other stations from Volumio queue.
// // Promotes current Pandora station tracks.
// // Keeps queue items from other services.
// ControllerPandora.prototype.pruneOtherStations = function () {
//     var self = this;
//     let oldQ = self.commandRouter.stateMachine.playQueue.getQueue();
//     let newQ = oldQ.filter(item => item.station === self.currStation.name)
//                .concat(oldQ.filter(item => item.service !== self.serviceName));

//     if (newQ.length > 0) {
//         return self.commandRouter.stateMachine.playQueue.clearAddPlayQueue(newQ);
//     }
//     else {
//         return self.commandRouter.stateMachine.playQueue.clearQueue();
//     }
// };

// add tags to newTracks and add to mpd queue
ControllerPandora.prototype.appendTracksToMpd = function (newTracks) {
    var self = this;
    var defer = libQ.defer();

    self.announceFn('appendTracksToMpd');

    // resolve address to numeric IP by DNS lookup
    function resolveUri(uri) {
        let fnName = 'appendTracksToMpd::resolveUri';

        try {
            let start = uri.indexOf('//') + 2;
            let host = uri.substr(start, uri.indexOf('/', start) - start);
            let result = uri.replace(host, dnsSync.resolve(host));

            self.logInfo(fnName + ': ' + uri + ' => ' + result);

            return libQ.resolve(result);
        } catch (err) {
            self.logError(fnName + ' error: ', err);
            self.commandRouter.pushToastMessage('error', 'Pandora', fnName + ' error');

            return self.generalReject(fnName, err);
        }
    }

    function setTrackTags(input) {
        (() => self.useCurl302WorkAround ? resolveUri(input.realUri) : libQ.resolve(input.realUri))()
            .then(endUri => self.mpdPlugin.sendMpdCommand('addid', [endUri]))
            .then(result => {
                let tagUpdateCmds = [
                    { command: 'addtagid', parameters: [result.Id, 'artist', input.artist] },
                    { command: 'addtagid', parameters: [result.Id, 'album', input.album] },
                    { command: 'addtagid', parameters: [result.Id, 'title', input.title] }
                ];

                return self.mpdPlugin.sendMpdCommandArray(tagUpdateCmds);
            });
    }

    let promises = [];
    newTracks.forEach(item => promises.push(setTrackTags(item)));
    self.logInfo('appendTracksToMpd added ' +
                  newTracks.length +
                 ' track(s) to mpd');

    libQ.all(promises)
        .then(() => defer.resolve())
        .fail(err => {
            self.logError('Error in appendTracksToMpd', err);
            defer.reject(self.pandoraPrefix() + 'appendTracksToMpd error: ' + err);
        });

    return defer.promise;
};

ControllerPandora.prototype.findQueueIndex = function (uri) {
    var self = this;
    let Q = self.commandRouter.stateMachine.playQueue.getQueue();

    return Q.findIndex(item => item.uri === uri);
};

ControllerPandora.prototype.removeTrack = function (uri) {
    var self = this;

    self.announceFn('removeTrack');

    if (uri !== null) {
       self.commandRouter.stateMachine.removeQueueItem({value: self.findQueueIndex(uri)});
    }
    return libQ.resolve();
};

ControllerPandora.prototype.getQueueTrack = function () {
    var self = this;
    return self.commandRouter.stateMachine.getTrack(self.commandRouter.stateMachine.currentPosition);
};

// this callback runs after mpd player starts playing
ControllerPandora.prototype.pandoraListener = function () {
    var self = this;

    let fnName = 'pandoraListener';

    self.announceFn(fnName);

    self.mpdPlugin.getState()
        .then(state => {
                let nextTrack = self.getQueueTrack();
                self.lastUri = nextTrack.uri;

                if (self.commandRouter.stateMachine.getNextIndex() != 0) { // not last track in queue
                    if (nextTrack.service && nextTrack.service === self.serviceName) {
                        self.mpdPlugin.clientMpd.once('system-player', self.pandoraListener.bind(self));
                        
                        return self.pushState(state);
                    }
                    else {
                        self.logInfo(fnName + ' Not a Pandora track, removing listener');
                    }
                }
                else {
                    self.logInfo(fnName + ' Last track in queue, removing listener');
                }
        });
};

// Define a method to clear, add, and play an array of tracks
ControllerPandora.prototype.clearAddPlayTrack = function (track) {
    var self = this;
    let fnName = 'clearAddPlayTrack';

    self.announceFn(fnName);

    // Here we go! (¡Juana's Adicción!)
    return self.mpdPlugin.sendMpdCommand('clear', [])
        .then(() => self.appendTracksToMpd([track]))
        .then(() => self.removeTrack(self.lastUri))
        .then(() => {
            self.mpdPlugin.clientMpd.removeAllListeners('system-player');
            self.mpdPlugin.clientMpd.once('system-player', self.pandoraListener.bind(self));

            return self.mpdPlugin.sendMpdCommand('play', []);
        })
        .then(() => self.mpdPlugin.getState())
        .then(state => self.pushState(state))
        .then(() => {
            return self.pandoraHandler.fetchTracks()
                .then(() => {
                    let newTracks = self.pandoraHandler.getNewTracks();
                    let count = newTracks.length;
                    if (count > 0) {
                        self.logInfo(fnName + ': PandoraHandler::fetchTracks fetched ' + count + ' track(s)');

                        return self.commandRouter.stateMachine.playQueue.addQueueItems(newTracks);
                    }
                });
        })
        .fail(err => self.generalReject('clearAddPlayTrack', err));
};

ControllerPandora.prototype.revisitPlayLoop = function (newPos) {
    var self = this;

    self.lastUri = self.getQueueTrack().uri;
    self.mpdPlugin.clientMpd.removeAllListeners('system-player');

    return self.mpdPlugin.stop()
        .then(() => {
            self.commandRouter.stateMachine.currentPosition = newPos;

            return libQ.resolve(self.getQueueTrack());
        })
        .then(track => self.clearAddPlayTrack(track));
};

// ControllerPandora.prototype.seek = function (position) {
//     var self = this;
    
//     // self.announceFn('seek to ' + position);
    
//     // return self.mpdPlugin.seek(position);
// };

// Stop
ControllerPandora.prototype.stop = function () {
	var self = this;

    self.announceFn('stop');

    self.lastUri = null;
    self.mpdPlugin.clientMpd.removeListener('system-player', self.pandoraListener);

    return self.mpdPlugin.stop()
        .then(() => self.mpdPlugin.getState())
        .then(state => self.pushState(state));
};

// Spop pause
ControllerPandora.prototype.pause = function () {
    var self = this;

    self.announceFn('pause');

    return self.mpdPlugin.pause()
        .then(() => self.mpdPlugin.getState())
        .then(state => self.mpdPlugin.pushState);
};

ControllerPandora.prototype.resume = function () {
    var self = this;

    self.announceFn('resume');

    return self.mpdPlugin.resume()
        .then(() => self.mpdPlugin.getState())
        .then(state => self.pushState(state));
};

ControllerPandora.prototype.previous = function () {
    var self = this;

    self.announceFn('previous');

    let pos = self.commandRouter.stateMachine.currentPosition;
    let newPos = pos > 0 ? pos - 1 : self.commandRouter.stateMachine.playQueue.arrayQueue.length - 1;

    return this.revisitPlayLoop(newPos);
};

ControllerPandora.prototype.next = function () {
    var self = this;

    self.announceFn('next');

    let pos = self.commandRouter.stateMachine.currentPosition;
    let newPos = pos == self.commandRouter.stateMachine.playQueue.arrayQueue.length - 1 ? 0 : pos + 1;

    return self.revisitPlayLoop(newPos);
};

ControllerPandora.prototype.pushState = function (state) {
    var self = this;

    self.announceFn('pushState');

    let pState = state;
    pState.trackType = 'mp3';
    pState.bitdepth = '16 bit';

    self.commandRouter.servicePushState(pState, self.serviceName);
    
    return self.commandRouter.stateMachine.setConsumeUpdateService('pandora');
};

ControllerPandora.prototype.explodeUri = function (uri) {
    // Mandatory: retrieve all info for a given URI
    var self = this;
    let uriMatch = uri.match(/\/pandora\/station_id=(\d+)\/track_id=\d+/);

    self.announceFn('explodeUri');

    if (uriMatch !== null) {
        // return a one elememnt track object array
        let Q = self.commandRouter.stateMachine.playQueue.getQueue();
        let tracks = Q.concat(self.pandoraHandler.getNewTracks());
        let response = tracks.filter(item => item.uri === uri).slice(0, 1);

        return libQ.resolve(response);
    }

    self.commandRouter.pushToastMessage('error', 'Pandora', 'Please clear old Pandora tracks from last session.');

    return self.generalReject('explodeUri could not resolve uri: ' + uri);
};

ControllerPandora.prototype.search = function (query) {
    // Mandatory, search. You can divide the search in sections using following functions
    var self = this;

	return libQ.resolve();
};

ControllerPandora.prototype._searchArtists = function (results) {

};

ControllerPandora.prototype._searchAlbums = function (results) {

};

ControllerPandora.prototype._searchPlaylists = function (results) {


};

ControllerPandora.prototype._searchTracks = function (results) {

};

// Logging helper functions --------------------------------------------------------------------------------

ControllerPandora.prototype.pandoraPrefix = function() {
    var self = this;
    return self.datePrefix() +  '[Pandora] ';
};

ControllerPandora.prototype.datePrefix = function() {
    // var self = this;
    return '[' + Date.now() + '] ';
};

ControllerPandora.prototype.logInfo = function (msg) {
    var self = this;
    return self.logger.info(self.pandoraPrefix() + msg);
};

ControllerPandora.prototype.logError = function (msg, err) {
    var self = this;

    let errMsg = self.pandoraPrefix() + msg;
    if (err !== undefined) {
        errMsg += ': ' + err;
    }
    return self.logger.error(errMsg);
};

ControllerPandora.prototype.generalReject = function (msg, err) {
    var self = this;

    let rejection = self.pandoraPrefix() + msg;
    if (err !== undefined) {
        msg += ' error: ' + err;
    }
    return libQ.reject(new Error(rejection));
};

ControllerPandora.prototype.announceFn = function(fnName) {
    var self = this;
    return self.commandRouter.pushConsoleMessage(self.datePrefix() + 'ControllerPandora::' + fnName);
};

function PandoraHandler(self, loginData) {
    var pandora = {};
    var loggedIn = false;
    var stationList = {}; // raw stationList object
    var stationData = []; // array of basic station info
    var newTracks = [];

    PandoraHandler.prototype.init = function (loginData) {
        let partnerInfo = null;
        const pandoraOnePartnerInfo = {
            'username': 'pandora one',
            'password': 'TVCKIBGS9AO9TSYLNNFUML0743LH82D',
            'deviceModel': 'D01',
            'decryptPassword': 'U#IO$RZPAB%VX2',
            'encryptPassword': '2%3WCL*JU$MP]4'
        };

        self.announceFn('PandoraHandler::init');

        if (loginData.isPandoraOne) {
            partnerInfo = pandoraOnePartnerInfo;
        }

        pandora = new anesidora(loginData.email,
                                loginData.password,
                                partnerInfo);

        return libQ.resolve();
    };

    PandoraHandler.prototype.getNewTracks = function () {
        return newTracks;
    };

    PandoraHandler.prototype.getStationData = function () {
        return stationData;
    };

    PandoraHandler.prototype.pandoraLoginAndGetStations = function () {
        self.announceFn('PandoraHandler::pandoraLoginAndGetStations');

        // Login with pandora anesidora object
        function pandoraLogin() {
            let defer = libQ.defer();

            pandora.login(defer.makeNodeResolver());

            return defer.promise;
        }

        // Retrieve a raw Pandora station list object
        function getStationList() {
            let defer = libQ.defer();

            pandora.request('user.getStationList', {
                    includeStationArtUrl: true
                }, defer.makeNodeResolver());

            return defer.promise;
        }

        return pandoraLogin()
            .fail(err => {
                if (err === 1011) {
                    self.logError('Invalid Username');
                    self.commandRouter.pushToastMessage('error',
                                                'Pandora Login Error',
                                                'Invalid Username');
                       return self.generalReject('Invalid Username: ' + loginData.email);
                }
                else if (err === 1012) {
                    self.logError('Invalid Password');
                    self.commandRouter.pushToastMessage('error',
                                                'Pandora Login Error',
                                                'Invalid Password');
                    return self.generalReject('Invalid Password: ' + loginData.password);
                }
                else {
                    let infoMsg = ' See https://6xq.net/pandora-apidoc/json/errorcodes/';
                    self.logError('Other Login Error', err + '\n' + infoMsg);
                    self.commandRouter.pushToastMessage('error',
                                                'Pandora Login Error',
                                                'Other Login Error: ' + err);
                    return self.generalReject('Other login error: ' + err);
                }
            })
            .then(() => {
                if (!loggedIn) {
                    loggedIn = true;
                    self.logInfo('Logged in');
                    self.commandRouter.pushToastMessage('success',
                                                        'Pandora',
                                                        'Successful Pandora Login');
                }

                return getStationList()
                    .then(result => {
                        stationList = result;

                        return libQ.resolve();
                    });

                // fetch list in background
                // let getStationListDefer = getStationList();
                // getStationListDefer.then(result => {
                //     stationList = result;
                // });

                // return libQ.resolve();
            });
    };

    PandoraHandler.prototype.fillStationData = function () {
        let fnName = 'PandoraHandler::fillStationData';

        self.announceFn(fnName);

        if (stationList.stations.length > 0) {
            stationData = stationList.stations.map(item => ({
                name: item.stationName,
                albumart: item.artUrl
            }));

            return libQ.resolve();
        }
        else {
            self.logError('Error in ' + fnName,
                          'stationList is empty');
            self.commandRouter.pushToastMessage('error',
                                                'Pandora',
                                                'Error in fillStationData');

            return self.generalReject(fnName, 'stationList is empty');
        }
    };

    PandoraHandler.prototype.fetchTracks = function () {
        let fnName = 'PandoraHandler::fetchTracks';
        let Q = self.commandRouter.stateMachine.playQueue.getQueue();
        const maxQ = 20;  // stop requesting tracks after we have this many

        // Retrieve a raw Pandora playlist from a Pandora station index
        // This may fail because Pandora login is stale.
        function fetchStationPlaylist() {
            var station = stationList.stations[self.currStation.id];
            var defer = libQ.defer();

            self.announceFn(fnName + '::fetchStationPlaylist');

            pandora.request('station.getPlaylist', {
                'stationToken': station.stationToken,
                'additionalAudioUrl': 'HTTP_128_MP3',
                'includeTrackLength': true
                }, defer.makeNodeResolver());

            return defer.promise;
        }

        // Retrieve an array of tracks from a raw Pandora playlist object
        function fillNewTracks(playlist) {
            const maxFetch = 4; // number of songs to fetch from servers
            let baseNameMatch = new RegExp(/\/access\/(\d+)/);

            self.announceFn(fnName + '::fillNewTracks');

            newTracks = [];

            for (let i = 0; i < maxFetch; i++) {
                let track = playlist.items[i];
                let baseName = track.additionalAudioUrl.match(baseNameMatch)[1];
                let uri = '/pandora/station_id=' + self.currStation.id +
                          '/track_id=' + baseName;

                if (!Q.map(item => item.uri).includes(uri)) {
                    newTracks.push({
                        service: self.serviceName,
                        type: 'song',
                        trackType: 'mp3',
                        station: self.currStation.name,
                        title: track.songName,
                        name: track.songName,
                        artist: track.artistName,
                        album: track.albumName,
                        albumart: track.albumArtUrl,
                        uri: uri,
                        realUri: track.additionalAudioUrl,
                        isStreaming: true,
                        duration: track.trackLength,
                        samplerate: '44.1 KHz',
                        bitdepth: '16 bit',
                        channels: 2
                    });
                }
            }

            return libQ.resolve();
        }

        self.announceFn(fnName);

        return fetchStationPlaylist()
            .fail(err => {
                self.logError('Error in ' + fnName + '::fetchStationPlaylist', err);
                return self.generalReject(fnName + '::fetchStationPlaylist', err);
            })
            .then(playlist => {
                if (Q.length <= maxQ) {
                    return fillNewTracks(playlist)
                        .then(() => {
                            if (newTracks.length == 0) {
                                self.logError(fnName + '::fillNewTracks returned zero tracks!');
                            }
                        });
                }
                else {
                    return libQ.resolve();
                }
            })
            .fail(err => {
                self.logError('Error in ' + fnName + '::fillNewTracks', err);
                return self.generalReject(fnName + '::fillNewTracks', err);
            });
    };

    this.init(loginData);
}