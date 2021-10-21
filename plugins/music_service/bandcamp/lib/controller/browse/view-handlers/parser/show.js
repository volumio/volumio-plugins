'use strict';

const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseParser = require(__dirname + '/base');

class ShowParser extends BaseParser {

    parseToListItem(show, type) {
        let baseUri = this.getUri();

        let data = {
            'service': 'bandcamp',
            'type': 'folder',
            'title': show.name,
            'artist': show.date,
            'albumart': show.thumbnail,
            'uri': baseUri + '/shows@showUrl=' + encodeURIComponent(show.url)
        };

        if (type === 'playFullStream') {
            data.type = 'song';
            data.title = bandcamp.getI18n('BANDCAMP_SHOW_PLAY_FULL');
            data.uri = baseUri;
            data.duration = show.duration;
            delete data.artist;
        }
        
        return data;
    }

    parseToHeader(show) {
        let baseUri = this.getUri();
        let header = {
            'uri': baseUri,
            'service': 'bandcamp',
            'type': 'song',
            'title': show.name,
            'artist': bandcamp.getI18n('BANDCAMP_HEADER_SHOW'),
            'year': show.date,
            'duration': show.description,
            'albumart': show.thumbnail
        };
        return header;
    }

}

module.exports = ShowParser;