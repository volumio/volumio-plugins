'use strict';

const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const BaseParser = require(__dirname + '/base');

class PlaylistParser extends BaseParser {

    parseToListItem(playlist) {
        let baseUri = this.getUri();

        let data = {
            'service': 'jellyfin',
            'type': 'folder',
            'title': playlist.Name,
            'albumart': this.getAlbumArt(playlist),
            'uri': baseUri + '/songs@playlistId=' + playlist.Id
        }
        return data;
    }

    parseToHeader(playlist) {
        let header = super.parseToHeader(playlist);
        header.artist = jellyfin.getI18n('JELLYFIN_PLAYLIST');

        return header;
    }
}

module.exports = PlaylistParser;