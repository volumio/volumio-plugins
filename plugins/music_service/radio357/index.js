'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
const http = require('https');

var rpApiBaseUrl;
var nextEventApiUrl;
var streamUrl;
var songsOfNextEvent;
var channelMix;
var audioFormat;

module.exports = rad357pl;

//====================================================================================================
function rad357pl(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

    self.state = {};
    self.timer = null;
}

//====================================================================================================
rad357pl.prototype.onVolumioStart = function() {
    var self = this;

    self.configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    self.getConf(self.configFile);
    self.apiDelay = self.config.get('apiDelay');
    self.logger.info('[' + Date.now() + '] ' + '[rad357pl] API delay: ' + self.apiDelay);

    return libQ.resolve();
}

//====================================================================================================
rad357pl.prototype.onStart = function() {
    var self = this;

    self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

    self.loadRadioI18nStrings();
    self.addRadioResource();
    self.addToBrowseSources();

    self.serviceName = "rad357pl";

    // Once the Plugin has successfull started resolve the promise
    return libQ.resolve();
};

//====================================================================================================
rad357pl.prototype.onStop = function() {
    var self = this;

    self.removeFromBrowseSources();
    return libQ.resolve();
};

//====================================================================================================
rad357pl.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
    return libQ.resolve();
};

//====================================================================================================
// Configuration Methods -----------------------------------------------------------------------------
//====================================================================================================
rad357pl.prototype.getUIConfig = function() {
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

//====================================================================================================
rad357pl.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

//====================================================================================================
rad357pl.prototype.setUIConfig = function(data) {
    var self = this;
    var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');

    return libQ.resolve();
};

//====================================================================================================
rad357pl.prototype.getConf = function (configFile) {
    var self = this;

    self.config = new (require('v-conf'))();
    self.config.loadFile(configFile);
};

//====================================================================================================
rad357pl.prototype.setConf = function(varName, varValue) {
    var self = this;
    fs.writeJsonSync(self.configFile, JSON.stringify(conf));
};

//====================================================================================================
rad357pl.prototype.updateConfig = function (data) {
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

//====================================================================================================
//====================================================================================================
// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it
//====================================================================================================
//====================================================================================================
rad357pl.prototype.addToBrowseSources = function () {
	// Use this function to add your music service plugin to music sources
    var self = this;

    self.commandRouter.volumioAddToBrowseSources({
        name: self.getRadioI18nString('PLUGIN_NAME'),
        uri: 'rad357pl',
        plugin_type: 'music_service',
        plugin_name: 'rad357pl',
        albumart: '/albumart?sourceicon=music_service/rad357pl/r35-bw.svg'
    });
};

//====================================================================================================
rad357pl.prototype.removeFromBrowseSources = function () {
    // Use this function to add your music service plugin to music sources
    var self = this;

    self.commandRouter.volumioRemoveToBrowseSources(self.getRadioI18nString('PLUGIN_NAME'));
};

//====================================================================================================
rad357pl.prototype.getRadioContent = function (station) {
    var self = this;
    self.logger.info('[' + Date.now() + '] ' + '[rad357pl] getRadioContent url: ' + station);
    var response;
    var radioStation;
    var defer = libQ.defer();

    radioStation = self.radioStations.rad357pl;

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

//====================================================================================================
rad357pl.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    self.logger.info('[' + Date.now() + '] ' + '[rad357pl] handleBrowseUri curUri: ' + curUri);
    var response;
    if (curUri.startsWith('rad357pl')) response = self.getRadioContent('rad357pl');
    return response
        .fail(function (e) {
            self.logger.info('[' + Date.now() + '] ' + '[rad357pl] handleBrowseUri failed');
            libQ.reject(new Error());
        });
};

//====================================================================================================
rad357pl.prototype.addRadioResource = function () {
    var self = this;

    var radioResource = fs.readJsonSync(__dirname + '/radio_stations.json');
    var baseNavigation = radioResource.baseNavigation;

    self.radioStations = radioResource.stations;
    self.rootNavigation = JSON.parse(JSON.stringify(baseNavigation));
    self.radioNavigation = JSON.parse(JSON.stringify(baseNavigation));
};

//====================================================================================================
rad357pl.prototype.getMetadata = function (url) {
    var self = this;
    self.logger.info('[' + Date.now() + '] ' + '[rad357pl] getMetadata started with url ' + url);
    var defer = libQ.defer();    
    
    http.get(url, (resp) => {
        if (resp.statusCode < 200 || resp.statusCode > 299) {
            self.logger.info('[' + Date.now() + '] ' + '[rad357pl] Failed to query Radio Swarmstation api, status code: ' + resp.statusCode);
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
        self.logger.info('[' + Date.now() + '] ' + '[rad357pl] Error: ' + err.message);
          defer.resolve(null);
        self.errorToast(url, 'ERROR_STREAM_SERVER');
    });
    
    return defer.promise;
};

//====================================================================================================
//====================================================================================================
// Define a method to clear, add, and play an array of tracks
//====================================================================================================
//====================================================================================================
rad357pl.prototype.clearAddPlayTrack = function (track) {
    var self = this;
    if (self.timer) {
        self.timer.clear();
    }

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
};

//====================================================================================================
rad357pl.prototype.loadRadioI18nStrings = function () {
    var self = this;
    self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};

//====================================================================================================
rad357pl.prototype.getRadioI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};

//====================================================================================================
rad357pl.prototype.pushSongState = function (metadata) {
    var self = this;
    var rpState = {
        status: 'play',
        service: self.serviceName,
        type: 'track',
        trackType: audioFormat,
        radioType: 'rad357pl',
        albumart: metadata.cover,
        uri: flacUri,
        name: metadata.artist + ' - ' + metadata.title,
        title: metadata.title,
        artist: 'Radio 357 ' + channelMix,
        album: metadata.album,
        streaming: true,
        disableUiControls: true,
        duration: metadata.time,
        seek: 0,
        samplerate: '44.1 KHz',
        bitdepth: '16 bit',
        channels: 2
    };

    self.state = rpState;

    //workaround to allow state to be pushed when not in a volatile state
    var vState = self.commandRouter.stateMachine.getState();
    var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];

    queueItem.name = metadata.artist + ' - ' + metadata.title;
    queueItem.artist = 'Radio 357 ' + channelMix;
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
    self.commandRouter.servicePushState(rpState, self.serviceName);
};

//====================================================================================================
rad357pl.prototype.seek = function (position) {
    var self = this;
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + '[rad357pl] seek to ' + position);
    return libQ.resolve();
    //return self.mpdPlugin.seek(position);
};

//====================================================================================================
// Stop
rad357pl.prototype.stop = function () {
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

//====================================================================================================
// Pause
rad357pl.prototype.pause = function () {
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

//====================================================================================================
// Resume
rad357pl.prototype.resume = function () {
    var self = this;

    return self.mpdPlugin.sendMpdCommand('play', [])
        .then(function () {
            // adapt play status and update state machine
            self.state.status = 'play';
            self.commandRouter.servicePushState(self.state, self.serviceName);
            return self.setMetadata(metadataUrl);
    });
};

//====================================================================================================
// Get state
rad357pl.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'rad357pl::getState');


};

//====================================================================================================
//Parse state
rad357pl.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'rad357pl::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

//====================================================================================================
// Announce updated State
rad357pl.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'rad357pl::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


//====================================================================================================
rad357pl.prototype.explodeUri = function(uri) {
	var self = this;
    self.logger.info('[' + Date.now() + '] ' + '[rad357pl] explodeUri: ' + uri);
	var defer = libQ.defer();
    var response = [];

    var uris = uri.split("/");
    var channel = parseInt(uris[1]);
    var query;
    var station;

    station = uris[0].substring(3);

    switch (uris[0]) {
        case 'webrns':
            if (self.timer) {
                self.timer.clear();
            }
            response.push({
                service: self.serviceName,
                type: 'track',
                trackType: self.getRadioI18nString('PLUGIN_NAME'),
                radioType: station,
                albumart: '/albumart?sourceicon=music_service/rad357pl/r35.png',
                uri: self.radioStations.rad357pl[channel].url,
                name: self.radioStations.rad357pl[channel].title,
                duration: 1000
            });
            defer.resolve(response);
            break;
        default:
            defer.resolve();
    }

	return defer.promise;
};

//====================================================================================================
rad357pl.prototype.getAlbumArt = function (data, path) {

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

//====================================================================================================
rad357pl.prototype.setMetadata = function (metadataUrl) {
    var self = this;
    return self.getMetadata(metadataUrl)
    .then(function (eventResponse) {
        if (eventResponse !== null) {
            var result = JSON.parse(eventResponse);
            if (result.time === undefined) {
                self.errorToast('web', 'INCORRECT_RESPONSE');
            }
            self.logger.info('[' + Date.now() + '] ' + '[rad357pl] received new metadata: ' + JSON.stringify(result));
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
            self.logger.info('[' + Date.now() + '] ' + '[rad357pl] setting new timer with duration of ' + duration + ' seconds.');
            self.timer = new RPTimer(self.setMetadata.bind(self), [metadataUrl], duration);
        });
    });
};

//====================================================================================================
rad357pl.prototype.search = function (query) {
    return libQ.resolve();
};

//====================================================================================================
rad357pl.prototype._searchArtists = function (results) {

};

//====================================================================================================
rad357pl.prototype._searchAlbums = function (results) {

};

//====================================================================================================
rad357pl.prototype._searchPlaylists = function (results) {


};

//====================================================================================================
rad357pl.prototype._searchTracks = function (results) {

};

//====================================================================================================
rad357pl.prototype.goto=function(data){
    var self=this
    var defer=libQ.defer()

// Handle go to artist and go to album function

     return defer.promise;
};

//====================================================================================================
rad357pl.prototype.errorToast = function (station, msg) {
    var self = this;

    var errorMessage = self.getRadioI18nString(msg);
    errorMessage.replace('{0}', station.toUpperCase());
    self.commandRouter.pushToastMessage('error',
        self.getRadioI18nString('PLUGIN_NAME'), errorMessage);
};

//====================================================================================================
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
