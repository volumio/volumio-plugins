'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
const http = require('https');

module.exports = ControllerAudiophileAudition;

function ControllerAudiophileAudition(context) {
    var self = this;

    self.context = context;
    self.commandRouter = this.context.coreCommand;
    self.logger = this.context.logger;
    self.configManager = this.context.configManager;

    self.state = {};
};

ControllerAudiophileAudition.prototype.onVolumioStart = function () {
    var self = this;
    self.configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	self.getConf(self.configFile);
    self.apiDelay = self.config.get('apiDelay');
    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] API delay: ' + self.apiDelay);

    return libQ.resolve();
};

ControllerAudiophileAudition.prototype.getConfigurationFiles = function () {
    return ['config.json'];
};

ControllerAudiophileAudition.prototype.onStart = function () {
    var self = this;

    var defer=libQ.defer();
    self.logger.info('Entering onStart');

    self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

    self.loadRadioI18nStrings();
    self.addRadioResource();
    self.addToBrowseSources();

    self.serviceName = "audiophile_audition";

    // Once the Plugin has successfull started resolve the promise
    //return libQ.resolve();
    defer.resolve();

    return defer.promise;
};

ControllerAudiophileAudition.prototype.onStop = function () {
    var self = this;

    self.removeFromBrowseSources();
    return libQ.resolve();
};

ControllerAudiophileAudition.prototype.onRestart = function () {
    var self = this;
    // Optional, use if you need it
    return libQ.resolve();
};


// Configuration Methods -----------------------------------------------------------------------------
ControllerAudiophileAudition.prototype.getUIConfig = function () {
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


ControllerAudiophileAudition.prototype.setUIConfig = function (data) {
    var self = this;
    var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');

    return libQ.resolve();
};

ControllerAudiophileAudition.prototype.getConf = function (configFile) {
    var self = this;

    self.config = new (require('v-conf'))();
    self.config.loadFile(configFile);
};

ControllerAudiophileAudition.prototype.setConf = function (varName, varValue) {
    var self = this;
    fs.writeJsonSync(self.configFile, JSON.stringify(conf));
};

ControllerAudiophileAudition.prototype.updateConfig = function (data) {
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
ControllerAudiophileAudition.prototype.addToBrowseSources = function () {
    // Use this function to add your music service plugin to music sources
    var self = this;

    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] addToBrowseSources: ');
    self.commandRouter.volumioAddToBrowseSources({
        name: self.getRadioI18nString('PLUGIN_NAME'),
        uri: 'audiophile_audition',
        plugin_type: 'music_service',
        plugin_name: "audiophile_audition",
        albumart: '/albumart?sourceicon=music_service/audiophile_audition/aa.png'
    });
};

ControllerAudiophileAudition.prototype.removeFromBrowseSources = function () {
    // Use this function to add your music service plugin to music sources
    var self = this;

    self.commandRouter.volumioRemoveToBrowseSources(self.getRadioI18nString('PLUGIN_NAME'));
};

ControllerAudiophileAudition.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    var response;
    self.logger.info('Entering handleBrowseUri with ' + curUri);
    if (curUri.startsWith('audiophile_audition')) {
        response = self.getRadioContent('audiophile_audition');
    }
    return response
        .fail(function (e) {
            self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] handleBrowseUri failed');
            libQ.reject(new Error());
        });
};

ControllerAudiophileAudition.prototype.getRadioContent = function (station) {
    var self = this;
    var response;
    var radioStation;
    var defer = libQ.defer();

    radioStation = self.radioStations.audiophile_audition;

    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] entering getRadioContent');
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
ControllerAudiophileAudition.prototype.clearAddPlayTrack = function (track) {
    var self = this;

    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] clearAddPlayTrack: ' + track.url);
        
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
                    'WAIT_FOR_RADIO_CHANNEL');
                    //self.getRadioI18nString('WAIT_FOR_RADIO_CHANNEL'));

                return self.mpdPlugin.sendMpdCommand('play', []);
            })
            .then(function () {
		self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
		return libQ.resolve();
            })
            .fail(function (e) {
                return libQ.reject(new Error());
            });
};

ControllerAudiophileAudition.prototype.seek = function (position) {
    var self = this;
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + '[AudiophileAudition] seek to ' + position);
    return libQ.resolve();
    //return self.mpdPlugin.seek(position);
};

// Stop
ControllerAudiophileAudition.prototype.stop = function () {
    var self = this;
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
ControllerAudiophileAudition.prototype.pause = function () {
    var self = this;

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
ControllerAudiophileAudition.prototype.resume = function () {
    var self = this;

  return self.mpdPlugin.resume().then(function () {
    return self.mpdPlugin.getState().then(function (state) {
      return self.commandRouter.stateMachine.syncState(state, self.serviceName);
    });
  });
};

ControllerAudiophileAudition.prototype.explodeUri = function (uri) {
    var self = this;
    var defer = libQ.defer();
    var response = [];

    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] explodeUri' + uri);
    var uris = uri.split("/");
    // The channel is the number behind webaa 
    // in the radio_station.json file
    var channel = parseInt(uris[1]);
    var query;
    var station;
    var sleep = require('sleep');

    station = uris[0].substring(3);

    switch (uris[0]) {
        case 'webaa':
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

ControllerAudiophileAudition.prototype.getAlbumArt = function (data, path) {

    var artist, album;

    self.logger.info('[' + Date.now() + '] ' + '[AudiophileAudition] entering getAlbumArt');
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

ControllerAudiophileAudition.prototype.addRadioResource = function () {
    var self = this;

    var radioResource = fs.readJsonSync(__dirname + '/radio_stations.json');
    var baseNavigation = radioResource.baseNavigation;

    self.radioStations = radioResource.stations;
    self.rootNavigation = JSON.parse(JSON.stringify(baseNavigation));
    self.radioNavigation = JSON.parse(JSON.stringify(baseNavigation));
};

ControllerAudiophileAudition.prototype.loadRadioI18nStrings = function () {
    var self = this;
    self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};

ControllerAudiophileAudition.prototype.getRadioI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};

ControllerAudiophileAudition.prototype.search = function (query) {
    return libQ.resolve();
};
