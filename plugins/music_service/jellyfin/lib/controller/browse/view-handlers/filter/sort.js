'use strict';

const FilterViewHandler = require(__dirname + '/base');

class AZFilterViewHandler extends FilterViewHandler {

    getType() {
        return 'sort';
    }

}

module.exports = AZFilterViewHandler;