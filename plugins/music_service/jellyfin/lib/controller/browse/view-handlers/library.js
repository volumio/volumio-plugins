'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin')
const ExplodableViewHandler = require(__dirname + '/explodable');

class LibraryViewHandler extends ExplodableViewHandler {

    browse() {
        let self = this;
        let defer = libQ.defer();
        let baseUri = self.getUri();
        let prevUri = self.constructPrevUri();
        let view = self.getCurrentView();
        let libraryId = self.getCurrentView().parentId;
        
        let listPromises = [
            self._getTopLevelItems(libraryId, baseUri)
        ];

        if (jellyfin.getConfigValue('showLatestMusicSection', true)) {
            listPromises.push(self._getLatestMusic(libraryId, baseUri));
        }
        if (jellyfin.getConfigValue('showRecentlyPlayedSection', true)) {
            listPromises.push(self._getRecentlyPlayed(libraryId, baseUri));
        }
        if (jellyfin.getConfigValue('showFrequentlyPlayedSection', true)) {
            listPromises.push(self._getFrequentlyPlayed(libraryId, baseUri));
        }
        if (jellyfin.getConfigValue('showFavoriteArtistsSection', true)) {
            listPromises.push(self._getFavoriteArtists(libraryId, baseUri));
        }
        if (jellyfin.getConfigValue('showFavoriteAlbumsSection', true)) {
            listPromises.push(self._getFavoriteAlbums(libraryId, baseUri));
        }
        if (jellyfin.getConfigValue('showFavoriteSongsSection', true)) {
            listPromises.push(self._getFavoriteSongs(libraryId, baseUri));
        }

        libQ.all(listPromises).then( (lists) => {
            let finalLists = [];
            lists.forEach( (list) => {
                if (list.items.length) {
                    finalLists.push(list);
                }
            });
            return {
                prev: {
                    uri: prevUri
                },
                lists: finalLists
            }
        })
        .then( nav => self.setPageTitle(view, nav) )
        .then( nav => {
            defer.resolve({
                navigation: nav
            });
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    _getTopLevelItems(libraryId, baseUri) {
        let self = this;
        let defer = libQ.defer();
        let userViewModel = self.getModel('userView');
        let baseImgPath = 'music_service/jellyfin/assets/images/';

        userViewModel.getUserView(libraryId).then( (userView) => {
            return userView.Name;
        }).then( (userViewTitle) => {
            let items = [
                {
                    service: 'jellyfin',
                    type: 'folder',
                    title: jellyfin.getI18n('JELLYFIN_ALBUMS'),
                    uri: baseUri + '/albums@parentId=' + libraryId,
                    albumart: '/albumart?sourceicon=' + baseImgPath + 'album.png'
                },
                {
                    service: 'jellyfin',
                    type: 'streaming-category',
                    title: jellyfin.getI18n('JELLYFIN_ALBUM_ARTISTS'),
                    uri: baseUri + '/albumArtists@parentId=' + libraryId,
                    albumart: '/albumart?sourceicon=' + baseImgPath + 'avatar.png'
                },
                {
                    service: 'jellyfin',
                    type: 'streaming-category',
                    title: jellyfin.getI18n('JELLYFIN_ARTISTS'),
                    uri: baseUri + '/artists@parentId=' + libraryId,
                    albumart: '/albumart?sourceicon=' + baseImgPath + 'avatar.png'
                },
                {
                    service: 'jellyfin',
                    type: 'streaming-category',
                    title: jellyfin.getI18n('JELLYFIN_GENRES'),
                    uri: baseUri + '/genres@parentId=' + libraryId,
                    albumart: '/albumart?sourceicon=' + baseImgPath + 'genre.png'
                },
                {
                    service: 'jellyfin',
                    type: 'folder',
                    title: jellyfin.getI18n('JELLYFIN_ALL_SONGS'),
                    uri: baseUri + '/songs@parentId=' + libraryId,
                    albumart: '/albumart?sourceicon=' + baseImgPath + 'song.png'
                }
            ];

            defer.resolve({
                title: userViewTitle,
                availableListViews: ['list', 'grid'],
                items: items
            });
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    _getLatestMusic(libraryId, baseUri) {
		let options = this.getModelOptions({
			parentId: libraryId,
			sortBy: 'DateCreated,SortName',
			sortOrder: 'Descending,Ascending',
			limit: jellyfin.getConfigValue('latestMusicSectionItems', 11)
        });
        let moreUri = baseUri + '/albums@parentId=' + libraryId + '@sortBy=DateCreated,SortName@sortOrder=Descending,Ascending@fixedView=latest';
        
		return this._getAlbumList(options, jellyfin.getI18n('JELLYFIN_LATEST_ALBUMS'), moreUri);
    }

    _getRecentlyPlayed(libraryId, baseUri) {
        let options = this.getModelOptions({
            parentId: libraryId,
            sortBy: 'DatePlayed,SortName',
            sortOrder: 'Descending,Ascending',
            filters: 'IsPlayed',
            limit: jellyfin.getConfigValue('recentlyPlayedSectionItems', 5)
        });
        let moreUri = baseUri + '/songs@parentId=' + libraryId + '@sortBy=DatePlayed,SortName@sortOrder=Descending,Ascending@filters=IsPlayed@fixedView=recentlyPlayed';
        
        return this._getSongList(options, jellyfin.getI18n('JELLYFIN_RECENTLY_PLAYED_SONGS'), moreUri);
    }

    _getFrequentlyPlayed(libraryId, baseUri) {
        let options = this.getModelOptions({
            parentId: libraryId,
            sortBy: 'PlayCount,SortName',
            sortOrder: 'Descending,Ascending',
            filters: 'IsPlayed',
            limit: jellyfin.getConfigValue('frequentlyPlayedSectionItems', 5)
        });
        let moreUri = baseUri + '/songs@parentId=' + libraryId + '@sortBy=PlayCount,SortName@sortOrder=Descending,Ascending@filters=IsPlayed@fixedView=frequentlyPlayed';
        
        return this._getSongList(options, jellyfin.getI18n('JELLYFIN_FREQUENTLY_PLAYED_SONGS'), moreUri);
    }

    _getFavoriteArtists(libraryId, baseUri) {
        let options = this.getModelOptions({
            parentId: libraryId,
            filters: 'IsFavorite',
            limit: jellyfin.getConfigValue('favoriteArtistsSectionItems', 5),
        });
        let moreUri = baseUri + '/artists@parentId=' + libraryId + '@filters=IsFavorite@fixedView=favorite';

        return this._getArtistList(options, jellyfin.getI18n('JELLYFIN_FAVORITE_ARTISTS'), moreUri);
    }

    _getFavoriteAlbums(libraryId, baseUri) {
        let options = this.getModelOptions({
            parentId: libraryId,
            filters: 'IsFavorite',
            limit: jellyfin.getConfigValue('favoriteAlbumsSectionItems', 5),
        });
        let moreUri = baseUri + '/albums@parentId=' + libraryId + '@filters=IsFavorite@fixedView=favorite';

        return this._getAlbumList(options, jellyfin.getI18n('JELLYFIN_FAVORITE_ALBUMS'), moreUri);
    }

    _getFavoriteSongs(libraryId, baseUri) {
        let options = this.getModelOptions({
            parentId: libraryId,
            filters: 'IsFavorite',
            limit: jellyfin.getConfigValue('favoriteSongsSectionItems', 5),
        });
        let moreUri = baseUri + '/songs@parentId=' + libraryId + '@filters=IsFavorite@fixedView=favorite';

        return this._getSongList(options, jellyfin.getI18n('JELLYFIN_FAVORITE_SONGS'), moreUri);
    }

    _getAlbumList(options, title, moreUri) {
        let self = this;
    	let defer = libQ.defer();
    	
        let model = self.getModel('album');
        let parser = self.getParser('album');

		model.getAlbums(options).then( (albums) => {
            let items = [];

            albums.items.forEach( (album) => {
                items.push(parser.parseToListItem(album));
            });

            self._addMoreItem(items, albums.total, moreUri);

            defer.resolve({
                title: title,
                availableListViews: ['list', 'grid'],
            	items: items
            });
		}).fail( (error) => { // return empty list
			defer.resolve({
				items: [],
			});
		});

		return defer.promise;
    }

    _getSongList(options, title, moreUri) {
        let self = this;
    	let defer = libQ.defer();
    	
        let model = self.getModel('song');
        let parser = self.getParser('song');

        model.getSongs(options).then( (songs) => {
            let items = [];

            songs.items.forEach( (song) => {
                items.push(parser.parseToListItem(song));
            });

            self._addMoreItem(items, songs.total, moreUri);

            defer.resolve({
                title: title,
                availableListViews: ['list', 'grid'],
                items: items
            });
        }).fail( (error) => { // return empty list
			defer.resolve({
				items: [],
			});
        });
        
        return defer.promise;
    }

    _getArtistList(options, title, moreUri) {
        let self = this;
    	let defer = libQ.defer();
    	
        let model = self.getModel('artist');
        let parser = self.getParser('artist');

		model.getArtists(options).then( (artists) => {
            let items = [];

            artists.items.forEach( (artist) => {
                items.push(parser.parseToListItem(artist));
            });

            self._addMoreItem(items, artists.total, moreUri);

            defer.resolve({
                title: title,
                availableListViews: ['list', 'grid'],
            	items: items
            });
		}).fail( (error) => { // return empty list
			defer.resolve({
				items: [],
			});
		});

		return defer.promise;
    }

    _addMoreItem(items, total, moreUri) {
        if (items.length < total) {
            items.push(this.constructNextPageItem(moreUri, "<span style='color: #7a848e;'>" + jellyfin.getI18n('JELLYFIN_VIEW_MORE') + "</span>"));
        }
    }

    getSongsOnExplode() {
        let libraryId = this.getCurrentView().parentId;
        let uri = `${ this.getUri() }/songs@parentId=${ libraryId }`;
        let getHandler = require(jellyfinPluginLibRoot + '/controller/browse/view-handlers/factory').getHandler(uri);

        return getHandler.then( handler => handler.getSongsOnExplode() );
    }
}

module.exports = LibraryViewHandler;