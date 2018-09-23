'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = require('v-conf');
var RssParser = require('rss-parser');
var _ = require('lodash');

module.exports = ControllerPodcast;

function ControllerPodcast(context) {
	var self = this;

  self.context = context;
  self.commandRouter = this.context.coreCommand;
  self.logger = this.context.logger;
  self.configManager = this.context.configManager;

  self.logger.info("ControllerPodcast::constructor");
}

ControllerPodcast.prototype.onVolumioStart = function()
{
  var self = this;

  self.configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
  self.getConf(self.configFile);

  return libQ.resolve();
};

ControllerPodcast.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

ControllerPodcast.prototype.onStart = function() {
  var self = this;

  self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service','mpd');

  self.loadPodcastI18nStrings();
  self.loadPodcastsResource();
  self.addToBrowseSources();

  self.serviceName = "podcast";

  return libQ.resolve();
};

ControllerPodcast.prototype.onStop = function() {
  var self = this;

  return libQ.resolve();
};

ControllerPodcast.prototype.onRestart = function() {
  var self = this;

  return libQ.resolve();
};

// Configuration Methods -----------------------------------------------------
ControllerPodcast.prototype.getConf = function(configFile) {
  var self = this;

  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
};

ControllerPodcast.prototype.setConf = function(conf) {
  var self = this;

  fs.writeJsonSync(self.configFile, JSON.stringify(conf));
};

ControllerPodcast.prototype.getUIConfig = function() {
  var self = this;
  var defer = libQ.defer();
  var lang_code = self.commandRouter.sharedVars.get('language_code');

  self.getConf(this.configFile);
  self.commandRouter.i18nJson(__dirname+'/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
  .then(function(uiconf)
  {
    self.podcasts.items.forEach(function (entry) {
      var podcastItem = {
        label: entry.title,
        value: entry.id
      };
      uiconf.sections[0].content[0].options.push(podcastItem);
    });
    uiconf.sections[0].content[0].value = uiconf.sections[0].content[0].options[0];

    defer.resolve(uiconf);
  })
  .fail(function()
  {
    defer.reject(new Error());
  });

  return defer.promise;
};

ControllerPodcast.prototype.updateUIConfig = function() {
  var self=this;

  var lang_code = self.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname+'/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
  .then(function(uiconf)
  {
    self.podcasts.items.forEach(function (entry) {
      self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[0].options', {
        label: entry.title,
        value: entry.id
      });
    });
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value', {
      value: self.podcasts.items[0].title,
      label: self.podcasts.items[0].title
    });
    self.commandRouter.broadcastMessage('pushUiConfig', uiconf);

    fs.writeJsonSync(__dirname+'/podcasts_list.json', self.podcasts);
  })
  .fail(function()
  {
    new Error();
  });
};

ControllerPodcast.prototype.setUIConfig = function(data)
{
  var self = this;

  var uiconf=fs.readJsonSync(__dirname+'/UIConfig.json');

  return libQ.resolve();
};

// Podcast Methods -----------------------------------------------------
ControllerPodcast.prototype.addPodcast = function(data) {
  var self=this;
  var defer = libQ.defer();
  var rssUrl = data['input_podcast'];
  var message;

  if ((rssUrl === null) || (rssUrl.length === 0)) {
    self.showDialogMessage(self.getPodcastI18nString('PODCAST_URL_PROBLEM'));
    return;
  }

  var findItem = _.find(self.podcasts.items, function(item) {
    return item.url === rssUrl;
  });
  if (findItem !== undefined) {
    self.commandRouter.pushToastMessage(
        'info',
        self.getPodcastI18nString('PLUGIN_NAME'),
        self.getPodcastI18nString('DUPLICATED_PODCAST')
    );
    return;
  }

  self.commandRouter.pushToastMessage(
      'info',
      self.getPodcastI18nString('PLUGIN_NAME'),
      self.getPodcastI18nString('ADD_PODCAST_PROCESSING')
  );

  var rssParser = new RssParser({
    headers: {
      'Accept': '*/*',
      'User-Agent': 'Mozilla/5.0'
    },
    feed: {
      channel: ['image']
    }
  });

  rssParser.parseURL(rssUrl,
    function (err, feed) {
      var imageUrl, podcastItem;

      if (err) {
        self.showDialogMessage(
            self.getPodcastI18nString('PODCAST_URL_PARSING_PROBLEM'));
        return;
      }

      if ( (feed.image !== undefined) && (feed.image.url !== undefined) )
        imageUrl = feed.image.url;
      else if ( (feed.itunes !== undefined)  && (feed.itunes.image !== undefined) )
        imageUrl = feed.itunes.image;

      podcastItem = {
        id: Math.random().toString(36).substring(2, 10) +
            Math.random().toString(36).substring(2, 10),
        title: feed.title,
        url: rssUrl,
        image: imageUrl
      };

      self.podcasts.items.push(podcastItem);
      self.updateUIConfig();

      message = self.getPodcastI18nString('ADD_PODCAST_COMPLETION');
      message = message.replace('{0}', feed.title);
      self.commandRouter.pushToastMessage(
          'success',
          self.getPodcastI18nString('PLUGIN_NAME'),
          message
      );
      defer.resolve({});
  });

  return defer.promise;
};

ControllerPodcast.prototype.deletePodcast = function(data) {
  var self = this;
  var defer = libQ.defer();
  var id = data['list_podcast'].value;
  var title = data['list_podcast'].label;

  var message = self.getPodcastI18nString('DELETE_CONFIRM_MESSAGE');
  message = message.replace('{0}', title);

  var modalData = {
    title: self.getPodcastI18nString('PLUGIN_NAME'),
    message: message,
    size: 'md',
    buttons: [
      {
        name: self.getPodcastI18nString('CANCEL'),
        class: 'btn btn-info'
      },
      {
        name: self.getPodcastI18nString('CONFIRM'),
        class: 'btn btn-primary',
        emit:'callMethod',
        payload:{'endpoint':'music_service/podcast','method':'deletePodcastConfirm','data': [id, title]}
      }
    ]
  };
  self.commandRouter.broadcastMessage("openModal", modalData);
  return defer.promise;
};

ControllerPodcast.prototype.deletePodcastConfirm = function(data) {
  var self=this;
  var defer = libQ.defer();

  self.podcasts.items = _.remove(self.podcasts.items, function(item) {
    return item.id !== data[0];
  });

  self.updateUIConfig();
  var message = self.getPodcastI18nString('DELETE_PODCAST_COMPLETION');
  message = message.replace('{0}', data[1]);
  self.commandRouter.pushToastMessage(
      'success',
      self.getPodcastI18nString('PLUGIN_NAME'),
      message
  );
  return defer.promise;
};

ControllerPodcast.prototype.showDialogMessage = function(message) {
  var self=this;

  var modalData = {
    title: self.getPodcastI18nString('PLUGIN_NAME'),
    message: message,
    size: 'md',
    buttons: [
      {
        name: self.getPodcastI18nString('CLOSE'),
        class: 'btn btn-info'
      }
    ]
  };
  self.commandRouter.broadcastMessage("openModal", modalData);
};

// Playback Controls ---------------------------------------------------------
ControllerPodcast.prototype.addToBrowseSources = function () {
  var self = this;

  self.commandRouter.volumioAddToBrowseSources({
    name: self.getPodcastI18nString('PLUGIN_NAME'),
    uri: 'podcast',
    plugin_type: 'music_service',
    plugin_name: "podcast",
    albumart: '/albumart?sourceicon=music_service/podcast/podcast.svg'
  });
};

ControllerPodcast.prototype.handleBrowseUri = function (curUri) {
  var self = this;
  var response;

  if (curUri.startsWith('podcast')) {
    if (curUri === 'podcast') {
      response = self.getRootContent();
    }
    else {
      response =  self.getPodcastContent(curUri);
    }
  }

  return response;
};

ControllerPodcast.prototype.getRootContent = function() {
  var self=this;
  var response;
  var defer = libQ.defer();

  response = {
    navigation: {
      lists: [
        {
          title: self.getPodcastI18nString('PLUGIN_NAME'),
          icon: 'fa fa-podcast',
          availableListViews: ["list", "grid"],
          items: []
        }
      ],
      prev: {
        "uri": "/"
      }
    }
  };

  self.podcasts.items.forEach(function (entry, index) {
    var imageUrl;

    imageUrl = entry.image;
    if (imageUrl === undefined)
      imageUrl = '/albumart?sourceicon=music_service/podcast/default.jpg';
    var podcast = {
      service: self.serviceName,
      type: 'folder',
      title: entry.title,
      uri: 'podcast/' + index,
      albumart: imageUrl
    };
    response.navigation.lists[0].items.push(podcast);
  });
  defer.resolve(response);
  return defer.promise;
};

ControllerPodcast.prototype.getPodcastContent = function(uri) {
  var self = this;
  var defer = libQ.defer();
  var uris = uri.split('/');
  var response = {
    "navigation": {
      "lists": [
        {
          icon: 'fa fa-podcast',
          "availableListViews": [
            "list", "grid"
          ],
          "items": [
          ]
        }
      ],
      "prev": {
        "uri": "podcast"
      }
    }
  };

  var message = self.getPodcastI18nString('WAIT_PODCAST_ITEMS');
  message = message.replace('{0}', self.podcasts.items[uris[1]].title);
  self.commandRouter.pushToastMessage(
      'info',
      self.getPodcastI18nString('PLUGIN_NAME'),
      message
  );

  var rssParser = new RssParser({
    headers: {
      'Accept': '*/*',
      'User-Agent': 'Mozilla/5.0'
    },
    feed: {
      channel: ['image']
    }
  });
  rssParser.parseURL(self.podcasts.items[uris[1]].url,
    function (err, feed) {
      response.navigation.lists[0].title = feed.title;

      feed.items.forEach(function (entry) {
        var podcastItem = {
          service: self.serviceName,
          type: 'song',
          title: entry.title,
          icon: 'fa fa-podcast',
          uri: 'podcast/' + uris[1] + '/' + entry.enclosure.url + '|' + entry.title
        };
        response.navigation.lists[0].items.push(podcastItem);
      });
      defer.resolve(response);
    });

  return defer.promise;
};

ControllerPodcast.prototype.explodeUri = function (uri) {
  var self = this;
  var defer = libQ.defer();
  var uris = uri.split("/", 2);
  var response;

  var uriInfo = uri.match(/podcast\/[0-9]+\/(.*)\|(.*)/);
  response = {
    service: self.serviceName,
    type: 'track',
    uri: uriInfo[1],
    trackType: self.getPodcastI18nString('PLUGIN_NAME'),
    name: uriInfo[2],
    albumart: self.podcasts.items[uris[1]].image,
    serviceName: self.serviceName
  };
  defer.resolve(response);

  return defer.promise;
};

ControllerPodcast.prototype.clearAddPlayTrack = function(track) {
  var self = this;
  var defer = libQ.defer();

  return self.mpdPlugin.sendMpdCommand('stop', [])
    .then(function() {
        return self.mpdPlugin.sendMpdCommand('clear', []);
    })
    .then(function() {
        return self.mpdPlugin.sendMpdCommand('add "'+track.uri+'"',[]);
    })
    .then(function () {
      self.mpdPlugin.clientMpd.on('system', function (status) {
        if (status !== 'playlist' && status !== undefined) {
          self.getState().then(function (state) {
            if (state.status === 'play') {
              return self.pushState(state);
            }
          });
        }
      });

      return self.mpdPlugin.sendMpdCommand('play', []).then(function () {
        return self.getState().then(function (state) {
          return self.pushState(state);
        });
      });

    })
    .fail(function (e) {
      return defer.reject(new Error());
    });
};

ControllerPodcast.prototype.getState = function () {
  var self = this;

  return self.mpdPlugin.sendMpdCommand('status', [])
  .then(function (objState) {
    var collectedState = self.mpdPlugin.parseState(objState);

    // If there is a track listed as currently playing, get the track info
    if (collectedState.position !== null) {
      var trackinfo=self.commandRouter.stateMachine.getTrack(self.commandRouter.stateMachine.currentPosition);
      if (collectedState.samplerate) trackinfo.samplerate = collectedState.samplerate;
      if (collectedState.bitdepth) trackinfo.bitdepth = collectedState.bitdepth;

      collectedState.isStreaming = trackinfo.isStreaming != undefined ? trackinfo.isStreaming : false;
      collectedState.title = trackinfo.title;
      collectedState.artist = trackinfo.artist;
      collectedState.album = trackinfo.album;
      collectedState.uri = trackinfo.uri;
      collectedState.trackType = trackinfo.trackType.split('?')[0];
      collectedState.serviceName = trackinfo.serviceName;
      return collectedState;
    } else {
      collectedState.isStreaming = false;
      collectedState.title = null;
      collectedState.artist = null;
      collectedState.album = null;
      collectedState.uri = null;
      return collectedState;
    }
  });
};

ControllerPodcast.prototype.pushState = function (state) {
  var self = this;

  if (state.serviceName === self.serviceName)
    return self.commandRouter.servicePushState(state, self.serviceName);
};

ControllerPodcast.prototype.seek = function (position) {
  var self = this;

  return self.mpdPlugin.seek(position);
};

ControllerPodcast.prototype.stop = function() {
	var self = this;

  self.commandRouter.pushToastMessage(
      'info',
      self.getPodcastI18nString('PLUGIN_NAME'),
      self.getPodcastI18nString('STOP_PODCAST')
  );

  return self.mpdPlugin.stop().then(function () {
    return self.getState().then(function (state) {
      return self.pushState(state);
    });
  });
};

ControllerPodcast.prototype.pause = function() {
  var self = this;

  return self.mpdPlugin.pause().then(function () {
    return self.getState().then(function (state) {
      return self.pushState(state);
    });
  });
};

ControllerPodcast.prototype.resume = function() {
  var self = this;

  return self.mpdPlugin.resume().then(function () {
    return self.getState().then(function (state) {
      return self.pushState(state);
    });
  });
};


// resource functions for Podcast -----------------------------------
ControllerPodcast.prototype.loadPodcastsResource = function() {
  var self=this;

  self.podcasts = fs.readJsonSync(__dirname+'/podcasts_list.json');
};

ControllerPodcast.prototype.loadPodcastI18nStrings = function () {
  var self=this;

  try {
    var language_code = self.commandRouter.sharedVars.get('language_code');
    self.i18nStrings=fs.readJsonSync(__dirname+'/i18n/strings_'+language_code+".json");
  } catch(e) {
    self.i18nStrings=fs.readJsonSync(__dirname+'/i18n/strings_en.json');
  }

  self.i18nStringsDefaults=fs.readJsonSync(__dirname+'/i18n/strings_en.json');
};

ControllerPodcast.prototype.getPodcastI18nString = function (key) {
  var self=this;

  if (self.i18nStrings[key] !== undefined)
    return self.i18nStrings[key];
  else
    return self.i18nStringsDefaults[key];
};
