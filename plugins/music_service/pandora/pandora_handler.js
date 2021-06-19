/* jshint node: true, esversion: 9, unused: false */
'use strict';

var anesidora = require('anesidora');
var fs = require('fs-extra');
var libQ = require('kew');
const {PUtil} = require('./helpers');
const {serviceName, uriParts, uriPrefix} = require('./common');

const phName = 'PandoraHandler';

function PandoraHandler(context) {
    this.context = context;
    this.logger = this.context.logger;
    this.commandRouter = this.context.commandRouter;
}

PandoraHandler.prototype.init = function () {
    const self = this;
    const fnName = 'init';

    self.pUtil = new PUtil(self, phName);

    self.pUtil.announceFn(fnName);

    self.pandora = null;
    self.loggedIn = false;
    self.stationList = {}; // raw stationList object
    self.stationData = {}; // array of basic station info
    self.newTracks = [];

    return self.loadErrorCodes();
};

PandoraHandler.prototype.loadErrorCodes = function () {
    const self = this;
    const fnName = 'loadErrorCodes';
    const errorFile = '/errorcodes.json';

    self.pUtil.announceFn(fnName);

    self.errorCodes = fs.readJSONSync(__dirname + errorFile);

    return libQ.resolve();
};

PandoraHandler.prototype.setAccountOptions = function (email, password, isPandoraOne) {
    const self = this;
    const fnName = 'setAccountOptions';
    const pInfo = {
        regular: {
            username: 'android',
            password: 'AC7IBG09A3DTSYM4R41UJWL07VLN8JI7',
            deviceModel: 'android-generic',
            decryptPassword: 'R=U!LH$O2B#',
            encryptPassword: '6#26FRL$ZWD'
        },
        premium: {
            username: 'pandora one',
            password: 'TVCKIBGS9AO9TSYLNNFUML0743LH82D',
            deviceModel: 'D01',
            decryptPassword: 'U#IO$RZPAB%VX2',
            encryptPassword: '2%3WCL*JU$MP]4'
        }
    };

    self.pUtil.announceFn(fnName);

    self.isPandoraOne = isPandoraOne;

    let partnerInfo = self.isPandoraOne ?
        pInfo.premium : pInfo.regular;

    if (self.pandora == null) {
        self.pandora = new anesidora(
            email,
            password,
            partnerInfo
        );
    }
    else {
        self.pandora.username = email;
        self.pandora.password = password;
        self.pandora.partnerInfo = partnerInfo;
        self.pandora.partnerInfo.version = '5';
        self.pandora.authData = null;
    }

    return libQ.resolve();
};

PandoraHandler.prototype.getNewTracks = function () {
    const self = this;
    return libQ.resolve(self.newTracks);
};

PandoraHandler.prototype.getStationData = function () {
    const self = this;
    return libQ.resolve(self.stationData);
};

// Parses raw '%'-delimited string and sets bandFilter
PandoraHandler.prototype.setBandFilter = function (bf) {
    const self = this;
    self.bandFilter = bf.split('%');
    const setbfTo = bf.length > 0 ? JSON.stringify(self.bandFilter) : 'bandfilter is empty';
    self.pUtil.logInfo('setBandFilter', setbfTo);
    return libQ.resolve();
};

PandoraHandler.prototype.setMaxStationTracks = function (maxTracks) {
    const self = this;
    self.maxStationTracks = maxTracks;
    self.pUtil.logInfo('setMaxStationTracks', maxTracks);
    return libQ.resolve();
};

PandoraHandler.prototype.setMQTTEnabled = function (mqttEnabled) {
    const self = this;
    self.mqttEnabled = mqttEnabled;

    if (self.mqttEnabled) {
        return self.context.stationDataHandler.init();
    }
    else if (typeof(self.context.stationDataHandler) !== 'undefined'){
        return self.context.stationDataHandler.stop();
    }
    
    return libQ.resolve();
};

PandoraHandler.prototype.getSongMaxDiff = function () {
    const self = this;
    return self.context.getStationTracks(self.context.currStation.stationToken)
        .then(stationQ => {
            const result = stationQ.length - self.maxStationTracks;
            self.pUtil.logInfo('getSongMaxDiff', result);
            return libQ.resolve(result);
        });
};

PandoraHandler.prototype.reportAPIError = function (fnName, pandoraErr) {
    const self = this;
    const errMsg = pandoraErr.message;
    const errMatch = errMsg.match(/\[(\d+)\]/);
    const code = (errMatch !== null) ? errMatch[1] : 'unknown';
    let decoded = (code === 'unknown') ?
        'Unknown Error: ' + errMsg : '[Error ' + code + '] ' +
        self.errorCodes[code];
    const retry_codes = ['0', '1003'];
    const msg_retry = 'Try again in a few hours. ' +
        'Check status at https://pandora.com';

    self.pUtil.logError(fnName, ' Error: ' + decoded);
    self.commandRouter.pushToastMessage(
        'error', phName, decoded);

    if (retry_codes.includes(code)) {
        self.pUtil.timeOutToast('reportAPIError', 'info',
            phName, msg_retry, 5000);
    }

    return libQ.resolve();
};

// Retrieve a raw Pandora station list object
PandoraHandler.prototype.getStationList = function () {
    const self = this;
    let defer = libQ.defer();

    self.pandora.request('user.getStationList', {
            includeStationArtUrl: true
        }, defer.makeNodeResolver());

    return defer.promise;
};

PandoraHandler.prototype.pandoraLoginAndGetStations = function () {
    const self = this;
    const fnName = 'pandoraLoginAndGetStations';
    self.pUtil.announceFn(fnName);

    // Login with pandora anesidora object
    function pandoraLogin() {
        let defer = libQ.defer();

        self.pandora.login(defer.makeNodeResolver());

        return defer.promise;
    }

    return pandoraLogin()
        .fail(err => {
            const subFnName = fnName + '::pandoraLogin';
            self.reportAPIError(subFnName, err);

            return self.pUtil.generalReject(subFnName, err);
        })
        .then(() => {
            let bookendMsg = '[<=- * -=>]';
            let msg = 'Successful Pandora Login';
            let logMsg = 'Logged in to Pandora Servers';
            if (!self.loggedIn) {
                self.loggedIn = true;
            }
            else {
                msg = 'Refreshed Pandora Login';
                logMsg = msg;
            }

            self.pUtil.logInfo(fnName + '::pandoraLogin', bookendMsg.replace('*', logMsg));
            self.commandRouter.pushToastMessage('success', 'Pandora Login', msg);

            return libQ.resolve();
        });
};

PandoraHandler.prototype.fillStationData = function () {
    const self = this;
    const fnName = 'fillStationData';
    self.pUtil.announceFn(fnName);

    return self.getStationList()
        .fail(err => {
            const subFnName = fnName + '::getStationlist';
            self.reportAPIError(subFnName, err);

            return self.pUtil.generalReject(subFnName, err);
        })
        .then(result => {
            self.stationList = result;

            if (self.stationList.stations.length > 0) {
                self.stationData = {};

                for (let i = 0; i < self.stationList.stations.length; i++) {
                    const {
                        stationToken,
                        stationName,
                        artUrl,
                        // dateCreated
                    } = self.stationList.stations[i];
                    self.stationData[stationToken] = {
                        id: i,
                        name: stationName,
                        albumart: artUrl
                        // dateCreated: dateCreated.time // already in decr. date order
                    };
                }

                return libQ.resolve();
            }
            else {
                self.pUtil.logError(fnName, 'self.stationList is empty');
                self.commandRouter.pushToastMessage('error',
                                                    phName,
                                                    fnName + ' error');

                return self.pUtil.generalReject(fnName, 'self.stationList is empty');
            }
        })
        .then(() => {
            if (self.mqttEnabled) {
                return self.publishStationData();
            }
        });
};

PandoraHandler.prototype.publishStationData = function () {
    const self = this;
    const fnName = 'publishStationData';
    self.pUtil.announceFn(fnName);

    let stationDataNoRadio = Object.assign({}, self.stationData);
    for (const key of Object.keys(stationDataNoRadio)) {
        const newStationName = stationDataNoRadio[key].name.replace(' Radio', '');
        stationDataNoRadio[key].name = newStationName; 
    }
    return self.context.mqttHandler.publishData(stationDataNoRadio, 'stationData');
};

PandoraHandler.prototype.fetchTracks = function () {
    const self = this;
    const fnName = 'fetchTracks';
    const fnFSPName = fnName + '::fetchStationPlaylist';
    const fnFNTName = fnName + '::fillNewTracks';

    const currStationToken = self.context.currStation.stationToken;

    // Retrieve a raw Pandora playlist from a Pandora station index
    function fetchStationPlaylist() {
        var defer = libQ.defer();

        self.pUtil.announceFn(fnFSPName);

        self.pandora.request('station.getPlaylist', {
            'stationToken': currStationToken,
            'additionalAudioUrl': 'HTTP_128_MP3',
            'includeTrackLength': true
            }, defer.makeNodeResolver());

        return defer.promise;
    }

    // Retrieve an array of tracks from a raw Pandora playlist object
    function fillNewTracks(playlist) {
        const Q = self.context.getQueue();
        const trackIdRE = /\/access\/(\d+)/;

        self.pUtil.announceFn(fnFNTName);

        for (let i = 0; i < playlist.items.length; i++) {
            if (!playlist.items[i].songName) { break; } // no more tracks

            const track = playlist.items[i];
            const realUri = self.isPandoraOne ?
                            track.audioUrlMap.highQuality.audioUrl :
                            track.additionalAudioUrl;
            const trackId = realUri.match(trackIdRE)[1];
            const uri = uriPrefix + currStationToken +
                uriParts.keys[2] + trackId;
            let fetchTime = Date.now();

            if ( typeof(Q) !== 'undefined' &&
                (!Q.map(item => item.uri).includes(uri) &&
                !self.bandFilter.includes(track.artistName)) ) {
                self.newTracks.push({
                    service: serviceName,
                    fetchTime: fetchTime,
                    type: 'song',
                    trackType: 'mp3',
                    stationToken: currStationToken,
                    trackToken: track.trackToken,
                    title: track.songName,
                    name: track.songName,
                    artist: track.artistName,
                    album: track.albumName,
                    albumart: track.albumArtUrl,
                    uri: uri,
                    realUri: realUri,
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

    self.newTracks = [];

    return self.fillStationData()
        // .then(() => {
        //     if (options.mqttEnabled) {
        //         return self.publishStationData();
        //     }
        //     return libQ.resolve();
        // })
        .then(() => {
            if (currStationToken in self.stationData) {
                return fetchStationPlaylist()
                    .fail(err => {
                        self.reportAPIError(fnFSPName, err);
                        return self.pUtil.generalReject(fnFSPName, err);
                    })
                    .then(playlist => {
                        self.pUtil.logInfo(fnFSPName, 'Retrieved ' +
                            self.context.currStation.name + ' playlist');
                        return fillNewTracks(playlist)
                            .then(() => {
                                let msg = (self.newTracks.length == 0) ?
                                    'Returned zero tracks!' :
                                    'Fetched ' + self.newTracks.length + ' track(s)';

                                self.pUtil.logInfo(fnFNTName, msg);
                                return libQ.resolve();
                            });
                    })
                    .fail(err => {
                        self.pUtil.logError(fnFNTName, err);
                        return self.pUtil.generalReject(fnFNTName, err);
                    });
            }
            else { // station doesn't exist!
                // pick a station near the old one in age
                const nextStationIndex = Math.min(self.context.currStation.id, self.stationData.length)
                const nextStationToken = Object.keys(self.stationData)[nextStationIndex];

                self.commandRouter.pushToastMessage('warning', 'Pandora', 'Station ' +
                    self.context.currStation.name + ' no longer exists!');

                self.pUtil.logInfo(fnName, 'Station ' + self.context.currStation.name +
                    ' no longer exists.  Changing to ' +
                    self.stationData[nextStationToken].name);

                return self.context.setCurrStationInfo(nextStationToken)
                    .then(() => self.fetchTracks())
                    .then(() => self.pUtil.timeOutToast(fnName, 'info', 'Pandora',
                        'Changing to ' + self.context.currStation.name, 5000));
                    // You go back, Jack.  Do it again... (Steely Dan)
            }
        });
};

PandoraHandler.prototype.thumbsDownTrack = function (track) {
    const self = this;
    const fnName = 'thumbsDownTrack';
    var defer = libQ.defer();

    self.pUtil.announceFn(fnName);

    if (track.service === serviceName) {
        self.pandora.request('station.addFeedback', {
            'stationToken': track.stationToken,
            'trackId': track.trackId,
            'isPositive': false
            }, defer.makeNodeResolver());

        self.pUtil.logInfo(fnName, 'Thumbs down delivered.  Station: ' +
            self.context.currStation.name + ' Track: ' + track.name);

        self.pUtil.timeOutToast(fnName, 'success', 'Pandora',
            'Thumbs Down delivered.\n' +
            '¡Adiós, ' + track.name + '!', 5000);

        return defer.promise;
    }
    self.pUtil.logInfo(fnName, 'Not a Pandora track.  Ignored.');

    return libQ.resolve();
};

module.exports.PandoraHandler = PandoraHandler;
