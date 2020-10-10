/* jshint node: true, esversion: 9, unused: false */
'use strict';

var anesidora = require('anesidora');
var fs = require('fs-extra');
var libQ = require('kew');

function PandoraHandler(context, options) {
    this.self = context;
    this.self.commandRouter = context.commandRouter;

    const that = this;
    var pandora = null;
    var bandFilter = options.bandFilter;
    var maxStationTracks = options.maxStationTracks;
    var loggedIn = false;
    var stationList = {}; // raw stationList object
    var stationData = []; // array of basic station info
    var newTracks = [];
    const phName = 'PandoraHandler';
    const phPrefix = phName + '::';

    PandoraHandler.prototype.init = function () {
        that.phAnnounceFn('init');

        that.setBandFilter(options.bandFilter);
        that.setMaxStationTracks(options.maxStationTracks);
        
        return that.loadErrorCodes();
    };

    PandoraHandler.prototype.loadErrorCodes = function () {
        const fnName = 'loadErrorCodes';
        const errorFile = '/errorcodes.json';

        that.phAnnounceFn(fnName);

        this.errorCodes = fs.readJSONSync(__dirname + errorFile);
        
        // return that.setCredentials(options);
        return libQ.resolve();
    };

    PandoraHandler.prototype.setCredentials = function (options) {
        const fnName = 'setCredentials';
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

        that.phAnnounceFn(fnName);

        let partnerInfo = options.isPandoraOne ?
            pInfo.premium : pInfo.regular;

        if (pandora == null) {
            pandora = new anesidora(
                options.email,
                options.password,
                partnerInfo
            );
        }
        else {
            that.phLogInfo(fnName, 'pandora object: ' + JSON.stringify(pandora));

            pandora.username = options.email;
            pandora.password = options.password;
            pandora.partnerInfo = partnerInfo;
            pandora.partnerInfo.version = '5';
            pandora.authData = null;
        }

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
        return that.self.getCurrStationTracks()
            .then(stationQ => {
                const result = stationQ.length - maxStationTracks;
                that.phLogInfo('getSongMaxDiff', result);
                return libQ.resolve(result);
            });
    };

    PandoraHandler.prototype.phAnnounceFn = function (fn) {
        that.self.announceFn(phPrefix + fn);
    };

    PandoraHandler.prototype.phLogInfo = function (fn, msg) {
        that.self.logInfo(phPrefix + fn + ': ' + msg);
    };

    PandoraHandler.prototype.phLogError = function (fn, msg, err) {
        that.self.logError(phPrefix + fn + ' ' + msg, err);
    };

    PandoraHandler.prototype.phGeneralReject = function (fn, errMsg) {
        return that.self.generalReject(phPrefix + fn, errMsg);
    };

    PandoraHandler.prototype.reportAPIError = function (fnName, pandoraErr) {
        const errMsg = pandoraErr.message;
        const errMatch = errMsg.match(/\[(\d+)\]/);
        const code = (errMatch !== null) ? errMatch[1] : 'unknown';
        let decoded = (code === 'unknown') ?
            'Unknown Error: ' + errMsg : '[Error ' + code + '] ' +
            that.errorCodes[code];
        const retry_codes = ['0', '1003'];
        const msg_retry = 'Try again in a few hours. ' +
            'Check status at https://pandora.com';

        that.phLogError(fnName, ' Error: ' + decoded);
        that.self.commandRouter.pushToastMessage(
            'error', phName, decoded);

        if (retry_codes.includes(code)) {
            that.self.timeOutToast('reportAPIError', 'info',
                phName, msg_retry, 5000);
        }

        return libQ.resolve();
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
                const subFnName = fnName + '::pandoraLogin';
                that.reportAPIError(subFnName, err);

                return that.phGeneralReject(subFnName, err);
            })
            .then(() => {
                let bookendMsg = '[<=- * -=>]';
                let msg = 'Successful Pandora Login';
                let logMsg = 'Logged in to Pandora Servers';
                if (!loggedIn) {
                    loggedIn = true;
                }
                else {
                    msg = 'Refreshed Pandora Login';
                    logMsg = msg;
                }

                that.phLogInfo(fnName + '::pandoraLogin', bookendMsg.replace('*', logMsg));
                that.self.commandRouter.pushToastMessage('success', 'Pandora Login', msg);

                return getStationList()
                    .fail(err => {
                        const subFnName = fnName + ':getStationlist';
                        that.reportAPIError(subFnName, err);

                        return that.phGeneralReject(subFnName, err);
                    })
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
            that.phLogError(fnName, 'stationList is empty');
            that.self.commandRouter.pushToastMessage('error',
                                                phName,
                                                fnName + ' error');

            return that.phGeneralReject(fnName, 'stationList is empty');
        }
    };

    PandoraHandler.prototype.fetchTracks = function () {
        const fnName = 'fetchTracks';
        const fnFSPName = fnName + '::fetchStationPlaylist';
        const fnFNTName = fnName + '::fillNewTracks';

        let Q = that.self.getQueue();

        // Retrieve a raw Pandora playlist from a Pandora station index
        function fetchStationPlaylist() {
            var station = stationList.stations[that.self.currStation.id];
            var defer = libQ.defer();

            that.phAnnounceFn(fnFSPName);

            pandora.request('station.getPlaylist', {
                'stationToken': station.stationToken,
                'additionalAudioUrl': 'HTTP_128_MP3',
                'includeTrackLength': true
                }, defer.makeNodeResolver());

            return defer.promise;
        }

        // Retrieve an array of tracks from a raw Pandora playlist object
        function fillNewTracks(playlist) {
            let baseNameMatch = /\/access\/(\d+)/;
            let stationToken = stationList.stations[that.self.currStation.id].stationToken;

            that.phAnnounceFn(fnFNTName);

            for (let i = 0; i < playlist.items.length; i++) {
                if (!playlist.items[i].songName) { break; } // no more tracks

                let track = playlist.items[i];
                let realUri = options.isPandoraOne ?
                              track.audioUrlMap.highQuality.audioUrl :
                              track.additionalAudioUrl;
                let baseName = realUri.match(baseNameMatch)[1];
                let uri = '/pandora/station_id=' + that.self.currStation.id +
                        '/track_id=' + baseName;
                let fetchTime = Date.now();

                if (!Q.map(item => item.uri).includes(uri) &&
                    !bandFilter.includes(track.artistName)) {
                    newTracks.push({
                        service: that.self.serviceName,
                        fetchTime: fetchTime,
                        type: 'song',
                        trackType: 'mp3',
                        stationId: that.self.currStation.id,
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
                that.reportAPIError(fnFSPName, err);
                return that.phGeneralReject(fnFSPName, err);
            })
            .then(playlist => {
                that.phLogInfo(fnFSPName, 'Retrieved ' +
                    that.self.currStation.name + ' playlist');
                return fillNewTracks(playlist)
                    .then(() => {
                        let msg = (newTracks.length == 0) ?
                            'Returned zero tracks!' :
                            'Fetched ' + newTracks.length + ' track(s)';

                        that.phLogInfo(fnFNTName, msg);
                        return libQ.resolve();
                    });
            })
            .fail(err => {
                that.phLogError(fnFNTName, err);
                return that.phGeneralReject(fnFNTName, err);
            });
    };

    PandoraHandler.prototype.thumbsDownTrack = function (track) {
        const fnName = 'thumbsDownTrack';
        var defer = libQ.defer();

        that.phAnnounceFn(fnName);

        if (track.service === that.self.serviceName) {
            pandora.request('station.addFeedback', {
                'stationToken': track.stationToken,
                'trackToken': track.trackToken,
                'isPositive': false
                }, defer.makeNodeResolver());

            that.phLogInfo(fnName, 'Thumbs down delivered.  Station: ' +
                that.self.currStation.name + ' Track: ' + track.name);

            that.self.timeOutToast(fnName, 'success', 'Pandora',
                'Thumbs Down delivered.\n' +
                '¡Adiós, ' + track.name + '!', 5000);

            return defer.promise;
        }
        that.phLogInfo(fnName, 'Not a Pandora track.  Ignored.');
        
        return libQ.resolve();
    };
}

module.exports = PandoraHandler;
