'use strict';

const BaseModel = require(__dirname + '/base');

class AlbumArtistModel extends BaseModel {

    getAlbumArtists(options = {}, tag = '') {
        let queryOptions = this.getBaseQueryOptions(options);
        return this.getItems(queryOptions, tag, 'getAlbumArtists');
    }

    getAlbumArtist(albumArtistId) {
        return this.getItem(albumArtistId);
    }

}

module.exports = AlbumArtistModel;