'use strict';

const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const BaseParser = require(__dirname + '/base');

class ArtistParser extends BaseParser {

    parseToListItem(artist, noParent = false) {
        let baseUri = this.getUri();
        let parentId = noParent ? null : this.getCurrentView().parentId;
        
        let data = {
            'service': 'jellyfin',
            'type': 'folder',
            'title': artist.Name,
            'albumart': this.getAlbumArt(artist),
            'uri': `${ baseUri }/albums${ noParent ? '' : '@parentId=' + parentId }@${ this._getArtistType() }Id=${ artist.Id }`
        }
        return data;
    }

    _getArtistType() {
        return 'artist';
    }

    parseToHeader(artist) {
        let header = super.parseToHeader(artist);
        header.artist = jellyfin.getI18n('JELLYFIN_ARTIST');
        header.year = Array.isArray(artist.Genres) ? artist.Genres.join(', ') : undefined;

        return header;
    }
}

module.exports = ArtistParser;