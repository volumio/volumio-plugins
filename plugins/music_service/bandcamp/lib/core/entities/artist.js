'use strict';

class Artist {

    constructor(url, name, thumbnail, location, label = null, isLabel = false) {
        this.type = 'artist';
        this.url = url;
        this.name = name;
        this.thumbnail = thumbnail;
        this.location = location;
        this.label = label;
        this.isLabel = isLabel;
    }

}

module.exports = Artist;