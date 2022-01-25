'use strict';

class Show {

    constructor(url, name, thumbnail, description, date, streamUrl, duration, tracks) {
        this.type = 'show';
        this.url = url;
        this.name = name;
        this.thumbnail = thumbnail;
        this.description = description;
        this.date = date;
        this.streamUrl = streamUrl;
        this.duration = duration;
        this.tracks = tracks;
    }

}

module.exports = Show;