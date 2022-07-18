'use strict';

var libQ = require('kew');
var libNet = require('net');
var libFast = require('fast.js');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var superagent = require('superagent');
var NodeCache = require('node-cache');
var io = require('socket.io-client');
var os = require('os');

// Spotify connect libs 
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const readFile = (fileName) => fs.readFile(fileName, 'utf8');
const writeFile = (fileName, data) => fs.writeFile(fileName, data, 'utf8');
const path = require('path');

// Plugin modules and helpers
const SpotifyWebApi = require('spotify-web-api-node');
const SpotConnCtrl = require('./SpotConnController').SpotConnEvents;
const msgMap = require('./SpotConnController').msgMap;
const logger = require('./logger');


// Global vars
var seekTimer;
var thisSpotifyConnectDeviceId;
var spotifyApi;
var thisDeviceIdentifier;
var selectedBitrate;
var accessToken;
var spotifyAccessTokenExpiration;
var isBrowsingInitialized = false;
var loggedInUsername;
var userCountry;
var socket;
var currentSpotifyVolume;
var currentVolumioVolume;
var startVolume;
var volumeDebounce;
var currentService;
var currentTrackContext = {};
var justLoggedIn = false;
// Debug
var isDebugMode = false;


// Define the ControllerSpotify class
module.exports = ControllerSpotify;

function ControllerSpotify(context) {
    // This fixed variable will let us refer to 'this' object at deeper scopes
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
    // We use a caching manager to speed up the presentation of root page
    this.browseCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

    // Volatile for metadata
    this.unsetVol = () => {
        logger.info('unSetVolatile called');
        this.debugLog('unSetVolatile called');
        return this.spotConnUnsetVolatile();
    };
}


ControllerSpotify.prototype.onVolumioStart = function () {
    var self = this;
    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);
    this.loadI18n();

    return libQ.resolve();
}

ControllerSpotify.prototype.getConfigurationFiles = function () {
    return ['config.json'];
}

ControllerSpotify.prototype.addToBrowseSources = function () {
    var data = {
        name: 'Spotify',
        uri: 'spotify',
        plugin_type: 'music_service',
        plugin_name: 'spop',
        albumart: '/albumart?sourceicon=music_service/spop/spotify.png'
    };
    this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerSpotify.prototype.removeToBrowseSources = function () {

    this.commandRouter.volumioRemoveToBrowseSources('Spotify');
};


ControllerSpotify.prototype.onStop = function () {
    var self = this;
    var defer = libQ.defer();
    this.spotifyApi = undefined;

    self.removeToBrowseSources();
    self.closeSpotifyConnectDaemonConnections();

    defer.resolve('');

    return defer.promise;
};

ControllerSpotify.prototype.onStart = function () {
    var self = this;
    var defer = libQ.defer();

    // SpotifyWebApi
    this.spotifyApi = new SpotifyWebApi();
    this.device = undefined;
    this.selectedBitrate = self.config.get('bitrate_number', '320').toString();
    this.volumeListener();
    this.applySpotifyHostsFix();

    this.commandRouter.sharedVars.registerCallback('language_code', this.systemLanguageChanged.bind(this));
    var boundMethod = self.onPlayerNameChanged.bind(self);
    self.commandRouter.executeOnPlugin('system_controller', 'system', 'registerCallback', boundMethod);


    this.init().then(() => {
        defer.resolve();
    });

    return defer.promise;
};

ControllerSpotify.prototype.initializeBrowsingFacility = function () {
    var self = this;

    if (self.isUserLoggedIn() && !self.isBrowsingInitialized) {
        self.logger.info('Initliazing Spotify Browsing Facility');
        isBrowsingInitialized = true;
        self.addToBrowseSources();
        self.identifyThisConnectDevice();
        self.getUserInformations();
    }
};

ControllerSpotify.prototype.isUserLoggedIn = function () {
    var self = this;
    var userName = self.config.get('username', '');
    var userPassword = self.config.get('password', '');

    if (userName && userName.length && userPassword && userPassword.length && self.accessToken && self.accessToken.length) {
        return true;
    } else {
        return false;
    }
};

ControllerSpotify.prototype.closeSpotifyConnectDaemonConnections = function () {
    var self = this;

    try {
        this.DeactivateState();
        this.debugLog('Stopping Vollibrespot daemon');
        this.VolspotconnectServiceCmds('stop');
        // Close the metadata pipe:
        logger.info('Closing metadata listener');
        this.SpotConn.close();
    } catch (e) {
        logger.error('Error stopping Vollibrespot daemon: ', e);
    }
};

ControllerSpotify.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    self.commandRouter.logger.info('In handleBrowseUri, curUri=' + curUri);
    var response;

    if (curUri.startsWith('spotify')) {
        if (curUri == 'spotify') {
            response = self.getRoot();
        } else if (curUri.startsWith('spotify/playlists')) {
            if (curUri == 'spotify/playlists')
                response = self.getMyPlaylists(curUri); // use the Spotify Web API instead of the spop service
            else {
                response = self.listWebPlaylist(curUri); // use the function to list playlists returned from the Spotify Web API
            }
        } else if (curUri.startsWith('spotify/myalbums')) {
            response = self.getMyAlbums(curUri);
        } else if (curUri.startsWith('spotify/mytracks')) {
            response = self.getMyTracks(curUri);
        } else if (curUri.startsWith('spotify/mytopartists')) {
            response = self.getTopArtists(curUri);
        } else if (curUri.startsWith('spotify/mytoptracks')) {
            response = self.getTopTracks(curUri);
        } else if (curUri.startsWith('spotify/myrecentlyplayedtracks')) {
            response = self.getRecentTracks(curUri);
        } else if (curUri.startsWith('spotify/featuredplaylists')) {
            response = self.featuredPlaylists(curUri);
        } else if (curUri.startsWith('spotify:user:')) {
            response = self.listWebPlaylist(curUri);
        } else if (curUri.startsWith('spotify:playlist:')) {
            var uriSplitted = curUri.split(':');
            response = self.listWebPlaylist('spotify:user:spotify:playlist:' + uriSplitted[2]);
        } else if (curUri.startsWith('spotify/new')) {
            response = self.listWebNew(curUri);
        } else if (curUri.startsWith('spotify/categories')) {
            response = self.listWebCategories(curUri);
        } else if (curUri.startsWith('spotify:album')) {
            response = self.listWebAlbum(curUri);
        } else if (curUri.startsWith('spotify/category')) {
            response = self.listWebCategory(curUri);
        } else if (curUri.startsWith('spotify:artist:')) {
            response = self.listWebArtist(curUri);
        }
        else {
            self.logger.info('************* Bad browse Uri:' + curUri);
        }
    }

    return response;
};

ControllerSpotify.prototype.spotifyCheckAccessToken = function () {
    var self = this;
    var defer = libQ.defer();
    var d = new Date();
    var now = d.getTime();
    var oldAccessToken = self.accessToken;

    if (self.spotifyAccessTokenExpiration < now) {
        self.refreshAccessToken().then((data)=>{
            self.logger.info('Successfully Refreshed access token');
            defer.resolve('');
        }).fail((error)=>{
            self.logger.error('Failed to refresh Token: ' + error);
            defer.reject(error);
        });
    } else {
        defer.resolve();
    }

    return defer.promise;
};

ControllerSpotify.prototype.refreshAccessToken = function () {
    var self = this;
    var defer = libQ.defer();
    var oldAccessTokenToRefresh = self.accessToken;

    self.logger.info('Renewing Access Token via Daemon');
    self.SpotConn.sendmsg(msgMap.get('ReqToken'));

    var refreshedTokenCheckTimeout = setTimeout(()=>{
        clearInterval(refreshedTokenCheck);
        defer.reject('Timeout');
    }, 6000)
    var refreshedTokenCheck = setInterval(()=>{
        if (self.accessToken !== oldAccessTokenToRefresh) {
            clearInterval(refreshedTokenCheck);
            clearTimeout(refreshedTokenCheckTimeout);
            defer.resolve('');
        }

    },100);

    return defer.promise;
};

ControllerSpotify.prototype.getRoot = function () {
    var self = this;
    var defer = libQ.defer();

    self.browseCache.get('root',function( err, value ){
        if( !err ){
            // Root has not been cached yet
            if(value == undefined){
                self.listRoot().then((data)=>{
                    // Set root cache
                    self.browseCache.set('root',data)
                    defer.resolve(data)
                });
            } else {
                // Cached Root
                defer.resolve(value)
            }
        } else {
            self.logger.error('Could not fetch root spotify folder cached data: ' + err);
        }
    });

    return defer.promise
};

ControllerSpotify.prototype.listRoot = function (curUri) {
    var self = this;
    var defer = libQ.defer();

    var response = {
        navigation: {
            lists: [
                {
                    "availableListViews": [
                        "grid","list"
                    ],
                    "type": "title",
                    "title": self.getI18n('MY_MUSIC'),
                    "items": [
                        {
                            service: 'spop',
                            type: 'streaming-category',
                            title: self.getI18n('MY_PLAYLISTS'),
                            artist: '',
                            album: '',
                            albumart: '/albumart?sourceicon=music_service/spop/icons/playlist.png',
                            uri: 'spotify/playlists'
                        },
                        {
                            service: 'spop',
                            type: 'streaming-category',
                            title: self.getI18n('MY_ALBUMS'),
                            artist: '',
                            album: '',
                            albumart: '/albumart?sourceicon=music_service/spop/icons/album.png',
                            uri: 'spotify/myalbums'
                        },
                        {
                            service: 'spop',
                            type: 'streaming-category',
                            title: self.getI18n('MY_TRACKS'),
                            artist: '',
                            album: '',
                            albumart: '/albumart?sourceicon=music_service/spop/icons/track.png',
                            uri: 'spotify/mytracks'
                        },
                        {
                            service: 'spop',
                            type: 'streaming-category',
                            title: self.getI18n('MY_TOP_ARTISTS'),
                            artist: '',
                            album: '',
                            albumart: '/albumart?sourceicon=music_service/spop/icons/artist.png',
                            uri: 'spotify/mytopartists'
                        },
                        {
                            service: 'spop',
                            type: 'streaming-category',
                            title: self.getI18n('MY_TOP_TRACKS'),
                            artist: '',
                            album: '',
                            albumart: '/albumart?sourceicon=music_service/spop/icons/track.png',
                            uri: 'spotify/mytoptracks'
                        },
                        {
                            service: 'spop',
                            type: 'streaming-category',
                            title: self.getI18n('MY_RECENTLY_PLAYED_TRACKS'),
                            artist: '',
                            album: '',
                            albumart: '/albumart?sourceicon=music_service/spop/icons/track.png',
                            uri: 'spotify/myrecentlyplayedtracks'
                        }
                    ]
                }
            ]
        }
    }

    var spotifyRootArray = [self.featuredPlaylists('spotify/featuredplaylists'),self.listWebNew('spotify/new'),self.listWebCategories('spotify/categories')];
    libQ.all(spotifyRootArray)
        .then(function (results) {

            var discoveryArray = [
                {
                    "availableListViews": [
                        "grid","list"
                    ],
                    "type": "title",
                    "title": self.getI18n('FEATURED_PLAYLISTS'),
                    "items": results[0].navigation.lists[0].items
                },
                {
                    "availableListViews": [
                        "grid","list"
                    ],
                    "type": "title",
                    "title": self.getI18n('WHATS_NEW'),
                    "items": results[1].navigation.lists[0].items
                },
                {
                    "availableListViews": [
                        "grid","list"
                    ],
                    "type": "title",
                    "title": self.getI18n('GENRES_AND_MOODS'),
                    "items": results[2].navigation.lists[0].items
                }
            ];
            response.navigation.lists = response.navigation.lists.concat(discoveryArray);
            defer.resolve(response);
        })
        .fail(function (err) {
            self.logger.info('An error occurred while getting Spotify ROOT Discover Folders: ' + err);
            defer.resolve(response);
        });

    return defer.promise;
}

ControllerSpotify.prototype.getMyPlaylists = function (curUri) {
    var self = this;
    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {


                var response = {
                    navigation: {
                        prev: {
                            uri: 'spotify'
                        },
                        "lists": [
                            {
                                "availableListViews": [
                                    "list",
                                    "grid"
                                ],
                                "items": []
                            }
                        ]
                    }
                };

                superagent.get('https://api.spotify.com/v1/me/playlists')
                    .set("Content-Type", "application/json")
                    .set("Authorization", "Bearer " + self.accessToken)
                    .query({limit: 50})
                    .accept('application/json')
                    .then(function (results) {
                        //  self.logger.info('Playlist result is: ' + JSON.stringify(results.body));
                        for (var i in results.body.items) {
                            var playlist = results.body.items[i];
                            response.navigation.lists[0].items.push({
                                service: 'spop',
                                type: 'playlist',
                                title: playlist.name,
                                albumart: self._getAlbumArt(playlist),
                                uri: 'spotify:user:spotify:playlist:' + playlist.id
                            });
                        }

                        defer.resolve(response);
                    })
                    .catch(function (err) {
                        self.logger.info('An error occurred while listing Spotify getMyPlaylists ' + err.message);
                    });
            }
        );

    return defer.promise;
};

ControllerSpotify.prototype.getMyAlbums = function (curUri) {
    var self = this;
    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
                var spotifyDefer = self.spotifyApi.getMySavedAlbums({limit: 50});
                spotifyDefer.then(function (results) {
                    var response = {
                        navigation: {
                            prev: {
                                uri: 'spotify'
                            },
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list",
                                        "grid"
                                    ],
                                    "items": []
                                }
                            ]
                        }
                    };

                    for (var i in results.body.items) {
                        var album = results.body.items[i].album;
                        response.navigation.lists[0].items.push({
                            service: 'spop',
                            type: 'folder',
                            title: album.name,
                            albumart: self._getAlbumArt(album),
                            uri: album.uri
                        });
                    }
                    defer.resolve(response);
                }, function (err) {
                    self.logger.error('An error occurred while listing Spotify my albums ' + err);
                    self.handleBrowsingError(err);
                });
            }
        );

    return defer.promise;
};

ControllerSpotify.prototype.getMyTracks = function (curUri) {
    var self = this;
    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
                var spotifyDefer = self.spotifyApi.getMySavedTracks({limit: 50});
                spotifyDefer.then(function (results) {
                    var response = {
                        navigation: {
                            prev: {
                                uri: 'spotify'
                            },
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list"
                                    ],
                                    "items": []
                                }
                            ]
                        }
                    };

                    for (var i in results.body.items) {
                        var track = results.body.items[i].track;
                        if (self.isTrackAvailableInCountry(track)) {
                            response.navigation.lists[0].items.push({
                                service: 'spop',
                                type: 'song',
                                title: track.name,
                                artist: track.artists[0].name || null,
                                album: track.album.name || null,
                                albumart: self._getAlbumArt(track.album),
                                uri: track.uri
                            });
                        }
                    }
                    defer.resolve(response);
                }, function (err) {
                    self.logger.error('An error occurred while listing Spotify my tracks ' + err);
                    self.handleBrowsingError(err);
                });
            }
        );

    return defer.promise;
};

ControllerSpotify.prototype.getTopArtists = function (curUri) {

    var self = this;

    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
                var spotifyDefer = self.spotifyApi.getMyTopArtists({limit: 50});
                spotifyDefer.then(function (results) {
                    var response = {
                        navigation: {
                            prev: {
                                uri: 'spotify'
                            },
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list",
                                        "grid"
                                    ],
                                    "items": []
                                }
                            ]
                        }
                    };

                    for (var i in results.body.items) {
                        var artist = results.body.items[i];
                        response.navigation.lists[0].items.push({
                            service: 'spop',
                            type: 'folder',
                            title: artist.name,
                            albumart: self._getAlbumArt(artist),
                            uri: artist.uri
                        });
                    }
                    defer.resolve(response);
                }, function (err) {
                    self.logger.error('An error occurred while listing Spotify my artists ' + err);
                    self.handleBrowsingError(err);
                });
            }
        );

    return defer.promise;
};

ControllerSpotify.prototype.getTopTracks = function (curUri) {

    var self = this;

    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
                var spotifyDefer = self.spotifyApi.getMyTopTracks({limit: 50});
                spotifyDefer.then(function (results) {
                    var response = {
                        navigation: {
                            prev: {
                                uri: 'spotify'
                            },
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list"
                                    ],
                                    "items": []
                                }
                            ]
                        }
                    };

                    for (var i in results.body.items) {
                        var track = results.body.items[i];
                        if (self.isTrackAvailableInCountry(track)) {
                            response.navigation.lists[0].items.push({
                                service: 'spop',
                                type: 'song',
                                title: track.name,
                                artist: track.artists[0].name || null,
                                album: track.album.name || null,
                                albumart: self._getAlbumArt(track.album),
                                uri: track.uri
                            });
                        }
                    }
                    defer.resolve(response);
                }, function (err) {
                    self.logger.error('An error occurred while listing Spotify top tracks ' + err);
                    self.handleBrowsingError(err);
                });
            }
        );

    return defer.promise;
};

ControllerSpotify.prototype.getRecentTracks = function (curUri) {

    var self = this;

    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
                var spotifyDefer = self.spotifyApi.getMyRecentlyPlayedTracks({limit: 50});
                spotifyDefer.then(function (results) {
                    var response = {
                        navigation: {
                            prev: {
                                uri: 'spotify'
                            },
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list"
                                    ],
                                    "items": []
                                }
                            ]
                        }
                    };

                    for (var i in results.body.items) {
                        var track = results.body.items[i].track;
                        if (self.isTrackAvailableInCountry(track)) {
                            response.navigation.lists[0].items.push({
                                service: 'spop',
                                type: 'song',
                                title: track.name,
                                artist: track.artists[0].name || null,
                                album: track.album.name || null,
                                albumart: self._getAlbumArt(track.album),
                                uri: track.uri
                            });
                        }
                    }
                    defer.resolve(response);
                }, function (err) {
                    self.logger.error('An error occurred while listing Spotify recent tracks ' + err);
                    self.handleBrowsingError(err);
                });
            }
        );

    return defer.promise;
};

ControllerSpotify.prototype.featuredPlaylists = function (curUri) {

    var self = this;

    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
                var spotifyDefer = self.spotifyApi.getFeaturedPlaylists();
                spotifyDefer.then(function (results) {
                    var response = {
                        navigation: {
                            prev: {
                                uri: 'spotify'
                            },
                            "lists": [
                                {
                                    "availableListViews": [
                                        "list",
                                        "grid"
                                    ],
                                    "items": []
                                }
                            ]
                        }
                    };

                    for (var i in results.body.playlists.items) {
                        var playlist = results.body.playlists.items[i];
                        response.navigation.lists[0].items.push({
                            service: 'spop',
                            type: 'playlist',
                            title: playlist.name,
                            albumart: self._getAlbumArt(playlist),
                            uri: playlist.uri
                        });
                    }
                    defer.resolve(response);
                }, function (err) {
                    self.logger.error('An error occurred while listing Spotify featured playlists ' + err);
                    self.handleBrowsingError(err);
                });
            }
        );

    return defer.promise;
};

ControllerSpotify.prototype.listWebPlaylist = function (curUri) {
    var self = this;

    var defer = libQ.defer();

    var uriSplitted = curUri.split(':');

    var spotifyDefer = self.getPlaylistTracks(uriSplitted[2], uriSplitted[4]);
    spotifyDefer.then(function (results) {
        var response = {
            navigation: {
                prev: {
                    uri: 'spotify'
                },
                "lists": [
                    {
                        "availableListViews": [
                            "list"
                        ],
                        "items": []
                    }
                ]
            }
        };
        for (var i in results) {
            response.navigation.lists[0].items.push(results[i]);
        }
        var playlistInfo = self.getPlaylistInfo(uriSplitted[2], uriSplitted[4]);
        playlistInfo.then(function (results) {
            response.navigation.info = results;
            response.navigation.info.uri = curUri;
            response.navigation.info.service = 'spop';
            defer.resolve(response);
        })
    });

    return defer.promise;
};

ControllerSpotify.prototype.listWebNew = function (curUri) {

    var self = this;

    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getNewReleases({limit: 50});
            spotifyDefer.then(function (results) {

                var response = {
                    navigation: {
                        prev: {
                            uri: 'spotify'
                        },
                        "lists": [
                            {
                                "availableListViews": [
                                    "list",
                                    "grid"
                                ],
                                "items": []
                            }
                        ]
                    }
                };

                for (var i in results.body.albums.items) {
                    var album = results.body.albums.items[i];
                    response.navigation.lists[0].items.push({
                        service: 'spop',
                        type: 'folder',
                        title: album.name,
                        albumart: self._getAlbumArt(album),
                        uri: album.uri
                    });
                }
                defer.resolve(response);
            }, function (err) {
                self.logger.error('An error occurred while listing Spotify new albums ' + err);
                self.handleBrowsingError(err);
            });
        });

    return defer.promise;
};

ControllerSpotify.prototype.listWebAlbum = function (curUri) {
    var self = this;
    var defer = libQ.defer();
    var uriSplitted = curUri.split(':');

    var spotifyDefer = self.getAlbumTracks(uriSplitted[2], {limit: 50});
    spotifyDefer.then(function (results) {
        var response = {
            navigation: {
                "prev": {
                    "uri": 'spotify'
                },
                "lists": [
                    {
                        "availableListViews": [
                            "list"
                        ],
                        "items": []
                    }
                ]
            }
        };

        for (var i in results) {
            response.navigation.lists[0].items.push(results[i]);
        }
        var albumInfo = self.getAlbumInfo(uriSplitted[2]);
        albumInfo.then(function (results) {
            response.navigation.info = results;
            response.navigation.info.uri = curUri;
            response.navigation.info.service = 'spop';
            defer.resolve(response);
        })
    });

    return defer.promise;
};


ControllerSpotify.prototype.listWebCategories = function (curUri) {

    var self = this;

    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getCategories({limit: 50});
            spotifyDefer.then(function (results) {

                var response = {
                    navigation: {
                        prev: {
                            uri: 'spotify'
                        },
                        "lists": [
                            {
                                "availableListViews": [
                                    "list",
                                    "grid"
                                ],
                                "items": []
                            }
                        ]
                    }
                };

                for (var i in results.body.categories.items) {
                    response.navigation.lists[0].items.push({
                        service: 'spop',
                        type: 'spotify-category',
                        title: results.body.categories.items[i].name,
                        albumart: results.body.categories.items[i].icons[0].url,
                        uri: 'spotify/category/' + results.body.categories.items[i].id
                    });
                }
                defer.resolve(response);
            }, function (err) {
                self.logger.error('An error occurred while listing Spotify categories ' + err);
                self.handleBrowsingError(err);
            });
        });

    return defer.promise;
};

ControllerSpotify.prototype.listWebCategory = function (curUri) {

    var self = this;

    var defer = libQ.defer();

    var uriSplitted = curUri.split('/');

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getPlaylistsForCategory(uriSplitted[2], {limit: 50});
            spotifyDefer.then(function (results) {

                var response = {
                    navigation: {
                        prev: {
                            uri: 'spotify/categories'
                        },
                        "lists": [
                            {
                                "availableListViews": [
                                    "list",
                                    "grid"
                                ],
                                "items": []
                            }
                        ]
                    }
                };

                for (var i in results.body.playlists.items) {
                    var playlist = results.body.playlists.items[i];
                    response.navigation.lists[0].items.push({
                        service: 'spop',
                        type: 'folder',
                        title: playlist.name,
                        albumart: self._getAlbumArt(playlist),
                        uri: playlist.uri
                    });
                }
                defer.resolve(response);
            }, function (err) {
                self.logger.error('An error occurred while listing Spotify playlist category ' + err);
                self.handleBrowsingError(err);
            });
        });

    return defer.promise;
};

ControllerSpotify.prototype.listWebArtist = function (curUri) {

    var self = this;

    var defer = libQ.defer();

    var uriSplitted = curUri.split(':');

    var artistId = uriSplitted[2];

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var response = {
                navigation: {
                    prev: {
                        uri: 'spotify'
                    },
                    "lists": [
                        {
                            "availableListViews": [
                                "list"
                            ],
                            "items": []
                        }
                    ],

                }
            };
            var spotifyDefer = self.listArtistTracks(artistId);
            spotifyDefer.then(function (results) {
                for (var i in results) {
                    response.navigation.lists[0].items.push(results[i]);
                }
                return response;
            })
                .then(function (data) {
                    var response = data;
                    var spotifyDefer = self.getArtistRelatedArtists(artistId);
                    spotifyDefer.then(function (results) {
                        response.navigation.lists[0].items.push({type: 'title', title: 'Related Artists'});
                        for (var i in results) {
                            response.navigation.lists[0].items.push(results[i]);
                        }
                    })
                    return response;
                })
                .then(function (data) {
                    var spotifyDefer = self.getArtistInfo(artistId);
                    spotifyDefer.then(function (results) {
                        response.navigation.info = results;
                        response.navigation.info.uri = curUri;
                        response.navigation.info.service = 'spop';

                        defer.resolve(response);
                    })
                });
        });

    return defer.promise;
};

ControllerSpotify.prototype.listArtistTracks = function (id) {

    var self = this;

    var defer = libQ.defer();

    var list = [{type: 'title', title: 'Top Tracks'}];

    var spotifyDefer = self.getArtistTopTracks(id);
    spotifyDefer.then(function (data) {
        for (var i in data) {
            list.push(data[i]);
        }
        return list;
    })
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getArtistAlbums(id);
            spotifyDefer.then(function (results) {
                var title = {type: 'title', title: 'Albums'};
                var response = data;
                response.push(title);
                for (var i in results.body.items) {
                    var album = results.body.items[i];
                    response.push({
                        service: 'spop',
                        type: 'folder',
                        title: album.name,
                        albumart: self._getAlbumArt(album),
                        uri: album.uri,
                    });
                }
                defer.resolve(response);
            })
        });

    return defer.promise;
};

ControllerSpotify.prototype.getArtistTracks = function (id) {

    var self = this;

    var defer = libQ.defer();

    var list = [];

    var spotifyDefer = self.getArtistTopTracks(id);
    spotifyDefer.then(function (data) {
        for (var i in data) {
            list.push(data[i]);
        }
        return list;
    })
        .then(function (data) {
            var spotifyDefer = self.getArtistAlbumTracks(id);
            spotifyDefer.then(function (results) {
                var response = data;
                for (var i in results) {
                    response.push(results[i]);
                }
                defer.resolve(response);
            });
        });

    return defer.promise;
};

ControllerSpotify.prototype.getArtistAlbumTracks = function (id) {

    var self = this;

    var defer = libQ.defer();

    var list = [];

    var spotifyDefer = self.spotifyApi.getArtistAlbums(id);
    spotifyDefer.then(function (results) {
        //	var response = data;
        var response = [];
        return results.body.items.map(function (a) {
            return a.id
        });
    })
        .then(function (albums) {
            var spotifyDefer = self.spotifyApi.getAlbums(albums);
            spotifyDefer.then(function (data) {
                var results = data;
                var response = [];
                for (var i in results.body.albums) {
                    var album = results.body.albums[i];
                    for (var j in album.tracks.items) {
                        var track = album.tracks.items[j];
                        if (self.isTrackAvailableInCountry(track)) {
                            response.push({
                                service: 'spop',
                                type: 'song',
                                name: track.name,
                                title: track.name,
                                artist: track.artists[0].name,
                                album: album.name,
                                albumart: self._getAlbumArt(album),
                                uri: track.uri
                            });
                        }
                    }
                }
                defer.resolve(response);
            });
        });


    return defer.promise;
};

ControllerSpotify.prototype.getArtistAlbums = function (artistId) {

    var self = this;

    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getArtistAlbums(artistId);
            spotifyDefer.then(function (results) {
                var response = [];
                for (var i in results.body.items) {
                    var album = results.body.items[i];
                    response.push({
                        service: 'spop',
                        type: 'folder',
                        title: album.name,
                        albumart: self._getAlbumArt(album),
                        uri: album.uri
                    });
                }
                defer.resolve(response);
            });
        });
    return defer.promise;
};

ControllerSpotify.prototype.getArtistRelatedArtists = function (artistId) {

    var self = this;

    var defer = libQ.defer();

    var list = [];

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getArtistRelatedArtists(artistId);
            spotifyDefer.then(function (results) {
                for (var i in results.body.artists) {
                    var albumart = '';
                    var artist = results.body.artists[i];
                    var albumart = self._getAlbumArt(artist);
                    var item = {
                        service: 'spop',
                        type: 'folder',
                        title: artist.name,
                        albumart: albumart,
                        uri: artist.uri
                    };
                    if (albumart == '') {
                        item.icon = 'fa fa-user';
                    }
                    list.push(item);
                }
                defer.resolve(list);
            })
        });

    return defer.promise;
};

ControllerSpotify.prototype._getAlbumArt = function (item) {

    var albumart = '';
    if (item.hasOwnProperty('images') && item.images.length > 0) {
        albumart = item.images[0].url;
    }
    return albumart;
};

ControllerSpotify.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;

    var lang_code = self.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function (uiconf) {

            // User and PW Settings
            var userName = self.config.get('username', '');
            var userPassword = self.config.get('password', '');
            uiconf.sections[1].content[0].value = userName

            if (userName !== '' && userPassword !== '' &&  self.accessToken !== '') {
                uiconf.sections[1].content[0].hidden = true
                uiconf.sections[1].content[1].hidden = true;
                uiconf.sections[1].content[3].hidden = false;
                uiconf.sections[1].content[3].description = self.getI18n('LOGGED_IN_AS') + ' ' + userName;
            } else {
                uiconf.sections[1].saveButton = {
                    "label": self.getI18n('SPOTIFY_LOGIN'),
                        "data": [
                        "username",
                        "password"
                    ]
                };
            }
            
            // Asking for trouble, map index to id?
            uiconf.sections[2].content[1].config.bars[0].value = self.config.get('initvol');
            uiconf.sections[2].content[2].value = self.config.get('normalvolume', false);
            uiconf.sections[2].content[3].value.value = self.config.get('bitrate_number', 320);
            uiconf.sections[2].content[3].value.label = self.config.get('bitrate_number', 320).toString();


            uiconf.sections[2].content[4].value.label = self.config.get('volume_ctrl');
            uiconf.sections[2].content[4].value.value = self.config.get('volume_ctrl');
            uiconf.sections[2].content[5].value = self.config.get('gapless', true);
            uiconf.sections[2].content[6].value = self.config.get('autoplay', true);
            uiconf.sections[2].content[7].value = self.config.get('debug');

            if (process.env.SHOW_SPOTIFY_ON_BROWSE_SOURCES === 'true') {
                uiconf.sections[2].hidden = true;
                uiconf.sections.shift();
            }

            defer.resolve(uiconf);
        })
        .fail(function (error) {
            self.logger.error('Cannot populate Spotify configuration: ' + error);
            defer.reject(new Error());
        });

    return defer.promise;
};

// Define a method to clear, add, and play an array of tracks
ControllerSpotify.prototype.clearAddPlayTrack = function (track) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpotify::clearAddPlayTrack');

    try {
        self.setDeviceActive().then(function() {
            return self.playTrackFromWebAPI(track.uri);
        })
    } catch(e) {
        self.logger.error('Failed to play spotify track: ' + e);
    }
};

// Spop get state
ControllerSpotify.prototype.getState = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpotify::getState');

    self.debugLog('GET STATE: ' + self.state);
    return self.state
};

// Announce updated Spop state
ControllerSpotify.prototype.pushState = function (state) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpotify::pushState');
    self.debugLog('Push state: ' + JSON.stringify(self.state) + ' SERVICE NAME: ' + self.servicename);

    /*
    if (currentTrackContext && currentTrackContext.isConnect) {
        self.context.coreCommand.stateMachine.setVolatile({
            service: self.servicename,
            callback: self.unsetVol
        });
    }*/
    return self.commandRouter.servicePushState(self.state, 'spop');
};

ControllerSpotify.prototype.getAlbumTracks = function (id) {
    var self = this;
    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
                var spotifyDefer = self.spotifyApi.getAlbum(id);
                spotifyDefer.then(function (results) {
                    var response = [];
                    var album = results.body.name;
                    var albumart = results.body.images[0].url;
                    for (var i in results.body.tracks.items) {
                        var track = results.body.tracks.items[i];
                        if (self.isTrackAvailableInCountry(track)) {
                            response.push({
                                service: 'spop',
                                type: 'song',
                                title: track.name,
                                name: track.name,
                                artist: track.artists[0].name,
                                album: album,
                                albumart: albumart,
                                uri: track.uri,
                                samplerate: self.getCurrentBitrate(),
                                bitdepth: '16 bit',
                                bitrate: '',
                                trackType: 'spotify',
                                duration: Math.trunc(track.duration_ms / 1000)
                            });
                        }
                    }
                    defer.resolve(response);
                }, function (err) {
                    self.logger.error('An error occurred while listing Spotify album tracks ' + err);
                    self.handleBrowsingError(err);
                });
            }
        );

    return defer.promise;
};

ControllerSpotify.prototype.getCurrentBitrate = function () {
    var self = this;

    return self.selectedBitrate + ' kbps';
}


ControllerSpotify.prototype.getPlaylistTracks = function (userId, playlistId) {
    var self = this;
    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getPlaylist(playlistId);
            spotifyDefer.then(function (results) {

                var response = [];

                for (var i in results.body.tracks.items) {
                    var track = results.body.tracks.items[i].track;
                    if (self.isTrackAvailableInCountry(track)) {
                        try {
                            var item = {
                                service: 'spop',
                                type: 'song',
                                name: track.name,
                                title: track.name,
                                artist: track.artists[0].name,
                                album: track.album.name,
                                uri: track.uri,
                                samplerate: self.getCurrentBitrate(),
                                bitdepth: '16 bit',
                                bitrate: '',
                                trackType: 'spotify',
                                albumart: (track.album.hasOwnProperty('images') && track.album.images.length > 0 ? track.album.images[0].url : ''),
                                duration: Math.trunc(track.duration_ms / 1000)
                            };
                            response.push(item);
                        } catch(e) {}
                    }
                }
                defer.resolve(response);
            }, function (err) {
                self.logger.error('An error occurred while exploding listing Spotify playlist tracks ' + err);
                self.handleBrowsingError(err);
                defer.reject(err);
            });
        });

    return defer.promise;
};

ControllerSpotify.prototype.getArtistTopTracks = function (id) {
    var self = this;
    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getArtistTopTracks(id, 'GB');
            spotifyDefer.then(function (results) {
                var response = [];
                for (var i in results.body.tracks) {
                    var albumart = '';
                    var track = results.body.tracks[i];
                    if (track.album.hasOwnProperty('images') && track.album.images.length > 0) {
                        albumart = track.album.images[0].url;
                    }
                    if (self.isTrackAvailableInCountry(track)) {
                        response.push({
                            service: 'spop',
                            type: 'song',
                            name: track.name,
                            title: track.name,
                            artist: track.artists[0].name,
                            album: track.album.name,
                            albumart: albumart,
                            duration: parseInt(track.duration_ms / 1000),
                            samplerate: self.getCurrentBitrate(),
                            bitdepth: '16 bit',
                            bitrate: '',
                            trackType: 'spotify',
                            uri: track.uri
                        });
                    }
                }
                defer.resolve(response);
            }), function (err) {
                self.logger.error('An error occurred while listing Spotify artist tracks ' + err);
                self.handleBrowsingError(err);
            }
        });

    return defer.promise;
};

ControllerSpotify.prototype.getArtistInfo = function (id) {
    var self = this;
    var defer = libQ.defer();

    var info = {};
    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getArtist(id);
            spotifyDefer.then(function (results) {
                if (results && results.body && results.body.name) {
                    info.title = results.body.name;
                    info.albumart = results.body.images[0].url;
                    info.type = 'artist';
                }
                defer.resolve(info);
            }), function (err) {
                self.logger.info('An error occurred while listing Spotify artist informations ' + err);
                defer.resolve(info);
            }
        });

    return defer.promise;
}

ControllerSpotify.prototype.getAlbumInfo = function (id) {
    var self = this;
    var defer = libQ.defer();

    var info = {};
    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getAlbum(id);
            spotifyDefer.then(function (results) {
                if (results && results.body && results.body.name) {
                    info.album = results.body.name;
                    info.artist = results.body.artists[0].name;
                    info.albumart = results.body.images[0].url;
                    info.type = 'album';
                }
                defer.resolve(info);
            }), function (err) {
                self.logger.error('An error occurred while listing Spotify album informations ' + err);
                self.handleBrowsingError(err);
                defer.resolve(info);
            }
        });

    return defer.promise;
}

ControllerSpotify.prototype.getPlaylistInfo = function (userId, playlistId) {
    var self = this;
    var defer = libQ.defer();

    var info = {};
    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getPlaylist(playlistId);
            spotifyDefer.then(function (results) {
                if (results && results.body && results.body.name) {
                    info.title = results.body.name;
                    info.albumart = results.body.images[0].url;
                    info.type = 'album';
                    info.service = 'spop';
                }
                defer.resolve(info);
            }, function (err) {
                defer.resolve(info);
                self.logger.error('An error occurred while getting Playlist info: ' + err);
                self.handleBrowsingError(err);
            });
        });

    return defer.promise;
}

ControllerSpotify.prototype.getTrack = function (id) {
    var self = this;
    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getTrack(id);
            spotifyDefer.then(function (results) {

                var response = [];
                var artist = '';
                var album = '';
                var title = '';
                var albumart = '';

                if (results.body.artists.length > 0) {
                    artist = results.body.artists[0].name;
                }

                if (results.body.hasOwnProperty('album') && results.body.album.hasOwnProperty('name')) {
                    album = results.body.album.name;
                }

                if (results.body.album.hasOwnProperty('images') && results.body.album.images.length > 0) {
                    albumart = results.body.album.images[0].url;
                } else {
                    albumart = '';
                }

                var item = {
                    uri: results.body.uri,
                    service: 'spop',
                    name: results.body.name,
                    artist: artist,
                    album: album,
                    type: 'song',
                    duration: parseInt(results.body.duration_ms / 1000),
                    albumart: albumart,
                    samplerate: self.getCurrentBitrate(),
                    bitdepth: '16 bit',
                    bitrate: '',
                    trackType: 'spotify'
                };
                response.push(item);
                self.debugLog('GET TRACK: ' + response)
                defer.resolve(response);
            });
        });

    return defer.promise;
};

ControllerSpotify.prototype.explodeUri = function (uri) {
    var self = this;

    self.debugLog('EXPLODING URI:' + uri);

    var defer = libQ.defer();

    var uriSplitted;

    var response;

    if (uri.startsWith('spotify/playlists')) {
        response = self.getMyPlaylists();
        defer.resolve(response);
    } else if (uri.startsWith('spotify:playlist:')) {
        uriSplitted = uri.split(':');
        response = self.getPlaylistTracks(uriSplitted[0], uriSplitted[2]);
        defer.resolve(response);
    } else if (uri.startsWith('spotify:artist:')) {
        uriSplitted = uri.split(':');
        response = self.getArtistTracks(uriSplitted[2]);
        defer.resolve(response);
    } else if (uri.startsWith('spotify:album:')) {
        uriSplitted = uri.split(':');
        response = self.getAlbumTracks(uriSplitted[2]);
        defer.resolve(response);
    } else if (uri.startsWith('spotify:user:')) {
        uriSplitted = uri.split(':');
        response = self.getPlaylistTracks(uriSplitted[2], uriSplitted[4]);
        defer.resolve(response);
    } else if (uri.startsWith('spotify:track:')) {
        uriSplitted = uri.split(':');
        response = self.getTrack(uriSplitted[2]);
        defer.resolve(response);
    } else {
        self.logger.info('Bad URI while exploding Spotify URI: ' + uri);
    }

    return defer.promise;
};

ControllerSpotify.prototype.getAlbumArt = function (data, path) {

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

        web = '?web=' + encodeURIComponent(artist) + '/' + encodeURIComponent(album) + '/large'
    }

    var url = '/albumart';

    if (web != undefined)
        url = url + web;

    if (web != undefined && path != undefined)
        url = url + '&';
    else if (path != undefined)
        url = url + '?';

    if (path != undefined)
        url = url + 'path=' + encodeURIComponent(path);

    return url;
};

ControllerSpotify.prototype.saveSpotifyAccountMyMusic = function (data) {
    var self = this;
    var defer = libQ.defer();

    self.saveVolspotconnectAccount(data, true).then(()=>{
        setTimeout(()=>{
            defer.resolve('');
        }, 7100);
    })

    return defer.promise;
}

ControllerSpotify.prototype.search = function (query) {
    var self = this;
    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.search(query.value, ['artist', 'album', 'playlist', 'track']);
            spotifyDefer.then(function (results) {
                var list = [];
                // Show artists, albums, playlists then tracks
                if (results.body.hasOwnProperty('artists') && results.body.artists.items.length > 0) {
                    var artistlist = [];
                    var artists = self._searchArtists(results);
                    for (var i in artists) {
                        artistlist.push(artists[i]);
                    }
                    list.push({
                        type: 'title',
                        title: 'Spotify ' + self.commandRouter.getI18nString('COMMON.SEARCH_ARTIST_SECTION'),
                        availableListViews: ["list", "grid"],
                        items: artistlist
                    });
                }
                if (results.body.hasOwnProperty('albums') && results.body.albums.items.length > 0) {
                    var albumlist = [];
                    var albums = self._searchAlbums(results);
                    for (var i in albums) {
                        albumlist.push(albums[i]);
                    }
                    list.push({
                        type: 'title',
                        title: 'Spotify ' + self.commandRouter.getI18nString('COMMON.SEARCH_ALBUM_SECTION'),
                        availableListViews: ["list", "grid"],
                        items: albumlist
                    });
                }
                if (results.body.hasOwnProperty('playlists') && results.body.playlists.items.length > 0) {
                    var playlistlist = [];
                    var playlists = self._searchPlaylists(results);
                    for (var i in playlists) {
                        playlistlist.push(playlists[i]);
                    }
                    list.push({
                        type: 'title',
                        title: 'Spotify ' + self.commandRouter.getI18nString('COMMON.PLAYLISTS'),
                        availableListViews: ["list", "grid"],
                        items: playlistlist
                    });
                }
                if (results.body.hasOwnProperty('tracks') && results.body.tracks.items.length > 0) {
                    var songlist = [];
                    var tracks = self._searchTracks(results);
                    for (var i in tracks) {
                        songlist.push(tracks[i]);
                    }
                    list.push({type: 'title', title: 'Spotify ' + self.commandRouter.getI18nString('COMMON.TRACKS'), availableListViews: ["list"], items: songlist});
                }
                defer.resolve(list);
            }, function (err) {
                self.logger.error('An error occurred while searching ' + err);
                self.handleBrowsingError(err);
            });
        });

    return defer.promise;
};

ControllerSpotify.prototype._searchArtists = function (results) {

    var list = [];

    for (var i in results.body.artists.items) {
        var albumart = '';
        var artist = results.body.artists.items[i];
        if (artist.hasOwnProperty('images') && artist.images.length > 0) {
            albumart = artist.images[0].url;
        }
        ;
        var item = {
            service: 'spop',
            type: 'folder',
            title: artist.name,
            albumart: albumart,
            uri: artist.uri
        };
        if (albumart == '') {
            item.icon = 'fa fa-user';
        }
        list.push(item);
    }

    return list;

};

ControllerSpotify.prototype._searchAlbums = function (results) {

    var list = [];

    for (var i in results.body.albums.items) {
        var albumart = '';
        var album = results.body.albums.items[i];
        if (album.hasOwnProperty('images') && album.images.length > 0) {
            albumart = album.images[0].url;
        }
        ;
        list.push({
            service: 'spop',
            type: 'folder',
            title: album.name,
            albumart: albumart,
            uri: album.uri,
        });
    }

    return list;
};

ControllerSpotify.prototype._searchPlaylists = function (results) {

    var list = [];

    for (var i in results.body.playlists.items) {
        var albumart = '';
        var playlist = results.body.playlists.items[i];
        if (playlist.hasOwnProperty('images') && playlist.images.length > 0) {
            albumart = playlist.images[0].url;
        }
        ;
        list.push({
            service: 'spop',
            type: 'folder',
            title: playlist.name,
            albumart: albumart,
            uri: playlist.uri
        });
    }

    return list;
};

ControllerSpotify.prototype._searchTracks = function (results) {

    var list = [];

    for (var i in results.body.tracks.items) {
        var albumart = '';
        var track = results.body.tracks.items[i];
        if (track.album.hasOwnProperty('images') && track.album.images.length > 0) {
            albumart = track.album.images[0].url;
        }
        ;
        list.push({
            service: 'spop',
            type: 'song',
            title: track.name,
            artist: track.artists[0].name,
            album: track.album.name,
            albumart: albumart,
            uri: track.uri
        });
    }

    return list;
};

ControllerSpotify.prototype.systemLanguageChanged = function () {
    var self=this;

    self.loadI18n();
    self.flushCache();
};

ControllerSpotify.prototype.onPlayerNameChanged = function () {
    var self=this;

    setTimeout(()=>{
        self.rebuildRestartDaemon();
    }, 1000)
    setTimeout(()=>{
        self.applySpotifyHostsFix();
    }, 3000)
};

ControllerSpotify.prototype.flushCache = function() {
    var self=this

    self.browseCache.flushAll();
}

ControllerSpotify.prototype.loadI18n = function () {
    var self=this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        self.i18n=fs.readJsonSync(__dirname+'/i18n/strings_'+language_code+".json");
    } catch(e) {
        self.i18n=fs.readJsonSync(__dirname+'/i18n/strings_en.json');
    }

    self.i18nDefaults=fs.readJsonSync(__dirname+'/i18n/strings_en.json');
};

ControllerSpotify.prototype.getI18n = function (key) {
    var self=this;

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

ControllerSpotify.prototype.logout = function (avoidBroadcastUiConfig) {
    var self=this;
    var broadcastUiConfig = true;
    self.isBrowsingInitialized = false;


    if (avoidBroadcastUiConfig === true){
        broadcastUiConfig = false;
    }

    self.config.set('username', '');
    self.config.set('password', '');
    self.config.set('refresh_token', '');
    self.deleteCredentialsFile();
    if (self.spotifyApi) {
        self.spotifyApi.resetCredentials();
    }
    self.commandRouter.pushToastMessage('success', self.getI18n('LOGOUT'), self.getI18n('LOGOUT_SUCCESSFUL'));
    self.thisSpotifyConnectDeviceId = undefined;
    self.thisDeviceIdentifier = undefined;
    self.accessToken = undefined;
    self.spotifyAccessTokenExpiration = undefined;
    self.isBrowsingInitialized = false;
    self.loggedInUsername = undefined;
    self.rebuildRestartDaemon();
    self.pushUiConfig(broadcastUiConfig);
    self.removeToBrowseSources();
};

ControllerSpotify.prototype.pushUiConfig = function (broadcastUiConfig) {
    var self=this;

    setTimeout(()=>{
        var config = self.getUIConfig();
        config.then((conf)=> {
            if (broadcastUiConfig) {
                self.commandRouter.broadcastMessage('pushUiConfig', conf);
            }
        });
    }, 7000);
}

ControllerSpotify.prototype.deleteCredentialsFile = function () {
    var self=this;
    var credentialsFile = '/data/configuration/music_service/spop/credentials.json';

    self.logger.info('Deleting Spotify credentials File');
    try {
        fs.unlinkSync(credentialsFile)
    } catch(err) {
        self.logger.error('Failed to delete credentials file ' + e);
    }
};

ControllerSpotify.prototype.logoutMyMusic = function () {
    var self=this;
    var defer = libQ.defer();

    self.logout(true);
    setTimeout(()=>{
        defer.resolve('');
    }, 5100);

    return defer.promise;
};

ControllerSpotify.prototype.identifyThisConnectDevice = function () {
    var self=this;
    var defer = libQ.defer();

    var systemName = this.commandRouter.sharedVars.get('system.name');
    var thisDeviceIdentifier = false;

    self.listMyDevices().then(function(devices) {
        if (devices && devices.length) {
            for (var i in devices) {
                if (devices[i].name === systemName) {
                    self.thisSpotifyConnectDeviceId = devices[i].id;
                    self.thisDeviceIdentifier = true;
                }
            }
        }
    });
};

ControllerSpotify.prototype.listMyDevices = function () {
    var self=this;
    var defer = libQ.defer();

    self.spotifyApi.getMyDevices()
        .then(function(data) {
            if (data && data.body && data.body.devices) {
                defer.resolve(data.body.devices);
            } else {
                defer.resolve([]);
            }
        }, function(err) {
            self.logger.error('Failed to retrieve spotify devices lists: ' + err);
            defer.resolve([]);
        });
    return defer.promise;
};

ControllerSpotify.prototype.getUserInformations = function () {
    var self = this;
    var defer = libQ.defer();

    self.spotifyApi.getMe()
        .then(function(data) {
            if (data && data.body) {
                self.loggedInUsername = data.body.display_name || data.body.id;
                self.userCountry = data.body.country || 'US';
            }
        }, function(err) {
            self.logger.error('Failed to retrieve user informations: ' + err);
        });

    return defer.promise;
};

// Plugin methods -----------------------------------------------------------------------------

ControllerSpotify.prototype.VolspotconnectServiceCmds = async function (cmd) {
    if (!['start', 'stop', 'restart'].includes(cmd)) {
        throw TypeError('Unknown systemmd command: ', cmd);
    }
    const { stdout, stderr } = await exec(`/usr/bin/sudo /bin/systemctl ${cmd} volspotconnect.service`, { uid: 1000, gid: 1000 });
    if (stderr) {
        logger.error(`Unable to ${cmd} Daemon: `, stderr);
    } else if (stdout) { }
    logger.info(`Vollibrespot Daemon service ${cmd}ed!`);
};

// For metadata
ControllerSpotify.prototype.volspotconnectDaemonConnect = function (defer) {
    this.servicename = 'spop';
    this.displayname = 'spop';
    this.accessToken = '';
    this.active = false;
    this.isStopping = false;
    this.DeviceActive = false;
    this.SinkActive = false;
    this.VLSStatus = '';
    this.SPDevice = undefined; // WebAPI Device
    this.state = {
        status: 'stop',
        service: 'spop',
        title: '',
        artist: '',
        album: '',
        albumart: '/albumart',
        uri: '',
        // icon: 'fa fa-spotify',
        trackType: 'spotify',
        seek: 0,
        duration: 0,
        samplerate: this.getCurrentBitrate(),
        bitdepth: '16 bit',
        bitrate: '',
        channels: 2
    };

    const nHost = ''; // blank = localhost
    const nPort = 5030;
    logger.info('Starting metadata listener');
    this.SpotConn = new SpotConnCtrl({
        address: nHost,
        port: nPort
    });
    this.Events = this.SpotConn.Events;
    this.SpotConn.sendmsg(msgMap.get('Hello'));

    // Register callbacks from the daemon
    this.SpotConn.on('error', (err) => {
        logger.error('Error connecting to metadata daemon', err);
    throw Error('Unable to connect to Spotify metadata daemon: ', err);
});

    this.SpotConn.on(this.Events.DeviceActive, (data) => {
        // A Spotify Connect session has been initiated
        logger.evnt('<DeviceActive> A connect session has begun');
        //this.commandRouter.pushToastMessage('info', 'Spotify Connect', 'Session is active!');
        // Do not stop Volumio playback, just notify
        if (!this.iscurrService()) {
            this.logger.info('Acquiring new spotify session');
            this.debugLog('Acquiring new spotify session amd stopping');
            this.volumioStop().then(() => {
                this.SinkActive = true;
                this.checkWebApi();
                this.state.status = 'play';
                if (!this.active) this.ActiveState();
            });
        }
});

    this.SpotConn.on(this.Events.PlaybackActive, (data) => {
        // SpotConn is active playback device
        // This is different from SinkActive, it will be triggered at the beginning
        // of a playback session (e.g. Playlist) while the track loads
        logger.evnt('<PlaybackActive> Device palyback is active!');
        this.debugLog('SINK ACTIVE');
        this.DeviceActive = true;
    });

    this.SpotConn.on(this.Events.SinkActive, (data) => {
        // Sink is active when actual playback starts
        logger.evnt('<SinkActive> Sink acquired');
        if (!this.iscurrService()) {
            this.logger.info('Acquiring new spotify session');
            this.debugLog('Acquiring new spotify session amd stopping');
            this.volumioStop().then(() => {
                this.SinkActive = true;
                this.checkWebApi();
                this.state.status = 'play';
                if (!this.active) this.ActiveState();
            });
        } else {
            this.logger.info('Continuing Spotify Session');
            this.debugLog('Acquiring new spotify session without stopping');
            this.SinkActive = true;
            this.checkWebApi();
            this.state.status = 'play';
            if (!this.active) this.ActiveState();
        }
    });

    this.SpotConn.on(this.Events.PlaybackInactive, (data) => {
        logger.evnt('<PlaybackInactive> Device palyback is inactive');
        // Device has finished playing current queue or received a pause command
        //  overkill async, who are we waiting for?

    });

    this.SpotConn.on(this.Events.SinkInactive, (data) => {

        logger.evnt('<SinkInactive> Sink released');
        this.SinkActive = false;
        clearInterval(seekTimer);
        seekTimer = undefined;

        this.debugLog('PLAYBACK INACTIVE ' + data)
        this.debugLog('IS CONNECT ' + currentTrackContext);
        this.debugLog('VLS STATUS ' + this.VLSStatus);
        this.debugLog('STATE STATUS ' + this.state.status);
        this.debugLog('SINK ACTIVE ' + this.SinkActive);

        if (currentTrackContext && currentTrackContext.isConnect) {
            this.state.status = 'pause';
            this.DeactivateState();
            this.pushState();
        } else if (this.VLSStatus === 'pause' && this.state.status === 'pause') {
            this.debugLog('Device is paused');
            this.state.status = 'pause';
            this.pushState();
        } else if (!this.SinkActive) {
            this.debugLog('Device is not active. Cleaning up!');
            this.state.status = 'stop';
            this.pushState();
        } else {
            this.debugLog(`Device Session is_active: ${this.active}`);
            if (this.active) {
                this.state.status = 'play';
            } else {
                this.state.status = 'stop';
            }
            this.pushState();
        }
    });

    this.SpotConn.on(this.Events.DeviceInactive, (data) => {
        // Connect session has been exited
        logger.evnt('<DeviceInactive> Connect Session has ended');
        this.DeactivateState();
    });

    this.SpotConn.on(this.Events.Seek, (position) => {
        logger.evnt(`<Seek> ${position}`);
        this.state.seek = position;
        this.pushState();
    });

    this.SpotConn.on(this.Events.Metadata, (meta) => {
        logger.evnt(`<Metadata> ${meta.track_name}`);
        // Update metadata
        const albumartId = meta.albumartId[2] === undefined ? meta.albumartId[0] : meta.albumartId[2];
        this.state.uri = `spotify:track:${meta.track_id}`;
        this.state.title = meta.track_name;
        this.state.artist = meta.artist_name.join(', ');
        this.state.album = meta.album_name;
        this.state.duration = Math.ceil(meta.duration_ms / 1000);
        this.state.seek = meta.position_ms;
        this.state.albumart = `https://i.scdn.co/image/${albumartId}`;
        this.state.samplerate = this.getCurrentBitrate();
        this.state.bitdepth = '16 bit';
        this.state.bitrate = '';

        if (currentTrackContext && currentTrackContext.trackId !== undefined && meta !== undefined && meta.track_id !== undefined && currentTrackContext.trackId === meta.track_id && currentTrackContext.isConnect !== undefined) {
            if (!this.isStopping) {
                this.pushState();
            }
        } else if (meta !== undefined && meta.track_id !== undefined) {
            setTimeout(()=>{
                this.isPlaybackFromConnectDevice(meta.track_id).then((isConnect)=>{
                    this.pushState();
                }).fail(function (err) {
                    console.log('Failed to retrieve connect playback status: ' + err);
                });
            },500)
        }
        if (!this.isStopping) {
            this.debugLog('Pushing metadata');
            // This will not succeed if volspotconnect2 isn't the current active service
            //this.pushState();
        } else {
            this.debugLog(`Not pushing metadata: { active: ${this.active}, isStopping: ${this.isStopping} }`);
        }
    });

    this.SpotConn.on(this.Events.Token, (token) => {
        var d = new Date();
        var now = d.getTime();

        this.logger.info('New Spotify Access Token Received');
        this.accessToken = token.accessToken;
        this.spotifyAccessTokenExpiration = parseInt(token.expiresIn) * 1000 + parseInt(now);
        this.initWebApi();
    });

    this.SpotConn.on(this.Events.Volume, (spvol) => {
        // Listen to volume changes
        var vol = Math.round(spvol);
        logger.evnt('Volume Spotify: ' + spvol + ' Volumio: ' + vol);
        if (startVolume) {
            startVolume = false;
            this.setSpotifyVolume(currentVolumioVolume);
        } else {
            // TODO IMPLEMENT A VOLUME DEBOUNCE METHOD HERE
            if (Number.isInteger(vol)) {
                currentSpotifyVolume = vol;
                if (currentVolumioVolume !== currentSpotifyVolume) {
                    if (this.iscurrService()) {
                        if (volumeDebounce) {
                            clearTimeout(volumeDebounce);
                        }
                        volumeDebounce = setTimeout(() => { this.commandRouter.volumiosetvolume(vol)}, 500);
                    }
                }
            }
        }
    });

    this.SpotConn.on(this.Events.Status, (status) => {
        logger.evnt(`<State> ${status}`);
        this.VLSStatus = status;
    });

    this.SpotConn.on(this.Events.Pong, (type) => {
        logger.evnt(`<Pong> ${type}`);
    });

    this.SpotConn.on(this.Events.Unknown, (msg, err) => {
        // logger.evnt('<Unknown>', msg, err);
    });
};

ControllerSpotify.prototype.checkActive = async function () {
    const res = await this.spotifyApi.getMyDevices();
    if (res.statusCode !== 200) {
        this.debugLog(res);
        return false;
    }
    const activeDevice = res.body.devices.find((el) => el.is_active === true);
    if (activeDevice !== undefined) {
        // This will fail if someone sets a custom name in the template..
        if (this.commandRouter.sharedVars.get('system.name') === activeDevice.name) {
            this.SPDevice = activeDevice;
            logger.info(`Setting VLS device_id: ${activeDevice.id}`);
            this.deviceID = activeDevice.id;
            return true;
        } else {
            this.SPDevice = undefined;
            return false;
        }
    } else {
        this.debugLog('No active spotify devices found');
        return false;
    }
};

ControllerSpotify.prototype.initWebApi = function () {

    this.logger.info('Initializing Spotify Web API')
    this.spotifyApi.setAccessToken(this.accessToken);
    if (!this.checkActive()) {
        this.DeactivateState();
    }

    this.initializeBrowsingFacility();
};

ControllerSpotify.prototype.checkWebApi = function () {

    this.logger.info('Checking Spotify Web API');
    if (justLoggedIn) {
        justLoggedIn = false;
        this.debugLog('Newly logged in user, requesting a new one...');
        this.SpotConn.sendmsg(msgMap.get('ReqToken'));
    } else if (!this.accessToken || this.accessToken.length === 0) {
        this.debugLog('Invalid webAPI token, requesting a new one...');
        this.SpotConn.sendmsg(msgMap.get('ReqToken'));
    }

};

// State updates
ControllerSpotify.prototype.ActiveState = function () {
    var self = this;
    self.active = true;
    // Vollibrespot is currently Active (Session|device)!
    logger.info('Vollibrespot Active');

    self.context.coreCommand.stateMachine.setConsumeUpdateService(undefined);
    self.context.coreCommand.stateMachine.setVolatile({
        service: self.servicename,
        callback: self.unsetVol
    });
    self.pushState();
};

ControllerSpotify.prototype.DeactivateState = async function () {
    this.active = false;

    this.debugLog('Executing Deactivate State');

    if (this.iscurrService()) {
        this.context.coreCommand.volumioStop.bind(this.commandRouter);
        this.DeviceActive = false;
    }
};

ControllerSpotify.prototype.spotConnUnsetVolatile = function () {
    this.logger.info('Spotify Unset Volatile called');

    this.device === undefined ? logger.info('Relinquishing Volumio State to another service')
        : this.debugLog(`Relinquishing Volumio state to another service, Spotify session: ${this.device.is_active}`);

    return this.stop();
};

ControllerSpotify.prototype.volumioStop = function () {
    if (!this.iscurrService()) {
        this.debugLog('Stopping currently active service');
        return this.commandRouter.volumioStop();
    } else {
        this.debugLog('Not requsting volumioStop on our own service');
    }
    return Promise.resolve(true);
};

ControllerSpotify.prototype.iscurrService = function () {

    if (currentService === 'spop') {
        return true;
    } else {
        return false;
    }
};

ControllerSpotify.prototype.isCurrTrackInQueue = function () {
    // Check what is the current Volumio service
    var currentQueue = this.commandRouter.volumioGetQueue();
    var currentstate = this.commandRouter.volumioGetState();
    if (currentstate !== undefined && currentstate.service !== undefined && currentstate.service !== this.servicename) {
        return false;
    } else {
        try {
            if (currentQueue[currentstate.position].uri === currentstate.uri) {
                return true;
            } else {
                return false;
            }
        } catch(e){
            return false;
        }
    }
};

// Workaround for non Promise aware pluginmanger
ControllerSpotify.prototype.init = async function () {
    if (typeof metrics === 'undefined') {
        console.time('SpotifyConnect');
    } else {
        metrics.time('SpotifyConnect');
    }
    try {
        // await creation?
        this.createConfigFile();
        this.volspotconnectDaemonConnect();
        await this.VolspotconnectServiceCmds('start');

        setTimeout(()=>{
            this.checkWebApi();
        }, 4000)

        // Hook into Playback config
        // TODO: These are called multiple times, and there is no way to deregister them
        // So be warned...
        this.commandRouter.sharedVars.registerCallback('alsa.outputdevice',
            this.rebuildRestartDaemon.bind(this));
        this.commandRouter.sharedVars.registerCallback('alsa.outputdevicemixer',
            this.rebuildRestartDaemon.bind(this));
        this.commandRouter.sharedVars.registerCallback('alsa.device',
            this.rebuildRestartDaemon.bind(this));
        this.commandRouter.sharedVars.registerCallback('system.name',
            this.rebuildRestartDaemon.bind(this));
    } catch (e) {
        const err = 'Error starting SpotifyConnect';
        logger.error(err, e);
    }
    if (typeof metrics === 'undefined') {
        console.timeEnd('SpotifyConnect');
    } else {
        metrics.log('SpotifyConnect');
    }
};

ControllerSpotify.prototype.getLabelForSelect = function (options, key) {
    var n = options.length;
    for (var i = 0; i < n; i++) {
        if (options[i].value === key) { return options[i].label; }
    }

    return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};


ControllerSpotify.prototype.createConfigFile = async function () {
    logger.info('Creating VLS config file');

    try {
        var template = fs.readFileSync(path.join(__dirname, 'volspotify.tmpl'), {encoding:'utf8'});
    } catch(e) {
        this.logger.error('Failed to read template file: ' + e);
    }

    // Authentication
    var shared = true;
    var username = this.config.get('username', '');
    var password = this.config.get('password', '');
    if (username !== undefined && username.length &&  password !== undefined && password.length) {
        shared = false;
    }
    // Playback
    const normalvolume = this.config.get('normalvolume', false);
    let initvol = '0';
    var volumestart = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumestart');
    if (volumestart !== 'disabled') {
        initvol = volumestart;
    }
    var devicename = this.commandRouter.sharedVars.get('system.name');
    //  const outdev = this.commandRouter.sharedVars.get('alsa.outputdevice');
    var outdev = 'volumio';
    var volcuve = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumecurvemode');
    var mixname = this.commandRouter.sharedVars.get('alsa.outputdevicemixer');
    var mixt = this.getAdditionalConf('audio_interface', 'alsa_controller', 'mixer_type');

    /* eslint-disable one-var */
    // Default values will be parsed as neccesary by the backend for these
    let idxcard = '',
        hwdev = '',
        mixer = '',
        mixdev = '',
        mixeropts = '',
        initvolstr = '',
        mixidx = 0;
    /* eslint-enable one-var */
    let mixlin = false;
    if ((mixt === '') || (mixt === 'None')) {
        this.debugLog('<> or <None> Mixer found, using softvol');
        // No mixer - default to (linear) Spotify volume
        mixer = 'softvol';
        mixeropts = this.config.get('volume_ctrl');
        hwdev = `${outdev}`;
        initvolstr = this.config.get('initvol');
    } else {
        // Some mixer is defined, set inital volume to startup volume or current volume
        mixer = 'alsa';
        initvolstr = initvol;
        if (volcuve !== 'logarithmic') {
            mixlin = true;
            var outdevv = this.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevice');
            mixdev = 'hw:' + outdevv;
        }
        // to be fixed with soft volume set in volumio
        if (mixt === 'Software') {
            hwdev = 'volumio';
            var outdevv = this.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevice');
            mixdev = 'hw:' + outdevv;
            mixlin = true;
            mixidx = 0// this.getAdditionalConf('audio_interface', 'alsa_controller', 'softvolumenumber');
            mixeropts = 'linear';

        } else {

            // We have an actual Hardware mixer
            var mixv = this.getAdditionalConf('audio_interface', 'alsa_controller', 'mixer');
            hwdev = `${outdev}`;
            // outputdevice = card,device..
            // ¯\_(ツ)_/¯
            idxcard = outdev.split(',')[0];
            // Similar storey with mixer,index
            mixname = mixv.split(',')[0];
            mixidx = mixv.split(',')[1] || 0;
            var outdevv = this.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevice');
            mixdev = 'hw:' + outdevv;
            mixeropts = 'linear';

        }
    }
    if (this.config.get('debug', false)) {
        isDebugMode = true;
    }

    if (process.env.MODULAR_ALSA_PIPELINE !== 'true') {
        var outdev = this.commandRouter.sharedVars.get('alsa.outputdevice');
        hwdev = `plughw:${outdev}`;
        if (outdev === 'softvolume') {
            hwdev = outdev;
        }
    }

    // We need to hardcode the bitrate value, since it might conflict with old spop values
    var bitrateValue = 320;

    /* eslint-disable no-template-curly-in-string */
    const conf = template.replace('${shared}', shared)
        .replace('${username}', username)
        .replace('${password}', password)
        .replace('${devicename}', devicename)
        .replace('${normalvolume}', normalvolume)
        .replace('${outdev}', hwdev)
        .replace('${mixer}', mixer)
        .replace('${mixname}', mixname)
        .replace('${mixdev}', mixdev)
        .replace('${mixidx}', mixidx)
        .replace('${mixlin}', mixlin)
        .replace('${mixeropts}', mixeropts)
        .replace('${initvol}', initvolstr)
        .replace('${autoplay}', this.config.get('autoplay', true))
        .replace('${gapless}', this.config.get('gapless', true))
        .replace('${bitrate}', bitrateValue);
    /* eslint-enable no-template-curly-in-string */

    // Sanity check
    if (conf.indexOf('undefined') > 1) {
        logger.error('SpotifyConnect Daemon config issues!');
        // get some hints as to what when wrong
        const trouble = conf.match(/^.*\b(undefined)\b.*$/gm);
        logger.error('volspotify config error: ', trouble);
        this.commandRouter.pushToastMessage('stickyerror', 'Spotify', `Error reading config: ${trouble}`);
    }
    return writeFile('/tmp/volspotify.toml', conf);
};

ControllerSpotify.prototype.saveVolspotconnectAccount = function (data, avoidBroadcastUiConfig) {
    var self = this;
    var defer = libQ.defer();

    var broadcastUiConfig = true;
    if (avoidBroadcastUiConfig === true){
        broadcastUiConfig = false;
    }

    if (data && data.username.length && data.password.length) {
        self.config.set('username', data.username);
        self.config.set('password', data.password);
        justLoggedIn = true;
        self.rebuildRestartDaemon()
            .then(() => defer.resolve({}))
            .catch((e) => defer.reject(new Error('saveVolspotconnectAccountError')));
        self.pushUiConfig(broadcastUiConfig);
        this.commandRouter.pushToastMessage('success', 'Spotify', self.getI18n('CONFIGURATION_SUCCESSFULLY_UPDATED'));
    } else {
        this.commandRouter.pushToastMessage('error', 'Spotify', self.getI18n('PROVIDE_USERNAME_AND_PASSWORD'));
        defer.resolve('');
    }

    return defer.promise;
};

ControllerSpotify.prototype.saveVolspotconnectSettings = function (data, avoidBroadcastUiConfig) {
    var self = this;
    var defer = libQ.defer();

    var broadcastUiConfig = true;
    if (avoidBroadcastUiConfig === true){
        broadcastUiConfig = false;
    }

    if (data.initvol !== undefined) {
        self.config.set('initvol', data.initvol);
    }
    if (data.bitrate !== undefined && data.bitrate.value !== undefined) {
        self.self.config.get('bitrate_number', data.bitrate.value);
    }
    if (data.normalvolume !== undefined) {
        self.config.set('normalvolume', data.normalvolume);
    }
    if (data.volume_ctrl !== undefined && data.volume_ctrl.value !== undefined) {
        self.config.set('volume_ctrl', data.volume_ctrl.value);
    }
    if (data.gapless !== undefined) {
        self.config.set('gapless', data.gapless);
    }
    if (data.autoplay !== undefined) {
        self.config.set('autoplay', data.autoplay);
    }
    if (data.debug !== undefined) {
        self.config.set('debug', data.debug);
    }

    self.config.set('shareddevice', false);
    self.selectedBitrate = self.config.get('bitrate_number', '320').toString();
    self.rebuildRestartDaemon()
        .then(() => defer.resolve({}))
        .catch((e) => defer.reject(new Error('saveVolspotconnectAccountError')));
    self.pushUiConfig(broadcastUiConfig);
    this.commandRouter.pushToastMessage('success', 'Spotify', self.getI18n('CONFIGURATION_SUCCESSFULLY_UPDATED'));

    return defer.promise;
};


ControllerSpotify.prototype.rebuildRestartDaemon = async function () {
    // Deactive state
    this.DeactivateState();
    try {
        await this.createConfigFile();
        logger.info('Restarting Vollibrespot Daemon');
        startVolume = true;
        await this.VolspotconnectServiceCmds('restart');
        setTimeout(()=>{
            this.checkWebApi();
        }, 6000)

    } catch (e) {
        this.commandRouter.pushToastMessage('error', 'Spotify', `Unable to update config: ${e}`);
    }
};

ControllerSpotify.prototype.awawitSpocon = function (type) {
    return new Promise((resolve, reject) => {
        this.SpotConn.once(type, resolve);
        // If it takes more than 3 seconds, something is wrong..
        setTimeout(() => {
            return reject;
            }, 3 * 1000);
    });
};

// Plugin methods for the Volumio state machine
ControllerSpotify.prototype.stop = function () {
    var defer = libQ.defer();
    logger.info('Spotify Received stop');
    this.isStopping = true;
    this.SpotConn.sendmsg(msgMap.get('Pause'));

    setTimeout(()=>{
        this.active = false;
        this.isStopping = false;
        defer.resolve('');
    }, 500)

    return defer.promise;
};

ControllerSpotify.prototype.pause = function () {
    this.logger.info('Spotify Received pause');

    this.spotifyCheckAccessToken().then(()=>{
        this.spotifyApi.pause()
            .then(()=> {
                this.state.status = 'pause';
                this.pushState();
            }, (err) => {
                logger.error('Failed to pause ' + error);
            });
    });
};

ControllerSpotify.prototype.play = function () {
    this.logger.info('Spotify Play');

    this.spotifyCheckAccessToken().then(()=>{
        if (this.active) {
            return this.spotifyApi.play().then(e => {
                if (this.state.status !== 'play') {
                    this.state.status = 'play';
                    this.pushState();
                }
            }).catch(error => {
                this.commandRouter.pushToastMessage('error', 'Spotify API Error', error.message);
                logger.error(error);
                this.checkActive();
            });
        } else {
            this.debugLog('Playing on:', this.deviceID);
            return this.spotifyApi.transferMyPlayback({ deviceIds: [this.deviceID], play: true }).catch(error => {
                this.commandRouter.pushToastMessage('error', 'Spotify API Error', error.message);
                logger.error(error);
            });
        }
    });
};

ControllerSpotify.prototype.resume = function () {
    this.logger.info('Spotify Resume');

    this.spotifyCheckAccessToken().then(()=>{
        return this.spotifyApi.play().then(e => {
            if (this.state.status !== 'play') {
                this.state.status = 'play';
                this.pushState();
            }
        }).catch(error => {
            this.commandRouter.pushToastMessage('error', 'Spotify API Error', error.message);
            logger.error(error);
            this.checkActive();
        });
    });
};

ControllerSpotify.prototype.next = function () {
    this.logger.info('Spotify next');
    this.spotifyCheckAccessToken().then(()=>{
        return this.spotifyApi.skipToNext().catch(error => {
            this.commandRouter.pushToastMessage('error', 'Spotify API Error', error.message);
            logger.error(error);
        });
    });
};

ControllerSpotify.prototype.previous = function () {
    this.logger.info('Spotify previous');
    this.spotifyCheckAccessToken().then(()=>{
        return this.spotifyApi.skipToPrevious().catch(error => {
            this.commandRouter.pushToastMessage('error', 'Spotify API Error', error.message);
            logger.error(error);
        });
    });
};

ControllerSpotify.prototype.seek = function (position) {
    this.logger.info('Spotify seek to: ' + position);
    this.spotifyCheckAccessToken().then(()=>{
        return this.spotifyApi.seek(position).catch(error => {
            this.commandRouter.pushToastMessage('error', 'Spotify API Error', error.message);
            logger.error(error);
        });
    });
};

ControllerSpotify.prototype.random = function (value) {
    this.logger.info('Spotify Random: ' + value);

    this.spotifyCheckAccessToken().then(()=>{
        return this.spotifyApi.setShuffle({ state: value }).then(() => {
            this.state.random = value;
            this.pushState();
        }).catch(error => {
            this.commandRouter.pushToastMessage('error', 'Spotify API Error', error.message);
            logger.error(error);
        });
    });
    
};

ControllerSpotify.prototype.repeat = function (value, repeatSingle) {
    this.spotifyCheckAccessToken().then(()=>{
        let state = value ? 'context' : 'off';
        state = repeatSingle ? 'track' : state;
        this.debugLog(`Received Repeat: ${value}-${repeatSingle} => ${state}`);
        // track, context or off.
        return this.spotifyApi.setRepeat({ state: state }).then(() => {
            this.state.repeat = value;
            this.state.repeatSingle = repeatSingle;
            this.pushState();
        }).catch(error => {
            this.commandRouter.pushToastMessage('error', 'Spotify API Error', error.message);
            logger.error(error);
        });
    });
};

ControllerSpotify.prototype.seekTimerAction = function () {
    if (this.state.status === 'play') {
        if (seekTimer === undefined) {
            seekTimer = setInterval(() => {
                this.state.seek = this.state.seek + 1000;
        }, 1000);
        }
    } else {
        clearInterval(seekTimer);
        seekTimer = undefined;
    }
};

ControllerSpotify.prototype.getAdditionalConf = function (type, controller, data) {
    return this.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
};

ControllerSpotify.prototype.playTrackFromWebAPI = function (trackUri) {
    var self = this;

    this.spotifyCheckAccessToken().then(()=>{
        superagent.put('https://api.spotify.com/v1/me/player/play')
            .set("Content-Type", "application/json")
            .set("Authorization", "Bearer " + this.accessToken)
            .send({
                device_id: self.thisSpotifyConnectDeviceId,
                uris : [trackUri],
                position_ms: 0
            })
            .accept('application/json')
            .then(function (results) {
            })
            .catch(function (err) {
                self.logger.info('An error occurred while starting playback ' + err.message);
            });
    });
};

ControllerSpotify.prototype.setDeviceActive = function () {
    var self = this;
    var defer = libQ.defer();

    self.logger.info('Setting this device active')
    self.spotifyCheckAccessToken().then(()=> {
        superagent.put('https://api.spotify.com/v1/me/player')
            .set("Content-Type", "application/json")
            .set("Authorization", "Bearer " + this.accessToken)
            .send({
                device_ids: [self.thisSpotifyConnectDeviceId]
            })
            .accept('application/json')
            .then(function (results) {
                defer.resolve('');
            })
            .catch(function (err) {
                self.logger.info('Failed to Set Device Active: ' + err);
                defer.reject('');
            });
    })
    

    return defer.promise;
};

ControllerSpotify.prototype.debugLog = function (stringToLog) {
    var self = this;

    if (isDebugMode) {
        console.log('SPOTIFY ' + stringToLog);
    }
};

ControllerSpotify.prototype.volumeListener = function () {
    var self = this;

    if (socket) {
        socket.disconnect();
        socket = undefined;
    }
    socket= io.connect('http://localhost:3000');
    socket.on("connect", function(){
        socket.on("pushState", function(state) {
            if (state && state.volume !== undefined && state.mute !== undefined && Number.isInteger(state.volume)) {
                let volume = parseInt(state.volume);
                let mute = state.mute;
                if (mute) {
                    volume = 0;
                }
                if (state.service !== undefined) {
                    currentService = state.service;
                }
                currentVolumioVolume = volume;
                if (currentVolumioVolume > 0 && currentVolumioVolume !== currentSpotifyVolume) {
                    if (self.iscurrService()) {
                        self.setSpotifyVolume(volume);
                    }
                }
            }
        });
    });
};

ControllerSpotify.prototype.setSpotifyVolume = function (volumePercent) {
    var self = this;

    if (self.spotifyApi) {
        self.spotifyCheckAccessToken().then(()=> {
            self.spotifyApi.setVolume(volumePercent)
                .then(function () {
                    currentSpotifyVolume = volumePercent;
                    self.debugLog('Setting Spotify Volume ' + volumePercent);
                }, function (err) {
                    self.debugLog('Error Setting Spotify Volume ' + err);
                });
        });
    }
};

ControllerSpotify.prototype.isTrackAvailableInCountry = function (currentTrackObj) {
    var self = this;

    if (self.userCountry && self.userCountry.length && currentTrackObj && currentTrackObj.available_markets && currentTrackObj.available_markets.length) {
        if (currentTrackObj.available_markets.includes(self.userCountry)) {
            return true;
        } else {
            return false;
        }
    } else {
        return true;
    }
};


ControllerSpotify.prototype.applySpotifyHostsFix = function () {
    var self = this;

    exec('/usr/bin/sudo /bin/chmod 777 /etc/hosts', {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
        if (error !== null) {
            self.logger.error('Spotify Cannot set permissions for /etc/hosts: ' + error);
        } else {
            fs.readFile('/etc/hosts', 'utf8', (err, data) => {
                if (err) {
                    self.logger.error('Failed to Read hosts file:' + err);
                } else {
                    if (!data.includes('ap-gew4.spotify.com')) {
                        data = data + os.EOL + '#SPOTIFY HOSTS FIX' + os.EOL + '104.199.65.124  ap-gew4.spotify.com' + os.EOL;
                        fs.writeFile('/etc/hosts', data, (err) => {
                            if (err) {
                                self.logger.error('Failed to fix hosts file for Spotify: ' + err);
                            } else {
                                self.logger.info('Successfully fixed Spotify hosts');
                            }
                        });
                    }
                }
            });
        }
    });
};

ControllerSpotify.prototype.isPlaybackFromConnectDevice = function (trackId) {
    var self = this;
    var defer = libQ.defer();

    // We retrieve the current playback context:
    // If context is defined: playback is started from spotify app: spotify connect
    // If not, playback is started within Volumio
    if (self.spotifyApi) {
        self.spotifyCheckAccessToken().then(()=> {
            superagent.get('https://api.spotify.com/v1/me/player')
                .set("Content-Type", "application/json")
                .set("Authorization", "Bearer " + self.accessToken)
                .accept('application/json')
                .then((results) => {
                    if (trackId !== undefined) {
                        currentTrackContext = {'trackId': trackId, 'isConnect': undefined};
                    }
                    if (results && results.body && results.body.context && results.body.context.uri) {
                        self.logger.info('Is Connect Playback');
                        if (trackId !== undefined) {
                            currentTrackContext.isConnect = true;
                        }
                        defer.resolve(true);
                    } else {
                        self.logger.info('Is Not Connect Playback');
                        if (trackId !== undefined) {
                            currentTrackContext.isConnect = false;
                        }
                        defer.resolve(false);
                    }
                })
                .catch(function (err) {
                    self.logger.error('Failed to retrieve context ' + err.message);
                });
        });
    }
    return defer.promise;
};

ControllerSpotify.prototype.handleBrowsingError = function (errorMsg) {
    var self = this;
    var defer = libQ.defer();

    if (errorMsg.toString().includes('Forbidden')) {
        self.logger.info('Web API failed due to error forbidden, refreshing token');
        try {
            self.SpotConn.sendmsg(msgMap.get('ReqToken'));
        } catch(e) {
            self.logger.error('Failed to request new token: ' + e);
        }
    }

    self.commandRouter.pushToastMessage('error', 'Spotify API Error', errorMsg.toString());
};

ControllerSpotify.prototype.clearVolumioQueueFromSpotifySongs = function () {
    var self = this;
    var defer = libQ.defer();

    self.logger.info('Clearing Spotify queue');

    var queue = self.commandRouter.volumioGetQueue();
    for (var i in queue) {
        var track = queue[i];
        if (track && track.service === 'spop') {
            self.commandRouter.volumioRemoveQueueItem(i+1);
        }
    }
    setTimeout(()=>{
        defer.resolve('');
    }, 1000)
    return defer.promise;
};