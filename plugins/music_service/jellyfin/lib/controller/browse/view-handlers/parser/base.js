'use strict';

const AlbumArtHandler = require(jellyfinPluginLibRoot + '/util/albumart');

class BaseParser {

    constructor(uri, curView, prevViews, apiClient) {
        this._uri = uri;
        this._curView = curView;
        this._prevViews = prevViews;
        this._apiClient = apiClient;
    }

    parseToListItem(item) {
        return null;
    }

    parseToHeader(item) {
        let baseUri = this.getUri();

        return {
            'uri': baseUri,
            'service': 'jellyfin',
            'type': 'song',
            'album': item.Name,
            'albumart': this.getAlbumArt(item)
        };
    }

    getUri() {
        return this._uri;
    }

    getCurrentView() {
        return this._curView;
    }

    getPreviousViews() {
        return this._prevViews;
    }

    getApiClient() {
        return this._apiClient;
    }

    getAlbumArt(item) {
        if (this._albumArtHandler == undefined) {
            this._albumArtHandler = new AlbumArtHandler(this.getApiClient());
        }
        return this._albumArtHandler.getAlbumArt(item);
    }

    ticksToSeconds(ticks) {
        if (ticks) {
            return Math.floor(ticks / 10000000);
        }
        return null;
    }

    // https://github.com/volumio/Volumio2-UI/blob/master/src/app/browse-music/browse-music.controller.js
    timeFormat(time) {
        if (time) {
            // Hours, minutes and seconds
            let hrs = ~~(time / 3600);
            let mins = ~~((time % 3600) / 60);
            let secs = ~~time % 60;
            // Output like "1:01" or "4:03:59" or "123:03:59"
            let ret = '';
            if (hrs > 0) {
                ret += '' + hrs + ':' + (mins < 10 ? '0' : '');
            }
            ret += '' + mins + ':' + (secs < 10 ? '0' : '');
            ret += '' + secs;
            return ret;
        }
        return null;
    }
}

module.exports = BaseParser;