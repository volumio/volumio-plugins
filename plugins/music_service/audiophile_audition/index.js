'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var NanoTimer = require('nanotimer');
const http = require('https');

var flacUri;
var channelMix;
var metadataUrl;
var audioFormat = "flac";

module.exports = AudiophileAudition;

function AudiophileAudition(context) {
    var self = this;

    self.context = context;
    self.commandRouter = this.context.coreCommand;
    self.logger = this.context.logger;
    self.configManager = this.context.configManager;

    self.state = {};
    self.timer = null;
};

AudiophileAudition.prototype.onVolumioStart = function () {
    var self = this;
    self.configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	self.getConf(self.configFile);
    self.apiDelay = self.config.get('apiDelay');
    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] API delay: ' + self.apiDelay);

    return libQ.resolve();
};

AudiophileAudition.prototype.getConfigurationFiles = function () {
    return ['config.json'];
};

AudiophileAudition.prototype.onStart = function () {
    var self = this;

    var defer=libQ.defer();
    self.logger.info('Entering onStart');

    self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

    self.logger.info('Before Loadradio onStart');
    self.loadRadioI18nStrings();
    self.logger.info('Before Addradio onStart');
    self.addRadioResource();
    self.logger.info('Before Addtobrowse onStart');
    self.addToBrowseSources();
    self.logger.info('After Addtobrowse onStart');

    //self.serviceName = "audiophile_audition";

    // Once the Plugin has successfull started resolve the promise
    //return libQ.resolve();
    defer.resolve();

    return defer.promise;
};

AudiophileAudition.prototype.onStop = function () {
    var self = this;

    self.removeFromBrowseSources();
    return libQ.resolve();
};

AudiophileAudition.prototype.onRestart = function () {
    var self = this;
    // Optional, use if you need it
    return libQ.resolve();
};


// Configuration Methods -----------------------------------------------------------------------------
AudiophileAudition.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.getConf(this.configFile);
    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function (uiconf) {
            uiconf.sections[0].content[0].value = self.config.get('apiDelay');
            defer.resolve(uiconf);
        })
        .fail(function () {
            defer.reject(new Error());
        });

    return defer.promise;
};


AudiophileAudition.prototype.setUIConfig = function (data) {
    var self = this;
    var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');

    return libQ.resolve();
};

AudiophileAudition.prototype.getConf = function (configFile) {
    var self = this;

    self.config = new (require('v-conf'))();
    self.config.loadFile(configFile);
};

AudiophileAudition.prototype.setConf = function (varName, varValue) {
    var self = this;
    fs.writeJsonSync(self.configFile, JSON.stringify(conf));
};

AudiophileAudition.prototype.updateConfig = function (data) {
    var self = this;
    var defer = libQ.defer();
    var configUpdated = false;
  
    if (self.config.get('apiDelay') != data['apiDelay']) {
      self.config.set('apiDelay', data['apiDelay']);
      self.apiDelay = data['apiDelay'];
      configUpdated = true;
    }
  
    if(configUpdated) {
      var responseData = {
        title: self.getRadioI18nString('PLUGIN_NAME'),
        message: self.getRadioI18nString('SAVE_CONFIG_MESSAGE'),
        size: 'md',
        buttons: [{
          name: 'Close',
          class: 'btn btn-info'
        }]
      };
  
      self.commandRouter.broadcastMessage("openModal", responseData);
    }
  
    return defer.promise;
};

// Playback Controls ---------------------------------------------------------------------------------------
AudiophileAudition.prototype.addToBrowseSources = function () {
    // Use this function to add your music service plugin to music sources
    var self = this;

    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] addToBrowseSources: ');
    self.commandRouter.volumioAddToBrowseSources({
        //name: self.getRadioI18nString('PLUGIN_NAME'),
        name: 'audiophile_audition',
        uri: 'audiophile_audition',
        plugin_type: 'music_service',
        plugin_name: "audiophile_audition",
        albumart: '/albumart?sourceicon=music_service/audiophile_audition/aa.png'
    });
};

AudiophileAudition.prototype.removeFromBrowseSources = function () {
    // Use this function to add your music service plugin to music sources
    var self = this;

    self.commandRouter.volumioRemoveToBrowseSources(self.getRadioI18nString('PLUGIN_NAME'));
};

AudiophileAudition.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    var response;
    self.logger.info('Entering handleBrowseUri with ' + curUri);
    if (curUri.startsWith('audiophile_audition')) {
        response = self.getRadioContent('audiophile_audition');
    }
    self.logger.info('Exiting handleBrowseUri');
    return response
        .fail(function (e) {
            self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] handleBrowseUri failed');
            libQ.reject(new Error());
        });
};

AudiophileAudition.prototype.getRadioContent = function (station) {
    var self = this;
    var response;
    var radioStation;
    var defer = libQ.defer();

    radioStation = self.radioStations.audiophile_audition;

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
AudiophileAudition.prototype.clearAddPlayTrack = function (track) {
    var self = this;
    if (self.timer) {
        self.timer.clear();
    }

    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] clearAddPlayTrack: ' + track.url);
        // Advanced stream via API
        flacUri = track.url;

        metadataUrl =  ""
        
        var songs;
        return self.mpdPlugin.sendMpdCommand('stop', [])
            .then(function () {
                self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] before clear');
                return self.mpdPlugin.sendMpdCommand('clear', []);
            })
            .then(function () {
                self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] before consume');
                return self.mpdPlugin.sendMpdCommand('consume 1', []);
            })
            .then(function () {
                self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] set to consume mode, adding url: ' + flacUri);
                return self.mpdPlugin.sendMpdCommand('add "' + flacUri + '"', []);
            })
            .then(function () {
                self.commandRouter.pushToastMessage('info',
                    self.getRadioI18nString('PLUGIN_NAME'),
                    self.getRadioI18nString('WAIT_FOR_RADIO_CHANNEL'));
                self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] before play');

                return self.mpdPlugin.sendMpdCommand('play', []);
            }).then(function () {
                return self.setMetadata(metadataUrl);
            })
            .fail(function (e) {
                return libQ.reject(new Error());
            });
};

AudiophileAudition.prototype.seek = function (position) {
    var self = this;
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + '[AudiophileAudition] seek to ' + position);
    return libQ.resolve();
    //return self.mpdPlugin.seek(position);
};

// Stop
AudiophileAudition.prototype.stop = function () {
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
AudiophileAudition.prototype.pause = function () {
    var self = this;

    // stop timer
    if (self.timer) {
        self.timer.clear();
    }

    // pause the song
    return self.mpdPlugin.sendMpdCommand('pause', [1])
    .then(function () {
        var vState = self.commandRouter.stateMachine.getState();
        self.state.status = 'pause';
        self.state.seek = vState.seek;
        self.commandRouter.servicePushState(self.state, self.serviceName);
    });
};

// Resume
AudiophileAudition.prototype.resume = function () {
    var self = this;

    return self.mpdPlugin.sendMpdCommand('play', [])
        .then(function () {
            // adapt play status and update state machine
            self.state.status = 'play';
            self.commandRouter.servicePushState(self.state, self.serviceName);
            return self.setMetadata(metadataUrl);
    });
};

AudiophileAudition.prototype.explodeUri = function (uri) {
    var self = this;
    var defer = libQ.defer();
    var response = [];

    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] explodeUri');
    var uris = uri.split("/");
    var channel = parseInt(uris[1]);
    var query;
    var station;

    station = uris[0].substring(3);

    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] explodeUri: ' + station);
    switch (uris[0]) {
        case 'webaa':
            if (self.timer) {
                self.timer.clear();
            }
            self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] explodeUri: before push');
            response.push({
                service: self.serviceName,
                type: 'track',
                trackType: self.getRadioI18nString('PLUGIN_NAME'),
                radioType: station,
                albumart: '/albumart?sourceicon=music_service/audiophile_audition/aa-cover-black.png',
                uri: self.radioStations.audiophile_audition[channel].url,
                name: self.radioStations.audiophile_audition[channel].title
            });
            defer.resolve(response);
            break;
        default:
            defer.resolve();
    }
    return defer.promise;
};

AudiophileAudition.prototype.getAlbumArt = function (data, path) {

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

AudiophileAudition.prototype.addRadioResource = function () {
    var self = this;

    var radioResource = fs.readJsonSync(__dirname + '/radio_stations.json');
    var baseNavigation = radioResource.baseNavigation;

    self.radioStations = radioResource.stations;
    self.rootNavigation = JSON.parse(JSON.stringify(baseNavigation));
    self.radioNavigation = JSON.parse(JSON.stringify(baseNavigation));
};

AudiophileAudition.prototype.getMetadata = function (url) {
    var self = this;
    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] getMetadata started with url ' + url);
    var defer = libQ.defer();    
    
    http.get(url, (resp) => {
    	if (resp.statusCode < 200 || resp.statusCode > 299) {
        	self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] Failed to query radio AudiophileAudition api, status code: ' + resp.statusCode);
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
		self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] Error: ' + err.message);
  		defer.resolve(null);
        self.errorToast(url, 'ERROR_STREAM_SERVER');
	});
    
    return defer.promise;
};

AudiophileAudition.prototype.loadRadioI18nStrings = function () {
    var self = this;
    self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};

AudiophileAudition.prototype.getRadioI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};

AudiophileAudition.prototype.search = function (query) {
    return libQ.resolve();
};

AudiophileAudition.prototype.errorToast = function (station, msg) {
    var self = this;

    var errorMessage = self.getRadioI18nString(msg);
    errorMessage.replace('{0}', station.toUpperCase());
    self.commandRouter.pushToastMessage('error',
        self.getRadioI18nString('PLUGIN_NAME'), errorMessage);
};

AudiophileAudition.prototype.pushSongState = function (metadata) {
    var self = this;
    var rpState = {
        status: 'play',
        service: self.serviceName,
        type: 'track',
        trackType: audioFormat,
        radioType: 'audiophile_audition',
        albumart: metadata.cover,
        uri: flacUri,
        name: metadata.artist + ' - ' + metadata.title,
        title: metadata.title,
        artist: 'Audiophile Audition ' + channelMix,
        album: metadata.album,
        streaming: true,
        disableUiControls: true,
        duration: metadata.time,
        seek: 0,
        samplerate: '44.1 KHz',
        bitdepth: '16 bit',
        channels: 2
    };

    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] .pushSongState');
    self.state = rpState;

    //workaround to allow state to be pushed when not in a volatile state
    var vState = self.commandRouter.stateMachine.getState();
    var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];

    queueItem.name = metadata.artist + ' - ' + metadata.title;
    queueItem.artist = 'Audiophile Audition ' + channelMix;
    queueItem.album = metadata.album;
    queueItem.albumart = metadata.cover;
    queueItem.trackType = audioFormat;
    queueItem.duration = metadata.time;
    queueItem.samplerate = '44.1 KHz';
    queueItem.bitdepth = '16 bit';
    queueItem.channels = 2;

    //reset volumio internal timer
    self.commandRouter.stateMachine.currentSeek = 0;
    self.commandRouter.stateMachine.playbackStart=Date.now();
    self.commandRouter.stateMachine.currentSongDuration=metadata.time;
    self.commandRouter.stateMachine.askedForPrefetch=false;
    self.commandRouter.stateMachine.prefetchDone=false;
    self.commandRouter.stateMachine.simulateStopStartDone=false;

    //volumio push state
    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] .pushSongState: before push');
    self.commandRouter.servicePushState(rpState, self.serviceName);
};

AudiophileAudition.prototype.setMetadata = function (metadataUrl) {
    var self = this;
    return self.getMetadata(metadataUrl)
    .then(function (eventResponse) {
        if (eventResponse !== null) {
            var result = JSON.parse(eventResponse);
            if (result.time === undefined) {
                self.errorToast('web', 'INCORRECT_RESPONSE');
            }
            self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] received new metadata: ' + JSON.stringify(result));
            return result;
        }
    }).then(function(metadata) {
        // show metadata and adjust time of playback and timer
        if(self.apiDelay) {
            metadata.time = parseInt(metadata.time) + parseInt(self.apiDelay);
        }
        var duration = metadata.time * 1000;
        return libQ.resolve(self.pushSongState(metadata))
        .then(function () {
            self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] setting new timer with duration of ' + duration + ' seconds.');
            self.timer = new RPTimer(self.setMetadata.bind(self), [metadataUrl], duration);
        });
    });
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
