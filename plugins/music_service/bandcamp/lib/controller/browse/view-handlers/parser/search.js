'use strict';

const BaseParser = require(__dirname + '/base');

class SearchResultParser extends BaseParser {

    parseToListItem(entity) {
        let baseUri = this.getUri();
        let data = {
            'service': 'bandcamp',
            'title': this.addType(entity.type, entity.name),
            'albumart': entity.thumbnail,
        }

        let encodedUrl = encodeURIComponent(entity.url);
        switch(entity.type) {
            case 'artist':
                data.type = 'folder';
                data.uri = baseUri + '/artist@artistUrl=' + encodedUrl;
                if (entity.location) {
                    data.artist = entity.location;
                }
                break;
            case 'label':
                data.type = 'folder';
                data.uri = baseUri + '/label@labelUrl=' + encodedUrl;
                break;
            case 'album':
                data.type = 'folder';
                data.uri = baseUri + '/album@albumUrl=' + encodedUrl;
                data.artist = entity.artist.name;
                break;
            case 'track':
                data.type = 'folder';
                data.uri = baseUri + '/track@trackUrl=' + encodedUrl;
                data.artist = entity.artist.name;
                if (entity.album) {
                    data.album = entity.album.name;
                }
        }
        return data;
    }

}

module.exports = SearchResultParser;