'use strict';

const FilterViewHandler = require(__dirname + '/base');

class GenreFilterViewHandler extends FilterViewHandler {

    getType() {
        return 'genre';
    }

}

module.exports = GenreFilterViewHandler;