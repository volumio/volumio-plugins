'use strict';

const bcfetch = require('bandcamp-fetch');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseModel = require(__dirname + '/base');
const ObjectHelper = require(bandcampPluginLibRoot + '/helper/object');
const Album = require(bandcampPluginLibRoot + '/core/entities/album.js');
const Artist = require(bandcampPluginLibRoot + '/core/entities/artist.js');

class TagModel extends BaseModel {

    getReleasesByTag(options) {
        return this.getItems(options);
    }

    getReleasesByTagFilterOptions(tagUrl) {
        return bandcamp.getCache().cacheOrPromise(this.getCacheKeyForFetch('releasesByTagFilterOptions'/*, {tagUrl}*/), () => {
            return bcfetch.limiter.getReleasesByTagFilterOptions(tagUrl);
        });
    }

    getTags() {
        return bandcamp.getCache().cacheOrPromise(this.getCacheKeyForFetch('tags'), () => {
            return bcfetch.limiter.getTags();
        });
    }

    getTag(tagUrl) {
        return bandcamp.getCache().cacheOrPromise(this.getCacheKeyForFetch('tag', {tagUrl}), () => {
            return bcfetch.limiter.getTagInfo(tagUrl);
        });
    }

    getFetchPromise(options) {
        let self = this;
        let page = options.pageToken || 1;

        let cacheKeyParams = ObjectHelper.assignProps(
            { page }, options, 
            ['tagUrl', 'filters']);
        if (cacheKeyParams.filters) {
            cacheKeyParams.filters = JSON.stringify(cacheKeyParams.filters);
        }
        return bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('releasesByTag', cacheKeyParams), () => {
            let queryParams = {
                filters: options.filters,
                page
            }
            return bcfetch.limiter.getReleasesByTag(options.tagUrl, queryParams, {
                imageFormat: self.getAlbumImageFormat(),
                useHardcodedDefaultFilters: true
            });
        });
    }

    getItemsFromFetchResult(result, options) {
        return result.items.slice(0);
    }

    getNextPageTokenFromFetchResult(result, options) {
        let page = options.pageToken || 1;
        if (result.items.length > 0 && result.hasMore) {
            return page + 1;
        }
        else {
            return null;
        }
    }

    convertToEntity(item, options) {
        switch(item.type) {
            case 'album':
                return new Album(item.url, item.name, item.imageUrl, new Artist(item.artist.url, item.artist.name), undefined, item.featuredTrack);
            case 'track':
                return new Track(item.url, item.name, undefined, item.imageUrl, undefined, new Artist(item.artist.url, item.artist.name));
            default:
                return null;
        }
    }

    beforeResolve(results, lastFetchResult) {
        results.filters = lastFetchResult.filters;
        return results;
    }

}

module.exports = TagModel;