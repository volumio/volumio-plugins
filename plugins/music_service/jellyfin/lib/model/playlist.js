'use strict';

const BaseModel = require(__dirname + '/base');

class PlaylistModel extends BaseModel {

    getPlaylists(options = {}, tag = '') {
        let queryOptions = this.getBaseQueryOptions(options, 'Playlist');
        return this.getItems(queryOptions, tag);
    }

    getPlaylist(playlistId) {
        return this.getItem(playlistId);
    }

}

module.exports = PlaylistModel;