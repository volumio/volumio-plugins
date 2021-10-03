'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const Model = require(jellyfinPluginLibRoot + '/model');
const AlbumArtHandler = require(jellyfinPluginLibRoot + '/util/albumart');

class SearchController {

    constructor() {
        this._albumArtHandlers = {};
    }

    search(query) {
        let self = this;
        let defer = libQ.defer();

        let searchAlbums = jellyfin.getConfigValue('searchAlbums', true);
        let searchArtists = jellyfin.getConfigValue('searchArtists', true);
        let searchSongs = jellyfin.getConfigValue('searchSongs', true);

        if (!searchAlbums && !searchArtists && !searchSongs) {
            defer.resolve([]);
        }
        else {
            let safeValue = query.value.replace(/"/g, '\\"');

            let searchItemTypes = {
                album: searchAlbums,
                artist: searchArtists,
                song: searchSongs
            };
            let servers = jellyfin.get('availableServers', []);
            let searchServerPromises = [];
            servers.forEach( (server) => {
                searchServerPromises.push(self._searchServer(server, safeValue, searchItemTypes));
            });

            let searchResultLists = [];
            libQ.all(searchServerPromises).then( (searchServerResults) => {
                searchServerResults.forEach( (result) => {
                    searchResultLists.push(...result);
                });
                defer.resolve(searchResultLists);
            }).fail( (error) => {
                defer.resolve([]);
            });
        }
        
        return defer.promise;
    }

    _searchServer(server, query, searchItemTypes) {
        let self = this;
        let defer = libQ.defer();

        jellyfin.get('connectionManager').authenticate(server).then( (result) => {
            let apiClient = result.apiClient;
            
            let searchItemPromises = [];
            if (searchItemTypes.album) {
                searchItemPromises.push(self._searchAlbum(server, apiClient, query));
            }
            if (searchItemTypes.artist) {
                searchItemPromises.push(self._searchArtist(server, apiClient, query));
            }   
            if (searchItemTypes.song) {
                searchItemPromises.push(self._searchSong(server, apiClient, query));
            }
                
            libQ.all(searchItemPromises).then( (searchResults) => {
                let nonEmpty = searchResults.filter( result => result.items.length );
                defer.resolve(nonEmpty);
            }).fail( (error) => {
                defer.resolve([]);
            })
        }).fail( (error) => {
            defer.resolve([]);
        });

        return defer.promise;
    }

    _searchAlbum(server, apiClient, query) {
        let self = this;
        let defer = libQ.defer();
        let albumModel = Model.getInstance('album', apiClient);

        let options = {
            search: query,
            limit: jellyfin.getConfigValue('searchAlbumsResultCount', 11)
        };
        albumModel.getAlbums(options).then( (albums) => {
            let items = [];
            let moreUri = 'jellyfin/' + server.getId() + '/albums@search=' + encodeURIComponent(query);

            albums.items.forEach( (album) => {
                items.push(self._parseAlbum(server.getId(), apiClient, album));
            });

            self._addMoreItem(items, albums.total, moreUri);

            defer.resolve({
                title: self._getListTitle(jellyfin.getI18n('JELLYFIN_ALBUMS'), server),
                availableListViews: ['list', 'grid'],
            	items: items
            });
        }).fail( (error) => {
            defer.resolve({
				items: [],
			});
        });

        return defer.promise;
    }

    _searchArtist(server, apiClient, query) {
        let self = this;
        let defer = libQ.defer();
        let artistModel = Model.getInstance('artist', apiClient);

        let options = {
            search: query,
            limit: jellyfin.getConfigValue('searchArtistsResultCount', 11)
        };

        artistModel.getArtists(options).then( (artists) => {
            let items = [];
            let moreUri = 'jellyfin/' + server.getId() + '/artists@search=' + encodeURIComponent(query);

            artists.items.forEach( (artist) => {
                items.push(self._parseArtist(server.getId(), apiClient, artist));
            });

            self._addMoreItem(items, artists.total, moreUri);

            defer.resolve({
                title: self._getListTitle(jellyfin.getI18n('JELLYFIN_ARTISTS'), server),
                availableListViews: ['list', 'grid'],
            	items: items
            });
        }).fail( (error) => {
            defer.resolve({
				items: [],
			});
        });

        return defer.promise;
    }

    _searchSong(server, apiClient, query) {
        let self = this;
        let defer = libQ.defer();
        let songModel = Model.getInstance('song', apiClient);

        let options = {
            search: query,
            limit: jellyfin.getConfigValue('searchSongsResultCount', 11)
        };

        songModel.getSongs(options).then( (songs) => {
            let items = [];
            let moreUri = 'jellyfin/' + server.getId() + '/songs@search=' + encodeURIComponent(query);

            songs.items.forEach( (song) => {
                items.push(self._parseSong(server.getId(), apiClient, song));
            });

            self._addMoreItem(items, songs.total, moreUri);

            defer.resolve({
                title: self._getListTitle(jellyfin.getI18n('JELLYFIN_SONGS'), server),
                availableListViews: ['list', 'grid'],
            	items: items
            });
        }).fail( (error) => {
            defer.resolve({
				items: [],
			});
        });

        return defer.promise;
    }

    _parseAlbum(serverId, apiClient, album) {
        let baseUri = 'jellyfin/' + serverId;
        let data = {
            'service': 'jellyfin',
            'type': 'folder',
            'title': album.Name,
            'artist': album.AlbumArtist,
            'albumart': this._getAlbumArt(serverId, apiClient, album),
            'uri': baseUri + '/songs@albumId=' + album.Id
        }
        return data;
    }

    _parseArtist(serverId, apiClient, artist) {
        let baseUri = 'jellyfin/' + serverId;      
        let data = {
            'service': 'jellyfin',
            'type': 'folder',
            'title': artist.Name,
            'albumart': this._getAlbumArt(serverId, apiClient, artist),
            'uri': baseUri + '/albums@artistId=' + artist.Id
        }
        return data;
    }

    _parseSong(serverId, apiClient, song) {
        let baseUri = 'jellyfin/' + serverId;      
        let data = {
            'service': 'jellyfin',
            'type': 'song',
            'title': song.Name,
            'artist': song.Artists.join(', '),
            'album': song.Album,
            'uri': baseUri + '/song@songId=' + song.Id,
            'albumart': this._getAlbumArt(serverId, apiClient, song)
        }

        return data;
    }

    _addMoreItem(items, total, moreUri) {
        if (items.length < total) {
            let data = {
                service: 'jellyfin',
                type: 'streaming-category',
                'title': "<span style='color: #7a848e;'>" + jellyfin.getI18n('JELLYFIN_VIEW_MORE') + "</span>",
                'uri': moreUri,
                'icon': 'fa fa-arrow-circle-right'
            }
            items.push(data);
        }
    }

    _getAlbumArt(serverId, apiClient, item) {
        if (this._albumArtHandlers[serverId] == undefined) {
            this._albumArtHandlers[serverId] = new AlbumArtHandler(apiClient);
        }
        return this._albumArtHandlers[serverId].getAlbumArt(item);
    }

    _getListTitle(itemName, server) {
        let title = jellyfin.getI18n('JELLYFIN_SEARCH_LIST_TITLE', server.getName(), itemName);
        let icon = '<img src="/albumart?sourceicon=' + encodeURIComponent('music_service/jellyfin/assets/images/jellyfin.svg') + '" style="width: 24px; height: 24px; margin-right: 8px;" />';
        return icon + title;
    }
    
}

module.exports = SearchController;