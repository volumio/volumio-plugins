'use strict';

const libQ = require('kew');
const bcfetch = require('bandcamp-fetch');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseModel = require(__dirname + '/base');
const Artist = require(bandcampPluginLibRoot + '/core/entities/artist');
const Album = require(bandcampPluginLibRoot + '/core/entities/album');
const Track = require(bandcampPluginLibRoot + '/core/entities/track');

class TrackModel extends BaseModel {

    getTrack(trackUrl) {
        let self = this;

        // Unlike other resources, tracks are mapped via convertToEntity()
        // before being cached.
        return bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('track', { trackUrl: trackUrl }), () => {
            return self._doGetTrack(trackUrl);
        });
    }

    _doGetTrack(trackUrl) {
        let self = this;
        let defer = libQ.defer();

        let options = {
            albumImageFormat: self.getAlbumImageFormat(),
            artistImageFormat: self.getArtistImageFormat(),
            includeRawData: false
        };
        bcfetch.limiter.getTrackInfo(trackUrl, options).then( (info) => {
            let artist = new Artist(info.artist.url, info.artist.name, info.artist.imageUrl);
            let album = info.album ? new Album(info.album.url, info.album.name, undefined, artist) : null;
            let track = new Track(info.url, info.name, info.duration, info.imageUrl, info.streamUrl, artist, album);

            defer.resolve(track);
        }).catch( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

}

module.exports = TrackModel;