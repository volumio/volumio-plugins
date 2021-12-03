'use strict';

const BaseParser = require(__dirname + '/base');

class UserViewParser extends BaseParser {

    parseToListItem(userView) {
        let baseUri = this.getUri();

        let uri, type;
        if (userView.Type === 'CollectionFolder' && userView.CollectionType === 'boxsets') {
            uri = baseUri + '/collections@parentId=' + userView.Id;
            type = 'streaming-category';
        }
        else if (userView.Type === 'UserView' && userView.CollectionType === 'playlists') {
            uri = baseUri + '/playlists';
            type = 'streaming-category';
        }
        else if (userView.Type === 'CollectionFolder' && userView.CollectionType === 'music') {
            uri = baseUri + '/library@parentId=' + userView.Id;
            type = 'folder';
        }

        if (uri != undefined) {
            let data = {
                'service': 'jellyfin',
                'type': type,
                'title': userView.Name,
                'uri': uri,
                'albumart': this.getAlbumArt(userView)
            }
            return data;
        }

        return null;
    }
}

module.exports = UserViewParser;
