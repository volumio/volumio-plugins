'use strict';

var libQ = require('kew');
var libNet = require('net');
var exec = require('child_process').exec;
var config = new(require('v-conf'))();
var backend = require('./backend');
var fs = require('fs');
var myUri = "";
var semver = require('semver');

module.exports = ControllerVolusonic;

function ControllerVolusonic(context) {
  var self = this;

  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;

}

ControllerVolusonic.prototype.onVolumioStart = function() {
  var self = this;
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  this.config = new(require('v-conf'))();
  this.config.loadFile(configFile);

  return libQ.resolve();
}

ControllerVolusonic.prototype.onStart = function() {
  var self = this;
  var defer = libQ.defer();


  self.backend = new backend(self.commandRouter.logger, self.config);
  self.mpdPlugin = self.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

  self.commandRouter.loadI18nStrings();
  self.commandRouter.updateBrowseSourcesLang();
  self.addToBrowseSources();

  // Once the Plugin has successfull started resolve the promise
  defer.resolve();

  return defer.promise;
};

ControllerVolusonic.prototype.onStop = function() {
  var self = this;
  var defer = libQ.defer();

  this.commandRouter.volumioRemoveToBrowseSources('Volusonic')
    .then(function() {
      self.resetPlugin();
      self.config.set('auth', '');
    });

  // Once the Plugin has successfull stopped resolve the promise
  defer.resolve();

  return libQ.resolve();
};

ControllerVolusonic.prototype.resetPlugin = function() {
  var self = this;
  var defer = libQ.defer();

  self.commandRouter.volumioClearQueue();
  self.backend.cacheReset();
  //TO DO - FIND A WAY TO SET NAV TO HOME IN BROWSE PANNEL

  defer.resolve();
  return libQ.resolve();
};

ControllerVolusonic.prototype.onRestart = function() {
  var self = this;
  // Optional, use if you need it
};

ControllerVolusonic.prototype.getI18nFile = function() {
  var self = this;
  var file = __dirname + '/i18n/strings_' + this.commandRouter.sharedVars.get('language_code') + '.json';

  if (fs.existsSync(file)) {
    return file;
  } else {
    return __dirname + '/i18n/strings_en.json';
  }
};

// Configuration Methods -----------------------------------------------------------------------------
ControllerVolusonic.prototype.getUIConfig = function() {
  var defer = libQ.defer();
  var self = this;

  var lang_code = this.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
    .then(function(uiconf) {
      var findOption = function(optionVal, options) {
        for (var i = 0; i < options.length; i++) {
          if (options[i].value === optionVal)
            return options[i];
        }
      };

      uiconf.sections[0].content[0].value = self.config.get('server');
      uiconf.sections[0].content[1].value = self.config.get('username');
      uiconf.sections[0].content[2].value = self.config.get('auth');
      uiconf.sections[0].content[3].value = self.config.get('salt');

      uiconf.sections[1].content[0].value = findOption(self.config.get('transcode'), uiconf.sections[1].content[0].options);
      uiconf.sections[1].content[1].value = findOption(self.config.get('listsSize'), uiconf.sections[1].content[1].options);
      uiconf.sections[1].content[2].value = findOption(self.config.get('artSize'), uiconf.sections[1].content[2].options);
      uiconf.sections[1].content[3].value = findOption(self.config.get('timeOut'), uiconf.sections[1].content[3].options);
      uiconf.sections[1].content[4].value = self.config.get('ID3');
      uiconf.sections[1].content[5].value = self.config.get('metas');
      uiconf.sections[1].content[6].value = self.config.get('path');
      /*
      	tracks in searchx
      	show similar artists not present in subso
      */
      defer.resolve(uiconf);
    })
    .fail(function() {
      defer.reject(new Error('getUIconfig'));
    });
  return defer.promise;
};

ControllerVolusonic.prototype.getConfigurationFiles = function() {
  return ['config.json'];
};

ControllerVolusonic.prototype.setUIConfig = function(data) {
  var self = this;
  //Perform your installation tasks here
};

ControllerVolusonic.prototype.getConf = function(varName) {
  var self = this;
  //Perform your installation tasks here
};

ControllerVolusonic.prototype.setConf = function(varName, varValue) {
  var self = this;
  //Perform your installation tasks here
};

ControllerVolusonic.prototype.savePluginCredentials = function(data) {
  var self = this;
  var defer = libQ.defer();

  //cut extra stuff from a copy/paste of server url
  if (data['server'].includes('.view')) data['server'] = data['server'].substring(0, data['server'].lastIndexOf('/'));

  self.config.set('server', data['server']);
  self.config.set('username', data['username']);
  self.config.set('salt', data['salt']);
  self.config.set('auth', self.backend.getAuth(data['username'], data['auth'], data['salt']));

  var result = self.backend.submitQuery('ping.view?')
    .then(function(result) {
      var msg;
      var tit;
      if (result['subsonic-response'].status == 'ok') {
        tit = self.commandRouter.getI18nString('CON_SUCCESS');
        msg = self.commandRouter.getI18nString('CON_OK');
      } else {
        tit = self.commandRouter.getI18nString('CON_FAILED');
        msg = self.commandRouter.getI18nString('CON_BAD_CREDS');
      }

      var conTest = {
        title: tit,
        message: msg,
        size: 'lg',
        buttons: [{
          name: 'Ok',
          class: 'btn btn-warning'
        }]
      }
      self.commandRouter.broadcastMessage("openModal", conTest);
      defer.resolve();
    })
    .fail(function(result) {
      var conTest = {
        title: self.commandRouter.getI18nString('CON_FAILED'),
        message: self.commandRouter.getI18nString('CON_SERVER_UNREACHABLE'),
        size: 'lg',
        buttons: [{
          name: 'Ok',
          class: 'btn btn-warning'
        }]
      }
      self.commandRouter.broadcastMessage("openModal", conTest);
      defer.reject(new Error('savePluginCredentials'));
    });

  //clearing mpd queue and cache in case of server change
  self.resetPlugin();

  return defer.promise;
};

ControllerVolusonic.prototype.savePluginOptions = function(data) {
  var self = this;
  var defer = libQ.defer();

  self.config.set('transcode', data['transcode'].value);
  self.config.set('listsSize', data['listsSize'].value);
  self.config.set('artSize', data['artSize'].value);
  self.config.set('timeOut', data['timeOut'].value);
  self.config.set('ID3', data['ID3']);
  self.config.set('metas', data['metas']);
  self.config.set('path', data['path']);

  self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('VOLUSONIC_OPTIONS'), self.commandRouter.getI18nString('SAVED') + " !");

  //clearing mpd playlist due to seeking depending on transcoding setting
  self.resetPlugin();

  defer.resolve();
  return defer.promise;
};


// Browsing functions ---------------------------------------------------------------------------------------

ControllerVolusonic.prototype.addToBrowseSources = function() {
  var data = {
    name: 'Volusonic',
    uri: 'volusonic',
    plugin_type: 'music_service',
    plugin_name: 'volusonic',
    albumart: '/albumart?sourceicon=music_service/volusonic/subso.png'
  };
  this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerVolusonic.prototype.handleBrowseUri = function(curUri) {

  var self = this;
  var response;
  var uriParts = curUri.split('/');
  var defer = libQ.defer();

  if (self.config.get('path')) {
    if ((curUri == 'volusonic') && (myUri != "") && (myUri.split('/').length > 2)) {
      curUri = myUri;
    } else {
      myUri = curUri;
    }
  }

  var uriParts = curUri.split('/');

  var ping = self.backend.submitQuery('ping.view?')
    .then(function(ping) {
      if (ping['subsonic-response'].status == 'ok') {
        var ApiVersion = ping['subsonic-response'].version;
        if (curUri.startsWith('volusonic')) {
          if (curUri == 'volusonic') {
            var nav = ({
              navigation: {
                prev: {
                  uri: '/'
                },
                lists: [{
                  title: self.config.get('server'),
                  icon: "fa fa-server",
                  availableListViews: ["list", "grid"],
                  items: [{
                      service: 'volusonic',
                      type: 'item-no-menu',
                      title: self.commandRouter.getI18nString('INDEXS'),
                      artist: '',
                      album: '',
                      //icon: 'fa fa-random',
                      icon: 'fa fa-sort-alpha-asc',
                      uri: 'volusonic/index'
                    },
                    {
                      service: 'volusonic',
                      type: 'item-no-menu',
                      title: self.commandRouter.getI18nString('RANDOMS_ALBUMS'),
                      artist: '',
                      album: '',
                      icon: 'fa fa-random',
                      uri: 'volusonic/random'
                    },
                    {
                      service: 'volusonic',
                      type: 'item-no-menu',
                      title: self.commandRouter.getI18nString('NEWEST_ALBUMS'),
                      artist: '',
                      album: '',
                      icon: 'fa fa-star',
                      uri: 'volusonic/newest'
                    },
                    {
                      service: 'volusonic',
                      type: 'item-no-menu',
                      title: self.commandRouter.getI18nString('GENRES'),
                      artist: '',
                      album: '',
                      icon: 'fa fa-transgender-alt',
                      uri: 'volusonic/genres'
                    },
                    {
                      service: 'volusonic',
                      type: 'item-no-menu',
                      title: self.commandRouter.getI18nString('PLAYLISTS'),
                      artist: '',
                      album: '',
                      icon: 'fa fa-list-alt',
                      uri: 'volusonic/playlists'
                    },
                    {
                      service: 'volusonic',
                      type: 'item-no-menu',
                      title: self.commandRouter.getI18nString('PODCASTS'),
                      artist: '',
                      album: '',
                      icon: 'fa fa-podcast',
                      uri: 'volusonic/podcasts'
                    }
                  ]
                }]
              }
            });
            if (semver.satisfies(ApiVersion, '>=1.11.0')) {
              nav.navigation['lists'][0]['items'].push({
                service: 'volusonic',
                type: 'item-no-menu',
                title: self.commandRouter.getI18nString('ARTISTS'),
                artist: '',
                album: '',
                icon: 'fa fa-microphone',
                uri: 'volusonic/artists'
              });
            }
            response = libQ.resolve(nav);
          } else if (curUri.startsWith('volusonic/index')) {
            if (curUri == 'volusonic/index') {
              response = self.listMusicFolders(uriParts, curUri);
            } else if (uriParts.length == 3) {
              response = self.listIndexes(uriParts, curUri);
            } else {
              response = self.listMusicDirectory(uriParts, curUri);
            }
          } else if (curUri.startsWith('volusonic/random')) {
            if (curUri === 'volusonic/random') {
              response = self.listAlbums(uriParts, curUri);
            } else {
              response = self.listTracks(uriParts, curUri);
            }
          } else if (curUri.startsWith('volusonic/search')) {
            if (uriParts[3] === 'album' && uriParts.length == 5) {
              response = self.listTracks(uriParts, curUri);
            } else {
              var query = {
                'value': uriParts[2],
                'type': 'any'
              };
              response = self._search(query, "volusonic/search");
            }
          } else if (curUri.startsWith('volusonic/newest')) {
            if (curUri === 'volusonic/newest') {
              response = self.listAlbums(uriParts, curUri);
            } else {
              response = self.listTracks(uriParts, curUri);
            }
          } else if (curUri.startsWith('volusonic/genres')) {
            if (curUri == 'volusonic/genres')
              response = self.listGenres(uriParts, curUri);
            else if (uriParts.length == 3) {
              response = self.listAlbums(uriParts, curUri);
            } else if (uriParts.length == 4) {
              response = self.listTracks(uriParts, curUri);
            }
          } else if (curUri.startsWith('volusonic/artists')) {
            if (uriParts.length == 2) {
              response = self.listArtists(uriParts, curUri);
            } else if (uriParts.length == 3) {
              response = self.showArtist(uriParts, curUri);
            } else if (uriParts.length == 4) {
              response = self.listTracks(uriParts, curUri);
            }
          } else if (curUri.startsWith('volusonic/playlists')) {
            if (curUri == 'volusonic/playlists')
              response = self.listPlaylists(uriParts, curUri);
            else if (uriParts.length == 3) {
              response = self.playlistEntrys(uriParts, curUri);
            }
          } else if (curUri.startsWith('volusonic/podcasts')) {
            if (curUri == 'volusonic/podcasts')
              response = self.listPodcasts(uriParts, curUri);
            else if (uriParts.length == 3) {
              response = self.podcastEpisodes(uriParts, curUri);
            }
          }
        }
        defer.resolve(response);
      } else {
        var conError = {
          title: self.commandRouter.getI18nString('CON_FAILED'),
          message: self.commandRouter.getI18nString('CON_BAD_CREDS'),
          size: 'lg',
          buttons: [{
            name: 'Ok',
            class: 'btn btn-warning'
          }]
        }
        self.commandRouter.broadcastMessage("openModal", conError);
        //defer.resolve();
      }
    })
    .fail(function(result) {
      var conErr = {
        title: self.commandRouter.getI18nString('CON_FAILED'),
        message: self.commandRouter.getI18nString('CON_SERVER_UNREACHABLE'),
        size: 'lg',
        buttons: [{
          name: 'Ok',
          class: 'btn btn-warning'
        }]
      }
      self.commandRouter.broadcastMessage("openModal", conErr);
    });

  return defer.promise;
};

ControllerVolusonic.prototype._getIcon = function(path) {
  var self = this;
  var icon = 'fa fa-music';

  switch (path) {
    case 'random':
      icon = 'fa fa-random';
      break;
    case 'newest':
      icon = 'fa fa-star';
      break;
    case 'genres':
      icon = 'fa fa-transgender-alt';
      break;
    case 'playlists':
      icon = 'fa fa-list-alt';
      break;
    case 'artists':
      icon = 'fa fa-microphone';
      break;
    case 'podcasts':
      icon = 'fa fa-podcast'
      break;
  }
  return icon;
}

ControllerVolusonic.prototype.getSetting = function(setting) {
  var self = this;
  var set;

  switch (setting) {
    case 'listsSize':
      switch (self.config.get('listsSize')) {
        case 0:
          set = '500';
          break;
        case 1:
          set = '200';
          break;
        case 2:
          set = '100';
          break;
        case 3:
          set = '50';
          break;
      }
      break;
    case 'artSize':
      switch (self.config.get('artSize')) {
        case 0:
          set = '1200';
          break;
        case 1:
          set = '800';
          break;
        case 2:
          set = '600';
          break;
        case 3:
          set = '400';
          break;
        case 4:
          set = '200';
          break;
      }
      break;
    case 'transcode':
      switch (self.config.get('transcode')) {
        case 0:
          set = 'raw';
          break;
        case 1:
          set = '320';
          break;
        case 2:
          set = '256';
          break;
        case 3:
          set = '128';
          break;
        case 4:
          set = '64';
          break;
      }
      break;
  }
  return set;
}

ControllerVolusonic.prototype.playlistEntrys = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();
  var title;

  var id = uriParts.pop();
  var params = 'id=' + id;

  var result = self.backend.get('getPlaylist', id, params)
    .then(function(result) {
      var items = [];
      var playlist = result['subsonic-response']['playlist'];
      playlist['entry'].forEach(function(song) {
        items.push(self._formatSong(song, curUri));
      });
      defer.resolve(self._formatPlay(playlist.name, playlist.owner, self._getArtId(playlist.coverArt), new Date(playlist.changed).toLocaleDateString(), playlist.duration, items, self._prevUri(curUri), curUri));
    })
    .fail(function(result) {
      defer.reject(new Error('playlistEntrys'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype.showArtist = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();

  var id = uriParts.pop();

  var nav = {
    navigation: {
      lists: [],
      prev: {
        uri: self._prevUri(curUri)
      },
      info: {}
    }
  }

  var info = {
    uri: curUri,
    title: '',
    service: 'volusonic',
    type: 'artist',
    albumart: ''
  }

  var infos = self._artistInfos(id);
  infos.then(function(infos) {
    var artist = self._artist(id);
    artist.then(function(artist) {
      var artistArt = self._getArtistArt(encodeURIComponent(artist.name));
      artistArt.then(function(artistArt) {
        var top = self._topSongs(encodeURIComponent(artist.name), '10');
        top.then(function(top) {
          //head section
          info.title = artist.name;
          info.albumart = artistArt;
          //bio section
          var meta = "";
          if ((infos.biography !== undefined) && (self.config.get('metas'))) {
            if (typeof infos.biography == "string") meta = infos.biography; //ampache hack
          }
          var bio = {
            title: meta,
            type: 'folder',
            availableListViews: ['list', 'grid'],
            items: [{
              service: 'volusonic',
              type: 'song',
              icon: 'fa fa-bolt',
              title: self.commandRouter.getI18nString('START_RADIO'),
              uri: 'volusonic/radio/' + id,
            }]
          }
          nav.navigation['lists'].push(bio);
          //top songs section
          if (top.song !== undefined) {
            var sgs = [];
            top['song'].forEach(function(song) {
              sgs.push(self._formatSong(song, curUri));
            });
            var topSongs = {
              title: self.commandRouter.getI18nString('TOP_SONGS'),
              type: 'song',
              availableListViews: ['list', 'grid'],
              items: sgs
            }
            nav.navigation['lists'].push(topSongs);
          }
          //albums section
          if ((artist.album !== undefined) || (artist.child !== undefined)) {
            var alb = "child";
            if (self.config.get('ID3')) alb = "album";
            var albs = [];
            artist[alb].forEach(function(album) {
              albs.push(self._formatAlbum(album, curUri));
            });
            var albums = {
              title: self.commandRouter.getI18nString('ALBUMS'),
              type: 'folder',
              availableListViews: ['list', 'grid'],
              items: albs
            }
            nav.navigation['lists'].push(albums);
          }
          //similar artists
          if (infos.similarArtist !== undefined) {
            var arts = [];

            if (infos['similarArtist']['0'] !== undefined) { //ampache hack
              infos['similarArtist'].forEach(function(similar) {
                arts.push(self._formatArtist(similar, self._prevUri(curUri)));
              });
            } else {
              arts.push(self._formatArtist(infos['similarArtist'], self._prevUri(curUri)));
            }
            var similars = {
              title: self.commandRouter.getI18nString('SIMILAR_ARTISTS'),
              type: 'folder',
              availableListViews: ['list', 'grid'],
              items: arts
            }
            nav.navigation['lists'].push(similars);
          }

          nav.navigation['info'] = info;
          defer.resolve(nav);
        });
      });
    });
  });
  return defer.promise;
}

ControllerVolusonic.prototype._getArtId = function(id){
  if (id == undefined) id = "-1";
  return id;
}
ControllerVolusonic.prototype._artist = function(id) {
  var self = this;
  var defer = libQ.defer();

  var getArtist = 'getMusicDirectory';
  if (self.config.get('ID3')) getArtist = "getArtist";

  var artist = "directory";
  if (self.config.get('ID3')) artist = "artist";

  var result = self.backend.get(getArtist, id, "id=" + id)
    .then(function(result) {
      defer.resolve(result['subsonic-response'][artist]);
    })
    .fail(function(result) {
      defer.reject(new Error('_artist'));
    });
  return defer.promise;
}
ControllerVolusonic.prototype._getArtistArt = function(artist) {
  var self = this;
  var defer = libQ.defer();

  var result = self.backend.getArtistArt(artist)
    .then(function(result) {
      defer.resolve(result.data);
    })
    .fail(function() {
      defer.resolve("/albumart");
    });
  return defer.promise;
}

ControllerVolusonic.prototype._topSongs = function(artist, count) {
  var self = this;
  var defer = libQ.defer();

  var result = self.backend.get('getTopSongs', artist + count, "artist=" + artist + "&count=" + count)
    .then(function(result) {
      if (result['subsonic-response']['topSongs'] !== undefined) { //lms hack
        defer.resolve(result['subsonic-response']['topSongs']);
      } else {
        defer.resolve(result);
      }
    })
    .fail(function(result) {
      defer.reject(new Error('_topSongs'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype._artistInfos = function(id) {
  var self = this;
  var defer = libQ.defer();

  var getInfo = 'getArtistInfo';
  if (self.config.get('ID3')) getInfo = "getArtistInfo2";

  var listInfo = 'artistInfo';
  if (self.config.get('ID3')) listInfo = "artistInfo2";

  var result = self.backend.get(getInfo, id, "id=" + id)
    .then(function(result) {
      if (result['subsonic-response']['artistInfo2'] !== undefined) { //ampache hack
        listInfo = "artistInfo2"; //ampache hack
      } else { //ampache hack
        listInfo = "artistInfo" //ampache hack
      } //ampache hack
      defer.resolve(result['subsonic-response'][listInfo]);
    })
    .fail(function(result) {
      defer.reject(new Error('_artistInfos'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype._album = function(id) {
  var self = this;
  var defer = libQ.defer();

  var getAlbum = 'getMusicDirectory';
  if (self.config.get('ID3')) getAlbum = "getAlbum";

  var container = 'directory';
  if (self.config.get('ID3')) container = "album";

  var result = self.backend.get(getAlbum, id, "id=" + id)
    .then(function(result) {
      defer.resolve(result['subsonic-response'][container]);
    })
    .fail(function(result) {
      defer.reject(new Error('_artistInfos'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype.listTracks = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();
  var title;

  var id = uriParts.pop();
  var params = 'id=' + id;

  var getAlbum = 'getMusicDirectory';
  if (self.config.get('ID3')) getAlbum = "getAlbum";

  var container = 'directory';
  if (self.config.get('ID3')) container = "album";

  var item = 'child';
  if (self.config.get('ID3')) item = "song";

  var result = self.backend.get(getAlbum, id, params)
    .then(function(result) {
      var album = result['subsonic-response'][container];
      var items = [];
      album[item].forEach(function(song) {
        items.push(self._formatSong(song, curUri));
      });
      var play = self._formatPlay(album.name, album.artist, self._getArtId(album.coverArt), album.year, album.duration, items, self._prevUri(curUri), curUri);
      var albumInfos = self._albumInfos(id)
        .then(function(albumInfos) {
          if ((albumInfos.notes !== undefined) && (self.config.get('metas'))) {
            play.navigation.lists[0].title = albumInfos.notes;
            play.navigation.lists[0].type = 'folder';
          }
          defer.resolve(play);
        })
        .fail(function() {
          defer.resolve(play);
        });
    })
    .fail(function(result) {
      defer.reject(new Error('listTracks'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype._albumInfos = function(id) {
  var self = this;
  var defer = libQ.defer();

  var getInfo = 'getAlbumInfo';
  if (self.config.get('ID3')) getInfo = "getAlbumInfo2";


  var result = self.backend.get(getInfo, id, "id=" + id)
    .then(function(result) {
      if (result['subsonic-response']['albumInfo'] !== undefined) {
        defer.resolve(result['subsonic-response']['albumInfo']);
      } else {
        defer.resolve(result['subsonic-response']);
      }
    })
    .fail(function(result) {
      defer.reject(new Error('_albumInfos'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype._formatPlay = function(album, artist, coverart, year, duration, items, prevUri, curUri) {
  var self = this;

  var nav = {
    navigation: {
      lists: [{
        title: '',
        type: '',
        availableListViews: ['list', 'grid'],
        items: items
      }],
      prev: {
        uri: prevUri
      },
      info: {
        uri: curUri,
        service: 'volusonic',
        artist: artist,
        album: album,
        albumart: self.config.get('server') + '/rest/getCoverArt.view?id=' + self._getArtId(coverart) + '&size=' + self.getSetting('artSize') + '&' + self.config.get('auth'),
        year: year,
        type: 'album',
        duration: parseInt(duration / 60) + 'mns'
      }
    }
  }
  return nav;
}

ControllerVolusonic.prototype.listPlaylists = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();

  var params = '';

  var result = self.backend.get('getPlaylists', 'All', params)
    .then(function(result) {
      var items = [];
      result['subsonic-response']['playlists']['playlist'].forEach(function(playlist) {
        items.push(self._formatPlaylist(playlist, curUri));
      });
      defer.resolve(self._formatNav('Playlists', 'folder', self._getIcon(uriParts[1]), ['list', 'grid'], items, self._prevUri(curUri)));
    })
    .fail(function(result) {
      defer.reject(new Error('listPlaylist'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype.listPodcasts = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();

  var id = "All";
  var params = "includeEpisodes=no";

  var result = self.backend.get('getPodcasts', id, params)
    .then(function(result) {
      var items = [];
      result['subsonic-response']['podcasts']['channel'].forEach(function(podcast) {
        items.push(self._formatPodcast(podcast, curUri));
      });
      defer.resolve(self._formatNav('Podcasts', 'item-no-menu', self._getIcon(uriParts[1]), ['list', 'grid'], items, self._prevUri(curUri)));
    })
    .fail(function(result) {
      defer.reject(new Error('listPodcasts'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype.podcastEpisodes = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();

  var id = uriParts.pop();
  var params = "id=" + id;

  var result = self.backend.get('getPodcasts', id, params)
    .then(function(result) {
      var items = [];
      result['subsonic-response']['podcasts']['channel']['0']['episode'].forEach(function(episode) {
        items.push(self._formatPodcastEpisode(episode, curUri));
      });
      defer.resolve(self._formatNav(result['subsonic-response']['podcasts']['channel']['0'].title, 'folder', self._getIcon(uriParts[1]), ['list', 'grid'], items, self._prevUri(curUri)));
    })
    .fail(function(result) {
      defer.reject(new Error('podcastEpisode'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype.listAlbums = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();

  var params;
  var id = uriParts[1];
  if (id == "genres") {
    id = uriParts[2];
    params = "type=byGenre&genre=" + uriParts[2] + "&size=" + self.getSetting('listsSize');
  } else {
    params = "type=" + uriParts[1] + "&size=" + self.getSetting('listsSize');
  }

  var getList = 'getAlbumList';
  if (self.config.get('ID3')) getList = "getAlbumList2";

  var aList = 'albumList';
  if (self.config.get('ID3')) aList = "albumList2";

  var result = self.backend.get(getList, id, params)
    .then(function(result) {
      var items = [];
      result['subsonic-response'][aList]['album'].forEach(function(album) {
        items.push(self._formatAlbum(album, curUri));
      });
      defer.resolve(self._formatNav(uriParts[uriParts.length - 1].charAt(0).toUpperCase() + uriParts[uriParts.length - 1].slice(1), 'folder', self._getIcon(uriParts[1]), ['list', 'grid'], items, self._prevUri(curUri)));
    })
    .fail(function(result) {
      defer.reject(new Error('listAlbums'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype._prevUri = function(curUri) {
  var self = this;
  var lastIndex = curUri.lastIndexOf("/");
  return curUri.slice(0, lastIndex);
}

ControllerVolusonic.prototype._formatNav = function(title, type, icon, views, items, prevUri) {
  var self = this;
  var nav = {
    navigation: {
      lists: [{
        title: title,
        type: type,
        icon: icon,
        availableListViews: views,
        items: items
      }],
      prev: {
        uri: prevUri
      },
    }
  }
  return nav;
}

ControllerVolusonic.prototype._formatPodcastEpisode = function(episode, curUri) {
  var self = this;
  var item = {
    service: 'volusonic',
    type: 'song',
    title: episode.title,
    artist: new Date(episode.publishDate).toLocaleDateString(),
    album: episode.description,
    albumart: self.config.get('server') + '/rest/getCoverArt.view?id=' + self._getArtId(episode.coverArt) + '&' + self.getSetting('artSize') + '&' + self.config.get('auth'),
    uri: 'volusonic/track/' + episode.streamId + "C" + episode.channelId //we had the channelId so it can be passed to the queue (goto call)
  }
  return item;
}

ControllerVolusonic.prototype._formatSong = function(song, curUri) {
  var self = this;
  var item = {
    service: 'volusonic',
    type: 'song',
    title: song.title,
    artist: song.artist,
    albumart: self.config.get('server') + '/rest/getCoverArt.view?id=' + self._getArtId(song.coverArt) + '&size=' + self.getSetting('artSize') + '&' + self.config.get('auth'),
    uri: 'volusonic/track/' + song.id,
  }
  return item;
}

ControllerVolusonic.prototype._formatPodcast = function(podcast, curUri) {
  var self = this;
  var item = {
    service: 'volusonic',
    type: 'item-no-menu',
    title: podcast.title,
    artist: podcast.description,
    album: "",
    albumart: self.config.get('server') + '/rest/getCoverArt.view?id=' + self._getArtId(podcast.coverArt) + '&' + self.getSetting('artSize') + '&' + self.config.get('auth'),
    icon: "",
    uri: curUri + '/' + podcast.id
  }
  return item;
}

ControllerVolusonic.prototype._formatAlbum = function(album, curUri) {
  var self = this;
  var tit = album.name || album.title;

  var item = {
    service: 'volusonic',
    type: 'playlist',
    title: tit + ' (' + new Date(album.created).getFullYear() + ')',
    artist: album.artist,
    album: "",
    albumart: self.config.get('server') + '/rest/getCoverArt.view?id=' + self._getArtId(album.coverArt) + '&' + self.getSetting('artSize') + '&' + self.config.get('auth'),
    icon: "",
    uri: curUri + '/' + album.id
  }
  return item;
}

ControllerVolusonic.prototype._formatPlaylist = function(playlist, curUri) {
  var self = this;
  var item = {
    service: 'volusonic',
    type: 'folder',
    title: playlist.name + ' (' + new Date(playlist.created).getFullYear() + ')',
    albumart: self.config.get('server') + '/rest/getCoverArt.view?id=' + self._getArtId(playlist.coverArt) + '&' + self.getSetting('artSize') + '&' + self.config.get('auth'),
    icon: "",
    uri: curUri + '/' + playlist.id
  }
  return item;
}

ControllerVolusonic.prototype._formatArtist = function(artist, curUri) {
  var self = this;

  var item = {
    service: 'volusonic',
    type: 'item-no-menu',
    title: artist.name,
    //albumart: artist.artistImageUrl,
    icon: 'fa fa-microphone',
    uri: curUri + '/' + artist.id
  }
  return item;
};

ControllerVolusonic.prototype._formatDirectory = function(folder, curUri) {
  var self = this;
  var title = folder.name || folder.title;

  var item = {
    service: 'volusonic',
    type: 'folder',
    title: title,
    //albumart: artist.artistImageUrl,
    icon: 'fa fa-folder-open',
    uri: curUri + '/' + folder.id
  }
  return item;
};

ControllerVolusonic.prototype.listGenres = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();
  var result = self.backend.get('getGenres', 'All', '')
    .then(function(result) {
      var item;
      var items = [];
      result['subsonic-response']['genres']['genre'].forEach(function(genre) {
        item = {
          service: 'volusonic',
          type: 'folder',
          title: genre.value,
          icon: "fa fa-transgender-alt",
          uri: curUri + '/' + genre.value
        }
        if (genre.value != "Podcast" && genre.value != "radio") {
          items.push(item);
        }
      });
      /*	items.sort(function(a, b) {
      		var tA = a.title.toLowerCase();
      		var tB = b.title.toLowerCase();

      		if (tA < tB){
      			return -1;
      		}

      		if (tB < tA){
      			return 1;
      		}
      		return 0;
      	});
      */
      defer.resolve(self._formatNav(uriParts[1].charAt(0).toUpperCase() + uriParts[1].slice(1), 'folder', 'fa fa-transgender-alt', ['list', 'grid'], items, self._prevUri(curUri)));
    })
    .fail(function(result) {
      defer.reject(new Error('listGenres'));
    });
  return defer.promise;
};

ControllerVolusonic.prototype.listArtists = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();

  var getArtists = "getIndexes";
  if (self.config.get('ID3')) getArtists = "getArtists";

  var container = "indexes";
  if (self.config.get('ID3')) container = "artists";

  var result = self.backend.get(getArtists, 'Artists', '')
    .then(function(result) {
      var list = [];
      var item;
      var items = [];
      var artists = [];

      result['subsonic-response'][container]['index'].forEach(function(index) {
        index['artist'].forEach(function(artist) {
          artists.push(self._formatArtist(artist, curUri));
        });
        item = {
          service: 'volusonic',
          type: 'item-no-menu',
          title: index.name,
          availableListViews: ['list', 'grid'],
          icon: '', //"fa fa-microphone",
          uri: curUri + '/' + index.name,
          items: artists
        }
        list.push(item);
        artists = [];
      });
      defer.resolve({
        navigation: {
          lists: list,
          prev: {
            uri: self._prevUri(curUri)
          }
        }
      });
    })
    .fail(function(result) {
      defer.reject(new Error('listArtists'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype.listMusicFolders = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();

  var result = self.backend.get('getMusicFolders', 'All', '')
    .then(function(result) {
      var folder;
      var folders = [];
      result['subsonic-response']['musicFolders']['musicFolder'].forEach(function(folder) {
        var item = {
          service: 'volusonic',
          type: 'item-no-menu',
          title: folder.name,
          icon: 'fa fa-folder-open',
          uri: curUri + '/' + folder.id
        }
        folders.push(item);
      });
      defer.resolve(self._formatNav(uriParts[1].charAt(0).toUpperCase() + uriParts[1].slice(1), 'folder', 'fa fa-folder-open', ['list', 'grid'], folders, self._prevUri(curUri)));
    });
  return defer.promise;
}

ControllerVolusonic.prototype.listIndexes = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();

  var id = uriParts.pop();
  var params = 'musicFolderId=' + id;

  var container = "indexes";

  var result = self.backend.get('getIndexes', 'Indexes' + id, params)
    .then(function(result) {
      var list = [];
      var item;
      var items = [];
      var artists = [];

      result['subsonic-response'][container]['index'].forEach(function(index) {
        index['artist'].forEach(function(artist) {
          artists.push(self._formatDirectory(artist, curUri));
        });
        item = {
          service: 'volusonic',
          type: 'item-no-menu',
          title: index.name,
          availableListViews: ['list', 'grid'],
          icon: '',
          uri: curUri + '/' + index.name,
          items: artists
        }
        list.push(item);
        artists = [];
      });
      defer.resolve({
        navigation: {
          lists: list,
          prev: {
            uri: self._prevUri(curUri)
          }
        }
      });
    })
    .fail(function(result) {
      defer.reject(new Error('listIndexes'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype.listMusicDirectory = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();
  var title;

  var id = uriParts.pop();
  var params = 'id=' + id;

  var container = 'directory';

  var result = self.backend.get('getMusicDirectory', id, params)
    .then(function(result) {
      var directory = result['subsonic-response']['directory'];
      var items = [];
      directory['child'].forEach(function(child) {
        if (child.isDir) {
          items.push(self._formatDirectory(child, curUri));
        } else {
          items.push(self._formatSong(child, curUri));
        }
      });
      defer.resolve(self._formatNav(uriParts[1].charAt(0).toUpperCase() + uriParts[1].slice(1), 'folder', 'fa fa-transgender-alt', ['list', 'grid'], items, self._prevUri(curUri)));
    })
    .fail(function(result) {
      defer.reject(new Error('listMusicDirectory'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype.artistInfo = function(uriParts, curUri) {
  var self = this;
  var defer = libQ.defer();
  var id = uriParts.pop();

  var getInfo = 'getArtistInfo';
  if (self.config.get('ID3')) getInfo = "getArtistInfo2";
  var result = self.backend.get(getInfo, id, 'id=' + id)
    .then(function(result) {

    })
    .fail(function(result) {
      defer.reject(new Error('artistInfo'));
    });
  return defer.promise;
}

//Playable function
ControllerVolusonic.prototype.explodeUri = function(uri) {
  var self = this;
  var defer = libQ.defer();

  var uriParts = uri.split('/');
  var id = uriParts.pop();
  var command;
  var params;
  var items = [];
  var song;

  if (uri.startsWith('volusonic/track')) {
    command = 'getSong';
    //get the podcast ChannelId if needed
    if (id.includes("C")) {
      var idParts = id.split('C');
      var channelId = idParts.pop();
      params = 'id=' + idParts.pop();
    } else {
      params = 'id=' + id;
    }
    var result = self.backend.get(command, id, params)
      .then(function(result) {
        if (result['subsonic-response']['song']['0'] !== undefined) { //ampache hack
          song = result['subsonic-response']['song']['0'];
        } else {
          song = result['subsonic-response']['song'];
        }
        var playable = self._getPlayable(song);
        if (channelId !== undefined) {
          playable.channelId = channelId;
        }
        defer.resolve(playable);
      })
      .fail(function(result) {
        defer.reject(new Error('explodeUri volusonic/track'));
      });
  } else if (uri.startsWith('volusonic/playlists')) {
    command = 'getPlaylist';
    params = 'id=' + id;
    var result = self.backend.get(command, id, params)
      .then(function(result) {
        result['subsonic-response']['playlist']['entry'].forEach(function(song) {
          items.push(self._getPlayable(song));
        });
        defer.resolve(items);
      })
      .fail(function(result) {
        defer.reject(new Error('explodeUri volusonic/playlists'));
      });
  } else if (uri.startsWith('volusonic/radio')) {
    command = 'getSimilarSongs';
    if (self.config.get('ID3')) command = "getSimilarSongs2";

    var similar = "similarSongs";
    if (self.config.get('ID3')) similar = "similarSongs2";

    params = 'id=' + id + "&count=500";
    var result = self.backend.get(command, id, params)
      .then(function(result) {
        if (result['subsonic-response']['similarSongs'] !== undefined) { //ampache hack
          similar = "similarSongs"; //ampache hack
        } else { //ampache hack
          similar = "similarSongs2"; //ampache hack
        } //ampache hack
        result['subsonic-response'][similar]['song'].forEach(function(song) {
          items.push(self._getPlayable(song));
        });
        defer.resolve(items);
      })
      .fail(function(result) {
        defer.reject(new Error('explodeUri volusonic/radio'));
      });
  } else if (uri.startsWith('volusonic/artists') && uriParts.length == 2) {
    var artist = self._artist(id);
    artist.then(function(artist) {
      if ((artist.album !== undefined) || (artist.child !== undefined)) {
        var container = "child";
        if (self.config.get('ID3')) container = "album";
        var proms = [];
        artist[container].forEach(function(album) {
          var alb = self._album(album.id);
          var sg = "child";
          if (self.config.get('ID3')) sg = "song";
          alb.then(function(alb) {
            alb[sg].forEach(function(song) {
              items.push(self._getPlayable(song));
            });
          });
          proms.push(alb);
        });
        libQ.all(proms)
          .then(function() {
            defer.resolve(items);
          });
      }
    });
  } else if (uri.startsWith('volusonic/genres') && uriParts.length == 2) {
    command = 'getRandomSongs';
    params = 'genre=' + id + "&size=" + self.getSetting('listsSize');

    var result = self.backend.get(command, id, params)
      .then(function(result) {
        result['subsonic-response']['randomSongs']['song'].forEach(function(song) {
          items.push(self._getPlayable(song));
        });
        defer.resolve(items);
      })
      .fail(function(result) {
        defer.reject(new Error('explodeUri volusonic/genres'));
      });
  } else if (uri.startsWith('volusonic/index')) {
    self._getRecursiveTracks(id)
      .then(function(tracks) {
        tracks.forEach(function(track) {
          items.push(self._getPlayable(track));
        });
        defer.resolve(items);
      })
      .fail(function(result) {
        defer.reject(new Error('explodeUri volusonic/index'));
      });
  } else {
    var command = 'getMusicDirectory';
    if (self.config.get('ID3')) command = "getAlbum";

    var container = 'directory';
    if (self.config.get('ID3')) container = "album";

    var item = 'child';
    if (self.config.get('ID3')) item = "song";


    params = 'id=' + id;
    var result = self.backend.get(command, id, params)
      .then(function(result) {
        result['subsonic-response'][container][item].forEach(function(song) {
          items.push(self._getPlayable(song));
        });
        defer.resolve(items);
      })
      .fail(function(result) {
        defer.reject(new Error('explodeUri volusonic default'));
      });
  }
  return defer.promise;
};

ControllerVolusonic.prototype._getRecursiveTracks = function(id) {
  var self = this;
  var defer = libQ.defer();
  var params = 'id=' + id;

  var result = self.backend.get('getMusicDirectory', id, params)
    .then(function(result) {
      var directory = result['subsonic-response']['directory'];
      var items = [];
      var proms = [];

      directory['child'].forEach(function(child) {
        if (child.isDir) {
          var d = self._getRecursiveTracks(child.id)
            .then(function(tracks) {
              tracks.forEach(function(track) {
                items.push(track);
              });
            });
          proms.push(d);
        } else {
          items.push(child);
        }
      });
      libQ.all(proms)
        .then(function() {
          defer.resolve(items);
        });
    })
    .fail(function(result) {
      defer.reject(new Error('getRecursiveTracks'));
    });
  return defer.promise;
}

ControllerVolusonic.prototype._getPlayable = function(song) {
  var self = this;

  //self.commandRouter.pushConsoleMessage("song: " + JSON.stringify(song));

  var format = "format=mp3&estimateContentLength=true&maxBitRate=" + self.getSetting('transcode');
  var type = song.transcodedSuffix;
  var bRate = self.getSetting('transcode');

  if (self.getSetting('transcode') === 'raw') {
    format = "format=raw";
    type = song.suffix;
    bRate = song.bitRate;
  }

  var track = {
    service: 'volusonic',
    type: 'song',
    name: song.title,
    title: song.title,
    duration: song.duration,
    artist: song.artist,
    artistId: song.artistId,
    album: song.album,
    albumId: song.albumId,
    genre: song.genre,
    type: song.type,
    albumart: self.config.get('server') + '/rest/getCoverArt.view?id=' + self._getArtId(song.coverArt) + '&size=' + self.getSetting('artSize') + '&' + self.config.get('auth'),
    uri: self.config.get('server') + '/rest/stream.view?id=' + song.id + '&' + format + '&' + self.config.get('auth'),
    samplerate: bRate + " kbps",
    trackType: type,
    streaming: true
  }
  return track;
}

ControllerVolusonic.prototype.getTrackInfo = function(uri) {
  var self = this;
  var deferred = libQ.defer();
  var uriParts = uri.split('/');

  if (uri.startsWith('volusonic/track')) {
    var result = self.backend.get('getSong', uriParts[2], 'id=' + uriParts[2])
      .then(function(result) {
        var song = result['subsonic-response']['song'];
        defer.resolve(self._getPlayable(song));
      })
      .fail(function(result) {
        defer.reject(new Error('getTrackInfo'));
      });
  }
  return defer.promise;
}

ControllerVolusonic.prototype.search = function(query) {
  var self = this;
  var defer = libQ.defer();
  var id = encodeURI(query.value);
  var params = "query=" + encodeURI(query.value) + "&artistCount=" + self.getSetting('listsSize') + "&albumCount=" + self.getSetting('listsSize') + "&songCount=" + self.getSetting('listsSize');

  var getSearch = 'search2';
  if (self.config.get('ID3')) getSearch = "search3";

  var sResult = "searchResult2";
  if (self.config.get('ID3')) sResult = "searchResult3";

  var result = self.backend.get(getSearch, id, params)
    .then(function(result) {
      var answer = [];
      var artists = [];
      var albums = [];
      var songs = [];

      if (result['subsonic-response'][sResult]['artist'] !== undefined) {
        result['subsonic-response'][sResult]['artist'].forEach(function(artist) {
          artists.push(self._formatArtist(artist, "volusonic/artists"));
        });
        answer.push({
          title: self.commandRouter.getI18nString('ARTISTS'),
          icon: 'fa fa-microphone',
          availableListViews: [
            "list",
            "grid"
          ],
          items: artists
        });
      }
      if (result['subsonic-response'][sResult]['album'] !== undefined) {
        result['subsonic-response'][sResult]['album'].forEach(function(album) {
          albums.push(self._formatAlbum(album, "volusonic/search/" + query.value + "/album"));
        });
        answer.push({
          title: self.commandRouter.getI18nString('ALBUMS'),
          icon: 'fa fa-play',
          availableListViews: [
            "list",
            "grid"
          ],
          items: albums
        });
      }
      if (result['subsonic-response'][sResult]['song'] !== undefined) {
        result['subsonic-response'][sResult]['song'].forEach(function(song) {
          songs.push(self._formatSong(song, "volusonic/search/" + query.value + "/track"));
        });
        answer.push({
          title: self.commandRouter.getI18nString('TRACKS'),
          icon: 'fa fa-music',
          availableListViews: [
            "list",
            "grid"
          ],
          items: songs
        });
      }
      defer.resolve(answer);
    })
    .fail(function(result) {
      defer.reject(new Error('search'));
    });
  return defer.promise;
};

ControllerVolusonic.prototype._search = function(query, curUri) {
  var self = this;
  var defer = libQ.defer();

  var result = self.search(query)
    .then(function(result) {
      defer.resolve({
        navigation: {
          lists: result,
          prev: {
            uri: self._prevUri(curUri)
          }
        }
      })
    })
    .fail(function(result) {
      defer.reject(new Error('_search'));
    });

  return defer.promise;
}

// Define a method to clear, add, and play an array of tracks
ControllerVolusonic.prototype.clearAddPlayTrack = function(track) {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::clearAddPlayTrack');

  var subsoListenerCallback = () => {
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic: MPD player state update');
    self.mpdPlugin.getState()
      .then(function(state) {
        var selectedTrackBlock = self.commandRouter.stateMachine.getTrack(self.commandRouter.stateMachine.currentPosition);
        if (selectedTrackBlock.service && selectedTrackBlock.service == 'volusonic') {
          self.mpdPlugin.clientMpd.once('system-player', subsoListenerCallback);
          return self.pushState(state);
        } else {
          self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic: Not a subsonic track, removing listener');
        }
      });
  };

  return self.mpdPlugin.sendMpdCommand('stop', [])
    .then(function() {
      return self.mpdPlugin.sendMpdCommand('clear', []);
    })
    .then(function() {
      return self.mpdPlugin.sendMpdCommand('load "' + track.uri + '"', []);
    })
    .fail(function(e) {
      return self.mpdPlugin.sendMpdCommand('add "' + track.uri + '"', []);
    })
    .then(function() {
      self.mpdPlugin.clientMpd.removeAllListeners('system-player');
      self.mpdPlugin.clientMpd.once('system-player', subsoListenerCallback);

      return self.mpdPlugin.sendMpdCommand('play', [])
        .then(function() {
          return self.mpdPlugin.getState()
            .then(function(state) {
              return self.pushState(state);
            });
        });
    });
}

ControllerVolusonic.prototype.clearAddPlayTracks = function(arrayTrackIds) {
  //console.log(arrayTrackIds);
}

// Seek
ControllerVolusonic.prototype.seek = function(timepos) {
  var self = this;
  if (self.getSetting('transcode') === 'raw') {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::seek to ' + timepos);
    return self.mpdPlugin.seek(timepos);
  } else {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::seek disabled for transcoded streams');
    return self.mpdPlugin.getState()
      .then(function(state) {
        return self.pushState(state);
      });
  }
}

// Stop
ControllerVolusonic.prototype.stop = function() {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::stop');
  return self.mpdPlugin.stop()
    .then(function() {
      return self.mpdPlugin.getState()
        .then(function(state) {
          return self.pushState(state);
        });
    });
}

// Pause
ControllerVolusonic.prototype.pause = function() {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::pause');

  return self.mpdPlugin.pause()
    .then(function() {
      return self.mpdPlugin.getState()
        .then(function(state) {
          return self.pushState(state);
        });
    });
}

// Resume
ControllerVolusonic.prototype.resume = function() {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::resume');
  return self.mpdPlugin.resume()
    .then(function() {
      return self.mpdPlugin.getState()
        .then(function(state) {
          return self.pushState(state);
        });
    });
}

// Next
ControllerVolusonic.prototype.next = function() {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::next');
  return self.mpdPlugin.sendMpdCommand('next', [])
    .then(function() {
      return self.mpdPlugin.getState()
        .then(function(state) {
          return self.pushState(state);
        });
    });
}

// Previous
ControllerVolusonic.prototype.previous = function() {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::previous');
  return self.mpdPlugin.sendMpdCommand('previous', [])
    .then(function() {
      return self.mpdPlugin.getState()
        .then(function(state) {
          return self.pushState(state);
        });
    });
}

// prefetch for gapless Playback
ControllerVolusonic.prototype.prefetch = function(nextTrack) {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::prefetch');

  return self.mpdPlugin.sendMpdCommand('add "' + nextTrack.uri + '"', [])
    .then(function() {
      return self.mpdPlugin.sendMpdCommand('consume 1', []);
    });
}

// Get state
ControllerVolusonic.prototype.getState = function() {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::getState');
};

//Parse state
ControllerVolusonic.prototype.parseState = function(sState) {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::parseState');

  //Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
ControllerVolusonic.prototype.pushState = function(state) {
  var self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::pushState');

  return self.commandRouter.servicePushState(state, 'volusonic');
};

ControllerVolusonic.prototype.addToFavourites = function(param) {
  var self = this;
  //self.commandRouter.pushConsoleMessage("volusonic.addToFavourites: " + JSON.stringify(param));
};

ControllerVolusonic.prototype.goto = function(data) {
  var self = this;
  var defer = libQ.defer();

  var track = self.commandRouter.stateMachine.playQueue.getTrack(self.commandRouter.stateMachine.currentPosition);

  if (track.channelId !== undefined) {
    defer.resolve(self.handleBrowseUri("volusonic/podcasts/" + track.channelId));
  } else {
    if (data.type == "artist") {
      defer.resolve(self.handleBrowseUri("volusonic/artists/" + track.artistId));
    } else {
      defer.resolve(self.handleBrowseUri("volusonic/artists/" + track.artistId + "/" + track.albumId));
    }
  }
  return defer.promise;
};
