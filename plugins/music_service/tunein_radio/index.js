'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var TuneIn = require('node-tunein');


module.exports = tuneinRadio;
function tuneinRadio(context) {
  var self = this;

  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
}

tuneinRadio.prototype.onVolumioStart = function() {
  var self = this;
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
  this.config = new (require('v-conf'))();
  this.config.loadFile(configFile);

  return libQ.resolve();
}

tuneinRadio.prototype.onStart = function() {
  var self = this;
  var defer = libQ.defer();

  self.logger.info('TuneIn onStart');
  self.addToBrowseSources();
  self.tuneIn = new TuneIn();

  self.mpdPlugin = self.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

  // Once the Plugin has successfull started resolve the promise
  defer.resolve();

  return defer.promise;
};

tuneinRadio.prototype.onStop = function() {
  var self = this;
  var defer = libQ.defer();

  // Once the Plugin has successfull stopped resolve the promise
  defer.resolve();

  return libQ.resolve();
};

tuneinRadio.prototype.onRestart = function() {
  var self = this;
  // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

tuneinRadio.prototype.getUIConfig = function() {
  var defer = libQ.defer();
  var self = this;

  var langCode = this.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + langCode + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
  .then(function(uiconf) {
    defer.resolve(uiconf);
  })
  .fail(function() {
      defer.reject(new Error());
    });

  return defer.promise;
};


tuneinRadio.prototype.setUIConfig = function(data) {
  var self = this;
  // Perform your installation tasks here
};

tuneinRadio.prototype.getConf = function(varName) {
  var self = this;
  // Perform your installation tasks here
};

tuneinRadio.prototype.setConf = function(varName, varValue) {
  var self = this;
  // Perform your installation tasks here
};

// Playback Controls --------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it
tuneinRadio.prototype.addToBrowseSources = function() {
  var self = this;
  // Use this function to add your music service plugin to music sources
  self.logger.info('TuneIn addToBrowseSources');
  var data = {
    albumart: '/albumart?sourceicon=music_service/webradio/icon.svg',
    icon: 'fa fa-microphone',
    name: 'TuneIn Radio',
    uri: 'tunein',
    plugin_type: 'music_service',
    plugin_name: 'tunein_radio',
  };
  this.commandRouter.volumioAddToBrowseSources(data);
};

tuneinRadio.prototype.handleBrowseUri = function(curUri) {
  var self = this;
  var response;

  self.logger.info('TuneIn handleBrowseUri');
  self.logger.info(curUri);

  if (curUri.startsWith('tunein')) {
    if (curUri == 'tunein') {
      response = self.browseRoot(curUri);
    } else {
      self.logger.error('Unknown URI: ' + curUri);
    }
  } else {
    self.logger.error('Unknown URI: ' + curUri);
  }

  return response;
};



// Define a method to clear, add, and play an array of tracks
tuneinRadio.prototype.clearAddPlayTrack = function(track) {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'tuneinRadio::clearAddPlayTrack');

  self.commandRouter.logger.info(JSON.stringify(track));

  return self.sendSpopCommand('uplay', [track.uri]);
};

tuneinRadio.prototype.seek = function(timepos) {
  this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'tuneinRadio::seek to ' + timepos);

  return this.sendSpopCommand('seek ' + timepos, []);
};

// Stop
tuneinRadio.prototype.stop = function() {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'tuneinRadio::stop');
};

// Spop pause
tuneinRadio.prototype.pause = function() {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'tuneinRadio::pause');
};

// Get state
tuneinRadio.prototype.getState = function() {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'tuneinRadio::getState');
};

// Parse state
tuneinRadio.prototype.parseState = function(sState) {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'tuneinRadio::parseState');

  // Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
tuneinRadio.prototype.pushState = function(state) {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'tuneinRadio::pushState');

  return self.commandRouter.servicePushState(state, self.servicename);
};


tuneinRadio.prototype.explodeUri = function(uri) {
  var self = this;
  var defer = libQ.defer();

  // Mandatory: retrieve all info for a given URI

  return defer.promise;
};

tuneinRadio.prototype.getAlbumArt = function(data, path) {

  var artist, album;

  if (data != undefined && data.path != undefined) {
    path = data.path;
  }

  var web;

  if (data != undefined && data.artist != undefined) {
    artist = data.artist;
    if (data.album != undefined) {
      album = data.album;
    } else {
      album = data.artist;
    }

    web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large'
  }

  var url = '/albumart';

  if (web != undefined) {
    url = url + web;
  }

  if (web != undefined && path != undefined) {
    url = url + '&';
  } else if (path != undefined) {
    url = url + '?';
  }

  if (path != undefined) {
    url = url + 'path=' + nodetools.urlEncode(path);
  }

  return url;
};


tuneinRadio.prototype.search = function(query) {
  var self = this;
  var defer = libQ.defer();

  // Mandatory, search. You can divide the search in sections using following functions

  return defer.promise;
};

tuneinRadio.prototype._searchArtists = function(results) {

};

tuneinRadio.prototype._searchAlbums = function(results) {

};

tuneinRadio.prototype._searchPlaylists = function(results) {


};

tuneinRadio.prototype._searchTracks = function(results) {

};

tuneinRadio.prototype.listCountries = function(results) {

};

tuneinRadio.prototype.browseRoot = function(uri) {
  var self = this;
  var defer = libQ.defer();

  self.logger.info('TuneIn: browseRoot');
  self.logger.info('TuneIn: Parsing Results For ' + uri);

  var tuneinRoot = self.tuneIn.browse();
  self.logger.info('Calling browse method');
  tuneinRoot.then(function(results) {
    var response = {
      navigation: {
        lists: [
          {
            availableListViews: [
              'list',
            ],
            items: [
            ],
          },
        ],
        prev: {
          url: '/',
        },
      },
    };

    var body = results.body;
    for (var i in body) {
      if (body[i].type == 'link') {
        response.navigation.lists[0].items.push({
          service: 'tunein',
          type: body[i].key,
          title: body[i].text,
          artist: '',
          album: '',
          icon: 'fa fa-folder-open-o',
          uri: 'tunein/' + body[i].key,
        });
        self.logger.info('Added new entry ' + body[i].key + ' => ' + body[i].text);
      } else {
        self.logger.warn('Unknown element type ' + body[i].type + ' ignored');
      }
    }
    defer.resolve(response);
  })
    .catch(function(err) {
      self.logger.error(err);
      defer.reject(new Error('Cannot list main categories: ' + err));
    });

  return defer.promise;
}
