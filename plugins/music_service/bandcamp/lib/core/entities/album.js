'use strict';

class Album {

    constructor(url, name, thumbnail, artist, tracks, featuredTrack, releaseDate) {
        this.type = 'album';
        this.url = url;
        this.name = name;
        this.thumbnail = thumbnail;
        this.artist = artist;
        this.tracks = tracks;
        this.featuredTrack = featuredTrack;
        this.releaseDate = releaseDate;
    }

}

module.exports = Album;