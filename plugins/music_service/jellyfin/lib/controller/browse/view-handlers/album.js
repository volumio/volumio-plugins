'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const ExplodableViewHandler = require(__dirname + '/explodable');

class AlbumViewHandler extends ExplodableViewHandler {

    browse() {
        let self = this;
        let defer = libQ.defer();

        let prevUri = self.constructPrevUri();
        let nextUri = self.constructNextUri();
        
        let view = self.getCurrentView();
        let model = self.getModel('album');
        let parser = self.getParser('album');

        self._handleFilters().then( result => {
            let lists = result.filterList;
            let options = result.modelOptions;
            return model.getAlbums(options).then( (albums) => {
                let items = [];
                albums.items.forEach( (album) => {
                    items.push(parser.parseToListItem(album));
                });
                if (albums.startIndex + albums.items.length < albums.total) {
                    items.push(self.constructNextPageItem(nextUri));
                }
                lists.push({
                    availableListViews: items.length > 0 ? ['list', 'grid'] : ['list'],
                    items: items
                });
                return {
                    prev: {
                        uri: prevUri
                    },
                    lists
                };
            });
        }).then ( (nav) => {
            let header, headerParser;
            if (view.artistId != undefined) {
                let artistModel = self.getModel('artist');
                header = artistModel.getArtist(view.artistId);
                headerParser = self.getParser('artist');
            }
            else if (view.albumArtistId != undefined) {
                let albumArtistModel = self.getModel('albumArtist');
                header = albumArtistModel.getAlbumArtist(view.albumArtistId);
                headerParser = self.getParser('albumArtist');
            }
            else if (view.genreId != undefined) {
                let genreModel = self.getModel('genre');
                header = genreModel.getGenre(view.genreId);
                headerParser = self.getParser('genre');
            }

            if (header) {
                let headerDefer = libQ.defer();

                header.then( (headerItem) => {
                    nav.info = headerParser.parseToHeader(headerItem)
                })
                .fin( () => {
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
        let trackLimit = jellyfin.getConfigValue('maxTracks', 100);
        let albumModel = self.getModel('album');
        let songModel = self.getModel('song');
        let songModelOptions = { includeMediaSources: true };
        let result = [];

        // kew Promise to JS promise
        let getAlbumsJS = (options) => {
            return new Promise( (resolve, reject) => {
                albumModel.getAlbums(options).then( r => {
                    resolve(r);
                })
                .fail( error => {
                    reject(error);
                });
            });
        };
        let getSongsJS = (albumId) => {
            return new Promise( (resolve, reject) => {
                songModelOptions.parentId = albumId;
                songModel.getSongs(songModelOptions).then( r => {
                    resolve(r);
                })
                .fail( error => {
                    reject(error);
                });
            })
        };

        return self._handleFilters().then( async r => {
            let albumModelOptions = r.modelOptions;
            albumModelOptions.limit = 50;  // fetch 50 albums at a time

            // Restrict iterations to arbitrary value of 500, so we don't
            // fall into a neverending loop if something goes wrong
            let iterations = 0, albumCount = 0;
            while (iterations < 500) {
                // get albums
                let albums = await getAlbumsJS(albumModelOptions);

                // Fetch songs in each album and add to result (break when trackLimit is reached)
                for (const album of albums.items) {
                    let songs = await getSongsJS(album.Id);
                    result = result.concat(songs.items);
                    albumCount++;
                    if (result.length >= trackLimit) {
                        break;
                    }
                }

                // Stop iteration if trackLimit is reached or no more albums available
                if (result.length >= trackLimit || albums.startIndex + albums.items.length >= albums.total) {
                    result = result.slice(0, trackLimit);
                    break;
                }
                else {
                    albumModelOptions.startIndex = albums.startIndex + albums.items.length;
                    iterations++;
                }
            }

            jellyfin.getLogger().info(`[jellyfin-view-album] getSongsOnExplode(): Fetched ${ result.length } songs from ${ albumCount } albums.`);

            return result;
        });
    }

    // Returns: 1. Filter list  2. Model options
    _handleFilters() {
        let self = this;
        let view = self.getCurrentView();
        let showFilters = view.fixedView == undefined && view.search == undefined && 
            view.artistId == undefined && view.albumArtistId == undefined;
        let filterListPromise;

        if (showFilters) {
            let saveFiltersKey = view.genreId ? 'genreAlbum' : `${ view.parentId }.album`;
            self.saveFilters(saveFiltersKey);
            if (view.genreId) { // coming from Genres view
                filterListPromise = self.getFilterList(saveFiltersKey, 'sort', 'az', 'filter', 'year');
            }
            else {
                filterListPromise = self.getFilterList(saveFiltersKey, 'sort', 'az', 'filter', 'genre', 'year');
            }
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

            return {
                filterList: lists,
                modelOptions: options
            };
        });
    }

}

module.exports = AlbumViewHandler;