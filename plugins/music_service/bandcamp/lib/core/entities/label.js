'use strict';

class Label {

    constructor(url, name, thumbnail, location) {
        this.type = 'label';
        this.url = url;
        this.name = name;
        this.thumbnail = thumbnail;
        this.location = location;
    }

}

module.exports = Label;