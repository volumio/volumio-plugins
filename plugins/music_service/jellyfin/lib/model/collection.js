'use strict';

const BaseModel = require(__dirname + '/base');

class CollectionModel extends BaseModel {

    getCollections(options = {}, tag = '') {
        options = Object.assign({}, options, {
            recursive: false,
            sortBy: 'IsFolder,SortName',
            sortOrder: 'Ascending'
        });
        let queryOptions = this.getBaseQueryOptions(options);
        return this.getItems(queryOptions, tag);
    }

    getAlbums(options = {}, tag = '') {
        let queryOptions = this.getBaseQueryOptions(this._assignOptions(options), 'MusicAlbum');
        return this.getItems(queryOptions, tag);
    }

    getArtists(options = {}, tag = '') {
        let queryOptions = this.getBaseQueryOptions(this._assignOptions(options), 'MusicArtist');
        return this.getItems(queryOptions, tag);
    }

    getSongs(options = {}, tag = '') {
        let queryOptions = this.getBaseQueryOptions(this._assignOptions(options), 'Audio');
        return this.getItems(queryOptions, tag);
    }

    getPlaylists(options = {}, tag = '') {
        /**
         * We can't use something like this as we did for albums and artists:
         * 
         * let queryOptions = this.getBaseQueryOptions(this._assignOptions(options), 'Playlist');
         * 
         * Jellyfin will somehow return the wrong data. Instead, we use ExcludeItemTypes.
         * We assume the items returned are playlists, because it seems you can only add
         * Albums, Artists and Playlists to a Collection.
         */
        let queryOptions = this.getBaseQueryOptions(this._assignOptions(options));
        queryOptions.ExcludeItemTypes = 'MusicAlbum,MusicArtist,Audio';
        return this.getItems(queryOptions, tag);
    }

    _assignOptions(options) {
        return Object.assign({}, options, {
            recursive: false,
            sortBy: '',
            sortOrder: ''
        });
    }

    getCollection(collectionId) {
        return this.getItem(collectionId);
    }

}

module.exports = CollectionModel;