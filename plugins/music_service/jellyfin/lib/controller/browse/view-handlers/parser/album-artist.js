'use strict';

const ArtistParser = require(__dirname + '/artist');

class AlbumArtistParser extends ArtistParser {

    _getArtistType() {
        return 'albumArtist';
    }
}

module.exports = AlbumArtistParser;