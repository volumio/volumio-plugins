'use strict';

const bcfetch = require('bandcamp-fetch');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseModel = require(__dirname + '/base');
const Album = require(bandcampPluginLibRoot + '/core/entities/album.js');
const Artist = require(bandcampPluginLibRoot + '/core/entities/artist.js');
const Track = require(bandcampPluginLibRoot + '/core/entities/track.js');

class DiscographyModel extends BaseModel {

    getDiscography(options) {
        return this.getItems(options);
    }

    getFetchPromise(options) {
        let self = this;
        let url = options.artistOrLabelUrl;
        return bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('discography', { artistOrLabelUrl: url }), () => {
            return bcfetch.limiter.getDiscography(url, {
                imageFormat: self.getArtistImageFormat()
            });
        });
    }

    getItemsFromFetchResult(result, options) {
        return result.slice(0);
    }

    convertToEntity(item, options) {
        switch(item.type) {
            case 'album':
                return new Album(item.url, item.name, item.imageUrl, new Artist(undefined, item.artist));
            case 'track':
                return new Track(item.url, item.name, undefined, item.imageUrl, undefined, new Artist(undefined, item.artist), item.album ? new Album(undefined, item.album) : null);
            default:
                return null;
        }
    }

}

module.exports = DiscographyModel;