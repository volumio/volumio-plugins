"use strict";
var libQ = require("kew");
var PLAY_MUSIC = require("playmusic");

// imports from proxy server
var express = require('express');
var bodyParser = require('body-parser');
var https = require('https');
var id3 = require('node-id3');
var tmp = require('tmp');
var fs = require("fs-extra");

// Constants For play Music 
var PLAY_MUSIC_CONSTANTS = {
  PLAY_MUSIC_FEATURE: {
    navigation: {
      lists: [
        {
          availableListViews: ["grid", "list"],
          items: [
            {
              service: "googleplaymusic",
              type: "googleplaymusic-category",
              title: "My Playlists",
              artist: "",
              album: "",
              icon: "fa fa-folder-open-o",
              uri: "googleplaymusic/playlists"
            },
            {
              service: "googleplaymusic",
              type: "googleplaymusic-category",
              title: "Stations",
              artist: "",
              album: "",
              icon: "fa fa-folder-open-o",
              uri: "googleplaymusic/stations"
            },
          ]
        }
      ],
      prev: {
        uri: "googleplaymusic"
      }
    }
  },

  BROWSE_CONFIG: {
    name: "Google Play Music",
    uri: "googleplaymusic",
    plugin_type: "music_service",
    plugin_name: "googleplaymusic",
    albumart: '/albumart?sourceicon=music_service/googleplaymusic/playMusic.svg'
  },

  FOLDER_OBJECT_STRUCTRE: {
    navigation: {
      prev: {
        uri: ''
      },
      "lists": [
        {
          "availableListViews": ["grid", "list"],
          "items": []
        }
      ]
    }
  }
};


module.exports = playMusicController;

function playMusicController(context) {
  var self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.context.logger;
  self.configManager = self.context.configManager;
  self.playMusic = new PLAY_MUSIC();
  self.serviceName = 'googleplaymusic';
  self.tracks = [];
}

playMusicController.prototype.onVolumioStart = function () {
  var self = this;
  var configFile = self.commandRouter.pluginManager.getConfigurationFile(
    self.context,
    "config.json"
  );
  self.config = new (require("v-conf"))();
  self.config.loadFile(configFile);
  if (self.config.get('bitrate') === true) {
    self.samplerate = "320Kbps";
  } else {
    self.samplerate = "128Kbps";
  }
  return libQ.resolve();
};

playMusicController.prototype.onStart = function () {
  var service = this;
  var defer = libQ.defer();
  service.mpdPlugin = service.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
  service.addToBrowseSources();
  var masterToken = service.config.get("masterToken");
  var androidId = service.config.get("androidId");
  console.log('I am getting token for access');
  defer.resolve(getTokenFromPlayMusic(service, masterToken, androidId));
  return defer.promise;
};

/**
* Get's access token to request Google Play Music features.
* @param  {Object} service google play music service object that holds information about current music player state and some functions references.
* @param {String} masterToken a token which will be used to get a access token for Google Play Music
* @param {String} androidId a Required android Id which will be used to get acesss together with masterToken
*/
function getTokenFromPlayMusic(service, masterToken, androidId) {
  var defer = libQ.defer();
  var googleAuthData = { masterToken: masterToken, androidId: androidId };
  service.playMusic.init(googleAuthData, function (error) {
    if (error) {
      console.error('Failed To get access Token Google Play mUsic', error);
      service.commandRouter.pushToastMessage(
        "error",
        "Failed to get token to access Google Play Music.",
        error.Error
      );
      return defer.reject(new Error());
    }
    // Create a proxy server so we can give mpd our own local server streaming url.
    createExpressServer(service.playMusic).then(function (localProxyUrlData) {
      service.localHostProxyUrl = localProxyUrlData.localHostUrl;
      service.commandRouter.pushToastMessage(
        "success",
        "Configuration update",
        "You have successfully signed in the google account."
      );
      defer.resolve();
    });
  });
  return defer.promise;
}

playMusicController.prototype.onStop = function () {
  var self = this;
  return libQ.resolve();
};

playMusicController.prototype.onRestart = function () {
  var self = this;
  // Optional, use if you need it
};


/**
* @param  {Object} credential information from signin form to login in google account.
*/
playMusicController.prototype.saveGoogleAccount = function (credential) {
  var service = this;
  var defer = libQ.defer();
  var email = credential.email;
  var password = credential.password;
  var bitrate = credential.bitrate;
  service.playMusic.login({ email: email, password: password }, function (err, authTokenData) {
    if (err) {
      console.error("Google login failed", err.Error);
      service.commandRouter.pushToastMessage('error', 'Google Login Failed');
      return defer.reject(new Error());
    }
    var masterToken = authTokenData.masterToken;
    var androidId = authTokenData.androidId;
    service.config.set("email", email);
    service.config.set("bitrate", bitrate);
    service.config.set("masterToken", masterToken);
    service.config.set("androidId", androidId);
    defer.resolve(getTokenFromPlayMusic(service, masterToken, androidId));
  });
  return defer.promise;
};

// Configuration Methods -----------------------------------------------------------------------------

playMusicController.prototype.getUIConfig = function () {
  var defer = libQ.defer();
  var self = this;
  var lang_code = self.commandRouter.sharedVars.get("language_code");
  self.commandRouter
    .i18nJson(
      __dirname + "/i18n/strings_" + lang_code + ".json",
      __dirname + "/i18n/strings_en.json",
      __dirname + "/UIConfig.json"
    )
    .then(function (uiconf) {
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });
  return defer.promise;
};

playMusicController.prototype.getConfigurationFiles = function () {
  return ["config.json"];
};

playMusicController.prototype.setUIConfig = function (data) {
  var self = this;
  //Perform your installation tasks here
};

playMusicController.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};

playMusicController.prototype.setConf = function (varName, varValue) {
  var self = this;
  //Perform your installation tasks here
};

// Playback Controls ---------------------------------------------------------------------------------------

/**
*This provides information about Google play music for adding into volumio dashboard.
*/
playMusicController.prototype.addToBrowseSources = function () {
  var self = this;
  var data = PLAY_MUSIC_CONSTANTS.BROWSE_CONFIG;
  self.commandRouter.volumioAddToBrowseSources(data);
};

/**
 * handles clicks in the player, by checking url what user has requeseted.
* @param  {String} curUri a string url that was send by the Volumio player, on a click event from user.
*/
playMusicController.prototype.handleBrowseUri = function (curUri) {
  var self = this;
  var info;
  var listItemsToRender;
  if (curUri == "googleplaymusic") {
    listItemsToRender = libQ.resolve(PLAY_MUSIC_CONSTANTS.PLAY_MUSIC_FEATURE); // get's first time options, when we click on the google play music in the browse section.
  } else if (curUri.startsWith("googleplaymusic/playlists")) {
    info = {
      curUri: curUri,
      playListId: curUri.split('/').pop(),
      shared: false,
      addToQueue: false,
    };
    listItemsToRender = (curUri == "googleplaymusic/playlists") ? getPlaylists(self) : getSongsInPlaylist(self, info);
  } else if (curUri.includes('googleplaymusic:shared:playlist:')) {
    info = {
      curUri: curUri,
      playListId: curUri.split(':').pop(),
      shared: true,
      addToQueue: false,
    };
    listItemsToRender = getSongsInPlaylist(self, info);
  } else if (curUri.startsWith("googleplaymusic/stations")) {
    var stationInfo = { curUri: curUri, stationId: curUri.split('/').pop(), addToQueue: false };
    listItemsToRender = (curUri == "googleplaymusic/stations") ? getStations(self) : getTracksInStation(self, stationInfo);
  } else if (curUri.startsWith("googleplaymusic:album")) {
    listItemsToRender = self.renderAlbumTracks(curUri);
  } else if (curUri.startsWith("googleplaymusic:artist:")) {
    listItemsToRender = self.getArtistData(curUri);
  }
  return listItemsToRender;
};



/**
 * Exploding uri for further music action like returning playlist songs to add into queue, or getting info of a individual song.
* @param  {String} uri a string url that was send by the Volumio player, on a click event from user.
*/
playMusicController.prototype.explodeUri = function (uri) {
  var self = this;
  var defer = libQ.defer();
  var returnPromiseObject;
  if (uri.includes('playlist')) {
    returnPromiseObject = getPlaylistTracksForQueue(self, uri);
  } else if (uri.includes('station')) {
    returnPromiseObject = getStationTracksForQueue(self, uri);
  } else if (uri.startsWith('googleplaymusic:album:')) {
    var albumId = uri.split(':').pop();
    returnPromiseObject = getAlbumTracks(self, albumId);
  } else {
    var trackData = getTrackInfo(self, uri);
    var response = [trackData];
    defer.resolve(response);
    returnPromiseObject = defer.promise;
  }
  return returnPromiseObject;
};

/**
* Getting songs of a playlist to add in a queue
* @param  {Object} service google play music service object that holds information about current music player state and some functions references.
* @param  {String} uri a string url that was send by the Volumio player, on a click event from user that asks to add a playlist's songs to queue.
* @returns {Promise} a Promise that resolves with a array that contains playlist songs.
*/
function getPlaylistTracksForQueue(service, uri) {
  service.logger.info("googleplaymusic::explodeUri Playlist: " + uri);
  var isSharedPlaylist = uri.includes('shared');
  var playlistId = isSharedPlaylist ? uri.split(':').pop() : uri.split('/').pop();
  var info = {
    curUri: uri,
    playListId: playlistId,
    shared: isSharedPlaylist,
    addToQueue: true, // this kind of uri will only to come to explode, when user is trying to add playlist songs to queue.
  };
  return getSongsInPlaylist(service, info); // will get playlist songs in a array to be added in queue.
}

/**
* Getting songs of a station to add in a queue
* @param  {Object} service google play music service object that holds information about current music player state and some functions references.
* @param  {String} uri a string url that was send by the Volumio player, on a click event from user to add songs of a song to queue.
* @returns {Promise} a Promise that resolves with a array that contains playlist songs.
*/
function getStationTracksForQueue(service, uri) {
  if (uri.includes('googleplaymusic:station:track')) {
    var defer = libQ.defer();
    var trackData = getTrackInfo(service, uri);
    defer.resolve([trackData]);
    return defer.promise;
  } else {
    service.logger.info("googleplaymusic::explodeUri Station: " + uri);
    var stationInfo = { curUri: uri, stationId: uri.split('/').pop(), addToQueue: true };
    return getTracksInStation(service, stationInfo);
  }
}

/**
* Getting tracks of a album to render on the page, need to return in a specific format.
* @param  {String} curUri a string url that was sent by the Volumio player, on a click event from user to list all the tracks of a album.
* @returns {Promise} a Promise that resolves with a object that contains some config data and also an array of album tracks.
*/
playMusicController.prototype.renderAlbumTracks = function (curUri) {
  var self = this;
  var defer = libQ.defer();
  var albumId = curUri.split(':').pop();
  var response = JSON.parse(JSON.stringify(PLAY_MUSIC_CONSTANTS.FOLDER_OBJECT_STRUCTRE));
  response.navigation.prev.uri = curUri; // setting previous uri for navigation
  getAlbumTracks(self, albumId)
    .then(function (tracks) {
      response.navigation.lists[0].items = tracks;
      defer.resolve(response);
    })
    .fail(function (error) {
      self.commandRouter.pushToastMessage(
        "error",
        "Error Getting Album Tracks",
        error
      );
      defer.reject(response);
    });
  return defer.promise;
};

playMusicController.prototype.getArtistData = function (curUri) {
  var self = this;
  var artistId = curUri.split(':').pop();
  var defer = libQ.defer();
  getArtistData(self, artistId).then(function (categoryData) {
    defer.resolve(categoryData);
  }).fail(function (error) {
    self.commandRouter.pushToastMessage(
      "error",
      "Error Getting Artist data",
      error
    );
    console.error('Error getting artist data from Google Play Music Server.', error);
    defer.reject(error);
  });
  return defer.promise;
};


playMusicController.prototype.clearAddPlayTrack = function (track) {
  var self = this;
  var defer = libQ.defer();
  var storeId = track.uri.split(':').pop();
  var localProxyUrl = self.localHostProxyUrl + storeId;
  self.playStreamUrl(localProxyUrl)
    .then(function () {
      defer.resolve();
    })
    .fail(function (error) {
      console.error('Failed to Play song from Stream url ' + localProxyUrl, error);
      defer.reject(error);
    });
  return defer.promise;
};

playMusicController.prototype.playStreamUrl = function (streamUrl) {
  var self = this;
  return self.mpdPlugin.sendMpdCommand('stop', []) // sending command to stop current playing song.
    .then(function () {
      return self.mpdPlugin.sendMpdCommand('clear', []);
    })
    .then(function (values) {
      return self.mpdPlugin.sendMpdCommand('load "' + streamUrl + '"', []);
    })
    .fail(function (data) {
      return self.mpdPlugin.sendMpdCommand('add "' + streamUrl + '"', []);
    })
    .then(function () {
      self.mpdPlugin.clientMpd.on('system', function (status) {
        self.logger.info('Google Play Music: ' + status);
        self.mpdPlugin.getState().then(function (state) {
          state.trackType = "Play Music";
          return self.commandRouter.stateMachine.syncState(state, "googleplaymusic");
        });
      });
      return self.mpdPlugin.sendMpdCommand('play', []).then(function () {
        self.commandRouter.pushConsoleMessage("googleplaymusic::After Play");
        return self.mpdPlugin.getState().then(function (state) {
          state.trackType = "Play Music";
          self.commandRouter.pushConsoleMessage("googleplaymusic: " + JSON.stringify(state));
          self.commandRouter.stateMachine.syncState(state, "googleplaymusic");
        });
      });
    });
};


playMusicController.prototype.prefetch = function (trackBlock) {
  console.log('Prefetching is happening');
  var self = this;
  var defer = libQ.defer();
  this.logger.info("DOING PREFETCH IN MPD");
  var storeId = trackBlock.uri.split(':').pop();
  var localProxyUrl = self.localHostProxyUrl + storeId;
  defer.resolve(self.mpdPlugin.sendMpdCommand('add "' + localProxyUrl + '"', [])
    .then(function () {
      return self.mpdPlugin.sendMpdCommand('consume 1', []);
    }));
  return defer.promise;
};

playMusicController.prototype.getAlbumArt = function (data, path) {
  var artist, album;
  if (data != undefined && data.path != undefined) {
    path = data.path;
  }
  var web;
  if (data != undefined && data.artist != undefined) {
    artist = data.artist;
    album = (data.album != undefined) ? data.album : data.artist;
    web = "?web=" +
      nodetools.urlEncode(artist) +
      "/" +
      nodetools.urlEncode(album) +
      "/large";
  }
  return getStructuredAlbumUrl(web, path);
};

function getStructuredAlbumUrl(web, path) {
  var url = "/albumart";
  if (web != undefined) url = url + web;
  if (web != undefined && path != undefined) url = url + "&";
  else if (path != undefined) url = url + "?";
  if (path != undefined) url = url + "path=" + nodetools.urlEncode(path);
  return url;
}

playMusicController.prototype.goto = function (data) {
  var self = this;
  var defer = libQ.defer();
  // Handle go to artist and go to album function
  return defer.promise;
};


// Core functions of Google Play
/**
 * @param  {Object} service Google play music service object that holds information about current music player state and some functions references.
 */
function getPlaylists(service) {
  var defer = libQ.defer();
  service.playMusic.getPlayLists(function (error, apiResponse) {
    if (error) {
      console.error("unsuccessfull from getting music playlist from google server", error);
      return defer.reject("unsuccessfull from getting music playlist from google server" + error);
    }
    var playlistsFormatedData = JSON.parse(JSON.stringify(PLAY_MUSIC_CONSTANTS.FOLDER_OBJECT_STRUCTRE));
    playlistsFormatedData.navigation.prev.uri = "googleplaymusic";
    playlistsFormatedData.navigation.lists[0].items = apiResponse.data.items.reduce(function (acc, playlist) {
      var formatedPlaylistData = getFormatedPlaylistData(playlist);
      acc.push(formatedPlaylistData);
      return acc;
    }, []);

    prefetchAllPlaylistTracks(service) // prefetching all playlist songs
      .then(function () { defer.resolve(playlistsFormatedData); }) // after fetching all tracks from playlist we are sending the array of playlists.
      .fail(function (error) { defer.reject(error); });
  });
  return defer.promise;
}

/**'
 * This Function prefetches all the entries in user's playlists.
 * @param  {Object} service google play music service object that holds information about current music player state and some functions references.
 */
function prefetchAllPlaylistTracks(service) {
  var defer = libQ.defer();
  service.playMusic.getPlayListEntries(function (error, playListSongs) {
    if (error) {
      console.error('Error getting playlist songs');
      return defer.reject('Error getting playlist songs' + error);
    }
    service.tracks = service.tracks.concat(playListSongs.data.items); // storing all playlist tracks.
    defer.resolve({});
  });
  return defer.promise;
}

/**
 * @param  {Object} service Google play music service object that holds information about current music player state and some functions references.
 * @param  {Object} playlist An object that contains information about requested playlist.
 */
function getSongsInPlaylist(service, playlist) {
  var defer = libQ.defer();
  if (playlist.shared) return getSongsOfASharedPlaylist(service, playlist);
  var response;
  var playListId = playlist.playListId;
  if (playlist.addToQueue) {
    response = retrievSongsOfAPlaylist(service.tracks, playListId); // if the request is for add to queue,then we need to send a array of songs.
  } else {
    response = JSON.parse(JSON.stringify(PLAY_MUSIC_CONSTANTS.FOLDER_OBJECT_STRUCTRE));
    response.navigation.prev.uri = 'googleplaymusic/playlists';
    response.navigation.lists[0].items = retrievSongsOfAPlaylist(service.tracks, playListId);
  }
  defer.resolve(response);
  return defer.promise;
}

/**
 * @param  {Object} service Google play music service object that holds information about current music player state and some functions references.
 * @param  {Object} playlist  an object that contains information about requested playlist.
 */
function getSongsOfASharedPlaylist(service, playlist) {
  var defer = libQ.defer();
  var response = JSON.parse(JSON.stringify(PLAY_MUSIC_CONSTANTS.FOLDER_OBJECT_STRUCTRE));
  response.navigation.prev = playlist.curUri;
  var options = {
    limit: 50, // Total songs that will be returned for this playlist 
    shareToken: playlist.playListId,
  };
  service.playMusic.getSharedPlayListEntries(options, function (error, responseData) {
    if (error) {
      console.error('Error getting shared playlist songs: ', error);
      defer.reject('Error getting shared playlist songs: ' + error);
    } else {
      var tracks = responseData.entries[0].playlistEntry;
      var sharedPlaylistSongs = tracks.reduce(function (acc, track) {
        var trackData = track.track;
        var volumioFormatSong = getVolumioFormatOfSong(track.trackId, trackData);
        acc.push(volumioFormatSong);
        return acc;
      }, []);
      service.tracks = service.tracks.concat(tracks);// having a reference of playlist songs for future use.
      // formatting return data on the basis of request type(wethere it is add to queue request or not).
      if (playlist.addToQueue) return defer.resolve(sharedPlaylistSongs); // we need to return a array of songs for addition of songs in queue.
      var response = JSON.parse(JSON.stringify(PLAY_MUSIC_CONSTANTS.FOLDER_OBJECT_STRUCTRE)); // else we need to send data in a specific format, so can volumio player can handle it.
      response.navigation.prev = playlist.curUri;
      response.navigation.lists[0].items = sharedPlaylistSongs;
      defer.resolve(response);
    }
  });
  return defer.promise;
}

/**
 *To get play music stations to render on the GUI, we will use this funciton.
 * @param  {Object} service Google play music service object that holds information about current music player state and some functions references.
 */
function getStations(service) {
  var defer = libQ.defer();
  service.playMusic.getStations(function (error, apiResponse) {
    if (error) {
      console.error("Unsuccessfull operation: Getting music stations from google server!", error);
      return defer.reject("Unsuccessfull operation: Getting music stations from google server!" + error);
    }
    var formatedListOfStation = JSON.parse(JSON.stringify(PLAY_MUSIC_CONSTANTS.FOLDER_OBJECT_STRUCTRE));
    formatedListOfStation.navigation.prev.uri = 'googleplaymusic';
    var stationsArray = apiResponse.data.items.reduce(function (acc, station) {
      var formatedStationData = getFormatedStationData(station);
      acc.push(formatedStationData);
      return acc;
    }, []);
    formatedListOfStation.navigation.lists[0].items = stationsArray;
    defer.resolve(formatedListOfStation);
  });
  return defer.promise;
}

/**
 * @param  {Object} service Google play music service object that holds information about current music player state and some functions references.
 * @param  {Object} stationInfo an object that contains information about requested station.
 */
function getTracksInStation(service, stationInfo) {
  var defer = libQ.defer();
  var stationId = stationInfo.stationId;
  var response = JSON.parse(JSON.stringify(PLAY_MUSIC_CONSTANTS.FOLDER_OBJECT_STRUCTRE));
  response.navigation.prev.uri = 'googleplaymusic/stations';
  service.playMusic.getStationTracks(stationId, 25, function (error, apiResponse) {
    if (error) {
      console.error('Error getting station tracks: ', error);
      return defer.reject('Error getting station tracks: ' + error);
    }
    var stationTracks = apiResponse.data.stations[0].tracks.reduce(function (acc, track) {
      var stationTrackFormat = getStationSongFormat(track);
      acc.push(stationTrackFormat);
      return acc;
    }, []);
    service.tracks = service.tracks.concat(stationTracks); // storing to use it further when exploding uri and getting other informaiton of the song
    if (stationInfo.addToQueue) response = stationTracks; // if the api request was to add songs in the queue then we just need to return array of station songs.
    else response.navigation.lists[0].items = stationTracks; // else we need to return in a specific format
    defer.resolve(response);
  });
  return defer.promise;
}

/**
 * @param  {Object} service Google play music service object that holds information about current music player state and some functions references.
 * @param  {String} albumId albumId of the the requested album from the player UI.
 */
function getAlbumTracks(service, albumId) {
  var defer = libQ.defer();
  service.playMusic.getAlbum(albumId, true, function (error, albumResponse) {
    if (error) {
      console.error('Error getting album tracks from server', error);
      return defer.reject('Error getting album tracks from server' + error);
    }
    var volumioFormatSongList = albumResponse.tracks.reduce(function (acc, track) {
      var formatedAlbumTrackData = getFormatedAlbumTrackData(track);
      acc.push(formatedAlbumTrackData);
      return acc;
    }, []);
    service.tracks = service.tracks.concat(volumioFormatSongList);
    defer.resolve(volumioFormatSongList);
  });
  return defer.promise;
}

/**
 * @param  {Object} service google play music service object that holds information about current music player state and some functions references.
 * @param  {String} uri To play a song, the player sends a uri, that conatins id of that song, we retrieve it and return required information about that song.
 */
function getTrackInfo(service, uri) {
  var trackId = uri.split(':').pop();
  var trackInfo;
  if (uri.includes('station')) {
    trackInfo = service.tracks.find(function (track) {
      return track.trackId === trackId;
    });
  } else if (uri.includes('search:track')) {
    trackInfo = service.tracks.find(function (track) {
      return track.storeId === trackId;
    });
  } else if (uri.includes('album')) {
    trackInfo = service.tracks.find(function (track) {
      return track.trackId === trackId;
    });
  } else {
    var trackResult = service.tracks.find(function (track) {
      return track.trackId === trackId;
    });
    trackInfo = trackResult.track;
  }
  return getVolumioFormatOfSong(trackId, trackInfo);
}


var app = express();
var PORT = '';
var LOCAL_HOST = 'http://127.0.0.1:'; // This address, We will use for proxy server to download temperorary stream data
var playMusicReference;
var server_timeout = 600000;
app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());

function wrapperID3(id, callback) {
  playMusicReference.getAllAccessTrack(id, function (err, track) {
    var tags = {
      'artist': track.artist,
      'album': track.album,
      'title': track.title,
      //'year' : track.year
    };
    tmp.file(function (err, path, fd) {
      if (err) throw err;
      var sts = id3.write(tags, path);
      callback(sts, fs.readFileSync(path));
    });
  });
}


/**
 * Api endpoint for local server, to get stream data form server and stream back to mpd deamon.
 */
app.get('/localStream', function (request, response) {
  if (request.query.id) {
    playMusicReference.getStreamUrl(request.query.id, function (err, streamUrl) {
      https.get(streamUrl, function (streamUrlResponse) {
        response.status(streamUrlResponse.statusCode);
        if (streamUrlResponse.statusCode === 200) {
          wrapperID3(request.query.id, function (sts, data) {
            if (sts) response.write(data);
            streamUrlResponse.on('data', function (chunk) { response.write(chunk); });
            streamUrlResponse.on('end', function () { response.end(); });
          });
        }
        else response.end();
      });
    });
  }
  else response.status(400).end();
});

/**
 * this creates a node server to use as a proxy for streaming of music track 
 * @param  {Object} playMusicInstance An object that holds refrence to play music package, which is doing all the request from google server
 */
function createExpressServer(playMusicInstance) {
  var defer = libQ.defer();
  playMusicReference = playMusicInstance;
  var server = app.listen(0, function () {
    var port = server.address().port;
    console.log('Proxy Express server listening on port', port);
    var localHostUrl = LOCAL_HOST + port + '/localStream/?id=';
    defer.resolve({ localHostUrl: localHostUrl });
  });
  server.setTimeout(server_timeout, function (msg) { console.log("Timeout for proxy server:", msg); });
  return defer.promise;
}


// Google Play Music Search functions.
/**
 * Handles google search functionality and returns tracks, albums, artists on the basis of search query.
 * @param  {Object} query An object that contains search string to send to google play music server
 */
playMusicController.prototype.search = function (query) {
  var service = this;
  var defer = libQ.defer();
  searchQuery(service, query.value).then(function (categoryData) {
    defer.resolve(categoryData);
  }).fail(function (error) {
    console.error('Error getting song based on search query from Google Play Music Server.', error);
    defer.reject(error);
  });
  return defer.promise;
};

// playMusicController.prototype._searchArtists = function (results) { };

// playMusicController.prototype._searchAlbums = function (results) { };

// playMusicController.prototype._searchPlaylists = function (results) { };

// playMusicController.prototype._searchTracks = function (results) { };

/**
 * @param  {Object} service google play music service object that holds information about current music player state and some functions references.
 * @param  {String} queryString String that will be search in the google play music database.
 */
function searchQuery(service, queryString) {
  var defer = libQ.defer();
  service.playMusic.search(queryString, 10, function (error, responseSongs) { // the second parameter is for returned songs in t
    if (error) {
      defer.reject(error);
    } else {
      var results = responseSongs.entries.sort(function (resultA, resultB) {
        return resultA.score < resultB.score;
      });
      var volumioFormated = [];
      var artistList = getArtistsFromList(results, { isArtistList: false });
      var albumsList = getAlbumsFromList(results, { isAlbumList: false });
      var playlist = getPlaylistsFromList(results);
      var songList = getTracksFromList(service, results, { isTrackArray: false });
      volumioFormated.push({ type: 'title', title: 'Play Music Tracks', availableListViews: ["list"], items: songList });
      volumioFormated.push({ type: 'title', title: 'Play Music Artists', availableListViews: ["list", "grid"], items: artistList });
      volumioFormated.push({ type: 'title', title: 'Play Music Albums', availableListViews: ["list", "grid"], items: albumsList });
      volumioFormated.push({ type: 'title', title: 'Play Music Playlists', availableListViews: ["list"], items: playlist });
      defer.resolve(volumioFormated);
    }
  });
  return defer.promise;
}

/**
 * @param  {Array} entityArray A collection of items, that may or may not contain different kind of data( Ex: Artist, Album, Tracks etc...)
 * @param  {Object} info Information about the type of data that we are looking in the array.
 */
function getArtistsFromList(entityArray, info) {
  var list = [];
  if (!info.isArtistList) {
    list = entityArray.reduce(function (acc, entity) {
      if (entity.type === '2') {// for artist type string is 2.
        acc.push(getFormatedArtistInfo(entity.artist));
      }
      return acc;
    }, []);
  } else {
    list = entityArray.reduce(function (acc, artist) {
      acc.push(getFormatedArtistInfo(artist));
      return acc;
    }, []);
  }
  return list;
}

/**
 * This functions retreives required data from an artist data object.
 * @param  {} artist An object that contains artist Data.
 */
function getFormatedArtistInfo(artist) {
  return {
    service: 'googleplaymusic',
    type: 'folder',
    title: artist.name,
    albumart: artist.artistArtRef,
    uri: 'googleplaymusic:artist:' + artist.artistId
  };
}

/**
 * @param  {Array} entityArray A collection of items, that may or may not contain different kind of data( Ex: Artist, Album, Tracks etc...)
 * @param  {Object} info Information about the type of data that we are looking in the array.
 */
function getAlbumsFromList(entityArray, info) {
  var list = [];
  if (!info.isAlbumList) {
    list = entityArray.reduce(function (acc, entity) {
      if (entity.type === '3') {// for album type string is 3.
        acc.push(getFormatedAlbumInfo(entity.album));
      }
      return acc;
    }, []);
  } else {
    list = entityArray.reduce(function (acc, album) {
      acc.push(getFormatedAlbumInfo(album));
      return acc;
    }, []);
  }
  return list;
}

/**
 * This functions retreives required data for an album from an album data object.
 * @param  {Object} album An object that contains album Data.
 */
function getFormatedAlbumInfo(album) {
  // To reder correctly on the volumio gui, we need following kind of predefined album object structure.
  return {
    service: 'googleplaymusic',
    type: 'folder',
    title: album.name,
    albumart: album.albumArtRef,
    uri: 'googleplaymusic:album:' + album.albumId
  };
}

/**
 * This functions retreives playlists data from a array of different data
 * @param  {Object} entityArray A collection of items, that may or may not contain different kind of data( Ex: Artist, Album, Tracks etc...)
 */
function getPlaylistsFromList(entityArray) {
  var list = [];
  for (var i in entityArray) {
    var entity = entityArray[i];
    if (entity.type === '4') {// for playlist type string is 4.
      list.push({
        service: 'googleplaymusic',
        type: 'folder',
        title: entity.playlist.name,
        albumart: entity.playlist.ownerProfilePhotoUrl,
        uri: 'googleplaymusic:shared:playlist:' + entity.playlist.shareToken
      });
    }
  }
  return list;
}

/**
 * @param  {Object} service google play music service object that holds information about current music player state and some functions references.
 * @param  {Array} entityArray A collection of items, that may or may not contain different kind of data( Ex: Artist, Album, Tracks etc...)
 * @param  {Object} info Information about the entityArray wethere all items are tracks/songs or not.
 */
function getTracksFromList(service, entityArray, info) {
  var list = [];
  if (!info.isTrackArray) {
    list = entityArray.reduce(function (acc, entity) {
      if (entity.type === '1') {// for track type string is 1.
        service.tracks.push(entity.track);
        acc.push(getFormatedTrackInfo(entity.track));
      }
      return acc;
    }, []);
  } else {
    list = entityArray.reduce(function (acc, track) {
      service.tracks.push(track);
      acc.push(getFormatedTrackInfo(track));
      return acc;
    }, []);
  }
  return list;
}

/**
 * This function gets required filed from track object and converts it into a volumio understandable object format.
 * @param  {Object} track a object that holds information about a track.
 */
function getFormatedTrackInfo(track) {
  return {
    service: 'googleplaymusic',
    type: 'song',
    title: track.title,
    artist: track.artist,
    album: track.album,
    albumart: track.albumArtRef[0].url,
    uri: 'googleplaymusic:search:track:' + track.storeId
  };
}

/**
 * @param  {Object} service google play music service object that holds information about current music player state and some functions references.
 * @param  {String} artistId artist id which data has beeen requested through this function
 */
function getArtistData(service, artistId) {
  var defer = libQ.defer();
  service.playMusic.getArtist(artistId,
    true, /**boolean value for album return */
    20, /**total tracks that will be returned in this api*/
    5, /*total related artist that will be returned */
    function (error, response) {
      if (error) {
        defer.reject(error);
      } else {
        var volumioFormated = {
          "navigation": {
            "isSearchResult": true,
            "lists": []
          }
        };
        var artistCollection = volumioFormated.navigation.lists;
        var artistList = getArtistsFromList(response.related_artists, { isArtistList: true });
        var albumsList = getAlbumsFromList(response.albums, { isAlbumList: true });
        var topTrackList = getTracksFromList(service, response.topTracks, { isTrackArray: true });
        artistCollection.push({ type: 'title', title: 'Artist Tracks', availableListViews: ["list"], items: topTrackList });
        artistCollection.push({ type: 'title', title: 'Related Artists', availableListViews: ["list", "grid"], items: artistList });
        artistCollection.push({ type: 'title', title: 'Artist Albums', availableListViews: ["list", "grid"], items: albumsList });
        defer.resolve(volumioFormated);
      }
    });
  return defer.promise;
}

// utility functions for Google Play Music Service


/**
 * gets required playlist data from a playlist information object.
 * @param  {Object} playlist a object that contains information about a playlist
 */
function getFormatedPlaylistData(playlist) {
  return {
    service: 'googleplaymusic',
    type: "folder",
    title: playlist.name,
    icon: "fa fa-list-ol",
    uri: "googleplaymusic/playlists/" + playlist.id,
  };
}

/**
 * @param  {Array} tracksArray  A list which contains songs
 * @param  {String} playListId playlist id, for which this function is going to filter songs from the tracksArray
 */
function retrievSongsOfAPlaylist(tracksArray, playListId) {
  return tracksArray.reduce(function (acc, track) {
    if (track.playlistId === playListId) {
      var trackData = track.track;
      var volumioFormatSong = getVolumioFormatOfSong(track.trackId, trackData);
      acc.push(volumioFormatSong);
    }
    return acc;
  }, []);
}

/**
 * gets required track data from a track's information object.
 * @param  {Object} track a object that contains information about a track
 */
function getStationSongFormat(track) {
  return {
    service: 'googleplaymusic', // plugin name
    uri: 'googleplaymusic:station:track:' + track.nid,
    type: 'song',
    trackId: track.nid, // nid works same as trackId, when we will try to get the streamurl from google.(for station songs array, google doesn't return trackId, but it does for playlist songs)
    name: track.title,
    title: track.title,
    artist: track.artist,
    album: track.album,
    albumArtRef: track.albumArtRef,
    albumart: track.albumArtRef[0].url,
    duration: Math.trunc(track.durationMillis / 1000),
    bitdepth: '16 bit',
    trackType: 'Play Music',
  };
}

/**
 * get's a predefined song structure for volumio player to play or render.
 * @param  {String} trackId trackId that required to be added into return data.
 * @param  {Object} trackInfo an object that contains information about the song.
 */
function getVolumioFormatOfSong(trackId, trackInfo) {
  return {
    uri: 'googleplaymusic:track:' + trackId,
    service: 'googleplaymusic', // plugin name
    type: 'song',
    title: trackInfo.title,
    artist: trackInfo.artist,
    album: trackInfo.album,
    albumart: trackInfo.albumArtRef[0].url,
    name: trackInfo.title,
    duration: Math.trunc(trackInfo.durationMillis / 1000),
    // samplerate: self.samplerate,
    bitdepth: '16 bit',
    trackType: 'Play Music',
  };
}

/**
 * gets required station data from a stations's information object.
 * @param  {Object} station a object that contains information about a station
 */
function getFormatedStationData(station) {
  return {
    service: 'googleplaymusic',
    type: "folder",
    title: station.name,
    icon: "fa fa-list-ol",
    uri: "googleplaymusic/stations/" + station.id,
  };
}

/**
 * gets required album track data from a track's information object.
 * @param  {Object} track a object that contains information about a track
 */
function getFormatedAlbumTrackData(track) {
  return {
    service: 'googleplaymusic', // plugin name
    uri: 'googleplaymusic:albumTrack:' + track.nid,
    type: 'song',
    trackId: track.nid, // nid works same as trackId, when we will try to get the streamurl from google.(for station songs array, google doesn't return trackId, but it does for playlist songs)
    name: track.title,
    title: track.title,
    artist: track.artist,
    album: track.album,
    albumArtRef: track.albumArtRef,
    albumart: track.albumArtRef[0].url,
    duration: Math.trunc(track.durationMillis / 1000),
    bitdepth: '16 bit',
    trackType: 'Play Music',
  };
}


// Player Actions on a song



playMusicController.prototype.seek = function (timePosition) {
  var service = this;
  var consoleMessage = "googleplaymusic::seek to " + timePosition;
  service.pushConsoleMessage(consoleMessage);
  return service.mpdPlugin.seek(timePosition).then(function () {
    return service.getState().then(function (state) {
      return service.pushState(state);
    });
  });
};


playMusicController.prototype.next = function () {
  var service = this;
  service.pushConsoleMessage('googleplaymusic::next');
  return service.mpdPlugin.next().then(function () {
    return service.getState().then(function (state) {
      return service.pushState(state);
    });
  });
};

playMusicController.prototype.previous = function () {
  var service = this;
  service.pushConsoleMessage('googleplaymusic::previous');
  return service.mpdPlugin.sendMpdCommand('previous', []).then(function () {
    return service.mpdPlugin.getState().then(function (state) {
      state.trackType = "googleplaymusic Track";
      return service.commandRouter.stateMachine.syncState(state, "googleplaymusic");
    });
  });
};

playMusicController.prototype.stop = function stop() {
  var service = this;
  service.pushConsoleMessage("googleplaymusic::stop");
  return service.mpdPlugin.stop().then(function () {
    return service.getState().then(function (state) {
      return service.pushState(state);
    });
  });
};

playMusicController.prototype.pause = function () {
  var service = this;
  service.pushConsoleMessage("googleplaymusic::pause");
  return service.mpdPlugin.pause().then(function () {
    return service.getState().then(function (state) {
      return service.pushState(state);
    });
  });
};

playMusicController.prototype.resume = function () {
  var service = this;
  service.pushConsoleMessage("googleplaymusic::resume");
  return service.mpdPlugin.resume().then(function () {
    return service.getState().then(function (state) {
      return service.pushState(state);
    });
  });
};

playMusicController.prototype.getState = function () {
  this.pushConsoleMessage("googleplaymusic::getState");
  var service = this;
  return service.mpdPlugin.sendMpdCommand('status', []);
};

playMusicController.prototype.parseState = function parseState(sState) {
  var service = this;
  service.pushConsoleMessage("googleplaymusic::parseState");
  var objState = JSON.parse(sState);
  var nSeek = null;
  if ('position' in objState) {
    nSeek = objState.position * 1000;
  }
  var nDuration = null;
  if ('duration' in objState) {
    nDuration = Math.trunc(objState.duration / 1000);
  }
  var sStatus = null;
  if ('status' in objState) {
    if (objState.status === 'playing') {
      sStatus = 'play';
    } else if (objState.status === 'paused') {
      sStatus = 'pause';
    } else if (objState.status === 'stopped') {
      sStatus = 'stop';
    }
  }
  var nPosition = null;
  if ('current_track' in objState) {
    nPosition = objState.current_track - 1;
  }
  return libQ.resolve({
    status: sStatus,
    position: nPosition,
    seek: nSeek,
    duration: nDuration,
    samplerate: service.samplerate, // Pull these values from somwhere else since they are not provided in the Spop state
    bitdepth: null,
    channels: null,
    artist: objState.artist,
    title: objState.title,
    album: objState.album
  });
};

playMusicController.prototype.pushState = function (state) {
  this.pushConsoleMessage("googleplaymusic::pushState");
  return this.commandRouter.servicePushState(state, this.servicename);
};

playMusicController.prototype.pushConsoleMessage = function (message) {
  this.commandRouter.pushConsoleMessage("[" + Date.now() + "] " + message);
};
