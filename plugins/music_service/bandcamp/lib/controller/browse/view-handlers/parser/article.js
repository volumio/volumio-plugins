'use strict';

const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseParser = require(__dirname + '/base');

class ArticleParser extends BaseParser {

    parseToListItem(article) {
        let baseUri = this.getUri();
        let data = {
            'service': 'bandcamp',
            'type': 'folder',
            'title': article.title,
            'artist': article.category.name + ' - ' + article.date,
            'albumart': article.thumbnail,
            'uri': baseUri + '/articles@articleUrl=' + encodeURIComponent(article.url)
        }
        return data;
    }

    parseToHeader(article) {
        let baseUri = this.getUri();
        let header = {
            'uri': baseUri,
            'service': 'bandcamp',
            'type': 'song',
            'title': article.title,
            'albumart': article.thumbnail,
            'artist': bandcamp.getI18n('BANDCAMP_DAILY') + ' - ' + article.category.name,
            'year': article.date,
            'duration': bandcamp.getI18n('BANDCAMP_ARTICLE_BY', article.author)
        };
        return header;
    }

    parseMediaItemTrack(article, mediaItem, track) {
        let baseUri = this.getUri();
        let data = {
            'service': 'bandcamp',
            'type': 'song',
            'title': track.name,
            'album': mediaItem.name,
            'artist': mediaItem.artist ? mediaItem.artist.name : '',
            'albumart': mediaItem.imageUrl,
            'duration': track.duration,
            'uri': baseUri + '/articles@articleUrl=' + encodeURIComponent(article.url) + '@mediaItemRef=' + mediaItem.mediaItemRef + '@track=' + track.position
        }
        return data;
    }

}

module.exports = ArticleParser;