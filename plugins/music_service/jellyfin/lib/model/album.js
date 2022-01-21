'use strict';

const BaseModel = require(__dirname + '/base');

class AlbumModel extends BaseModel {

    getAlbums(options = {}, tag = '') {
        let queryOptions = this.getBaseQueryOptions(options, 'MusicAlbum');
        return this.getItems(queryOptions, tag);
    }

    getAlbum(albumId) {
        return this.getItem(albumId);
    }

}

module.exports = AlbumModel;