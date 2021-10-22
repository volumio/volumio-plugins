'use strict';

const bcfetch = require('bandcamp-fetch');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseModel = require(__dirname + '/base');
const Album = require(bandcampPluginLibRoot + '/core/entities/album.js');
const Artist = require(bandcampPluginLibRoot + '/core/entities/artist.js');
const Label = require(bandcampPluginLibRoot + '/core/entities/label.js');
const Track = require(bandcampPluginLibRoot + '/core/entities/track.js');

class SearchModel extends BaseModel {

    getSearchResults(options) {
        return this.getItems(options);
    }

    getFetchPromise(options) {
        let self = this;
        let page = options.pageToken || 1;
        let queryParams = {
            page,
            query: options.query
        };       
        return bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('search', queryParams), () => {
            return bcfetch.limiter.search(queryParams, {
                albumImageFormat: self.getAlbumImageFormat(),
                artistImageFormat: self.getArtistImageFormat()
            });
        });
    }

    getItemsFromFetchResult(result, options) {
        return result.items.slice(0);
    }

    getNextPageTokenFromFetchResult(result, options) {
        let page = options.pageToken || 1;
        if (page < result.totalPages) {
            return page + 1;
        }
        else {
            return null;
        }
    }

    getFilter(options) {
        return (item) => item.type === 'album' || item.type === 'artist' || item.type === 'label' || item.type === 'track';
    }

    convertToEntity(item, options) {
        switch(item.type) {
            case 'artist':
                return new Artist(item.url, item.name, item.imageUrl, item.location);
            case 'label':
                return new Label(item.url, item.name, item.imageUrl, item.location);
            case 'album':
                return new Album(item.url, item.name, item.imageUrl, new Artist(undefined, item.artist));
            case 'track':
                return new Track(item.url, item.name, undefined, item.imageUrl, undefined, new Artist(undefined, item.artist), item.album ? new Album(undefined, item.album) : null);
            default:
                return null;
        }
    }

}

module.exports = SearchModel;