'use strict';

const FilterViewHandler = require(__dirname + '/base');

class AZFilterViewHandler extends FilterViewHandler {

    getType() {
        return 'az';
    }

}

module.exports = AZFilterViewHandler;