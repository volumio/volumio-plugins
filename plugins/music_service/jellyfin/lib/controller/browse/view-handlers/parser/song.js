'use strict';

const BaseParser = require(__dirname + '/base');

class SongParser extends BaseParser {

    parseToListItem(song) {
        let baseUri = this.getUri();
        
        let data = {
            'service': 'jellyfin',
            'type': 'song',
            'title': song.Name,
            'artist': song.Artists.join(', '),
            'album': song.Album,
            'duration': this.ticksToSeconds(song.RunTimeTicks),
            'uri': baseUri + '/song@songId=' + song.Id,
            'albumart': this.getAlbumArt(song)
        }

        return data;
    }

    parseToHeader(item) {
        return null;
    }
}

module.exports = SongParser;
