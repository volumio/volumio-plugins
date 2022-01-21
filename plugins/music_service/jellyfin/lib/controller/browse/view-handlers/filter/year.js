'use strict';

const FilterViewHandler = require(__dirname + '/base');

class YearFilterViewHandler extends FilterViewHandler {

    getType() {
        return 'year';
    }

}

module.exports = YearFilterViewHandler;