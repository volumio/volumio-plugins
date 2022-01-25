'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');

const RootViewHandler = require(__dirname + '/root');
const UserViewViewHandler = require(__dirname + '/userview');
const LibraryViewHandler = require(__dirname + '/library');
const AlbumViewHandler = require(__dirname + '/album');
const ArtistViewHandler = require(__dirname + '/artist');
const AlbumArtistViewHandler = require(__dirname + '/album-artist');
const PlaylistViewHandler = require(__dirname + '/playlist');
const GenreViewHandler = require(__dirname + '/genre');
const SongViewHandler = require(__dirname + '/song');
const CollectionsViewHandler = require(__dirname + '/collections');
const CollectionViewHandler = require(__dirname + '/collection');
const AZFilterViewHandler = require(__dirname + '/filter/az');
const GenreFilterViewHandler = require(__dirname + '/filter/genre');
const YearFilterViewHandler = require(__dirname + '/filter/year');
const FilterFilterViewHandler = require(__dirname + '/filter/filter');
const SortFilterViewHandler = require(__dirname + '/filter/sort');

class ViewHandlerFactory {

    static getHandler(uri) {
        let self = this;
        let defer = libQ.defer();

        let views = self._getViewsFromUri(uri);
        let curView = views.pop();
        let prevViews = views;

        let handler = new self._viewToClass[curView.name](uri, curView, prevViews);

        // If the view to be handled is associated with a server, obtain the server's apiClient 
        // and pass it to the view handler. This step also ensures that the user is authenticated.
        if (curView.serverId != undefined) { 
            let server = self._getAvailableServerById(curView.serverId);
            if (server) {
                self._getApiClient(server).then( (apiClient) => {
                    handler.setApiClient(apiClient);
                    defer.resolve(handler);
                }).fail( (error) => {
                    defer.reject(error);
                });
            }
            else {
                jellyfin.toast('error', jellyfin.getI18n('JELLYFIN_CONN_ERR_SERVER_NOT_FOUND'));
                defer.reject('Server not found');
            }
        }
        else {
            defer.resolve(handler);
        }

        return defer.promise;
    }

    static _getViewsFromUri(uri) {
        let result = [];

        let segments = uri.split('/');
        if (segments.length && segments[0] !== 'jellyfin') {
            return result;
        }

        let splitSegment = (s) => {
            let result = {};
            let ss = s.split('@');
            ss.forEach( (sss) => {
                let equalPos = sss.indexOf('=');
                if (equalPos < 0) {
                    result.name = sss;
                }
                else {
                    let key = sss.substr(0, equalPos);
                    let value = sss.substr(equalPos + 1);
                    
                    if (key === 'startIndex') {
                        value = parseInt(value, 10);
                    }

                    result[key] = value;
                }
            });
            if (result.startIndex == undefined) {
                result.startIndex = 0;
            }

            return result;
        };

        let serverId;
        segments.forEach( (segment, index) => {
            let data;
            if (index === 0) { // 'jellyfin/...'
                data = {
                    name: 'root'
                };
            }
            else if (index === 1) { // 'jellyfin/serverId/...'
                data = {
                    name: 'userViews',
                    serverId: segment
                }
                serverId = segment;
            }
            else {
                data = splitSegment(segment);
                data.serverId = serverId;
            }
            result.push(data);
        });

        return result;
    }

    static _getAvailableServerById(serverId) {
        let availableServers = jellyfin.get('availableServers', []);
        for (let i = 0; i < availableServers.length; i++) {
            if (availableServers[i].getId() === serverId) {
                return availableServers[i];
            }
        }

        return null;
    }

    static _getApiClient(server) {
    	let defer = libQ.defer();
    	
        jellyfin.get('connectionManager').authenticate(server).then( (result) => {
            defer.resolve(result.apiClient);
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }
}

ViewHandlerFactory._viewToClass = {
    'root': RootViewHandler,
    'userViews': UserViewViewHandler,
    'library': LibraryViewHandler,
    'albums': AlbumViewHandler,
    'albumArtists': AlbumArtistViewHandler,
    'artists': ArtistViewHandler,
    'playlists': PlaylistViewHandler,
    'genres': GenreViewHandler,
    'songs': SongViewHandler,
    'song': SongViewHandler,
    'collections': CollectionsViewHandler,
    'collection': CollectionViewHandler,
    'filter.az': AZFilterViewHandler,
    'filter.genre': GenreFilterViewHandler,
    'filter.year': YearFilterViewHandler,
    'filter.filter': FilterFilterViewHandler,
    'filter.sort': SortFilterViewHandler
}

module.exports = ViewHandlerFactory;