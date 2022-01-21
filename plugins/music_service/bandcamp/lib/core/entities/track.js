'use strict';

class Track {

    constructor(url, name, duration, thumbnail, streamUrl, artist, album) {
        this.type = 'track';
        this.url = url;
        this.name = name;
        this.duration = duration;
        this.thumbnail = thumbnail;
        this.streamUrl = streamUrl;
        this.album = album;
        this.artist = artist;
    }

}

module.exports = Track;