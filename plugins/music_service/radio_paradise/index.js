'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var NanoTimer = require('nanotimer');
const http = require('https');

var rpApiBaseUrl = 'https://api.radioparadise.com/api/get_block?bitrate=4&info=true';
var nextEventApiUrl;
var streamUrl;
var songsOfNextEvent;

module.exports = ControllerRadioParadise;

function ControllerRadioParadise(context) {
    var self = this;

    self.context = context;
    self.commandRouter = this.context.coreCommand;
    self.logger = this.context.logger;
    self.configManager = this.context.configManager;

    self.state = {};
    self.timer = null;
};

ControllerRadioParadise.prototype.onVolumioStart = function () {
    var self = this;
    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    self.getConf(self.configFile);

    return libQ.resolve();
};

ControllerRadioParadise.prototype.getConfigurationFiles = function () {
    return ['config.json'];
};

ControllerRadioParadise.prototype.onStart = function () {
    var self = this;

    self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

    self.loadRadioI18nStrings();
    self.addRadioResource();
    self.addToBrowseSources();

    self.serviceName = "radio_paradise";

    // Once the Plugin has successfull started resolve the promise
    return libQ.resolve();
};

ControllerRadioParadise.prototype.onStop = function () {
    return libQ.resolve();
};

ControllerRadioParadise.prototype.onRestart = function () {
    var self = this;
    // Optional, use if you need it
    return libQ.resolve();
};


// Configuration Methods -----------------------------------------------------------------------------
ControllerRadioParadise.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.getConf(this.configFile);
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


ControllerRadioParadise.prototype.setUIConfig = function (data) {
    var self = this;
    var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');

    return libQ.resolve();
};

ControllerRadioParadise.prototype.getConf = function (configFile) {
    var self = this;

    self.config = new (require('v-conf'))();
    self.config.loadFile(configFile);
};

ControllerRadioParadise.prototype.setConf = function (varName, varValue) {
    var self = this;
    fs.writeJsonSync(self.configFile, JSON.stringify(conf));
};



// Playback Controls ---------------------------------------------------------------------------------------
ControllerRadioParadise.prototype.addToBrowseSources = function () {
    // Use this function to add your music service plugin to music sources
    var self = this;

    self.commandRouter.volumioAddToBrowseSources({
        name: self.getRadioI18nString('PLUGIN_NAME'),
        uri: 'rparadise',
        plugin_type: 'music_service',
        plugin_name: "radio_paradise",
        albumart: '/albumart?sourceicon=music_service/radio_paradise/rp.svg'
    });
};

ControllerRadioParadise.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    var response;
    if (curUri.startsWith('rparadise')) {
        response = self.getRadioContent('rparadise');
    }
    return response
        .fail(function (e) {
            self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] handleBrowseUri failed');
            libQ.reject(new Error());
        });
};

ControllerRadioParadise.prototype.getRadioContent = function (station) {
    var self = this;
    var response;
    var radioStation;
    var defer = libQ.defer();

    radioStation = self.radioStations.rparadise;

    response = self.radioNavigation;
    response.navigation.lists[0].items = [];
    for (var i in radioStation) {
        var channel = {
            service: self.serviceName,
            type: 'mywebradio',
            title: radioStation[i].title,
            artist: '',
            album: '',
            icon: 'fa fa-music',
            uri: radioStation[i].uri
        };
        response.navigation.lists[0].items.push(channel);
    }
    defer.resolve(response);

    return defer.promise;
};

// Define a method to clear, add, and play an array of tracks
ControllerRadioParadise.prototype.clearAddPlayTrack = function (track) {
    var self = this;
    if (self.timer) {
        self.timer.clear();
    }

    if (!track.uri.includes("apps.radioparadise.com")) {
        // normal radio streams
        return self.mpdPlugin.sendMpdCommand('stop', [])
            .then(function () {
                return self.mpdPlugin.sendMpdCommand('clear', []);
            })
            .then(function () {
                return self.mpdPlugin.sendMpdCommand('add "' + track.uri + '"', []);
            })
            .then(function () {
                self.commandRouter.pushToastMessage('info',
                    self.getRadioI18nString('PLUGIN_NAME'),
                    self.getRadioI18nString('WAIT_FOR_RADIO_CHANNEL'));
                return self.mpdPlugin.sendMpdCommand('play', []).then(function () {
                    self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
                    return libQ.resolve();
                })
            });
    } else {
        // FLAC stream
        var songs;
        return self.setSongs(rpApiBaseUrl)
            .then(function (result) {
                songs = result;
                return self.mpdPlugin.sendMpdCommand('stop', []);
            })
            .then(function () {
                return self.mpdPlugin.sendMpdCommand('clear', []);
            })
            .then(function () {
                return self.mpdPlugin.sendMpdCommand('consume 1', []);
            })
            .then(function () {
                self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] set to consume mode, adding url: ' + songs[0].uri);
                return self.mpdPlugin.sendMpdCommand('add "' + songs[0].uri + '"', []);
            })
            .then(function () {
                self.commandRouter.pushToastMessage('info',
                    self.getRadioI18nString('PLUGIN_NAME'),
                    self.getRadioI18nString('WAIT_FOR_RADIO_CHANNEL'));

                return self.mpdPlugin.sendMpdCommand('play', []);
            })
            .then(function () {
                return self.playNextTrack(0, songs);
            })
            .fail(function (e) {
                return libQ.reject(new Error());
            });
    }
};

ControllerRadioParadise.prototype.seek = function (position) {
    var self = this;
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + '[RadioParadise] seek to ' + position);
    return libQ.resolve();
    //return self.mpdPlugin.seek(position);
};

// Stop
ControllerRadioParadise.prototype.stop = function () {
    var self = this;
    if (self.timer) {
        self.timer.clear();
    }
    self.commandRouter.pushToastMessage(
        'info',
        self.getRadioI18nString('PLUGIN_NAME'),
        self.getRadioI18nString('STOP_RADIO_CHANNEL')
    );

    return self.mpdPlugin.stop()
        .then(function () {
            self.state.status = 'stop';
            self.commandRouter.servicePushState(self.state, self.serviceName);
        });
};

// Pause
ControllerRadioParadise.prototype.pause = function () {
    var self = this;

    // pause the timeout of this song
    if (self.timer) {
        self.timer.pause();
    }

    // pause the song and store the seek position needed for the new setTimeout calculation
    return self.mpdPlugin.sendMpdCommand('pause', [1])
    .then(function () {
        var vState = self.commandRouter.stateMachine.getState();
        self.state.status = 'pause';
        self.state.seek = vState.seek;
        self.commandRouter.servicePushState(self.state, self.serviceName);
    });
};

// Resume
ControllerRadioParadise.prototype.resume = function () {
    var self = this;

    // seek back 1 sec to prevent mpd crashing on resume of a paused stream
    var fixMpdCrashCmds = [
        { command: 'seekcur', parameters: ['-1'] },
        { command: 'play', parameters: [] }
    ];

    return self.mpdPlugin.sendMpdCommandArray(fixMpdCrashCmds)
    .then(function () {
        // setTimeout
        if (self.timer) {
            self.timer.resume();
        }

        // adapt play status and update state machine
        self.state.status = 'play';
        self.commandRouter.servicePushState(self.state, self.serviceName);
    });
};

ControllerRadioParadise.prototype.explodeUri = function (uri) {
    var self = this;
    var defer = libQ.defer();
    var response = [];

    var uris = uri.split("/");
    var channel = parseInt(uris[1]);
    var query;
    var station;

    station = uris[0].substring(3);

    switch (uris[0]) {
        case 'webrp':
            if (self.timer) {
                self.timer.clear();
            }
            if (channel === 0) {
                nextEventApiUrl = null;
                // FLAC option chosen
                response.push({
                    service: self.serviceName,
                    type: 'track',
                    trackType: 'flac',
                    radioType: station,
                    albumart: '/albumart?sourceicon=music_service/radio_paradise/rp-cover-black.png',
                    uri: self.radioStations.rparadise[channel].url,
                    name: self.radioStations.rparadise[channel].title,
                    duration: 1000
                });
                defer.resolve(response);
            } else {
                // normal streams with static url from radio_stations.json
                response.push({
                    service: self.serviceName,
                    type: 'track',
                    trackType: self.getRadioI18nString('PLUGIN_NAME'),
                    radioType: station,
                    albumart: '/albumart?sourceicon=music_service/radio_paradise/rp-cover-black.png',
                    uri: self.radioStations.rparadise[channel].url,
                    name: self.radioStations.rparadise[channel].title
                });
                defer.resolve(response);
            }
            break;
        default:
            defer.resolve();
    }
    return defer.promise;
};

ControllerRadioParadise.prototype.getAlbumArt = function (data, path) {

    var artist, album;

    if (data != undefined && data.path != undefined) {
        path = data.path;
    }

    var web;

    if (data != undefined && data.artist != undefined) {
        artist = data.artist;
        if (data.album != undefined)
            album = data.album;
        else album = data.artist;

        web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large'
    }

    var url = '/albumart';

    if (web != undefined)
        url = url + web;

    if (web != undefined && path != undefined)
        url = url + '&';
    else if (path != undefined)
        url = url + '?';

    if (path != undefined)
        url = url + 'path=' + nodetools.urlEncode(path);

    return url;
};

ControllerRadioParadise.prototype.addRadioResource = function () {
    var self = this;

    var radioResource = fs.readJsonSync(__dirname + '/radio_stations.json');
    var baseNavigation = radioResource.baseNavigation;

    self.radioStations = radioResource.stations;
    self.rootNavigation = JSON.parse(JSON.stringify(baseNavigation));
    self.radioNavigation = JSON.parse(JSON.stringify(baseNavigation));
};

ControllerRadioParadise.prototype.getStream = function (url) {
    var self = this;
    self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] getStream started with url ' + url);
    var defer = libQ.defer();    
    
    http.get(url, (resp) => {
    	if (resp.statusCode < 200 || resp.statusCode > 299) {
        	self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] Failed to query radio paradise api, status code: ' + resp.statusCode);
        	defer.resolve(null);
        	self.errorToast(url, 'ERROR_STREAM_SERVER');
		} else {
        let data = '';

        // A chunk of data has been recieved.
        resp.on('data', (chunk) => {
            data += chunk;
        });

        // The whole response has been received.
        resp.on('end', () => {
            defer.resolve(data);
        });
        }

	}).on("error", (err) => {
		self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] Error: ' + err.message);
  		defer.resolve(null);
        self.errorToast(url, 'ERROR_STREAM_SERVER');
	});
    
    return defer.promise;
};

ControllerRadioParadise.prototype.loadRadioI18nStrings = function () {
    var self = this;
    self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};

ControllerRadioParadise.prototype.getRadioI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};

ControllerRadioParadise.prototype.search = function (query) {
    return libQ.resolve();
};

ControllerRadioParadise.prototype.errorToast = function (station, msg) {
    var self = this;

    var errorMessage = self.getRadioI18nString(msg);
    errorMessage.replace('{0}', station.toUpperCase());
    self.commandRouter.pushToastMessage('error',
        self.getRadioI18nString('PLUGIN_NAME'), errorMessage);
};

ControllerRadioParadise.prototype.pushSongState = function (song) {
    var self = this;
    var rpState = {
        status: 'play',
        service: self.serviceName,
        type: 'track',
        trackType: 'flac',
        radioType: 'rparadise',
        albumart: song.albumart,
        uri: song.uri,
        name: song.name,
        title: song.title,
        artist: 'Radio Paradise',
        album: song.album,
        streaming: true,
        disableUiControls: true,
        duration: Math.ceil(song.duration / 1000),
        seek: 0,
        samplerate: '44.1 KHz',
        bitdepth: '16 bit',
        channels: 2
    };

    self.state = rpState;

    //workaround to allow state to be pushed when not in a volatile state
    var vState = self.commandRouter.stateMachine.getState();
    var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];

    queueItem.name = song.name;
    queueItem.artist = 'Radio Paradise';
    queueItem.album = song.album;
    queueItem.albumart = song.albumart;
    queueItem.trackType = 'flac';
    queueItem.duration = Math.ceil(song.duration / 1000);
    queueItem.samplerate = '44.1 KHz';
    queueItem.bitdepth = '16 bit';
    queueItem.channels = 2;

    //reset volumio internal timer
    self.commandRouter.stateMachine.currentSeek = 0;
    self.commandRouter.stateMachine.playbackStart=Date.now();
    self.commandRouter.stateMachine.currentSongDuration=song.duration;
    self.commandRouter.stateMachine.askedForPrefetch=false;
    self.commandRouter.stateMachine.prefetchDone=false;
    self.commandRouter.stateMachine.simulateStopStartDone=false;

    //volumio push state
    self.commandRouter.servicePushState(rpState, self.serviceName);
};

ControllerRadioParadise.prototype.setSongs = function (rpUri) {
    var self = this;
    return self.getStream(rpUri)
    .then(function (eventResponse) {
        if (eventResponse !== null) {
            var result = JSON.parse(eventResponse);
            if (result.url === undefined) {
                streamUrl = null;
                self.errorToast('web', 'INCORRECT_RESPONSE');
            }
            // the stream event url to play
            streamUrl = result.url + '?src=alexa';

            // transform the songs into an array
            var songsArray = Object.keys(result.song).map(function (k) { return result.song[k] });
            self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] received new event with id ' + result.event + ' containing ' + songsArray.length + ' songs.');
            var firstSongOffset = 0;
            var lastSongOffset = 0;
            var startsWithOffset = false;
            var endsWithOffset = false;
            var lengthOfAllSongs = 0;
            for (var i = 0; i < songsArray.length; i++) {
                lengthOfAllSongs = lengthOfAllSongs + songsArray[i].duration;
            }
            if(result.event < songsArray[0].event) {
                self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] Event id is ' + result.event + ' but first song event is ' + songsArray[0].event + '. There is a spoken part at the beginning.');
                startsWithOffset = true;
            }
            if(result.end_event > songsArray[songsArray.length-1].event) {
                self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] End Event id is ' + result.end_event + ' but last song event is ' + songsArray[songsArray.length-1].event + '. There is a spoken part at the end.');
                endsWithOffset = true;
            }
            if (startsWithOffset) {
                if(endsWithOffset) {
                    // get total time of event without initial spoken part and calculate both start and end offset
                    return self.getStream(rpApiBaseUrl + '&event=' + result.event)
                    .then(function (eventResult) {
                        if (eventResult !== null) {
                            var eventResultJson = JSON.parse(eventResult);
                            firstSongOffset = (result.length * 1000) - (eventResultJson.length * 1000);
                            lastSongOffset = (result.length * 1000) - lengthOfAllSongs - firstSongOffset;
                        }
                        return self.getSongsResponse(songsArray, streamUrl, result.length, result.end_event, firstSongOffset, lastSongOffset);
                    });
                } else {
                    // add everything to the first song
                    firstSongOffset = (result.length * 1000) - lengthOfAllSongs;
                }
            } else if (endsWithOffset) {
                // add everything to the last song
                lastSongOffset = (result.length * 1000) - lengthOfAllSongs;
            }
            return self.getSongsResponse(songsArray, streamUrl, result.length, result.end_event, firstSongOffset, lastSongOffset);
        }
    }).then(function(response) {
        return response;
    });
};

ControllerRadioParadise.prototype.getSongsResponse = function (songsArray, streamUrl, lengthOfEvent, endEvent, firstSongOffset, lastSongOffset) {
    var self = this;
    var response = [];
    if(streamUrl.match('^https://')) {
    	streamUrl = streamUrl.replace("https://","http://")
	}
    for (var i = 0; i < songsArray.length; i++) {
        var song = songsArray[i];
        var duration = song.duration;
        // Workaround for rp bug when song duration is 0, see event 1694926 for example
        if(duration==0 && songsArray.length==1) {
            duration = lengthOfEvent * 1000;
        }
        if(i==0 && firstSongOffset > 0) {
            self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] Adding ' + firstSongOffset + 'ms to first song: ' + song.artist + ' - ' + song.title);
            duration = song.duration + firstSongOffset;
        }
        if(i==(songsArray.length - 1) && lastSongOffset > 0) {
            self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] Adding ' + lastSongOffset + 'ms to last song: ' + song.artist + ' - ' + song.title);
            duration = song.duration + lastSongOffset;
        }
        response.push({
            service: self.serviceName,
            type: 'track',
            trackType: 'flac',
            radioType: 'web',
            albumart: 'http://img.radioparadise.com/' + song.cover,
            uri: streamUrl,
            name: song.artist + ' - ' + song.title,
            title: song.title,
            artist: song.artist,
            album: song.album,
            streaming: true,
            disableUiControls: true,
            duration: duration,
            seek: song.elapsed,
            samplerate: '44.1 KHz',
            bitdepth: '16 bit',
            channels: 2
        });
    };
    // the url needed to retrieve the next stream event
    nextEventApiUrl = rpApiBaseUrl + '&event=' + endEvent;
    return response;
};

ControllerRadioParadise.prototype.playNextTrack = function (songIndex, songsArray) {
    var self = this;
    //if not the last track
    if ((songIndex == 0 && songsArray.length == 1) || (songIndex < songsArray.length)) {
        self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] Pushing the next song state: ' + songsArray[songIndex].name);
        return libQ.resolve(self.pushSongState(songsArray[songIndex]))
        .then(function () {
            var duration = songsArray[songIndex].duration;
            self.timer = new RPTimer(self.playNextTrack.bind(self), [songIndex + 1, songsArray], duration);
        })
        .then(function () {
            // prefetching next songs as soon as the last song of the previous event starts and already add them to the mpd queue
            if ((songsArray.length == 1) || (songIndex == (songsArray.length - 1))) {
                self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] Prefetching next event.');
                self.setSongs(nextEventApiUrl)
                .then(function (result) {
                    songsOfNextEvent = result;
                    return self.mpdPlugin.sendMpdCommand('add "' + songsOfNextEvent[0].uri + '"', []);
                });
            }
        });
    } else {
        self.logger.info('[' + Date.now() + '] ' + '[RadioParadise] Calling playNextTrack to start next event.');
        self.playNextTrack(0, songsOfNextEvent);
    }
};

function RPTimer(callback, args, delay) {
    var start, remaining = delay;

    var nanoTimer = new NanoTimer();

    RPTimer.prototype.pause = function () {
        nanoTimer.clearTimeout();
        remaining -= new Date() - start;
    };

    RPTimer.prototype.resume = function () {
        start = new Date();
        nanoTimer.clearTimeout();
        nanoTimer.setTimeout(callback, args, remaining + 'm');
    };

    RPTimer.prototype.clear = function () {
        nanoTimer.clearTimeout();
    };

    this.resume();
};