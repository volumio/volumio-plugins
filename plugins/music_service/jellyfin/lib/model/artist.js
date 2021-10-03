'use strict';

const BaseModel = require(__dirname + '/base');

class ArtistModel extends BaseModel {

    getArtists(options = {}, tag = '') {
        let queryOptions = this.getBaseQueryOptions(options);
        return this.getItems(queryOptions, tag, 'getArtists');
    }

    getArtist(artistId) {
        return this.getItem(artistId);
    }

}

module.exports = ArtistModel;