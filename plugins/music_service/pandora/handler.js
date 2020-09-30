/* jshint node: true, esversion: 9, unused: false */
'use strict';

var anesidora = require('anesidora');
var libQ = require('kew');

function PandoraHandler(self, options) {
    const that = this;
    var pandora = {};
    var bandFilter = options.bandFilter;
    var maxStationTracks = options.maxStationQ;
    var loggedIn = false;
    const errCodeRegEx = new RegExp(/\[(\d+)\]/);
    var stationList = {}; // raw stationList object
    var stationData = []; // array of basic station info
    var newTracks = [];
    const phName = 'PandoraHandler::';

    PandoraHandler.prototype.init = function () {
        let partnerInfo = null;
        const pandoraOnePartnerInfo = {
            username: 'pandora one',
            password: 'TVCKIBGS9AO9TSYLNNFUML0743LH82D',
            deviceModel: 'D01',
            decryptPassword: 'U#IO$RZPAB%VX2',
            encryptPassword: '2%3WCL*JU$MP]4'
        };

        that.phAnnounceFn('init');

        if (options.isPandoraOne) {
            partnerInfo = pandoraOnePartnerInfo;
        }

        pandora = new anesidora(options.email,
                                options.password,
                                partnerInfo);

        return libQ.resolve();
    };

    PandoraHandler.prototype.getNewTracks = function () {
        return newTracks;
    };

    PandoraHandler.prototype.getStationData = function () {
        return stationData;
    };

    PandoraHandler.prototype.setBandFilter = function (bf) {
        bandFilter = bf;
    };

    PandoraHandler.prototype.setMaxStationTracks = function (stationQMax) {
        maxStationTracks = stationQMax;
    };

    PandoraHandler.prototype.getSongMaxDiff = function () {
        return self.getCurrStationTracks()
            .then(stationQ => {
                const result = stationQ.length - maxStationTracks;
                that.phLogInfo('getSongMaxDiff', result);
                return libQ.resolve(result);
            });
    };

    PandoraHandler.prototype.phAnnounceFn = function (fn) {
        return self.announceFn(phName + fn);
    };

    PandoraHandler.prototype.phLogInfo = function (fn, msg) {
        return self.logInfo(phName + fn + ': ' + msg);
    };

    PandoraHandler.prototype.phLogError = function (fn, msg, err) {
        return self.logError(phName + fn + ' ' + msg, err);
    };

    PandoraHandler.prototype.phGeneralReject = function (fn, errMsg) {
        return self.generalReject(phName + fn, errMsg);
    };
        
    PandoraHandler.prototype.pandoraLoginAndGetStations = function () {
        const fnName = 'pandoraLoginAndGetStations';
        that.phAnnounceFn(fnName);

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
                let errMatch = err.message.match(errCodeRegEx);
                let code = (errMatch !== null) ? errMatch[1] : 'unknown';

                const infoMsg = ' See https://6xq.net/pandora-apidoc/json/errorcodes/';
                const usualErrs = ['1002', '1011', '1012'];

                let errPrefix = {
                    '1002': 'Invalid Partner Login [1002]',
                    '1011': 'Invalid User [1011]',
                    '1012': 'Invalid Password [1012]',
                    other: 'Other Login Error [' + code + ']',
                    unknown: 'Unknown Error: ' + err.message
                };
                
                let errMsg = {};
                let errPrefixKeys = Object.keys(errPrefix);
                for (let i = 0; i < errPrefixKeys.length; i++) {
                    let key = errPrefixKeys[i];
                    let msg = errPrefix[key];
                    errMsg[key] = {
                        toastMsg: msg,
                        logMsg: msg
                    };

                    if (key === '1002') errMsg[key].toastMsg += '\nCheck Email/Password';
                    if (key === 'other') errMsg[key].logMsg += infoMsg;
                }
                
                let index = (usualErrs.includes(code) || code === 'unknown') ? code : 'other';

                self.logError(errMsg[index].logMsg);
                self.commandRouter.pushToastMessage('error', 'Pandora Login Error', errMsg[index].toastMsg);
                return self.generalReject(errMsg[index].logMsg);
            })
            .then(() => {
                let msg = 'Successful Pandora Login';
                if (!loggedIn) {
                    loggedIn = true;
                }
                else {
                    msg = 'Refreshed Pandora Login';
                }

                that.phLogInfo(fnName + '::pandoraLogin', 'Logged in');
                self.commandRouter.pushToastMessage('success',
                                                    'Pandora Login',
                                                    msg);

                return getStationList()
                    .then(result => {
                        stationList = result;

                        return libQ.resolve();
                    });
            });
    };

    PandoraHandler.prototype.fillStationData = function () {
        const fnName = 'fillStationData';

        that.phAnnounceFn(fnName);

        if (stationList.stations.length > 0) {
            stationData = stationList.stations.map(item => ({
                name: item.stationName,
                albumart: item.artUrl
            }));

            return libQ.resolve();
        }
        else {
            that.phLogError(fnName, 'Stationlist is empty');
            self.commandRouter.pushToastMessage('error',
                                                'Pandora',
                                                'Error in fillStationData');

            return that.phGeneralReject(fnName, 'stationList is empty');
        }
    };

    PandoraHandler.prototype.fetchTracks = function () {
        const fnName = 'fetchTracks';
        let Q = self.getQueue();

        // Retrieve a raw Pandora playlist from a Pandora station index
        function fetchStationPlaylist() {
            var station = stationList.stations[self.currStation.id];
            var defer = libQ.defer();

            that.phAnnounceFn(fnName + '::fetchStationPlaylist');

            pandora.request('station.getPlaylist', {
                'stationToken': station.stationToken,
                'additionalAudioUrl': 'HTTP_128_MP3',
                'includeTrackLength': true
                }, defer.makeNodeResolver());

            return defer.promise;
        }

        // Retrieve an array of tracks from a raw Pandora playlist object
        function fillNewTracks(playlist) {
            let baseNameMatch = new RegExp(/\/access\/(\d+)/);
            let stationToken = stationList.stations[self.currStation.id].stationToken;

            that.phAnnounceFn(fnName + '::fillNewTracks');

            for (let i = 0; i < playlist.items.length; i++) {
                if (!playlist.items[i].songName) { break; } // no more tracks

                let track = playlist.items[i];
                let realUri = options.isPandoraOne ?
                              track.audioUrlMap.highQuality.audioUrl :
                              track.additionalAudioUrl;
                let baseName = realUri.match(baseNameMatch)[1];
                let uri = '/pandora/station_id=' + self.currStation.id +
                        '/track_id=' + baseName;
                let fetchTime = Date.now();

                if (!Q.map(item => item.uri).includes(uri) &&
                    !bandFilter.includes(track.artistName)) {
                    newTracks.push({
                        service: self.serviceName,
                        fetchTime: fetchTime,
                        type: 'song',
                        trackType: 'mp3',
                        stationId: self.currStation.id,
                        stationToken: stationToken,
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

        newTracks = [];

        return fetchStationPlaylist()
            .fail(err => {
                let errMatch = err.message.match(errCodeRegEx);
                let code = (errMatch !== null) ? errMatch[1] : null;

                that.phLogError(fnName + '::fetchStationPlaylist', 'Error', err);
                self.commandRouter.pushToastMessage('error', 'Pandora', 'Pandora Error - Code [' + code + ']');
                return that.phGeneralReject(fnName + '::fetchStationPlaylist', err);
            })
            .then(playlist => {
                return fillNewTracks(playlist)
                    .then(() => {
                        if (newTracks.length == 0) {
                            that.phLogError(fnName + '::fillNewTracks', 'returned zero tracks!');
                        }
                    });
            })
            .fail(err => {
                that.phLogError(fnName + '::fillNewTracks', 'Error', err);
                return that.phGeneralReject(fnName + '::fillNewTracks', err);
            });
    };

    PandoraHandler.prototype.thumbsDownTrack = function (track) {
        const fnName = 'thumbsDownTrack';
        var defer = libQ.defer();

        that.phAnnounceFn(fnName);

        if (track.service === self.serviceName) {
            pandora.request('station.addFeedback', {
                'stationToken': track.stationToken,
                'trackToken': track.trackToken,
                'isPositive': false
                }, defer.makeNodeResolver());

            that.phLogInfo(fnName, 'Thumbs down delivered.  Station: ' +
                self.currStation.name + ' Track: ' + track.name);

            setTimeout(() => {
                self.commandRouter.pushToastMessage('success', 'Pandora', 'Thumbs Down delivered.' +
                    '\n¡Adiós, ' + track.name + '!');
            }, 5000);

            return defer.promise;
        }
        return that.phLogInfo(fnName, 'Not a Pandora track.  Ignored.');
    };

    that.init(options);
}

module.exports = PandoraHandler;