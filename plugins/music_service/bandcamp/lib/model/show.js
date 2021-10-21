'use strict';

const libQ = require('kew');
const bcfetch = require('bandcamp-fetch');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseModel = require(__dirname + '/base');
const Show = require(bandcampPluginLibRoot + '/core/entities/show.js');
const Album = require(bandcampPluginLibRoot + '/core/entities/album.js');
const Artist = require(bandcampPluginLibRoot + '/core/entities/artist.js');
const Track = require(bandcampPluginLibRoot + '/core/entities/track.js');

class ShowModel extends BaseModel {

    getShows(options) {
        return this.getItems(options);
    }

    getShow(showUrl) {
        let self = this;
        let defer = libQ.defer();

        bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('show', { showUrl }), () => {
            return bcfetch.limiter.getShow(showUrl, {
                albumImageFormat: self.getAlbumImageFormat(),
                artistImageFormat: self.getArtistImageFormat(),
                showImageFormat: self.getAlbumImageFormat()
            });
        }).then( (info) => {
            let show = self.convertToEntity(info);
            let tracks = [];
            info.tracks.forEach( (track) => {
                let artist = new Artist(track.artist.url, track.artist.name, track.artist.imageUrl, track.artist.location);
                let album = track.album ? new Album(track.album.url, track.album.name, track.imageUrl, artist) : null;
                tracks.push(new Track(track.url, track.name, null, track.imageUrl, null, artist, album));
            });
            show.tracks = tracks;

            defer.resolve(show);
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    getFetchPromise(options) {
        let self = this;
        return bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('shows'), () => {
            return bcfetch.limiter.getAllShows({
                showImageFormat: self.getAlbumImageFormat()
            });
        });
    }

    getItemsFromFetchResult(result, options) {
        return result.slice(0);
    }

    convertToEntity(item, options) {
        return new Show(item.url, item.name, item.imageUrl, item.description, this._parseDate(item.publishedDate), item.streamUrl, item.duration);
    }

    _parseDate(dateString) {
        return new Date(Date.parse(dateString)).toLocaleDateString();
    }

}

module.exports = ShowModel;