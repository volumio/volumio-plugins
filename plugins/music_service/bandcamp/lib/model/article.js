'use strict';

const bcfetch = require('bandcamp-fetch');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseModel = require(__dirname + '/base');
const ObjectHelper = require(bandcampPluginLibRoot + '/helper/object');
const Article = require(bandcampPluginLibRoot + '/core/entities/article.js');

class ArticleModel extends BaseModel {

    getArticles(options) {
        return this.getItems(options);
    }

    getArticle(articleUrl) {
        let self = this;

        return bandcamp.getCache().cacheOrPromise(this.getCacheKeyForFetch('article', { articleUrl }), () => {
            return bcfetch.limiter.getArticle(articleUrl, {
                albumImageFormat: self.getAlbumImageFormat(),
                artistImageFormat: self.getArtistImageFormat()
            }).then( (articleInfo) => {
                return self.convertToEntity(articleInfo);
            });
        });
    }

    getArticleCategories() {
        return bandcamp.getCache().cacheOrPromise(this.getCacheKeyForFetch('articleCategories'), () => {
            return bcfetch.limiter.getArticleCategories();
        });
    }

    getFetchPromise(options) {
        let self = this;
        let page = 1;
        if (options.pageToken) {
            let parsedPageToken = JSON.parse(options.pageToken);
            page = ObjectHelper.getProp(parsedPageToken, 'page', 1);
        }

        let queryParams = ObjectHelper.assignProps({ page }, options, ['categoryUrl']);
        
        return bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('articles', queryParams), () => {
            return bcfetch.limiter.getArticleList(queryParams, {
                imageFormat: self.getAlbumImageFormat()
            });
        });
    }

    getItemsFromFetchResult(result, options) {
        return result.articles.slice(0);
    }

    getNextPageTokenFromFetchResult(result, options) {
        let page = 1, indexRef = 0;
        if (options.pageToken) {
            let parsedPageToken = JSON.parse(options.pageToken);
            page = ObjectHelper.getProp(parsedPageToken, 'page', 1);
            indexRef = ObjectHelper.getProp(parsedPageToken, 'indexRef', 0);
        }
        if (result.articles.length > 0 && result.total > indexRef + result.articles.length) {
            let nextPageToken = {
                page: page + 1,
                indexRef: indexRef + result.articles.length
            };
            return JSON.stringify(nextPageToken);
        }
        else {
            return null;
        }
    }

    convertToEntity(item, options) {
        return new Article(item.url, item.title, item.description, item.imageUrl, this._parseDate(item.date), item.category, item.author ? item.author.name : null, item.mediaItems, item.sections);
    }

    _parseDate(dateString) {
        return new Date(Date.parse(dateString)).toLocaleDateString();
    }

}

module.exports = ArticleModel;