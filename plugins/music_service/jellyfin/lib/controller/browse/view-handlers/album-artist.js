'use strict';

const ArtistViewHandler = require(__dirname + '/artist');

class AlbumArtistViewHandler extends ArtistViewHandler {
    
    _getArtists(options) {
        let model = this.getModel('albumArtist');
        return model.getAlbumArtists(options);
    }

    _getArtistType() {
        return 'albumArtist';
    }
}

module.exports = AlbumArtistViewHandler;