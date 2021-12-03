'use strict';

const libQ = require('kew');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');
const BaseViewHandler = require(__dirname + '/base');

class ExplodableViewHandler extends BaseViewHandler {

    explode() {
        let self = this;
        let defer = libQ.defer();
        this.getTracksOnExplode().then( (tracks) => {
            if (!Array.isArray(tracks)) {
                self._parseTrackForExplode(tracks).then( (trackInfo) => {
                    defer.resolve([trackInfo]);
                });
            }
            else {
                let parsePromises = [];
                tracks.forEach( (track, trackIndex) => {
                    parsePromises.push(self._parseTrackForExplode(track));
                });
                libQ.all(parsePromises).then( (tracks) => {
                    let items = [];
                    tracks.forEach( (track) => {
                        items.push(track);
                    });
                    defer.resolve(items);
                });
            }
        }).fail( (error) => {
            defer.reject(error);
        })

        return defer.promise;
    }

    getTracksOnExplode() {
        return libQ.resolve([]);
    }

    _parseTrackForExplode(track) {
        let trackName = track.streamUrl ? track.name : UIHelper.addNonPlayableText(track.name);
        let data = {
            'service': 'bandcamp',
            'uri': this._getTrackUri(track),
            'type': 'track',
            'albumart': track.thumbnail,
            'artist': track.artist.name,
            'album': track.album ? track.album.name : '',
            'name': trackName,
            'title': trackName
        };
        return libQ.resolve(data);
    }

    /**
     * Track uri:
     * bandcamp/track@trackUrl={trackUrl}@artistUrl={...}@albumUrl={...}
     */
    _getTrackUri(track) {
        let artistUrl = encodeURIComponent(track.artist.url);
        let albumUrl = track.album ? encodeURIComponent(track.album.url) : artistUrl;

        return `bandcamp/track@trackUrl=${encodeURIComponent(track.url)}@artistUrl=${artistUrl}@albumUrl=${albumUrl}`;
    }

}

module.exports = ExplodableViewHandler;