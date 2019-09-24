var libQ = require('kew');
var qobuzApi = require('./qobuzApi');
var cachemanager = require('cache-manager');
var defaultTtl = 60; //minutes
var defaultCachePruneInterval = 60; //minutes
var defaultSearchTtl = 5; //minutes
var navigation = require('./navigation')();

module.exports = QobuzService;

function QobuzService(logger, apiArgs, serviceArgs) {
    var self = this;

    var api = new qobuzApi(logger, apiArgs);
    var memoryCache = initialiseCache();

    self.rootList = function () {
        var items = [
            navigation.navigationFolder("My Albums", "qobuz/favourites/albums"),
            navigation.navigationFolder("My Tracks", "qobuz/favourites/tracks"),
            navigation.navigationFolder("My Playlists", "qobuz/favourites/playlists"),
            navigation.navigationFolder("My Artists", "qobuz/favourites/artists"),
            navigation.navigationFolder("My Purchases", "qobuz/purchases"),
            navigation.navigationFolder("Qobuz Playlists", "qobuz/editor/playlists"),
            navigation.navigationFolder("Genres", "qobuz/genres")
        ];

        if (serviceArgs.display.showQobuzListsInRoot === true) {
            items.push(
                navigation.navigationFolder("New Releases", "qobuz/new/albums"),
                navigation.navigationFolder("Best Sellers", "qobuz/bestsellers/albums"),
                navigation.navigationFolder("Most Streamed", "qobuz/moststreamed/albums"),
                navigation.navigationFolder("Press Awards", "qobuz/press/albums"),
                navigation.navigationFolder("Selected by Qobuz", "qobuz/editor/albums"),
                navigation.navigationFolder("Selected by the Media", "qobuz/mostfeatured/albums"));
        }
        else {
            items.push(navigation.navigationFolder("Discover", "qobuz/discover"));
        }

        return libQ.resolve(navigation.browse(["list"], items, "/"));
    };

    self.discover = function () {
        return libQ.resolve(
            navigation.browse(
                ["list"],
                [
                    navigation.navigationFolder("New Releases", "qobuz/new/albums"),
                    navigation.navigationFolder("Best Sellers", "qobuz/bestsellers/albums"),
                    navigation.navigationFolder("Most Streamed", "qobuz/moststreamed/albums"),
                    navigation.navigationFolder("Press Awards", "qobuz/press/albums"),
                    navigation.navigationFolder("Selected by Qobuz", "qobuz/editor/albums"),
                    navigation.navigationFolder("Selected by the Media", "qobuz/mostfeatured/albums")
                ],
                "qobuz"));
    };

    self.purchaseTypesList = function () {
        return libQ.resolve(
            navigation.browse(
                ["list"],
                [
                    navigation.navigationFolder("Albums", "qobuz/purchases/albums"),
                    navigation.navigationFolder("Tracks", "qobuz/purchases/tracks")
                ],
                "qobuz"));
    };

    self.favouriteAlbumsList = function () {
        return navigationItemList('qobuz/favourites/albums', favouriteAlbums, ["list", "grid"], "qobuz", serviceArgs.cache.favourites, serviceArgs.sort.albums);
    };

    self.favouriteTracksList = function () {
        return navigationItemList('qobuz/favourites/tracks', favouriteTracks, ["list"], "qobuz", serviceArgs.cache.favourites, serviceArgs.sort.tracks);
    };

    self.favouriteArtistsList = function () {
        return navigationItemList('qobuz/favourites/artists', favouriteArtists, ["list", "grid"], "qobuz", serviceArgs.cache.favourites);
    };

    self.userPlaylistsList = function () {
        return navigationItemList('qobuz/favourites/playlists', userPlaylists, ["list", "grid"], "qobuz", serviceArgs.cache.favourites, serviceArgs.sort.playlists);
    };

    self.albumTracksList = function (albumId, prevUri) {
        return navigationItemList('qobuz/albumTracks/' + albumId, albumTracks.bind(self, albumId), ["list"], prevUri, serviceArgs.cache.items);
    };

    self.playlistTracksList = function (playlistId, prevUri) {
        return navigationItemList('qobuz/playlistTracks/' + playlistId, playlistTracks.bind(self, playlistId), ["list"], prevUri, serviceArgs.cache.items);
    };

    self.featuredAlbumsList = function (type, prevUri) {
        return navigationItemList('qobuz/' + type + '/albums/', featuredAlbums.bind(self, type), ["list", "grid"], prevUri, serviceArgs.cache.editorial);
    };

    self.featuredPlaylistsList = function (type, prevUri) {
        return navigationItemList('qobuz/' + type + '/playlists/', featuredPlaylists.bind(self, type), ["list", "grid"], prevUri, serviceArgs.cache.editorial);
    };

    self.purchasesList = function (type) {
        return navigationItemList(
            'qobuz/purchases/' + type,
            purchases.bind(self, type),
            ["list", "grid"],
            'qobuz/purchases',
            serviceArgs.cache.favourites,
            type === "albums" ? serviceArgs.sort.albums : serviceArgs.sort.tracks);
    };

    self.artistAlbumsList = function (artistId, type, prevUri) {
        return navigationItemList('qobuz/artist/' + artistId, artistAlbums.bind(self, artistId, type), ["list", "grid"], prevUri, serviceArgs.cache.items, serviceArgs.sort.albums);
    };

    self.genres = function (genreId, prevUri) {
        return tryCache('qobuz/genre' + (genreId ? '/' + genreId : ''), genres.bind(self, genreId), serviceArgs.cache.editorial)
            .then(function (genreResults) {
                var lists = [genreResults.genres];
                if (genreId) {
                    var types = navigation.editorialTypes().map(function (type) {
                        return navigation.navigationFolder(type.name, "qobuz/genre/" + genreId + "/" + type.value + "/items");
                    });
                    lists.push(navigation.searchResults(["list", "grid"], types, "title", "Categories"));
                }
                return { navigation: { lists: lists, prev: { uri: prevUri + (genreResults.parentId ? "/" + genreResults.parentId : (genreId ? "s" : "")) } } };
            });
    };

    self.genreItemList = function (genreId, type, prevUri) {
        return tryCache('qobuz/genre/' + genreId + "/" + type + "/items", genreItems.bind(self, genreId, type), serviceArgs.cache.editorial)
            .then(function (results) {
                return { navigation: { lists: results, prev: { uri: prevUri + "/" + genreId } } };
            });
    };

    self.search = function (query, type, collectionSearch) {
        return tryCache(
            'qobuz/search/' + (collectionSearch === true ? 'my:' : '') + (type ? type + ':' : '') + encodeURIComponent(query),
            search.bind(self, query, type, collectionSearch),
            defaultSearchTtl);
    };

    self.track = function (trackId) {
        return trackList('qobuz/track/' + trackId, track.bind(self, trackId));
    };

    self.trackUrl = function (trackId) {
        //this should never be cached...
        return trackUrl(trackId);
    };

    self.album = function (albumId) {
        return trackList('qobuz/album/' + albumId, album.bind(self, albumId));
    };

    self.playlist = function (playlistId) {
        return trackList('qobuz/playlist/' + playlistId, playlist.bind(self, playlistId));
    };

    self.clearCache = function () {
        return memoryCache ? libQ.resolve(memoryCache.reset()) : libQ.resolve();
    };

    function initialiseCache() {
        var cache;

        if (serviceArgs.cache.enabled === true) {
            cache = cachemanager.caching({ store: 'memory', max: 100, ttl: defaultTtl });

            //schedule a clean up of expired cache entries
            setInterval(function () {
                if (cache) {
                    logger.info('[' + Date.now() + '] ' + 'QobuzService::pruning cache');
                    cache.keys()
                        .then(function (keys) {
                            libQ.all(keys.map(function (key) {
                                return cache.get(key);
                            }));
                        });
                }
            }, 1000 * 60 * (serviceArgs.cache.pruneInterval || defaultCachePruneInterval));
        }

        return cache;
    }

    var tryCache = function (cacheKey, apiCall, ttl) {
        if (serviceArgs.cache.enabled === true) {
            logger.qobuzDebug('cache check');

            ttl = (ttl || defaultTtl) * 60; //seconds

            return libQ.resolve(memoryCache.wrap(cacheKey, function () {
                logger.qobuzDebug(cacheKey + ': not in cache');
                return apiCall();
            }, { ttl: ttl }))
                .then(function (items) {
                    logger.qobuzDebug(cacheKey + ': finished with cache');
                    return items;
                })
                .fail(function (e) {
                    logger.info(cacheKey + ': fail cache error');
                    return libQ.reject(new Error());
                });
        } else {
            return apiCall()
                .fail(function (e) {
                    logger.info('api call failed');
                    return libQ.reject(new Error());
                });
        }
    };

    var navigationItemList = function (cacheKey, dataGetter, navigationViews, prevUri, ttl, sortBy) {
        return tryCache(cacheKey, dataGetter, ttl)
            .then(function (navigationItems) {
                if (sortBy && sortBy !== '')
                    navigationItems = navigationItems.sort(fieldSorter(sortBy));
                return navigation.browse(navigationViews, navigationItems, prevUri);
            });
    };

    var trackList = function (cacheKey, dataGetter) {
        return tryCache(cacheKey, dataGetter, serviceArgs.cache.items);
    };

    var favouriteAlbums = function () {
        return api.getFavourites("albums")
            .then(qobuzAlbumsToNavItems.bind(self, "qobuz/favourites/album/"));
    };

    var favouriteTracks = function () {
        return api.getFavourites("tracks")
            .then(qobuzTracksToNavItems);
    };

    var favouriteArtists = function () {
        return api.getFavourites("artists")
            .then(qobuzArtistsToNavItems.bind(self, "qobuz/favourites/artist/"));
    };

    var userPlaylists = function () {
        return api.getUserPlaylists()
            .then(qobuzPlaylistsToNavItems.bind(self, "qobuz/favourites/playlist/"));
    };

    var albumTracks = function (albumId) {
        return api.getAlbum(albumId)
            .then(qobuzAlbumTracksToNavItems);
    };

    var playlistTracks = function (playlistId) {
        return api.getPlaylist(playlistId)
            .then(qobuzTracksToNavItems);
    };

    var featuredAlbums = function (type) {
        return api.getFeaturedAlbums(type)
            .then(qobuzAlbumsToNavItems.bind(self, "qobuz/" + type + "/album/"));
    };

    var featuredPlaylists = function (type) {
        return api.getFeaturedPlaylists(type)
            .then(qobuzPlaylistsToNavItems.bind(self, "qobuz/" + type + "/playlist/"));
    };

    var purchases = function (type) {
        return api.getPurchases()
            .then(function (result) {
                return type === "albums" ? qobuzAlbumsToNavItems("qobuz/purchases/album/", result) : qobuzTracksToNavItems(result);
            });
    };

    var artistAlbums = function (artistId, type) {
        return api.getArtist(artistId)
            .then(qobuzAlbumsToNavItems.bind(self, "qobuz/" + (type && type.length > 0 ? type + "/" : "") + "artist/" + artistId + "/album/"));
    };

    var genres = function (genreId) {
        return api.getGenres(genreId)
            .then(function (result) {
                var genreResults = { genres: navigation.searchResults(["list"], qobuzGenresToNavItems(result), "title", "Genres") };
                if (result && result.parent && result.parent.path && result.parent.path.length > 1) {
                    genreResults.parentId = result.parent.path[1];
                }
                return genreResults;
            });
    };

    var genreItems = function (genreId, type) {
        // return libQ.all([
        //     api.getFeaturedAlbums(type, genreId),
        //     api.getFeaturedPlaylists("editor", genreId),
        //     api.getFeaturedPlaylists("public", genreId)
        //         ])
        return api.getFeaturedAlbums(type, genreId)
            .then(function (results) {
                return [
                    navigation.searchResults(["list", "grid"], qobuzAlbumsToNavItems("qobuz/genre/" + genreId + "/" + type + "/album/", results), "title", "Albums")
                    //filtering playlists by genre doesn't seem to be woring at all in qobbuz api
                    // navigation.searchResults(
                    //     ["list", "grid"],
                    //     qobuzPlaylistsToNavItems("qobuz/genre/" + genreId + "/editor/playlist/", results[1])
                    //         .concat(qobuzPlaylistsToNavItems("qobuz/genre/" + genreId + "/public/playlist/", results[2])),
                    //     "title",
                    //     "Playlists")
                ];
            });
    };

    var search = function (query, type, collectionSearch) {
        var searchResults;

        if (collectionSearch) {
            switch (type) {
                case 'artists':
                    searchResults = collectionSearchArtists(query);
                    break;
                case 'tracks':
                    searchResults = collectionSearchTracks(query);
                    break;
                case 'albums':
                default:
                    searchResults = collectionSearchAlbums(query);
            }
        }
        else {
            var baseUri = 'qobuz/search/' + (type ? type + ':' : '') + encodeURIComponent(query);
            searchResults = api.search(query, type)
                .then(function (result) {
                    return [
                        navigation.searchResults(["list", "grid"], qobuzAlbumsToNavItems(baseUri + "/album/", result), "title", "Qobuz Albums"),
                        navigation.searchResults(["list", "grid"], qobuzArtistsToNavItems(baseUri + "/artist/", result), "title", "Qobuz Artists"),
                        navigation.searchResults(["list"], qobuzTracksToNavItems(result), "title", "Qobuz Tracks"),
                        navigation.searchResults(["list", "grid"], qobuzPlaylistsToNavItems(baseUri + "/playlist/", result), "title", "Qobuz Playlists")
                    ];
                });
        }
        return searchResults;
    };

    var collectionSearchAlbums = function (query) {
        return api.getCollectionAlbums(query)
            .then(function (result) {
                return [
                    navigation.searchResults(["list", "grid"], qobuzAlbumsToNavItems("qobuz/search/my:albums:" + encodeURIComponent(query) + "/album/", { albums: result }), "title", "Qobuz Albums")
                ];
            });
    };

    var collectionSearchTracks = function (query) {
        return api.getCollectionTracks(query)
            .then(function (result) {
                return [
                    navigation.searchResults(["list"], qobuzTracksToNavItems({ tracks: result }), "title", "Qobuz Tracks")
                ];
            });
    };

    var collectionSearchArtists = function (query) {
        return api.getCollectionArtists(query)
            .then(function (result) {
                return [
                    navigation.searchResults(["list", "grid"], qobuzArtistsToNavItems("qobuz/search/my:artists:" + encodeURIComponent(query) + "/artist/", { artists: result }), "title", "Qobuz Artists")
                ];
            });
    };

    var qobuzAlbumsToNavItems = function (uriRoot, qobuzResult) {
        if (!qobuzResult || !qobuzResult.albums || !qobuzResult.albums.items)
            return [];

        return qobuzResult.albums.items.map(function (qobuzAlbum) {
            var title = qobuzAlbum.title + ' (' + new Date(qobuzAlbum.released_at * 1000).getFullYear() + ')';
            return navigation.item('folder', title, qobuzAlbum.artist.name, "", qobuzAlbum.image.small, "", uriRoot + qobuzAlbum.id);
        });
    };

    var qobuzPlaylistsToNavItems = function (uriRoot, qobuzResult) {
        if (!qobuzResult || !qobuzResult.playlists || !qobuzResult.playlists.items)
            return [];

        return qobuzResult.playlists.items.map(function (qobuzPlaylist) {
            return navigation.item("folder", qobuzPlaylist.name, qobuzPlaylist.owner.name, qobuzPlaylist.description, qobuzPlaylist.images[0], "", uriRoot + qobuzPlaylist.id);
        });
    };

    var qobuzGenresToNavItems = function (qobuzResult) {
        if (!qobuzResult || !qobuzResult.genres || !qobuzResult.genres.items)
            return [];

        return qobuzResult.genres.items.map(function (qobuzGenre) {
            return navigation.item("folder", qobuzGenre.name, "", "", "", "fa fa-filter", "qobuz/genre/" + qobuzGenre.id);
        });
    };

    var qobuzTracksToNavItems = function (qobuzResult) {
        if (!qobuzResult || !qobuzResult.tracks || !qobuzResult.tracks.items)
            return [];

        return qobuzResult.tracks.items.map(function (qobuzTrack) {
            return navigation.item('song', qobuzTrack.title, qobuzTrack.album.artist.name, qobuzTrack.album.title, qobuzTrack.album.image.small, "", "qobuz/track/" + qobuzTrack.id);
        });
    };

    var qobuzAlbumTracksToNavItems = function (qobuzAlbum) {
        if (!qobuzAlbum || !qobuzAlbum.tracks || !qobuzAlbum.tracks.items)
            return [];

        return qobuzAlbum.tracks.items.map(function (qobuzTrack) {
            return navigation.item('song', qobuzTrack.title, qobuzAlbum.artist.name, qobuzAlbum.title, qobuzAlbum.image.small, "", "qobuz/track/" + qobuzTrack.id);
        });
    };

    var qobuzArtistsToNavItems = function (uriRoot, qobuzResult) {
        if (!qobuzResult || !qobuzResult.artists || !qobuzResult.artists.items)
            return [];

        return qobuzResult.artists.items.map(function (qobuzArtist) {
            return navigation.item("folder", qobuzArtist.name, qobuzArtist.name, "", qobuzArtist.picture || "", "fa fa-user", uriRoot + qobuzArtist.id);
        });
    };

    var qobuzResultToTrack = function (qobuzTrack, qobuzTrackUrl, qobuzAlbum) {
        return {
            service: 'qobuz',
            type: 'track',
            name: qobuzTrack.title,
            title: qobuzTrack.title + '?',
            artist: qobuzAlbum.artist.name,
            album: qobuzAlbum.title,
            duration: qobuzTrack.duration,
            albumart: qobuzAlbum.image.small,
            uri: 'qobuz/track/' + qobuzTrack.id,
            samplerate: '',
            bitdepth: '',
            trackType: ''
        };
    };

    var track = function (trackId) {
        return api.getTrack(trackId)
            .then(function (results) {
                return qobuzResultToTrack(results, {}, results.album);
            })
            .fail(function (e) {
                libQ.reject(new Error());
            });
    };

    var trackUrl = function (trackId) {
        return api.getTrackUrl(trackId)
            .then(function (results) {
                return {
                    uri: results.url,
                    bitdepth: results.bit_depth ? results.bit_depth + " bit" : "",
                    samplerate: results.sampling_rate ? results.sampling_rate + " kHz" : "320 kbps",
                    trackType: results.mime_type.split('/')[1].replace('mpeg', 'mp3')
                };
            })
            .fail(function (e) {
                libQ.reject(new Error());
            });
    };

    var album = function (albumId) {
        return api.getAlbum(albumId)
            .then(function (result) {
                return result.tracks.items.map(function (qobuzTrack) {
                    return qobuzResultToTrack(qobuzTrack, {}, result);
                });
            })
            .fail(function (e) {
                libQ.reject(new Error());
            });
    };

    var playlist = function (playlistId) {
        return api.getPlaylist(playlistId)
            .then(function (result) {
                return result.tracks.items.map(function (qobuzTrack) {
                    return qobuzResultToTrack(qobuzTrack, {}, qobuzTrack.album);
                });
            })
            .fail(function (e) { libQ.reject(new Error()); });
    };

    var fieldSorter = function (sortBy) {
        var fields = [];

        switch (sortBy) {
            case "title":
                fields = ["title"];
                break;
            case "artistTitle":
                fields = ["artist", "title"];
                break;
        }

        return (a, b) => fields.map(o => {
            let dir = 1;
            if (o[0] === '-') { dir = -1; o = o.substring(1); }
            return a[o] > b[o] ? dir : a[o] < b[o] ? -(dir) : 0;
        }).reduce((p, n) => p ? p : n, 0);
    };
}

QobuzService.login = function (logger, username, password, apiArgs) {
    if (!username || username.length === 0 || !password || password.length === 0)
        return libQ.reject(new Error());

    return qobuzApi
        .login(logger, username, password, apiArgs)
        .then(function (result) {
            if (result.user_auth_token && result.user_auth_token.length > 0) {
                return result.user_auth_token;
            }
            else {
                libQ.reject(new Error());
            }
        })
        .fail(function (e) { libQ.reject(new Error()); });
};