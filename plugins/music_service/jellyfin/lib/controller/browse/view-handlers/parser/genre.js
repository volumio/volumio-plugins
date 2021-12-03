'use strict';

const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const BaseParser = require(__dirname + '/base');

class GenreParser extends BaseParser {

    parseToListItem(genre) {
        let baseUri = this.getUri();
        let parentId = this.getCurrentView().parentId;
        
        let data = {
            'service': 'jellyfin',
            'type': 'folder',
            'title': genre.Name,
            'albumart': this.getAlbumArt(genre),
            'uri': baseUri + '/albums@parentId=' + parentId + '@genreId=' + genre.Id
        }
        return data;
    }

    parseToHeader(genre) {
        let header = super.parseToHeader(genre);
        header.artist = jellyfin.getI18n('JELLYFIN_GENRE');

        return header;
    }
}

module.exports = GenreParser;