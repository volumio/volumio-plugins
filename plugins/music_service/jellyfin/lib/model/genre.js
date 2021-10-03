'use strict';

const BaseModel = require(__dirname + '/base');

class GenreModel extends BaseModel {

    getGenres(options = {}, tag = '') {
        let queryOptions = this.getBaseQueryOptions(options);
        return this.getItems(queryOptions, tag, 'getMusicGenres');
    }

    getGenre(genreId) {
        return this.getItem(genreId);
    }

}

module.exports = GenreModel;