'use strict';

const BaseParser = require(__dirname + '/base');

class ServerParser extends BaseParser {

    parseToListItem(server) {
        let data = {
            'service': 'jellyfin',
            'type': 'streaming-category',
            'title': server.getName(),
            'uri': 'jellyfin/' + server.getId(),
            'albumart': '/albumart?sourceicon=music_service/jellyfin/assets/images/jellyfin.png'
        }
        return data;
    }

    parseToHeader(item) {
        return null;
    }
}

module.exports = ServerParser;
