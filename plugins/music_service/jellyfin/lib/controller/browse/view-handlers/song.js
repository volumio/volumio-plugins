'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const ExplodableViewHandler = require(__dirname + '/explodable');

class SongViewHandler extends ExplodableViewHandler {

    browse() {
        let self = this;
        let defer = libQ.defer();

        let model = self.getModel('song');
        let parser = self.getParser('song');

        let prevUri = self.constructPrevUri();
        
        let view = self.getCurrentView();
        let albumId = view.albumId;
        let playlistId = view.playlistId;
      
        let isAlbum = (albumId != undefined);
        let isPlaylist = (playlistId != undefined);
        let listViewOnly = (isAlbum || isPlaylist);

        let pagination;
        if ( (isAlbum && jellyfin.getConfigValue('showAllAlbumTracks', true)) || 
             (isPlaylist && jellyfin.getConfigValue('showAllPlaylistTracks', true)) ) {
            pagination = false;
        }
        else {
            pagination = true;
        }

        self._handleFilters().then( result => {
            let lists = result.filterList;
            let options = result.modelOptions;
            return model.getSongs(options).then( (songs) => {
                let items = [];
                songs.items.forEach( (song) => {
                    items.push(parser.parseToListItem(song));
                });
                if (pagination && (songs.startIndex + songs.items.length) < songs.total) {
                    items.push(self.constructNextPageItem(self.constructNextUri()));
                }
                if (items.length == 0) {
                    listViewOnly = true;
                }
                lists.push({
                    availableListViews: listViewOnly ? ['list'] : ['list', 'grid'],
                    items: items
                });
                return {
                    prev: {
                        uri: prevUri
                    },
                    lists
                };
            });
        }).then( (nav) => {
            let header, headerParser;
            if (isAlbum) {
                let albumModel = self.getModel('album');
                header = albumModel.getAlbum(albumId);
                headerParser = self.getParser('album');
            }
            else if (isPlaylist) {
                let playlistModel = self.getModel('playlist');
                header = playlistModel.getPlaylist(playlistId);
                headerParser = self.getParser('playlist');
            }

            if (header) {
                let headerDefer = libQ.defer();

                header.then( (parentInfo) => {
                    nav.info = headerParser.parseToHeader(parentInfo);
                }).fin( () => {
                    headerDefer.resolve(nav);
                });

                return headerDefer.promise;
            }
            else {
                return self.setPageTitle(view, nav);
            }
        }).then( (nav) => {
            defer.resolve({
                navigation: nav
            });
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    getSongsOnExplode() {
        let self = this;

        let view = self.getCurrentView();
        let model = self.getModel('song');

        if (view.name === 'song') {           
            return model.getSong(view.songId);
        }
        else if (view.name === 'songs') {
            return self._handleFilters().then( r => {
                let options = Object.assign({}, r.modelOptions, {
                    includeMediaSources: true,
                    limit: jellyfin.getConfigValue('maxTracks', 100)
                });

                if (view.albumId != undefined) {
                    options.parentId = view.albumId;
    
                    if (jellyfin.getConfigValue('noMaxTracksSingleAlbum', true)) {
                        delete options.limit;
                    }
                }
                else if (view.playlistId != undefined) {
                    options.parentId = view.playlistId;
    
                    if (jellyfin.getConfigValue('noMaxTracksSinglePlaylist', true)) {
                        delete options.limit;
                    }
                }

                return model.getSongs(options).then( result => result.items );
            });
        }
        else {
            // Should never reach here, but just in case...
            return libQ.reject('View name is ' + view.name + ' but handler is for song');
        }
    }

    // Returns: 1. Filter list  2. Model options
    _handleFilters() {
        let self = this;
        let view = self.getCurrentView();
        let albumId = view.albumId;
        let playlistId = view.playlistId;
        let isAlbum = (albumId != undefined);
        let isPlaylist = (playlistId != undefined);

        let showFilters = view.fixedView == undefined && view.search == undefined && 
        !isAlbum && !isPlaylist;
        let filterListPromise;
        
        if (showFilters) {
            let saveFiltersKey = `${ view.parentId }.song`;
            self.saveFilters(saveFiltersKey);
            filterListPromise = self.getFilterList(saveFiltersKey, 'sort', 'filter', 'genre', 'year');
        }
        else {
            filterListPromise = libQ.resolve(null);
        }
        
        return filterListPromise.then( result => {
            let lists, options;
            if (result) {
                lists = result.list;
                options = self.getModelOptions(Object.assign({}, view, result.selection));
            }
            else {
                lists = [];
                options = self.getModelOptions();
            }

            if (isAlbum) {
                options.parentId = albumId;

                if (jellyfin.getConfigValue('showAllAlbumTracks', true)) {
                    delete options.limit;
                }
            }
            else if (isPlaylist) {
                options.parentId = playlistId;

                if (jellyfin.getConfigValue('showAllPlaylistTracks', true)) {
                    delete options.limit;
                }
            }

            return {
                filterList: lists,
                modelOptions: options
            }
        });
    }

}

module.exports = SongViewHandler;