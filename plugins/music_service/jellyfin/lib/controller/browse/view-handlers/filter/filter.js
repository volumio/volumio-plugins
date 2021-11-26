'use strict';

const FilterViewHandler = require(__dirname + '/base');

class FilterFilterViewHandler extends FilterViewHandler {

    getType() {
        return 'filter';
    }

}

module.exports = FilterFilterViewHandler;