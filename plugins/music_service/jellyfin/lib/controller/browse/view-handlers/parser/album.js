'use strict';

const BaseParser = require(__dirname + '/base');

class AlbumParser extends BaseParser {

    parseToListItem(album) {
        let baseUri = this.getUri();
    
        let data = {
            'service': 'jellyfin',
            'type': 'folder',
            'title': album.Name,
            'artist': album.AlbumArtist,
            'duration': this.ticksToSeconds(album.RunTimeTicks),
            'albumart': this.getAlbumArt(album),
            'uri': baseUri + '/songs@albumId=' + album.Id
        }
        return data;
    }

    parseToHeader(album) {
        let header = super.parseToHeader(album);
        header.artist = album.AlbumArtist;
        header.year = album.ProductionYear;
        // Duration does not get converted into time format when shown in header 
        // (as opposed to list item). So we have to do it ourselves.
        header.duration = this.timeFormat(this.ticksToSeconds(album.RunTimeTicks));
        header.genre = Array.isArray(album.Genres) ? album.Genres.join(', ') : undefined;

        return header;
    }
}

module.exports = AlbumParser;