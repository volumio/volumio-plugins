'use strict';

const BaseParser = require(__dirname + '/base');

class AlbumParser extends BaseParser {

    parseToListItem(album) {
        let baseUri = this.getUri();
        let data = {
            'service': 'bandcamp',
            'type': 'folder',
            'title': this.addType('album', album.name),
            'artist': album.artist.name,
            'albumart': album.thumbnail,
            'uri': baseUri + '/album@albumUrl=' + encodeURIComponent(album.url)
        }
        return data;
    }

    parseToHeader(album) {
        let baseUri = this.getUri();
        let header = {
            'uri': baseUri,
            'service': 'bandcamp',
            'type': 'song',
            'album': album.name,
            'artist': album.artist.name,
            'albumart': album.thumbnail,
            'year': album.releaseDate
        };
        return header;
    }

}

module.exports = AlbumParser;