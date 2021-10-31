'use strict';

const BaseParser = require(__dirname + '/base');

class CollectionParser extends BaseParser {

    parseToListItem(collection) {
        let baseUri = this.getUri();

        let data = {
            'service': 'jellyfin',
            'type': 'streaming-category',
            'title': collection.Name,
            'artist': collection.ProductionYear,
            'albumart': this.getAlbumArt(collection),
            'uri': baseUri + '/collection@parentId=' + collection.Id
        }
        return data;
    }
}

module.exports = CollectionParser;