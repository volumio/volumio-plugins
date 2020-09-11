'use strict';

var fs = require('fs-extra');
var ytdl = require('ytdl-core');
var libQ = require('kew');
var gapis = require('googleapis');
var dur = require("iso8601-duration");
var OAuth2Client = gapis.auth.OAuth2;
var superagent = require('superagent');

const { ROOT_NAV, BASE_STATUS, BROWSE_SOURCE } = require('./constants');

module.exports = Youtube;

function Youtube(context) {
  var self = this;

  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.context.logger;
  self.configManager = self.context.configManager;
  self.addQueue = [];
  self.state = {};
  self.stateMachine = self.commandRouter.stateMachine;
}

Youtube.prototype.onVolumioStart = function () {
  var self = this;

  var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
  self.configFile = configFile;

  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
  self.resultsLimit = self.config.get('results_limit');
  this.loadI18n();

  return libQ.resolve();
};

Youtube.prototype.onStart = function () {
  //Getting the mdp plugin
  this.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
  this.initializeAuth();
  this.logger.info("Youtube::onStart Adding to browse sources");

  return libQ.resolve();
}

Youtube.prototype.onStop = function () {
  this.removeToBrowseSources();
  return libQ.resolve();
};

Youtube.prototype.onRestart = function () {
  return libQ.resolve();
};

Youtube.prototype.onInstall = function () {
  //Perform your installation tasks here
};

Youtube.prototype.onUninstall = function () {
  //Perform your deinstallation tasks here
};

Youtube.prototype.detachQ = function (f, params = []) {
  var deferred = libQ.defer();
  this[f](...params).then((res) => {
    deferred.resolve(res);
  }).catch((e) => {
    deferred.reject(e);
  });
  return deferred;
}

Youtube.prototype.getUIConfig = function () {
  return this.detachQ('getUIConfigAsync');
};

Youtube.prototype.getUIConfigAsync = async function () {
  var lang_code = this.commandRouter.sharedVars.get('language_code');
  const uiconf = await this.commandRouter.i18nJson(
    `${__dirname}/i18n/strings_${lang_code}.json`,
    `${__dirname}/i18n/strings_en.json`,
    `${__dirname}/UIConfig.json`,
  );
  if (!uiconf) throw new Error('Youtube: Cannot find UI Configuration');
  if (this.config.get('refresh_token')) {
    uiconf.sections[0].content[0].hidden = true;
    uiconf.sections[0].content[1].hidden = false;
  } else {
    uiconf.sections[0].content[0].hidden = false;
    uiconf.sections[0].content[1].hidden = true;
  }
  uiconf.sections[1].content[0].value = this.config.get('results_limit');
  return uiconf;
}

Youtube.prototype.setUIConfig = function (data) {
  var self = this;
  //Perform your UI configuration tasks here
};

Youtube.prototype.getConf = function (varName) {
  var self = this;
  //Perform your tasks to fetch config data here
};

Youtube.prototype.setConf = function (varName, varValue) {
  var self = this;
  //Perform your tasks to set config data here
};

Youtube.prototype.getConfigurationFiles = function () {
  return ['config.json'];
}

Youtube.prototype.pause = function () {
  this.logger.info("Youtube::pause");

  return this.commandRouter.volumioPause();
};


Youtube.prototype.add = function (vuri) {
  var self = this;
  self.logger.info("Youtube::add");

  if (vuri.includes("list=")) {
    var playlistId = decodeURI(vuri.toString()).split("list=")[1].split("&")[0];
    self.addPlaylist(playlistId);
  } else {
    var regex = /https?:\/\/(?:[0-9A-Z-]+\.)?(?:youtu\.be\/|youtube(?:-nocookie)?\.com\S*?[^\w\s-])([\w-]{11})(?=[^\w-]|$)(?![?=&+%\w.-]*(?:['"][^<>]*>|<\/a>))[?=&+%\w.-]*/ig;
    var videoId = vuri.replace(regex, "$1");
    self.commandRouter.pushConsoleMessage(vuri + " - " + videoId);
    self.addVideo(videoId);
  }
};

Youtube.prototype.addVideo = function (videoId) {
  var self = this;
  self.logger.info("Youtube::addVideo");

  return self.commandRouter.addQueueItems([{
    uri: videoId,
    service: "youtube"
  }]);
}

Youtube.prototype.addPlaylist = function (playlistId, pageToken) {
  var self = this;
  self.logger.info("Youtube::addPlaylist " + playlistId);

  //Contact Youtube Data API v3 for the list of videos in the playlist
  var request = {
    part: "snippet",
    maxResults: 50,
    playlistId: playlistId
  };

  if (pageToken != undefined)
    request.pageToken = pageToken;

  self.yt.playlistItems.list(request, function (err, res) {
    if (err) {
      //Holy crap, something went wrong :/
      self.logger.error(err.message + "\n" + err.stack);
      deferred.reject(err);
    } else {
      var videos = res.items;
      for (var i = 0; i < videos.length; i++) {
        var video = {
          uri: videos[i].snippet.resourceId.videoId
        }
        self.addQueue = self.addQueue.concat([video]);
      }
      if (res.nextPageToken != undefined) {
        return self.addPlaylist(playlistId, res.nextPageToken);
      } else {
        return self.parseAddQueue();
      }
    }
  });
}

Youtube.prototype.parseAddQueue = function () {
  var self = this;

  var deferred = libQ.defer();
  if (self.addQueue.length > 0) {
    var videoDefer = libQ.defer();
    self.addVideo(self.addQueue[0].uri).then(function () {
      videoDefer.resolve()
    }, function (e) {
      videoDefer.resolve()
    });
    videoDefer.promise.then(function () {
      self.commandRouter.pushConsoleMessage("Added " + self.addQueue[0].url);
      self.addQueue.splice(0, 1);
      if (self.addQueue.length > 0) {
        return self.parseAddQueue();
      } else {
        return deferred.resolve();
      }
    });
  } else {
    return deferred.resolve({
      added: 0
    });
  }
  return deferred.promise;
}

Youtube.prototype.stop = function () {
  var self = this;
  self.logger.info("Youtube::stop");
  return self.commandRouter.volumioStop();
}

Youtube.prototype.handleBrowseUri = function (uri) {
  var self = this;
  self.logger.info('handleBrowseUri: ' + uri);
  self.commandRouter.pushToastMessage('info', 'YouTube', 'Fetching data from YouTube. This may take some time.');

  if (uri.startsWith('youtube')) {
    if (uri === 'youtube') { //root
      return self.getRootContent();
    } else if (uri.startsWith('youtube/root/subscriptions')) {
      return self.getUserSubscriptions();
    } else if (uri.startsWith('youtube/root/playlists')) {
      return self.getUserPlaylists();
    } else if (uri.startsWith('youtube/root/likedVideos')) {
      return self.getUserLikedVideos();
    } else if (uri.startsWith('youtube/root/activities')) {
      return self.getActivities();
    } else if (uri.startsWith('youtube/playlist/')) {
      return self.getPlaylistItems(uri.split('/').pop());
    } else if (uri.startsWith('youtube/channel/')) {
      return self.getChannelSections(uri.split('/').pop());
    }
  }

  return libQ.reject();
};

Youtube.prototype.explodeUri = function (uri) {
  var self = this;
  var deferred = libQ.defer();

  if (uri.startsWith('youtube/playlist/')) {
    self.logger.info("Youtube::explodeUri Playlist: " + uri);

    self.addPlaylist(uri.split('/').pop());
  } else {
    self.logger.info("Youtube::explodeUri " + "https://youtube.com/oembed?format=json&url=" + uri);

    self.yt.videos.list({
      part: "snippet,contentDetails",
      id: uri
    }, function (err, res) {
      if (err) {
        self.logger.error(err.message + "\n" + err.stack);
        deferred.reject(err);
      } else if (res.items.length == 0) {
        deferred.reject(new Error("Video is not valid"));
      } else {
        deferred.resolve({
          ...BASE_STATUS,
          uri: uri,
          name: res.items[0].snippet.title,
          title: res.items[0].snippet.title,
          albumart: res.items[0].snippet.thumbnails.default.url,
          duration: dur.toSeconds(dur.parse(res.items[0].contentDetails.duration)),
        });
      }
    });
  }

  return deferred.promise;
};

Youtube.prototype.getYouTubeUrlItemId = function (url, filter) {
  var splitResult = url.split(filter);
  var id = null;
  if (splitResult.length > 1) {
    id = splitResult[1];

    var ampersandPos = id.indexOf("&");
    if (ampersandPos != -1) {
      id = id.substring(0, ampersandPos);
    }
  }

  return id;
};

Youtube.prototype.search = function (query) {
  var self = this;
  if (!query || !query.value || query.value.length === 0) {
    return libQ.resolve([]);
  }

  var searchValue = query.value;

  if (searchValue.indexOf('youtube.com') !== -1) {
    //check if it is a video
    var id = self.getYouTubeUrlItemId(searchValue, 'v=') || self.getYouTubeUrlItemId(searchValue, 'list=');
    if (id) {
      searchValue = id;
    }
  } else if (searchValue.indexOf('youtu.be') !== -1) {
    // support short urls - the ID is after the slash
    searchValue = searchValue.split('/').pop();
  }

  return self.doSearch(searchValue);
};

Youtube.prototype.getState = function () {
  var self = this;
  self.logger.info("Youtube::getState");
};

Youtube.prototype.addToBrowseSources = function () {
  var self = this;
  self.commandRouter.volumioAddToBrowseSources(BROWSE_SOURCE);
};

Youtube.prototype.removeToBrowseSources = function () {

    this.commandRouter.volumioRemoveToBrowseSources(BROWSE_SOURCE.name);
};

Youtube.prototype.clearAddPlayTrack = function (track) {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Youtube::clearAddPlayTrack');

  var deferred = libQ.defer();
  ytdl.getInfo("https://youtube.com/watch?v=" + track.uri, {
    filter: "audioonly"
  }, function (err, info) {
    if (err) {
      console.error("Error opening Youtube stream, video is probably not valid.", err);
    } else {
      self.mpdPlugin.sendMpdCommand('stop', [])
        .then(function () {
          return self.mpdPlugin.sendMpdCommand('clear', []);
        })
        .then(function (values) {
          return self.mpdPlugin.sendMpdCommand('load "' + info["formats"][0]["url"] + '"', []);
        })
        .fail(function (data) {
          return self.mpdPlugin.sendMpdCommand('add "' + info["formats"][0]["url"] + '"', []);
        })
        .then(function () {
          self.mpdPlugin.clientMpd.on('system', function (status) {
            self.logger.info('Youtube Status Update: ' + status);
            self.mpdPlugin.getState().then(function (state) {
              state.trackType = "Youtube";
              return self.commandRouter.stateMachine.syncState(state, "youtube");
            });
          });
          return self.mpdPlugin.sendMpdCommand('play', []).then(function () {
            return self.mpdPlugin.getState().then(function (state) {
              state.trackType = "Youtube";
              return self.commandRouter.stateMachine.syncState(state, "youtube");
            });
          });
        })
        .fail(function (e) {
          return defer.reject(new Error());
        });
    }
  });
}

Youtube.prototype.stop = function () {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'Youtube::stop');
  return self.mpdPlugin.stop().then(function () {
    return self.mpdPlugin.getState().then(function (state) {
      state.trackType = "Youtube";
      return self.commandRouter.stateMachine.syncState(state, "youtube");
    });
  });
};

Youtube.prototype.pause = function () {
  var self = this;
  self.commandRouter.pushConsoleMessage('Youtube::pause');

  // TODO don't send 'toggle' if already paused
  return self.mpdPlugin.pause().then(function () {
    return self.mpdPlugin.getState().then(function (state) {
      state.trackType = "Youtube";
      return self.commandRouter.stateMachine.syncState(state, "youtube");
    });
  });
};

Youtube.prototype.resume = function () {
  var self = this;
  self.commandRouter.pushConsoleMessage('Youtube::resume');

  // TODO don't send 'toggle' if already playing
  return self.mpdPlugin.resume().then(function () {
    return self.mpdPlugin.getState().then(function (state) {
      state.trackType = "Youtube";
      return self.commandRouter.stateMachine.syncState(state, "youtube");
    });
  });
};

Youtube.prototype.seek = function (position) {
  var self = this;
  self.commandRouter.pushConsoleMessage('Youtube::seek');
  return self.mpdPlugin.seek(position);
};

Youtube.prototype.next = function () {
  var self = this;
  self.commandRouter.pushConsoleMessage('Youtube::next');
  return self.mpdPlugin.sendMpdCommand('next', []).then(function () {
    return self.mpdPlugin.getState().then(function (state) {
      state.trackType = "Youtube";
      return self.commandRouter.stateMachine.syncState(state, "youtube");
    });
  });;
};

Youtube.prototype.previous = function () {
  var self = this;
  self.commandRouter.pushConsoleMessage('Youtube::previous');
  return self.mpdPlugin.sendMpdCommand('previous', []).then(function () {
    return self.mpdPlugin.getState().then(function (state) {
      state.trackType = "Youtube";
      return self.commandRouter.stateMachine.syncState(state, "youtube");
    });
  });;
};

Youtube.prototype.prefetch = function (nextTrack) {
  var self = this;
  self.commandRouter.pushConsoleMessage('Youtube::prefetch');

  ytdl.getInfo("https://youtube.com/watch?v=" + nextTrack.uri, {
    filter: "audioonly"
  }, function (err, info) {
    if (err) {
      console.log("Error opening Youtube stream, video is probably not valid.");
    } else {
      return self.mpdPlugin.sendMpdCommand('add "' + info["formats"][0]["url"] + '"', [])
        .then(function () {
          return self.mpdPlugin.sendMpdCommand('consume 1', []);
        });
    }
  });
};

Youtube.prototype.getRootContent = function () {
  var self = this;

  if (!this.config.get('refresh_token')) {
    self.commandRouter.pushToastMessage('info', 'Volumio has no permissions', 'Grant Volumio access to your YouTube account to access your playlists.');
    return self.getTrend();
  }

  return libQ.resolve(ROOT_NAV);
}

Youtube.prototype.getUserSubscriptions = function () {
  var self = this;
  var deferred = libQ.defer();

  var request = {
    part: "snippet",
    mine: true,
    maxResults: 50
  };

  return self.youtubeRequest({
    apiFunc: self.yt.subscriptions.list,
    apiRequest: request,
    loadAll: true,
    prevUri: 'youtube',
    title: 'Youtube subscriptions'
  });
}

Youtube.prototype.getUserLikedVideos = function () {
  var self = this;
  var deferred = libQ.defer();

  var request = {
    part: "snippet",
    myRating: 'like',
    maxResults: 50
  };

  return self.youtubeRequest({
    apiFunc: self.yt.videos.list,
    apiRequest: request,
    loadAll: true,
    prevUri: 'youtube',
    title: 'Liked Videos',
  });
}

Youtube.prototype.getUserPlaylists = function () {
  var self = this;
  var deferred = libQ.defer();

  var request = {
    part: "snippet",
    mine: true,
    maxResults: 50
  };

  return self.youtubeRequest({
    apiFunc: self.yt.playlists.list,
    apiRequest: request,
    loadAll: true,
    prevUri: 'youtube',
    title: 'My Youtube playlists'
  });
}

Youtube.prototype.getActivities = function () {
  var self = this;
  var deferred = libQ.defer();

  var request = {
    part: "snippet",
    home: true,
    maxResults: 50
  };

  return self.youtubeRequest({
    apiFunc: self.yt.activities.list,
    apiRequest: request,
    loadAll: true,
    prevUri: 'youtube',
    title: 'Youtube activities',
  });
}

Youtube.prototype.getChannelSections = function (channelId) {
  // channel sections containing the playlists can be received in one request
  var self = this;
  var request = {
    channelId: channelId,
    part: "contentDetails",
  };

  // always load all playlist items contained in channel sections response
  return self.youtubeRequest({
    apiFunc: self.yt.channelSections.list,
    apiRequest: request,
    loadAll: true,
    plainResult: true,
  }).then(function (result) {
    // 1. collect all playlist ids
    var playlistIds = [];
    for (var i = 0; i < 50; i++) {
      var item = result[i];
      // channel sections may do not contain any playlists -> we need to skip them
      if (item && item.kind === 'youtube#channelSection' &&
        item.contentDetails && item.contentDetails.playlists) {
        playlistIds = playlistIds.concat(item.contentDetails.playlists);
      }
    }

    // 2. fetch the content details of the playlists
    return self.getPlaylists(playlistIds.slice(0, 50)).then(function (playlists) {
      if (playlists.navigation.lists.length > 0) {
        var playlistItems = playlists.navigation.lists.pop().items;

        return {
          navigation: {
            prev: {
              uri: 'youtube'
            },
            lists: [{
              title: 'Youtube channel playlists',
              icon: 'fa fa-youtube',
              availableListViews: ['list', 'grid'],
              items: playlistItems
            }]
          }
        };
      } else {
        self.commandRouter.pushToastMessage('info', 'No playlists', 'Could not find any playlists for this channel.');
        return {};
      }
    },
      function (error) {
        self.logger.error(err.message + "\n" + err.stack);
        self.commandRouter.pushToastMessage('error', 'Error fetching playlists', 'Failed fetching playlists of channel.');
      });
  });
}

Youtube.prototype.getTrend = function () {
  var self = this;
  var deferred = libQ.defer();

  var request = {
    chart: 'mostPopular',
    part: "snippet",
    videoCategoryId: 10,
    maxResults: 50
  };

  return self.youtubeRequest({
    apiFunc: self.yt.videos.list,
    apiRequest: request,
    loadAll: true,
    prevUri: '/',
    title: 'Youtube trendy videos'
  });
}

Youtube.prototype.doSearch = function (query) {
  var self = this;
  var deferred = libQ.defer();

  var request = {
    q: query,
    part: "snippet",
    type: "video,playlist,channel",
    maxResults: 50
  };

  return self.youtubeRequest({
    apiFunc: self.yt.search.list,
    apiRequest: request,
    loadAll: true,
    title: 'Youtube Search Results',
  });
}

Youtube.prototype.getPlaylists = function (playlistIds) {
  var self = this;
  var deferred = libQ.defer();

  var request = {
    id: playlistIds.join(','),
    part: "snippet",
    maxResults: 50
  };

  // always load all playlists
  return self.youtubeRequest({
    apiFunc: self.yt.playlists.list,
    apiRequest: request,
    loadAll: true,
    prevUri: 'youtube',
    title: 'Youtube Playlists'
  });
}

Youtube.prototype.getPlaylistItems = function (playlistId) {
  var self = this;
  var deferred = libQ.defer();
  console.log('playlistid:', playlistId);

  var request = {
    playlistId: playlistId,
    part: "snippet",
    maxResults: 50
  };

  // always load all playlist items
  return self.youtubeRequest({
    apiFunc: self.yt.playlistItems.list,
    apiRequest: request,
    loadAll: true,
    prevUri: 'youtube',
    title: 'Youtube Playlist'
  });
}

Youtube.prototype.youtubeRequest = function (request, cacheList, pageToken, deferred) {
  var self = this;

  if (!deferred) {
    deferred = libQ.defer();
  }

  if (!cacheList) {
    cacheList = [];
  }

  if (pageToken) {
    request.pageToken = pageToken;
  }

  request.apiFunc(request.apiRequest, function (err, res) {
    if (err) {
      self.logger.error(err.message + "\n" + err.stack);
      deferred.reject(err);
    } else {
      console.log('Youtube API call: ', request, res);
      cacheList = cacheList.concat(request.plainResult
        ? res.items
        : self.processResponse(res.items, cacheList.length, request.loadAll));

      if (res.nextPageToken && self.canLoadFurtherItems(cacheList.length)) {
        self.youtubeRequest(request, cacheList, res.nextPageToken, deferred);
      } else {
        if (request.plainResult) {
          deferred.resolve(cacheList);
        } else {
          var listItem = {
            title: request.title,
            icon: 'fa fa-youtube',
            availableListViews: ['list', 'grid'],
            items: cacheList
          };

          if (request.prevUri) {
            deferred.resolve({
              navigation: {
                prev: {
                  uri: request.prevUri
                },
                lists: [listItem]
              }
            });
          } else {
            deferred.resolve(listItem)
          }
        }
      }
    }
  });

  return deferred.promise;
}

Youtube.prototype.processResponse = function (items, numLoadedItems, loadAll) {
  var self = this;
  var parsedItems = [];

  var loadItemsCount = loadAll ? items.length : self.calcItemsLimit(numLoadedItems, items.length);
  for (var i = 0; i < loadItemsCount; i++) {
    parsedItems.push(self.parseResponseItemData(items[i]));
  }

  return parsedItems;
}

Youtube.prototype.canLoadFurtherItems = function (numOfCurrLoadedItems) {
  var self = this;
  return self.resultsLimit > numOfCurrLoadedItems;
}

Youtube.prototype.calcItemsLimit = function (numLoadedItems, numAvailableItems) {
  var self = this;
  var loadVideos = self.canLoadFurtherItems(numLoadedItems) ?
    self.resultsLimit - numLoadedItems : 0;

  //don't load more videos than available
  if (loadVideos > numAvailableItems) {
    loadVideos = numAvailableItems;
  }

  return loadVideos;
}

Youtube.prototype.parseResponseItemData = function (item) {
  var albumart, url, type;

  if (item.snippet.thumbnails && typeof item.snippet.thumbnails === 'object') {
    //try to get highest quality image first
    if (item.snippet.thumbnails.high && typeof item.snippet.thumbnails.high === 'object') {
      albumart = item.snippet.thumbnails.high.url;
    } else if (item.snippet.thumbnails.medium && typeof item.snippet.thumbnails.medium === 'object') {
      albumart = item.snippet.thumbnails.medium.url;
    } else if (item.snippet.thumbnails.default && typeof item.snippet.thumbnails.default === 'object') {
      albumart = item.snippet.thumbnails.default.url;
    }
  }

  if (item.kind) {
    switch (item.kind) {
      case 'youtube#searchResult':
        switch (item.id.kind) {
          case 'youtube#video':
            url = item.id.videoId;
            type = 'song';
            break;
          case 'youtube#playlist':
            url = 'youtube/playlist/' + item.id.playlistId;
            type = 'folder';
            break;
          case 'youtube#channel':
            url = 'youtube/channel/' + item.id.channelId;
            type = 'folder';
            break;
          default:
            url = 'youtube/unhandled-search-kind: ' + item.id.kind;
            break;
        }
        break;
      case 'youtube#video':
        url = item.id;
        type = 'song';
        break;
      case 'youtube#playlist':
        url = 'youtube/playlist/' + item.id;
        type = 'folder';
        break;
      case 'youtube#channel':
        url = 'youtube/channel/' + item.id;
        type = 'folder';
        break;
      case 'youtube#playlistItem':
        url = item.snippet.resourceId.videoId;
        type = 'song';
        break;
      case 'youtube#subscription':
        if (item.snippet.resourceId && item.snippet.resourceId.kind === 'youtube#channel') {
          url = 'youtube/channel/' + item.snippet.resourceId.channelId;
          type = 'folder';
        } else {
          url = 'youtube/unhandled-subscription-kind: ' + item.kind;
        }
        break;
      case 'youtube#activity':
        url = 'youtube/channel/' + item.snippet.channelId;
        type = 'folder';
        break;
      default:
        url = 'youtube/unhandled-kind: ' + item.kind;
        break;
    }
  }

  return {
    service: 'youtube',
    type: type,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    albumart: albumart,
    uri: url
  };
}

Youtube.prototype.updateSettings = function (data) {
  var self = this;
  var resultsLimit = data['results_limit'];

  if (resultsLimit <= 0) {
    self.commandRouter.pushToastMessage('error', 'Saving settings failed', 'Results limit must be greater than 0 (zero).');
  } else {
    self.config.set('results_limit', resultsLimit);
    self.resultsLimit = resultsLimit;
    self.commandRouter.pushToastMessage('info', 'Settings saved', 'Settings successsfully updated.');
  }

  return libQ.resolve();
};

Youtube.prototype.oauthLogin = function (data) {
  if (data && data.refresh_token) {
    this.logger.info('Saving Youtube Refresh Token');
    this.config.set('refresh_token', data.refresh_token);
    this.commandRouter.pushToastMessage('success', this.getI18n('LOGIN'), this.getI18n('LOGIN_SUCCESS'));
    this.initializeAuth();
  } else {
    this.logger.error('Could not receive oauth data');
  }
}

Youtube.prototype.logout = function () {
  console.log('Youtube: ', 'LOGOUT');
  this.config.delete('refresh_token');
  this.config.delete('access_token');
  this.removeToBrowseSources();
}

Youtube.prototype.initializeAuth = async function () {
  const accessToken = this.config.get('access_token');
  const refreshToken = this.config.get('refresh_token');
  if (refreshToken) {
    const accessTokenExpiry = this.config.get('access_token_expiry');
    this.addToBrowseSources();
    if (!accessToken || accessTokenExpiry <= Date.now()) {
      await this.refreshAccessToken();
    }
    this.updateYtApiAccessToken();
  }
}

Youtube.prototype.refreshAccessToken = async function () {
  var refreshToken = this.config.get('refresh_token', 'none');
  if (refreshToken) {
    let results = await superagent.post('https://oauth-performer.dfs.volumio.org/youtube/accessToken')
      .send({ refreshToken: refreshToken });
    if (results && results.body && results.body.accessToken) {
      this.config.set('access_token', results.body.accessToken);
      this.config.set('access_token_expiry', results.body.expiresInSeconds * 1000 + Date.now());
      console.log('Got access token!');
    } else {
      console.error('No access token!!!!');
    }
  }
};

Youtube.prototype.updateYtApiAccessToken = function () {
  var self = this;
  var oauth2Client = new OAuth2Client();

  oauth2Client.setCredentials({
    refresh_token: this.config.get('refresh_token'),
    access_token: this.config.get('access_token'),
  });

  self.yt = gapis.youtube({
    version: 'v3',
    auth: oauth2Client
  });
}

Youtube.prototype.loadI18n = function () {
  var self = this;

  try {
    var language_code = this.commandRouter.sharedVars.get('language_code');
    self.i18n = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
  } catch (e) {
    self.i18n = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
  }

  self.i18nDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};

Youtube.prototype.getI18n = function (key) {
  var self = this;

  if (key.indexOf('.') > 0) {
    var mainKey = key.split('.')[0];
    var secKey = key.split('.')[1];
    if (self.i18n[mainKey][secKey] !== undefined) {
      return self.i18n[mainKey][secKey];
    } else {
      return self.i18nDefaults[mainKey][secKey];
    }

  } else {
    if (self.i18n[key] !== undefined) {
      return self.i18n[key];
    } else {
      return self.i18nDefaults[key];
    }

  }
};
