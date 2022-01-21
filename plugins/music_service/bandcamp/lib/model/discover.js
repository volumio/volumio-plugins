'use strict';

const bcfetch = require('bandcamp-fetch');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseModel = require(__dirname + '/base');
const ObjectHelper = require(bandcampPluginLibRoot + '/helper/object');
const Album = require(bandcampPluginLibRoot + '/core/entities/album.js');
const Artist = require(bandcampPluginLibRoot + '/core/entities/artist.js');

class DiscoverModel extends BaseModel {

    getDiscoverResults(options) {
        return this.getItems(options);
    }

    getDiscoverOptions() {
        return bandcamp.getCache().cacheOrPromise(this.getCacheKeyForFetch('discoverOptions'), () => {
            return bcfetch.limiter.getDiscoverOptions();
        });
    }

    getFetchPromise(options) {
        let self = this;
        let page = 0;
        if (options.pageToken) {
            let parsedPageToken = JSON.parse(options.pageToken);
            page = ObjectHelper.getProp(parsedPageToken, 'page', 0);
        }

        let queryParams = ObjectHelper.assignProps(
            { page }, options, 
            ['genre', 'subgenre', 'sortBy', 'artistRecommendationType', 
            'location', 'format', 'time']);
        
        return bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('discover', queryParams), () => {
            return bcfetch.limiter.discover(queryParams, {
                albumImageFormat: self.getAlbumImageFormat(),
                artistImageFormat: self.getArtistImageFormat()
            });
        });
    }

    getItemsFromFetchResult(result, options) {
        return result.items.slice(0);
    }

    getNextPageTokenFromFetchResult(result, options) {
        let page = 0, indexRef = 0;
        if (options.pageToken) {
            let parsedPageToken = JSON.parse(options.pageToken);
            page = ObjectHelper.getProp(parsedPageToken, 'page', 0);
            indexRef = ObjectHelper.getProp(parsedPageToken, 'indexRef', 0);
        }
        if (result.items.length > 0 && result.total > indexRef + result.items.length) {
            let nextPageToken = {
                page: page + 1,
                indexRef: indexRef + result.items.length
            };
            return JSON.stringify(nextPageToken);
        }
        else {
            return null;
        }
    }

    convertToEntity(item, options) {
        let artist = new Artist(item.artist.url, item.artist.name, item.artist.imageUrl);
        return new Album(item.url, item.name, item.imageUrl, artist);
    }

    beforeResolve(results, lastFetchResult) {
        results.params = lastFetchResult.params;
        delete results.params.page;
        return results;
    }

}

module.exports = DiscoverModel;