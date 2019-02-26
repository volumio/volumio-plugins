'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var TuneIn = require('node-tunein-radio');
var url = require('url');

module.exports = tuneinRadio;
function tuneinRadio(context) {
  var self = this;

  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;

  self.resetHistory();
}

tuneinRadio.prototype.resetHistory = function() {
  var self = this;

  self.urlHistory = [];
  self.historyIndex = -1;
}

tuneinRadio.prototype.historyAdd = function(uri) {
  var self = this;

  // If the new url is equal to the previous one
  // this means it's a "Back" action
  if (self.urlHistory[self.historyIndex - 1] == uri) {
    self.historyPop()
  } else {
    self.urlHistory.push(uri);
    self.historyIndex++;
  }
}

tuneinRadio.prototype.historyPop = function(uri) {
  var self = this;

  self.urlHistory.pop();
  self.historyIndex--;
}

tuneinRadio.prototype.getPrevUri = function() {
  var self = this;
  var url;

  if (self.historyIndex >= 0) {
    url = self.urlHistory[self.historyIndex - 1];
  } else {
    url = '/';
  }

  return url;
}

tuneinRadio.prototype.onVolumioStart = function() {
  var self = this;
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
  this.config = new (require('v-conf'))();
  this.config.loadFile(configFile);

  self.refreshConfig();
  return libQ.resolve();
}

tuneinRadio.prototype.refreshConfig = function() {
  var self = this;

  if (self.config.get('popular', false) === true) {
    self.enablePopular = true;
  } else {
    self.enablePopular = false;
  }
  if (self.config.get('best', false) === true) {
    self.enableBest = true;
  } else {
    self.enableBest = false;
  }
  if (self.config.get('experimental', false) === true) {
    self.enableExperimental = true;
  } else {
    self.enableExperimental = false;
  }
}

tuneinRadio.prototype.getConfigurationFiles = function() {
  return ['config.json'];
}

tuneinRadio.prototype.onStart = function() {
  var self = this;
  var defer = libQ.defer();

  var tuneinOptions = {
    protocol: 'https',
    cacheRequests: true,
    cacheTTL: 1000 * 60 * 60,
  };

  self.addToBrowseSources();
  self.tuneIn = new TuneIn(tuneinOptions);

  self.navTree = {};

  var navTreeRoot = self.initNavTree();
  self.logger.info(navTreeRoot);
  navTreeRoot.then(function(results) {
    results.forEach (function(item) {
      self.logger.info('[TuneIn] Element: ' + item.key);
      var el = {
        type: item.type,
        text: item.text,
        URL: item.URL,
      }
      self.navTree[item.key] = el;
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
    uiconf.sections[0].content[0].value = self.config.get('popular', false);
    uiconf.sections[0].content[1].value = self.config.get('best', false);
    uiconf.sections[1].content[0].value = self.config.get('experimental', false);

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
};

tuneinRadio.prototype.saveMainCategoriesConf = function(data) {
  var self = this;
  var defer = libQ.defer();

  self.config.set('popular', data['popular']);
  self.config.set('best', data['best']);
  self.refreshConfig();
  self.commandRouter.pushToastMessage('success', 'TuneIn Radio', 'Main Categories Configuration Saved');
  return defer.promise;
};

tuneinRadio.prototype.saveTestingConf = function(data) {
  var self = this;
  var defer = libQ.defer();

  self.config.set('experimental', data['experimental']);
  self.refreshConfig();
  self.commandRouter.pushToastMessage('success', 'TuneIn Radio', 'Testing Configuration Saved');
  return defer.promise;
};


// Playback Controls --------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it
tuneinRadio.prototype.addToBrowseSources = function() {
  var self = this;
  // Use this function to add your music service plugin to music sources
  self.logger.info('TuneIn addToBrowseSources');
  var data = {
    albumart: '/albumart?sourceicon=music_service/tunein_radio/tunein.svg ',
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

  self.logger.info('TuneIn handleBrowseUri: ' + curUri);

  if (curUri.startsWith('tunein')) {
    if (curUri == 'tunein') {
      self.resetHistory();
      self.historyAdd(curUri);
      response = self.browseRoot(curUri);
    } else {
      self.historyAdd(curUri);
      var l1Exp = '^tunein\/([a-z]+)$';
      var l1Match = curUri.match(l1Exp);

      if (l1Match != null) {
        response = self.browseCategory(l1Match[1]);
        return response;
      } else {
        var l2Exp = /^tunein\/(browse|show)\/\?+([=0-9a-zA-Z&:~]+)$/
        let l2Match = curUri.match(l2Exp);
        if (l2Match != null) {
          response = self.browseList(curUri, l2Match[1]);
          return response;
        }
        self.logger.error('Unknown URI: ' + curUri);
      }
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

  let parsedUrl = url.parse(uri, true);
  let streamId = parsedUrl.query.id;

  let streamUrl = self.tuneIn.tune_radio(streamId);
  let streamDescribe = self.tuneIn.describe(streamId);

  self.logger.error('[TuneIn] Fetching details for stream: ' + streamId);
  Promise.all([streamUrl, streamDescribe]).then(function(results) {
    explodedUri.uri = results[0].body[0].url;
    explodedUri.name = results[1].body[0].name;
    explodedUri.albumart = results[1].body[0].logo;

    defer.resolve(explodedUri);
  })
    .catch(function(err) {
      self.logger.error(err);
      defer.reject(new Error('Cannot retrieve details for stram ' + uri + ': ' + err));
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

  var response = {
    title: 'TuneIn Radio',
    icon: 'fa icon',
    availableListViews: [
      'list',
    ],
    items: [

    ],
  };

  let tuneinSearch = self.tuneIn.search(query.value);
  tuneinSearch.then(function(results) {
    var body = results.body;
    for (var i in body) {
      let item = self.getNavigationItem(body[i], 'tunein_radio');
      if (item) {
        response.items.push(item);
      }
    }
    defer.resolve(response);
  })
    .catch(function(err) {
      self.logger.error(err);
      defer.reject(new Error('Cannot search for ' + query.value + ': ' + err));
    });

  return defer.promise;
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
    defer.reject(new Error('[TuneIn] Cannot list navTree Root nodes: ' + err));
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
    if (el == 'podcast' && self.enableExperimental === false) {
        continue;
    }

    rootTree.navigation.lists[0].items.push({
      service: 'tunein_radio',
      type: 'streaming-category',
      title: self.navTree[el].text,
      artist: '',
      album: '',
      icon: self.getNavigationItemIcon(self.navTree[el].text),
      uri: 'tunein/' + el,
    });
    self.logger.info('[TuneIn] Added new entry ' + el + ' => ' + self.navTree[el].text);
  }

  if (self.enablePopular === true) {
    rootTree.navigation.lists[0].items.push({
      service: 'tunein_radio',
      type: 'streaming-category',
      title: 'Popular',
      artist: '',
      album: '',
      icon: 'fa fa-thumbs-o-up',
      uri: 'tunein/popular',
    });
  }
  if (self.enableBest === true) {
    rootTree.navigation.lists[0].items.push({
      service: 'tunein_radio',
      type: 'streaming-category',
      title: 'Best',
      artist: '',
      album: '',
      icon: 'fa fa-diamond',
      uri: 'tunein/best',
    });
  }

  defer.resolve(rootTree);
  return defer.promise;
}

tuneinRadio.prototype.browseList = function(uri, listType) {
  var self = this;
  var defer = libQ.defer();
  var response;
  var tuneinRoot;

  self.logger.info('[TuneIn] Fetching (' + listType + ') results For ' + uri);

  let parsedUrl = url.parse(uri, true);
  if (listType == 'show') {
    tuneinRoot = self.tuneIn.browse_show(parsedUrl.query);
  } else {
    tuneinRoot = self.tuneIn.browse(parsedUrl.query);
  }
  tuneinRoot.then(function(results) {
    response = self.parseResults(results, parsedUrl.search);
    defer.resolve(response);
  })
    .catch(function(err) {
      self.logger.error(err);
      defer.reject(new Error('Cannot list category items for ' + uri + ': ' + err));
    });

  return defer.promise;
}

tuneinRadio.prototype.browseCategory = function(category) {
  var self = this;
  var defer = libQ.defer();
  var response;
  var tuneinRoot;

  self.logger.info('[TuneIn] Calling browse function for: ' + category);

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
  } else if (category == 'popular') {
    tuneinRoot = self.tuneIn.browse_popular();
  } else if (category == 'best') {
    tuneinRoot = self.tuneIn.browse_best();
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

  self.logger.info('[TuneIn] Parsing results for: ' + category);

  var response = {
    navigation: {
      lists: [ ],
      prev: {
        uri: self.getPrevUri(),
      },
    },
  };

  let body = results.body;
  let curList = 0;

  for (var i in body) {
    if (body[i].children) {
      // This is a list, parse it properly
      let childList = self.getNavigationList(body[i], category);
      if (childList) {
        response.navigation.lists.push(childList)
        curList++;
      }
    } else {
      if (response.navigation.lists[curList] == undefined) {
        let firstList = {
          availableListViews: [
            'list',
          ],
          items: [],
        };
        response.navigation.lists.push(firstList);
      }
      let item = self.getNavigationItem(body[i], category);
      if (item) {
        response.navigation.lists[curList].items.push(item);
      }
    }
  }

  return(response);
}

tuneinRadio.prototype.getNavigationList = function(nodeList, category) {
  var self = this;

  var list = {
    availableListViews: [
      'list',
    ],
    items: [
    ],
  };

  if (nodeList.text) {
    list.title = nodeList.text;
  }
  list.icon = 'fa icon';

  let children = nodeList.children;
  for (var i in children) {
    let item = self.getNavigationItem(children[i], category);
    if (item) {
      list.items.push(item);
    }
  }

  return list;
}

// TODO Do we really need a custom service Type, hence passing
// around the category string?
tuneinRadio.prototype.getNavigationItem = function(node, category) {
  var self = this;

  let servType = '';
  let albumart = '';
  let icon = '';
  let uri = '';

  if (node.type == 'audio') {
    servType = 'webradio';
    albumart = node.image;
    uri = node.URL;
  } else if (node.type == 'link') {
    let urlBase = 'tunein/browse/';
    if (node.item == 'show') {
      if (self.enableExperimental === false) {
        self.logger.info('Experimental fetaures disabled, skipping podcast item ' + node);
        return null;
      } else {
        urlBase = 'tunein/show/';
      }
    }

    servType = category;
    icon = 'fa fa-folder-open-o';
    // XXX To be fixed in node-tunein-radio
    if (node.URLObj) {
      uri = urlBase + node.URLObj.search;
    } else {
      let urlObj = url.parse(node.URL);
      uri = urlBase + urlObj.search;
    }
  } else {
    self.logger.warn('[TuneIn] Unknown element type ' + node.type + ' ignored for ' + category + ':' + node);
    return null;
  }

  var item = {
    service: 'tunein_radio',
    type: servType,
    title: node.text,
    artist: '',
    album: '',
    albumart: albumart,
    icon: icon,
    uri: uri,
  };

  self.logger.info('[TuneIn] Added new ' + category + ' entry ' + uri + ' => ' + node.text + ' => ' + node.URL);

  return item;
}

tuneinRadio.prototype.getNavigationItemIcon = function(text) {
  var self = this;
    switch(text) {
        case 'Local Radio':
            return 'fa fa-map-marker'
            break;
        case 'Music':
            return 'fa fa-music'
            break;
        case 'Talk':
            return 'fa fa-comments-o'
            break;
        case 'Sports':
            return 'fa fa-heartbeat'
            break;
        case 'By Location':
            return 'fa fa-globe'
            break;
        case 'By Language':
            return 'fa fa-map-signs'
            break;
        default:
            return 'fa fa-folder-open-o'
    }

}
