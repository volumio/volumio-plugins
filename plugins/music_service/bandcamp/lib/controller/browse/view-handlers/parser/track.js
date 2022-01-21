'use strict';

const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');
const BaseParser = require(__dirname + '/base');

class TrackParser extends BaseParser {

    parseToListItem(track, addType = false, fakeAlbum = false) {
        let baseUri = this.getUri();
        
        let data = {
            'service': 'bandcamp',
            'type': fakeAlbum ? 'folder' : 'song',
            'title': addType ? this.addType('track', track.name) : track.name,
            'artist': track.artist.name,
            'album': track.album ? track.album.name : '',
            'uri': baseUri + '/track@trackUrl=' + encodeURIComponent(track.url),
            'albumart': track.thumbnail
        }

        if (!fakeAlbum) {
            data.duration = track.duration;
        }
        if (track.streamUrl === null) {
            data.title = UIHelper.addNonPlayableText(data.title);
        }

        return data;
    }

    parseToHeader(track) {
        let baseUri = this.getUri();
        return {
            'uri': baseUri,
            'service': 'bandcamp',
            'type': 'song',
            'album': track.name,
            'artist': track.artist.name,
            'albumart': track.thumbnail
        };
    }
}

module.exports = TrackParser;
