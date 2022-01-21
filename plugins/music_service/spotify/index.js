'use strict';

var libQ = require('kew');
var libNet = require('net');
var libFast = require('fast.js');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var SpotifyWebApi = require('spotify-web-api-node');
var superagent = require('superagent');
var NodeCache = require('node-cache');

var isSpopLoggedIn = false;

// Define the ControllerSpop class
module.exports = ControllerSpop;

function ControllerSpop(context) {
    // This fixed variable will let us refer to 'this' object at deeper scopes
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
    // We use a caching manager to speed up the presentation of root page
    this.browseCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

}


ControllerSpop.prototype.onVolumioStart = function () {
    var self = this;
    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);
    this.commandRouter.sharedVars.registerCallback('language_code', this.systemLanguageChanged.bind(this));
    this.loadI18n();

    if (self.config.get('bitrate') === true) {
        self.samplerate = "320Kbps";
    } else {
        self.samplerate = "128Kbps";
    }

    return libQ.resolve();
}

ControllerSpop.prototype.getConfigurationFiles = function () {
    return ['config.json'];
}

ControllerSpop.prototype.addToBrowseSources = function () {
    var data = {
        name: 'Spotify',
        uri: 'spotify',
        plugin_type: 'music_service',
        plugin_name: 'spop',
        albumart: '/albumart?sourceicon=music_service/spop/spotify.png'
    };
    this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerSpop.prototype.removeToBrowseSources = function () {

    this.commandRouter.volumioRemoveToBrowseSources('Spotify');
};

// Plugin methods -----------------------------------------------------------------------------

ControllerSpop.prototype.startSpopDaemon = function () {
    var self = this;

    var defer = libQ.defer();

    exec("/usr/bin/sudo /bin/systemctl start spop.service", {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
        if (error !== null) {
            self.commandRouter.pushConsoleMessage('The following error occurred while starting SPOPD: ' + error);
            defer.reject();
        } else {
            self.commandRouter.pushConsoleMessage('SpopD Daemon Started');
            defer.resolve();
        }
    });

    return defer.promise;
};

ControllerSpop.prototype.spopDaemonConnect = function (defer, onLogin) {
    var self = this;

    // TODO use names from the package.json instead
    self.servicename = 'spop';
    self.displayname = 'Spotify';

    // Each core gets its own set of Spop sockets connected
    var nHost = 'localhost';
    var nPort = 6602;
    self.connSpopCommand = libNet.createConnection(nPort, nHost); // Socket to send commands and receive track listings
    self.connSpopStatus = libNet.createConnection(nPort, nHost, function () {
        var refreshToken = self.config.get('refresh_token', 'none');
        if (refreshToken !== 'none' && refreshToken !== null && refreshToken !== undefined) {
            self.getRoot();
            self.addToBrowseSources();
        }
        isSpopLoggedIn = true;
        if (defer) {
            defer.resolve();
        }
    }); // Socket to listen for status changes

    // Start a listener for receiving errors
    self.connSpopCommand.on('error', function (err) {
        self.logger.error('SPOP command error: ' + err);
        try {
            defer.reject();
        } catch (ecc) {
        }

    });
    self.connSpopStatus.on('error', function (err) {
        self.logger.error('SPOP status error: ' + err);
        isSpopLoggedIn = false;
        self.removeToBrowseSources();
        if (onLogin) {
            self.commandRouter.pushToastMessage('error', self.getI18n('SPOTIFY_LOGIN_FAILED'), self.getI18n('CHECK_USERNAME_AND_PASSWORD'));
        }
        try {
            defer.reject();
        } catch (ecc) {
        }
    });

    // Init some command socket variables
    self.bSpopCommandGotFirstMessage = false;
    self.spopCommandReadyDeferred = libQ.defer(); // Make a promise for when the Spop connection is ready to receive events (basically when it emits 'spop 0.0.1').
    self.spopCommandReady = self.spopCommandReadyDeferred.promise;
    self.arrayResponseStack = [];
    self.sResponseBuffer = '';

    // Start a listener for command socket messages (command responses)
    self.connSpopCommand.on('data', function (data) {
        self.sResponseBuffer = self.sResponseBuffer.concat(data.toString());

        //self.commandRouter.logger.info("DATA: "+self.sResponseBuffer);

        // If the last character in the data chunk is a newline, this is the end of the response
        if (data.slice(data.length - 1).toString() === '\n') {

            self.commandRouter.logger.info("FIRST BRANCH");

            // If this is the first message, then the connection is open
            if (!self.bSpopCommandGotFirstMessage) {
                self.bSpopCommandGotFirstMessage = true;
                try {
                    self.spopCommandReadyDeferred.resolve();
                } catch (error) {
                    self.pushError(error);
                }
                // Else this is a command response
            } else {
                try {
                    self.commandRouter.logger.info("BEFORE: SPOP HAS " + self.arrayResponseStack.length + " PROMISE IN STACK");

                    if (self.arrayResponseStack !== undefined && self.arrayResponseStack.length > 0)
                        self.arrayResponseStack.shift().resolve(self.sResponseBuffer);

                    self.commandRouter.logger.info("AFTER: SPOP HAS " + self.arrayResponseStack.length + " PROMISE IN STACK");

                } catch (error) {
                    self.pushError(error);
                }
            }

            // Reset the response buffer
            self.sResponseBuffer = '';
        }
    });

    // Init some status socket variables
    self.bSpopStatusGotFirstMessage = false;
    self.sStatusBuffer = '';

    // Start a listener for status socket messages
    self.connSpopStatus.on('data', function (data) {
        self.sStatusBuffer = self.sStatusBuffer.concat(data.toString());

        // If the last character in the data chunk is a newline, this is the end of the status update
        if (data.slice(data.length - 1).toString() === '\n') {
            // Put socket back into monitoring mode
            self.connSpopStatus.write('idle\n');

            // If this is the first message, then the connection is open
            if (!self.bSpopStatusGotFirstMessage) {
                self.bSpopStatusGotFirstMessage = true;
                // Else this is a state update announcement
            } else {
                var timeStart = Date.now();
                var sStatus = self.sStatusBuffer;

                //self.commandRouter.logger.info("STATUS");

                //self.commandRouter.logger.info(sStatus);

                self.logStart('Spop announces state update')
                //.then(function(){
                // return self.getState.call(self);
                // })
                    .then(function () {
                        return self.parseState.call(self, sStatus);
                    })
                    .then(libFast.bind(self.pushState, self))
                    .fail(libFast.bind(self.pushError, self))
                    .done(function () {
                        return self.logDone(timeStart);
                    });
            }

            // Reset the status buffer
            self.sStatusBuffer = '';
        }
    });

    // Define the tracklist
    self.tracklist = [];

    // Start tracklist promise as rejected, so requestors do not wait for it if not immediately available.
    // This is okay because no part of Volumio requires a populated tracklist to function.
    self.tracklistReadyDeferred = null;
    self.tracklistReady = libQ.reject('Tracklist not yet populated.');

    // Attempt to load tracklist from database on disk
    // TODO make this a relative path

    // Create a spotifyAPI object and then get an access token
    self.spotifyApiConnect();

};


ControllerSpop.prototype.onStop = function () {
    var self = this;

    var defer = libQ.defer();

    self.logger.info("Killing SpopD daemon");
    exec("/usr/bin/sudo /usr/bin/killall spopd", function (error, stdout, stderr) {
        if (error) {
            self.logger.info('Cannot kill spop Daemon')
            defer.resolve();
        } else {
            defer.resolve();
        }
        self.removeToBrowseSources();
    });

    return defer.promise;
};

ControllerSpop.prototype.onStart = function () {
    var self = this;
    var defer = libQ.defer();

    self.startSpopDaemon()
        .then(function (e) {
            setTimeout(function () {
                self.logger.info("Connecting to daemon");
                self.spopDaemonConnect(defer);
            }, 5000);
        })
        .fail(function (e) {
            defer.reject(new Error());
        });
    this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.rebuildSPOPDAndRestartDaemon.bind(this));

    return defer.promise;
};

ControllerSpop.prototype.handleBrowseUri = function (curUri) {
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


ControllerSpop.prototype.spotifyApiConnect = function () {
    var self = this;
    var defer = libQ.defer();
    var d = new Date();

    self.spotifyApi = new SpotifyWebApi();

    // Retrieve an access token
    self.spotifyClientCredentialsGrant()
        .then(function (data) {
                self.logger.info('Spotify credentials grant success - running version from March 24, 2019');
                defer.resolve();
            }, function (err) {
                self.logger.info('Spotify credentials grant failed with ' + err);
            }
        );

    return defer.promise;
}

ControllerSpop.prototype.spotifyClientCredentialsGrant = function () {
    var self = this;
    var defer = libQ.defer();
    var d = new Date();
    var now = d.getTime();

    var refreshToken = self.config.get('refresh_token', 'none');
    if (refreshToken !== 'none' && refreshToken !== null && refreshToken !== undefined) {
        self.spotifyApi.setRefreshToken(refreshToken);
        self.refreshAccessToken()
            .then(function (data) {
                self.spotifyAccessToken = data.body['accessToken'];
                self.spotifyApi.setAccessToken(self.spotifyAccessToken);
                self.spotifyAccessTokenExpiration = data.body['expiresInSeconds'] * 1000 + now;
                self.logger.info('New Spotify access token = ' + self.spotifyAccessToken);
                defer.resolve();
            }, function (err) {
                self.logger.info('Spotify credentials grant failed with ' + err);
            });
    }

    return defer.promise;
}

ControllerSpop.prototype.refreshAccessToken = function () {
    var self = this;
    var defer = libQ.defer();

    var refreshToken = self.config.get('refresh_token', 'none');
    if (refreshToken !== 'none' && refreshToken !== null && refreshToken !== undefined) {
        superagent.post('https://oauth-performer.dfs.volumio.org/spotify/accessToken')
            .send({refreshToken: refreshToken})
            .then(function (results) {
                if (results && results.body && results.body.accessToken) {
                    defer.resolve(results)
                } else {
                    defer.resject('No access token received');
                }
            })
            .catch(function (err) {
                self.logger.info('An error occurred while refreshing Spotify Token ' + err);
            });
    }

    return defer.promise;
};

ControllerSpop.prototype.spotifyCheckAccessToken = function () {
    var self = this;
    var defer = libQ.defer();
    var d = new Date();
    var now = d.getTime();

    if (self.spotifyAccessTokenExpiration < now) {
        self.refreshAccessToken()
            .then(function (data) {
                self.spotifyAccessToken = data.body.accessToken;
                self.spotifyApi.setAccessToken(data.body.accessToken);
                self.spotifyAccessTokenExpiration = data.body.expiresInSeconds * 1000 + now;
                self.logger.info('New access token = ' + self.spotifyAccessToken);
                defer.resolve();
            });
    } else {
        defer.resolve();
    }

    return defer.promise;

};

ControllerSpop.prototype.getRoot = function () {
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

ControllerSpop.prototype.listRoot = function (curUri) {
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


// New function that uses the Spotify Web API to get a user's playlists.  Must be authenticated ahead of time and using an access token that asked for the proper scopes
ControllerSpop.prototype.getMyPlaylists = function (curUri) {

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
                    .set("Authorization", "Bearer " + self.spotifyAccessToken)
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

//  Convert new Spotify playlists URIs to old format for SPOP to work
ControllerSpop.prototype._spotifyOldUri = function (uri) {

    self.logger.info('Entered _spotifyOldUri');
    var uriSplitted = uri.split(':');
    var legacyUri = 'spotify:user:spotify:playlist:' + uriSplitted[2];
    // temp debug
    self.logger.info('Converted URI is: ' + legacyUri);

    return legacyUri;
};


// New function that uses the Spotify Web API to get a user's albums.  Must be authenticated ahead of time and using an access token that asked for the proper scopes
ControllerSpop.prototype.getMyAlbums = function (curUri) {

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
                    self.logger.info('An error occurred while listing Spotify my albums ' + err);
                });
            }
        );

    return defer.promise;
};

// New function that uses the Spotify Web API to get a user's tracks.  Must be authenticated ahead of time and using an access token that asked for the proper scopes
ControllerSpop.prototype.getMyTracks = function (curUri) {

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
                        response.navigation.lists[0].items.push({
                            service: 'spop',
                            type: 'song',
                            title: track.name,
                            albumart: self._getAlbumArt(track.album),
                            uri: track.uri
                        });
                    }
                    defer.resolve(response);
                }, function (err) {
                    self.logger.info('An error occurred while listing Spotify my tracks ' + err);
                });
            }
        );

    return defer.promise;
};

// New function that uses the Spotify Web API to get a user's artists.  Must be authenticated ahead of time and using an access token that asked for the proper scopes
ControllerSpop.prototype.getTopArtists = function (curUri) {

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
                    self.logger.info('An error occurred while listing Spotify my artists ' + err);
                });
            }
        );

    return defer.promise;
};

// New function that uses the Spotify Web API to get a user's tracks.  Must be authenticated ahead of time and using an access token that asked for the proper scopes
ControllerSpop.prototype.getTopTracks = function (curUri) {

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
                        response.navigation.lists[0].items.push({
                            service: 'spop',
                            type: 'song',
                            title: track.name,
                            albumart: self._getAlbumArt(track.album),
                            uri: track.uri
                        });
                    }
                    defer.resolve(response);
                }, function (err) {
                    self.logger.info('An error occurred while listing Spotify top tracks ' + err);
                });
            }
        );

    return defer.promise;
};

// New function that uses the Spotify Web API to get a user's tracks.  Must be authenticated ahead of time and using an access token that asked for the proper scopes
ControllerSpop.prototype.getRecentTracks = function (curUri) {

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
                        response.navigation.lists[0].items.push({
                            service: 'spop',
                            type: 'song',
                            title: track.name,
                            albumart: self._getAlbumArt(track.album),
                            uri: track.uri
                        });
                    }
                    defer.resolve(response);
                }, function (err) {
                    self.logger.info('An error occurred while listing Spotify recent tracks ' + err);
                });
            }
        );

    return defer.promise;
};

ControllerSpop.prototype.featuredPlaylists = function (curUri) {

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
                    self.logger.info('An error occurred while listing Spotify featured playlists ' + err);
                });
            }
        );

    return defer.promise;
};

ControllerSpop.prototype.listWebPlaylist = function (curUri) {
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

ControllerSpop.prototype.listWebNew = function (curUri) {

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
                self.logger.info('An error occurred while listing Spotify new albums ' + err);
            });
        });

    return defer.promise;
};

ControllerSpop.prototype.listWebAlbum = function (curUri) {
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


ControllerSpop.prototype.listWebCategories = function (curUri) {

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
                self.logger.info('An error occurred while listing Spotify categories ' + err);
            });
        });

    return defer.promise;
};

ControllerSpop.prototype.listWebCategory = function (curUri) {

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
                self.logger.info('An error occurred while listing Spotify playlist category ' + err);
            });
        });

    return defer.promise;
};

ControllerSpop.prototype.listWebArtist = function (curUri) {

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

ControllerSpop.prototype.listArtistTracks = function (id) {

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

ControllerSpop.prototype.getArtistTracks = function (id) {

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

ControllerSpop.prototype.getArtistAlbumTracks = function (id) {

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
                defer.resolve(response);
            });
        });


    return defer.promise;
};

ControllerSpop.prototype.getArtistAlbums = function (artistId) {

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

ControllerSpop.prototype.getArtistRelatedArtists = function (artistId) {

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

ControllerSpop.prototype._getAlbumArt = function (item) {

    var albumart = '';
    if (item.hasOwnProperty('images') && item.images.length > 0) {
        albumart = item.images[0].url;
    }
    return albumart;
};

// Controller functions

// Spop stop
ControllerSpop.prototype.stop = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::stop');

    return self.sendSpopCommand('stop', []);
};

ControllerSpop.prototype.onRestart = function () {
    var self = this;
    //
};

ControllerSpop.prototype.onInstall = function () {
    var self = this;
    //Perform your installation tasks here
};

ControllerSpop.prototype.onUninstall = function () {
    var self = this;
    //Perform your installation tasks here
};

ControllerSpop.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function (uiconf) {

            if (!isSpopLoggedIn) {
                if (self.config.get('username', 'none') !== 'none' && self.config.get('password', 'none') !== 'none') {
                    uiconf.sections[0].content[0].value = self.config.get('username');
                    uiconf.sections[0].content[1].value = self.config.get('password');
                }
                uiconf.sections[0].content[0].hidden = false;
                uiconf.sections[0].content[1].hidden = false;
                uiconf.sections[0].content[3].hidden = true
            } else {
                uiconf.sections[0].content[0].hidden = true;
                uiconf.sections[0].content[1].hidden = true;
                var refreshToken = self.config.get('refresh_token', 'none');
                if (refreshToken === 'none' || refreshToken === null || refreshToken === undefined) {
                    uiconf.sections[0].content[3].hidden = false;
                } else {
                    uiconf.sections[0].content[3].hidden = true;
                }
                self.configManager.setUIConfigParam(uiconf, 'sections[0].onSave.method', 'logout');
                self.configManager.setUIConfigParam(uiconf, 'sections[0].saveButton.label', self.getI18n('LOGOUT'));
            }

            uiconf.sections[0].content[2].value = self.config.get('bitrate');

            var scopes = [
                'user-modify-playback-state',
                'user-read-playback-state',
                'user-read-currently-playing',
                'user-top-read',
                'user-read-recently-played',
                'user-library-read',
                'playlist-read-private',
                'playlist-read-collaborative',
                'app-remote-control',
                'streaming'
            ];



            uiconf.sections[0].content[3].onClick.scopes = scopes;
            defer.resolve(uiconf);
        })
        .fail(function (error) {
            self.logger.error('Cannot populate Spotify configuration: ' + error);
            defer.reject(new Error());
        });

    return defer.promise;
};

ControllerSpop.prototype.setUIConfig = function (data) {
    var self = this;
    //Perform your installation tasks here
};

ControllerSpop.prototype.getConf = function (varName) {
    var self = this;
    //Perform your installation tasks here
};

ControllerSpop.prototype.setConf = function (varName, varValue) {
    var self = this;
    //Perform your installation tasks here
};

// Public Methods ---------------------------------------------------------------------------------------
// These are 'this' aware, and return a promise


// Rebuild a library of user's playlisted Spotify tracks


// Define a method to clear, add, and play an array of tracks
ControllerSpop.prototype.clearAddPlayTrack = function (track) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::clearAddPlayTrack');

    self.commandRouter.logger.info(JSON.stringify(track));

    return self.sendSpopCommand('uplay', [track.uri]);
};

// Spop stop
ControllerSpop.prototype.stop = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::stop');

    return self.sendSpopCommand('stop', []);
};

// Spop pause
ControllerSpop.prototype.pause = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::pause');

    // TODO don't send 'toggle' if already paused
    return self.sendSpopCommand('toggle', []);
};

// Spop resume
ControllerSpop.prototype.resume = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::resume');

    // TODO don't send 'toggle' if already playing
    return self.sendSpopCommand('toggle', []);
};

// Spop music library
ControllerSpop.prototype.getTracklist = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::getTracklist');

    return self.tracklistReady
        .then(function () {
            return self.tracklist;
        });
};

// Internal methods ---------------------------------------------------------------------------
// These are 'this' aware, and may or may not return a promise

// Send command to Spop
ControllerSpop.prototype.sendSpopCommand = function (sCommand, arrayParameters) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::sendSpopCommand');

    // Convert the array of parameters to a string
    var sParameters = libFast.reduce(arrayParameters, function (sCollected, sCurrent) {
        return sCollected + ' ' + sCurrent;
    }, '');


    var spopResponseDeferred = libQ.defer();
    // Pass the command to Spop when the command socket is ready
    self.spopCommandReady
        .then(function () {
            return libQ.nfcall(libFast.bind(self.connSpopCommand.write, self.connSpopCommand), sCommand + sParameters + '\n', 'utf-8')
                /*.then(function()
                 {
                 spopResponseDeferred.resolve();
                 })
                 .fail(function(err)
                 {
                 spopResponseDeferred.reject(new Error(err));
                 })*/;
        });


    var spopResponse = spopResponseDeferred.promise;

    if (sCommand !== 'status') {
        self.commandRouter.logger.info("ADDING DEFER FOR COMMAND " + sCommand);
        self.arrayResponseStack.push(spopResponseDeferred);
    }
    // Return a promise for the command response
    return spopResponse;
};

// Spop get state
ControllerSpop.prototype.getState = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::getState');

    return self.sendSpopCommand('status', []);
};

// Spop parse state
ControllerSpop.prototype.parseState = function (sState) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::parseState');
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
        samplerate: self.samplerate, // Pull these values from somwhere else since they are not provided in the Spop state
        bitdepth: null,
        channels: null,
        artist: objState.artist,
        title: objState.title,
        album: objState.album
    });
};

// Announce updated Spop state
ControllerSpop.prototype.pushState = function (state) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::pushState');

    return self.commandRouter.servicePushState(state, self.servicename);
};

// Pass the error if we don't want to handle it
ControllerSpop.prototype.pushError = function (sReason) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::pushError(' + sReason + ')');

    // Return a resolved empty promise to represent completion
    return libQ.resolve();
};

// Scan tracks in playlists via Spop and populates tracklist
// Metadata fields to roughly conform to Ogg Vorbis standards (http://xiph.org/vorbis/doc/v-comment.html)
ControllerSpop.prototype.rebuildTracklistFromSpopPlaylists = function (objInput, arrayPath) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::rebuildTracklistFromSpopPlaylists');

    if (!('playlists' in objInput)) {
        throw new Error('Error building Spop tracklist - no playlists found.');
    }

    var arrayPlaylists = objInput.playlists;
    // We want each playlist to be parsed sequentially instead of simultaneously so that Spop is not overwhelmed
    // with requests. Use this chained promisedActions to guarantee sequential execution.
    var promisedActions = libQ.resolve();

    libFast.map(arrayPlaylists, function (curPlaylist) {
        /*
         if (!('index' in curPlaylist)) {
         return;
         }*/
        var sPlaylistName = '';
        if (curPlaylist.name === '') {
            // The Starred playlist has a blank name
            sPlaylistName = 'Starred';
        } else {
            sPlaylistName = curPlaylist.name;
        }
        var arrayNewPath = arrayPath.concat(sPlaylistName);

        if (curPlaylist.type === 'folder') {
            promisedActions = promisedActions
                .then(function () {
                    return self.rebuildTracklistFromSpopPlaylists(curPlaylist, arrayNewPath);
                });

        } else if (curPlaylist.type === 'playlist') {
            var curPlaylistIndex = curPlaylist.index;

            promisedActions = promisedActions
                .then(function () {
                    return self.sendSpopCommand('ls', [curPlaylistIndex]);
                })
                .then(JSON.parse)
                .then(function (curTracklist) {
                    var nTracks = 0;

                    if (!('tracks' in curTracklist)) {
                        return;
                    }

                    nTracks = curTracklist.tracks.length;

                    for (var j = 0; j < nTracks; j++) {
                        self.tracklist.push({
                            'name': curTracklist.tracks[j].title,
                            'service': self.servicename,
                            'uri': curTracklist.tracks[j].uri,
                            'browsepath': arrayNewPath,
                            'album': curTracklist.tracks[j].album,
                            'artists': libFast.map(curTracklist.tracks[j].artist.split(','), function (sArtist) {
                                // TODO - parse other options in artist string, such as "feat."
                                return sArtist.trim();

                            }),
                            'performers': [],
                            'genres': [],
                            'tracknumber': 0,
                            'date': '',
                            'duration': 0
                        });
                    }
                });
        }
    });

    return promisedActions;
};

// TODO delete below function - not used
ControllerSpop.prototype.explodeAlbumUri = function (id) {
    var self = this;
    var defer = libQ.defer();

    self.spotifyApi.getAlbum(id, 'GB')
        .then(function (result) {
            self.commandRouter.logger.info(result);
            defer.resolve();
        });


    return defer.promise;
};

ControllerSpop.prototype.getAlbumTracks = function (id) {

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
                        response.push({
                            service: 'spop',
                            type: 'song',
                            title: track.name,
                            name: track.name,
                            artist: track.artists[0].name,
                            album: album,
                            albumart: albumart,
                            uri: track.uri,
                            samplerate: self.samplerate,
                            bitdepth: '16 bit',
                            trackType: 'spotify',
                            duration: Math.trunc(track.duration_ms / 1000)
                        });
                    }
                    defer.resolve(response);
                }, function (err) {
                    self.logger.info('An error occurred while listing Spotify album tracks ' + err);
                });
            }
        );

    return defer.promise;
};

ControllerSpop.prototype.getPlaylistTracks = function (userId, playlistId) {
    var self = this;
    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.getPlaylist(playlistId);
            spotifyDefer.then(function (results) {

                var response = [];

                for (var i in results.body.tracks.items) {
                    var track = results.body.tracks.items[i].track;
                    try {
                        var item = {
                            service: 'spop',
                            type: 'song',
                            name: track.name,
                            title: track.name,
                            artist: track.artists[0].name,
                            album: track.album.name,
                            uri: track.uri,
                            samplerate: self.samplerate,
                            bitdepth: '16 bit',
                            trackType: 'spotify',
                            albumart: (track.album.hasOwnProperty('images') && track.album.images.length > 0 ? track.album.images[0].url : ''),
                            duration: Math.trunc(track.duration_ms / 1000)
                        };
                        response.push(item);
                    } catch(e) {}
                }
                defer.resolve(response);
            }, function (err) {
                self.logger.info('An error occurred while exploding listing Spotify playlist tracks ' + err);
            });
        });

    return defer.promise;
};

ControllerSpop.prototype.getArtistTopTracks = function (id) {

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
                    response.push({
                        service: 'spop',
                        type: 'song',
                        name: track.name,
                        title: track.name,
                        artist: track.artists[0].name,
                        album: track.album.name,
                        albumart: albumart,
                        duration: parseInt(track.duration_ms / 1000),
                        samplerate: self.samplerate,
                        bitdepth: '16 bit',
                        trackType: 'spotify',
                        uri: track.uri
                    });
                }
                defer.resolve(response);
            }), function (err) {
                self.logger.info('An error occurred while listing Spotify artist tracks ' + err);
            }
        });

    return defer.promise;
};

ControllerSpop.prototype.getArtistInfo = function (id) {
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

ControllerSpop.prototype.getAlbumInfo = function (id) {
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
                self.logger.info('An error occurred while listing Spotify album informations ' + err);
                defer.resolve(info);
            }
        });

    return defer.promise;
}

ControllerSpop.prototype.getPlaylistInfo = function (userId, playlistId) {
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
                self.logger.info('An error occurred while getting Playlist info: ' + err);
            });
        });

    return defer.promise;
}

ControllerSpop.prototype.getTrack = function (id) {

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
                    tracknumber: results.body.track_number,
                    albumart: albumart,
                    samplerate: self.samplerate,
                    bitdepth: '16 bit',
                    trackType: 'spotify'
                };
                response.push(item);
                defer.resolve(response);
            });
        });

    return defer.promise;
};


ControllerSpop.prototype.explodeUri = function (uri) {

    var self = this;

    var defer = libQ.defer();

    var uriSplitted;

    var response;

    if (uri.startsWith('spotify/playlists')) {
        // TODO replace this with SpotifyAPI when we have Oauth support
        response = self.getMyPlaylists();
        defer.resolve(response);
    } else if (uri.startsWith('spotify:playlist:')) {
        uriSplitted = uri.split(':');
        response = self.getPlaylistTracks(uriSplitted[0], uriSplitted[2]);
        defer.resolve(response);
    } else if (uri.startsWith('spotify:artist:')) {
        uriSplitted = uri.split(':');
        // TODO *jpa* Add tracks from albums next
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

ControllerSpop.prototype.getAlbumArt = function (data, path) {

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

ControllerSpop.prototype.logDone = function (timeStart) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + '------------------------------ ' + (Date.now() - timeStart) + 'ms');
    return libQ.resolve();
};

ControllerSpop.prototype.logStart = function (sCommand) {
    var self = this;
    self.commandRouter.pushConsoleMessage('\n' + '[' + Date.now() + '] ' + '---------------------------- ' + sCommand);
    return libQ.resolve();
};


ControllerSpop.prototype.createSPOPDFile = function () {
    var self = this;
    var defer = libQ.defer();

    try {
        fs.readFile(__dirname + "/spop.conf.tmpl", 'utf8', function (err, data) {
            if (err) {
                defer.reject(new Error(err));
                return console.log(err);
            }
            var outdev = self.commandRouter.sharedVars.get('alsa.outputdevice');

            if (outdev === 'softvolume') {
                var hwdev = 'softvolume';
            } else {
                if (outdev.indexOf(',') >= 0) {
                    var hwdev = 'plughw:'+outdev;
                } else {
                    var hwdev = 'plughw:'+outdev+',0';
                }
            }
            var bitrate = self.config.get('bitrate');
            var bitratevalue = 'true';
            if (bitrate == false) {
                bitratevalue = 'false';
            }

            var conf1 = data.replace("${username}", self.config.get('username'));
            var conf2 = conf1.replace("${password}", self.config.get('password'));
            var conf3 = conf2.replace("${refresh_token}", self.config.get('refresh_token'));
			var conf4 = conf3.replace("${bitrate}", self.config.get('bitrate'));
			var conf5 = conf4.replace("${outdev}", hwdev);
            

            fs.writeFile("/etc/spopd.conf", conf5, 'utf8', function (err) {
                if (err)
                    defer.reject(new Error(err));
                else defer.resolve();
            });


        });


    } catch (err) {


    }

    return defer.promise;

};

ControllerSpop.prototype.saveSpotifyAccount = function (data, avoidBroadcastUiConfig) {
    var self = this;
    var defer = libQ.defer();
    var broadcastUiConfig = true;

    if (avoidBroadcastUiConfig){
        broadcastUiConfig = false;
    }

    if (data && data['username'] && data['password']) {
        self.config.set('username', data['username']);
        self.config.set('password', data['password']);
    } else {
        self.commandRouter.pushToastMessage('error', self.getI18n('SPOTIFY_LOGIN_FAILED'), self.getI18n('PROVIDE_USERNAME_AND_PASSWORD'));
    }

	self.config.set('bitrate', data['bitrate']);

    self.commandRouter.pushToastMessage('success', self.getI18n('SPOTIFY_LOGIN'), self.getI18n('LOGGING_IN'));
 

    self.rebuildSPOPDAndRestartDaemon(true)
        .then(function (e) {
            self.commandRouter.pushToastMessage('success', self.getI18n('SPOTIFY_LOGIN'), self.getI18n('LOGIN_SUCCESSFUL'));

            var config = self.getUIConfig();
            config.then(function(conf) {
                if (broadcastUiConfig) {
                    self.commandRouter.broadcastMessage('pushUiConfig', conf);
                }
                self.showAuthorizationModal();
                defer.resolve(conf)
            });
            defer.resolve({});
        })
        .fail(function (e) {
            defer.reject(new Error());
        });

    return defer.promise;
};

ControllerSpop.prototype.saveSpotifyAccountMyMusic = function (data) {
    var self = this;

    return self.saveSpotifyAccount(data, true)
}

ControllerSpop.prototype.showAuthorizationModal = function () {
    var self = this;

    var responseData = {
        title:  self.getI18n('SPOTIFY_LOGIN'),
        message:  self.getI18n('AUTHORIZE_PERSONAL_CONTENT_INSTRUCTIONS'),
        size: 'lg',
        buttons: [
            {
                name: self.commandRouter.getI18nString('COMMON.GOT_IT'),
                class: 'btn btn-info ng-scope',
                emit:'',
                payload:''
            }
        ]
    }
    self.commandRouter.broadcastMessage("openModal", responseData);


};


ControllerSpop.prototype.rebuildSPOPDAndRestartDaemon = function (onLogin) {
    var self = this;
    var defer = libQ.defer();

    if (self.config.get('username', 'none') !== 'none' && self.config.get('password', 'none') !== 'none') {
        self.createSPOPDFile()
            .then(function (e) {
                var edefer = libQ.defer();
                exec("killall spopd", function (error, stdout, stderr) {
                    edefer.resolve();
                });
                return edefer.promise;
            })
            .then(self.startSpopDaemon.bind(self))
            .then(function (e) {
                setTimeout(function () {
                    self.logger.info("Connecting to daemon");
                    self.spopDaemonConnect(defer, onLogin);
                }, 5000);
            });
    } else {
        defer.resolve();
    }

    return defer.promise;
};

ControllerSpop.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::seek to ' + timepos);

    return this.sendSpopCommand('seek ' + timepos, []);
};

// TODO - didn't have time to update the search function for the new grid view UI....
ControllerSpop.prototype.search = function (query) {
    var self = this;
    var defer = libQ.defer();

    self.spotifyCheckAccessToken()
        .then(function (data) {
            var spotifyDefer = self.spotifyApi.search(query.value, ['artist', 'album', 'playlist', 'track']);
            spotifyDefer.then(function (results) {

                var list = [];

                // TODO put in internationalized strings
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
                self.logger.info('An error occurred while searching ' + err);
            });
        });

    return defer.promise;
};

ControllerSpop.prototype._searchArtists = function (results) {

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

ControllerSpop.prototype._searchAlbums = function (results) {

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

ControllerSpop.prototype._searchPlaylists = function (results) {

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

ControllerSpop.prototype._searchTracks = function (results) {

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

ControllerSpop.prototype.oauthLogin = function (data) {
    var self=this;

    if (data && data.refresh_token) {
        self.logger.info('Saving Spotify Refresh Token');
        self.config.set('refresh_token', data.refresh_token);
        self.spopDaemonConnect();
        self.commandRouter.pushToastMessage('success', self.getI18n('SPOTIFY_LOGIN'), self.getI18n('SUCCESSFULLY_AUTHORIZED'));
        var config = self.getUIConfig();
        config.then(function(conf) {
            self.commandRouter.broadcastMessage('pushUiConfig', conf);
            self.commandRouter.broadcastMessage('closeAllModals', '');
            defer.resolve(conf)
        });
    } else {
        self.logger.error('Could not receive oauth data');
    }
};

ControllerSpop.prototype.externalOauthLogin = function (data) {
    var self=this;
    var defer = libQ.defer();

    if (data && data.refresh_token) {
        self.logger.info('Saving Spotify Refresh Token');
        self.config.set('refresh_token', data.refresh_token);
        self.spopDaemonConnect();
        self.commandRouter.pushToastMessage('success', self.getI18n('SPOTIFY_LOGIN'), self.getI18n('SUCCESSFULLY_AUTHORIZED'));
        setTimeout(()=>{
            defer.resolve('');
        },150);
    } else {
        self.logger.error('Could not receive oauth data');
        defer.resolve('');
    }
    return defer.promise
};


ControllerSpop.prototype.systemLanguageChanged = function () {
    var self=this;

    self.loadI18n();
    self.flushCache();
};

ControllerSpop.prototype.flushCache = function() {
    var self=this

    self.browseCache.flushAll();
}

ControllerSpop.prototype.loadI18n = function () {
    var self=this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        self.i18n=fs.readJsonSync(__dirname+'/i18n/strings_'+language_code+".json");
    } catch(e) {
        self.i18n=fs.readJsonSync(__dirname+'/i18n/strings_en.json');
    }

    self.i18nDefaults=fs.readJsonSync(__dirname+'/i18n/strings_en.json');
};

ControllerSpop.prototype.getI18n = function (key) {
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

ControllerSpop.prototype.logout = function (avoidBroadcastUiConfig) {
    var self=this;
    var defer = libQ.defer();
    var broadcastUiConfig = true;


    if (avoidBroadcastUiConfig === true){
        broadcastUiConfig = false;
    }

    self.config.set('username', 'none');
    self.config.set('password', 'none');
    self.config.set('refresh_token', 'none');
    self.onStop();
    isSpopLoggedIn = false;
    if (self.spotifyApi) {
        self.spotifyApi.resetCredentials();
    }
    self.commandRouter.pushToastMessage('success', self.getI18n('LOGOUT'), self.getI18n('LOGOUT_SUCCESSFUL'));
    var config = self.getUIConfig();
    config.then(function(conf) {
        if (broadcastUiConfig) {
            self.commandRouter.broadcastMessage('pushUiConfig', conf);
        }
        defer.resolve(conf)
    });

    return defer.promise
};

ControllerSpop.prototype.logoutMyMusic = function () {
    var self=this;

    return self.logout(true)
};