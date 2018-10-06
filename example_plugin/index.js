'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var path = require('path');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

module.exports = ControllerExamplePlugin;
function ControllerExamplePlugin (context) {
  var self = this;

  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
}

ControllerExamplePlugin.prototype.onVolumioStart = function () {
  var self = this;
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  this.config = new (require('v-conf'))();
  this.config.loadFile(configFile);

  return libQ.resolve();
};

ControllerExamplePlugin.prototype.onStart = function () {
  var self = this;
  var defer = libQ.defer();

  // Once the Plugin has successfull started resolve the promise
  defer.resolve();

  return defer.promise;
};

ControllerExamplePlugin.prototype.onStop = function () {
  var self = this;
  var defer = libQ.defer();

  // Once the Plugin has successfull stopped resolve the promise
  defer.resolve();

  return libQ.resolve();
};

ControllerExamplePlugin.prototype.onRestart = function () {
  var self = this;
  // Optional, use if you need it
};

// Configuration Methods -----------------------------------------------------------------------------

ControllerExamplePlugin.prototype.getUIConfig = function () {
  var defer = libQ.defer();
  var self = this;

  var langCode = this.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(path.join(__dirname, 'i18n', 'strings_' + langCode + '.json'),
    path.join(__dirname, 'i18n', 'strings_en.json'),
    path.join(__dirname, 'UIConfig.json'))
    .then(function (uiconf) {
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });

  return defer.promise;
};

ControllerExamplePlugin.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

ControllerExamplePlugin.prototype.setUIConfig = function (data) {
  var self = this;
  // Perform your installation tasks here
};

ControllerExamplePlugin.prototype.getConf = function (varName) {
  var self = this;
  // Perform your installation tasks here
};

ControllerExamplePlugin.prototype.setConf = function (varName, varValue) {
  var self = this;
  // Perform your installation tasks here
};

// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it

ControllerExamplePlugin.prototype.addToBrowseSources = function () {
  // Use this function to add your music service plugin to music sources
  // var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
  this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerExamplePlugin.prototype.handleBrowseUri = function (curUri) {
  var self = this;

  // self.commandRouter.logger.info(curUri);
  var response;

  return response;
};

// Define a method to clear, add, and play an array of tracks
ControllerExamplePlugin.prototype.clearAddPlayTrack = function (track) {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::clearAddPlayTrack');

  self.commandRouter.logger.info(JSON.stringify(track));

  return self.sendSpopCommand('uplay', [track.uri]);
};

ControllerExamplePlugin.prototype.seek = function (timepos) {
  this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::seek to ' + timepos);

  return this.sendSpopCommand('seek ' + timepos, []);
};

// Stop
ControllerExamplePlugin.prototype.stop = function () {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::stop');
};

// Spop pause
ControllerExamplePlugin.prototype.pause = function () {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::pause');
};

// Get state
ControllerExamplePlugin.prototype.getState = function () {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::getState');
};

// Parse state
ControllerExamplePlugin.prototype.parseState = function (sState) {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::parseState');

  // Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
ControllerExamplePlugin.prototype.pushState = function (state) {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::pushState');

  return self.commandRouter.servicePushState(state, self.servicename);
};

ControllerExamplePlugin.prototype.explodeUri = function (uri) {
  var self = this;
  var defer = libQ.defer();

  // Mandatory: retrieve all info for a given URI

  return defer.promise;
};

ControllerExamplePlugin.prototype.getAlbumArt = function (data, path) {
  var artist, album;

  if (data !== undefined && data.path !== undefined) {
    path = data.path;
  }

  var web;

  if (data !== undefined && data.artist !== undefined) {
    artist = data.artist;
    if (data.album !== undefined) {
      album = data.album;
    } else {
      album = data.artist;
    }

    web = '?web=' + encodeURIComponent(artist) + '/' + encodeURIComponent(album) + '/large';
  }

  var url = '/albumart';

  if (web !== undefined) {
    url = url + web;
  }

  if (web !== undefined && path !== undefined) {
    url = url + '&';
  } else if (path !== undefined) {
    url = url + '?';
  }

  if (path !== undefined) {
    url = url + 'path=' + encodeURIComponent(path);
  }

  return url;
};

ControllerExamplePlugin.prototype.search = function (query) {
  var self = this;
  var defer = libQ.defer();

  // Mandatory, search. You can divide the search in sections using following functions

  return defer.promise;
};

ControllerExamplePlugin.prototype._searchArtists = function (results) {

};

ControllerExamplePlugin.prototype._searchAlbums = function (results) {

};

ControllerExamplePlugin.prototype._searchPlaylists = function (results) {

};

ControllerExamplePlugin.prototype._searchTracks = function (results) {

};
