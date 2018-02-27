'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var TuneIn = require('node-tunein-radio');
var axios = require('axios');


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

  self.addToBrowseSources();
  self.tuneIn = new TuneIn();

  self.mpdPlugin = self.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

  self.navTree = {};

  var navTreeRoot = self.initNavTree();
  self.logger.info(navTreeRoot);
  navTreeRoot.then(function(results) {
    self.logger.info('[TuneIn] Got elements: ' + results.length);
    results.forEach (function(item) {
      self.logger.info('[TuneIn] Element: ' + item.key);
      var el = {
        type: item.type,
        text: item.text,
        URL: item.URL,
      }
      self.navTree[item.key] = el;
      self.logger.info('[TuneIn] Added element: ' + el);
    });
    defer.resolve(self.navTree);
  })
  .fail(function(error) {
      self.logger.error('[TuneIn] Could not initialize navigation tree');
      defer.reject(new Error());
  });

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
      var l1Exp = '^tunein\/([a-z]+)$';
      var l1Match = curUri.match(l1Exp);

      if (l1Match != null) {
        response = self.browseCategory(l1Match[1]);
        return response;
      } // Else if here
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

  var explodedUri = {
    service: 'webradio',
    type: 'track',
  }


  axios.get(uri, {
    params: {
      render: 'json'
    }
  }).then(function (response) {

    self.logger.info(response.data)

    explodedUri.uri = response.data.body[0].url
    explodedUri.name = response.data.body[0].url

    self.logger.info(explodedUri);
    defer.resolve(explodedUri);
  })
  .catch(function (error) {
    self.logger.error(error);
    defer.resolve(explodedUri);
  });

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

tuneinRadio.prototype.initNavTree = function(uri) {
  var self = this;
  var defer = libQ.defer();

  var tuneinRoot = self.tuneIn.browse();
  tuneinRoot.then(function(results) {
    var navTreeRoot = [];

    var body = results.body;
    for (var i in body) {
      navTreeRoot.push(body[i]);
      self.logger.info('[TuneIn] Pushing element: ' + body[i].key);
    }
    self.logger.info('[TuneIn] Pushed elements: ' + navTreeRoot.length);
    defer.resolve(navTreeRoot);
  })
  .catch(function(err) {
    self.logger.error(err);
    defer.reject(new Error('Cannot list navTree Root nodes: ' + err));
  });

  return defer.promise;
}

tuneinRadio.prototype.browseRoot = function(uri) {
  var self = this;
  var defer = libQ.defer();

  var rootTree = {
    navigation: {
      lists: [
        {
          availableListViews: [
            'grid', 'list',
          ],
          items: [
          ],
        },
      ],
      prev: {
        uri: '/',
      },
    },
  };

  for (var el in self.navTree) {
    rootTree.navigation.lists[0].items.push({
      service: 'tunein_radio',
      type: el,
      title: self.navTree[el].text,
      artist: '',
      album: '',
      icon: 'fa fa-folder-open-o',
      uri: 'tunein/' + el,
    });
    self.logger.info('[TuneIn] Added new entry ' + el + ' => ' + self.navTree[el].text);
  }

  defer.resolve(rootTree);
  return defer.promise;
}

tuneinRadio.prototype.browseCategory = function(category) {
  var self = this;
  var defer = libQ.defer();
  var response;
  var tuneinRoot;

  self.logger.info('[TuneIn] Parsing Results For ' + category);

  if (category == 'local') {
    tuneinRoot = self.tuneIn.browse_local();
  } else if (category == 'music') {
    tuneinRoot = self.tuneIn.browse_music();
  } else if (category == 'talk') {
    tuneinRoot = self.tuneIn.browse_talk();
  } else if (category == 'sports') {
    tuneinRoot = self.tuneIn.browse_sports();
  } else if (category == 'location') {
    tuneinRoot = self.tuneIn.browse_locations();
  } else if (category == 'language') {
    tuneinRoot = self.tuneIn.browse_langs();
  } else if (category == 'podcast') {
    tuneinRoot = self.tuneIn.browse_podcast();
  } else {
    defer.reject(new Error('Unknown category list: ' + category));
  }

  tuneinRoot.then(function(results) {
    response = self.parseResults(results, category);
    defer.resolve(response);
  })
    .catch(function(err) {
      self.logger.error(err);
      defer.reject(new Error('Cannot list category items for ' + category + ': ' + err));
    });

  return defer.promise;
}

tuneinRadio.prototype.parseResults = function(results, category) {
  var self = this;
  var defer = libQ.defer();

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
        uri: 'tunein',
      },
    },
  };


  if (results.body[0].children) {
    let servType = '';
    let icon = '';
    let albumart = '';

    let stationList = results.body[0].children;
    for (var i in stationList) {
      if (stationList[i].type == 'audio') {
        servType = 'webradio';
        albumart = stationList[i].image;
      } else if (stationList[i].type == 'link') {
        servType = category;
        icon = 'fa fa-folder-open-o';
      } else {
        self.logger.warn('[TuneIn] Unknown element type ' + stationList[i].type + ' ignored for local radios');
        continue;
      }
      response.navigation.lists[0].items.push({
        service: 'tunein_radio',
        type: servType,
        title: stationList[i].text,
        artist: '',
        album: '',
        albumart: albumart,
        icon: icon,
        uri: stationList[i].URL,
      });
      self.logger.info('[TuneIn] Added new radio entry ' + stationList[i].preset_id + ' => ' + stationList[i].text + ' => ' + stationList[i].URL);
    }
  } else {
    var body = results.body;
    for (var i in body) {
      self.logger.info(body[i]);
      if (body[i].type == 'link') {
        response.navigation.lists[0].items.push({
          service: 'tunein_radio',
          type: category,
          title: body[i].text,
          artist: '',
          album: '',
          icon: 'fa fa-folder-open-o',
          uri: body[i].URL,
        });
        self.logger.info('[TuneIn] Added new ' + category + ' entry ' + body[i].guide_id + ' => ' + body[i].text + ' => ' + body[i].URL);
      } else {
        self.logger.warn('[TuneIn] Unknown element type (' + body[i].type + ') ignored');
      }
    }
  }
  return(response);
}
