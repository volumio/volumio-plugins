'use strict';

const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseParser = require(__dirname + '/base');

class ArtistParser extends BaseParser {

    parseToListItem(artist) {
        let baseUri = this.getUri();
        let data = {
            'service': 'bandcamp',
            'type': 'folder',
            'title': artist.name,
            'albumart': artist.thumbnail,
            'uri': baseUri + '/artist@artistUrl=' + encodeURIComponent(artist.url)
        }
        if (artist.location) {
            data.artist = artist.location;
        }
        return data;
    }

    parseToHeader(artist) {
        let baseUri = this.getUri();
        let header = {
            'uri': baseUri,
            'service': 'bandcamp',
            'type': 'song',
            'title': artist.name,
            'artist': bandcamp.getI18n('BANDCAMP_HEADER_ARTIST'),
            'albumart': artist.thumbnail
        };
        if (artist.location) {
            header.year = artist.location;
        }
        if (artist.label) {
            header.duration = artist.label.name;
        }
        return header;
    }
}

module.exports = ArtistParser;