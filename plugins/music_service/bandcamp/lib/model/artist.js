'use strict';

const libQ = require('kew');
const bcfetch = require('bandcamp-fetch');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseModel = require(__dirname + '/base');
const Artist = require(bandcampPluginLibRoot + '/core/entities/artist.js');
const Label = require(bandcampPluginLibRoot + '/core/entities/label.js');

class ArtistModel extends BaseModel {

    getArtists(options) {
        if (options.labelUrl) {
            return this.getItems(options);
        }
        return libQ.resolve([]);
    }

    getArtist(artistUrl) {
        let self = this;
        let defer = libQ.defer();

        bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('artist', { artistUrl }), () => {
            return bcfetch.limiter.getArtistOrLabelInfo(artistUrl, {
                imageFormat: self.getArtistImageFormat()
            });
        }).then( (info) => {
            let artist = new Artist(info.url, info.name, info.imageUrl, info.location);
            if (info.label) {
                artist.label = new Label(info.label.url, info.label.name);
            }
            artist.isLabel = info.type === 'label';
            defer.resolve(artist);
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    getFetchPromise(options) {
        let self = this;
        return bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('artists', { labelUrl: options.labelUrl }), () => {
            return bcfetch.limiter.getLabelArtists(options.labelUrl, {
                imageFormat: self.getArtistImageFormat()
            });
        });
    }

    getItemsFromFetchResult(result, options) {
        return result.slice(0);
    }

    convertToEntity(item, options) {
        return new Artist(item.url, item.name, item.imageUrl, item.location);
    }

}

module.exports = ArtistModel;