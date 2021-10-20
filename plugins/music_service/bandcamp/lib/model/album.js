'use strict';

const libQ = require('kew');
const bcfetch = require('bandcamp-fetch');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseModel = require(__dirname + '/base');
const Album = require(bandcampPluginLibRoot + '/core/entities/album.js');
const Artist = require(bandcampPluginLibRoot + '/core/entities/artist.js');
const Track = require(bandcampPluginLibRoot + '/core/entities/track.js');

class AlbumModel extends BaseModel {

    getAlbum(albumUrl) {
        let self = this;
        let defer = libQ.defer();

        bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('album', { albumUrl }), () => {
            return bcfetch.limiter.getAlbumInfo(albumUrl, {
                albumImageFormat: self.getAlbumImageFormat(),
                artistImageFormat: self.getArtistImageFormat(),
                includeRawData: false
            });
        }).then( (info) => {
            let artist = new Artist(info.artist.url, info.artist.name, info.artist.imageUrl, info.location);
            let album = new Album(info.url, info.name, info.imageUrl, artist);
            let tracks = [];
            info.tracks.forEach( (track) => {
                tracks.push(new Track(track.url, track.name, track.duration, info.imageUrl, track.streamUrl, artist, album));
            });
            album.tracks = tracks;
            if (info.releaseDate) {
                let d = new Date(info.releaseDate);
                album.releaseDate = d.toLocaleDateString();
            }

            self._cacheTracks(tracks);

            defer.resolve(album);
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    _cacheTracks(tracks) {
        tracks.forEach( (track) => {
            bandcamp.getCache().put(this.getCacheKeyForFetch('track', { trackUrl: track.url }), track);
        });
    }
}

module.exports = AlbumModel;