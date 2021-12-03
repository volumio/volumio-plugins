'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const Model = require(bandcampPluginLibRoot + '/model');
const ViewHelper = require(bandcampPluginLibRoot + '/helper/view');

class PlayController {

    constructor() {
        this.mpdPlugin = bandcamp.getMpdPlugin();
    }

    /**
     * Track uri:
     * - bandcamp/track@trackUrl={trackUrl}@artistUrl={...}@albumUrl={...}
     * - bandcamp/show@showUrl={showUrl}
     * - bandcamp/article@articleUrl={articleUrl}@mediaItemRef={...}@track={trackPosition}@artistUrl={...}@albumUrl={...}
     * - bandcamp/album@albumUrl={...}@track={...}@artistUrl={...}@albumUrl={...}
     */
    clearAddPlayTrack(track) {
        bandcamp.getLogger().info('[bandcamp-play] clearAddPlayTrack: ' + track.uri);

        let self = this;

        return self._getStreamUrl(track).then( (streamUrl) => {
            return self._doPlay(streamUrl, track);
        }).fail( (error) => {
            bandcamp.getLogger().error('[bandcamp-play] clearAddPlayTrack() error');
            bandcamp.getLogger().error(error);
        });
    }

    stop() {
        bandcamp.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.stop();
    };

    pause() {
        bandcamp.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.pause();
    };
  
    resume() {
        bandcamp.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.resume();
    }
  
    seek(position) {
        bandcamp.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.seek(position);
    }

    _getStreamUrl(track) {
        let views = ViewHelper.getViewsFromUri(track.uri);
        let trackView = views[1];
        if (trackView == undefined) {
            trackView = { name: null };
        }
        if (trackView.name === 'track' && trackView.trackUrl) {
            let trackUrl = decodeURIComponent(trackView.trackUrl);
            let model = Model.getInstance('track');
            return model.getTrack(trackUrl).then( (track) => {
                if (!track.streamUrl) {
                    bandcamp.toast('warning', bandcamp.getI18n('BANDCAMP_SKIP_NON_PLAYABLE_TRACK', track.name));
                    bandcamp.getStateMachine().next();
                    return libQ.reject('Skipping non-playable track');
                }
                else {
                    let safeUri = track.streamUrl.replace(/"/g, '\\"');
                    return safeUri;
                }
            });
        }
        else if (trackView.name === 'show' && trackView.showUrl) {
            let showUrl = decodeURIComponent(trackView.showUrl);
            let model = Model.getInstance('show');
            return model.getShow(showUrl).then( (show) => {
                let streamUrl = show.streamUrl['mp3-128'] || show.streamUrl['opus-lo'];
                let safeUri = streamUrl.replace(/"/g, '\\"');
                return safeUri;
            });
        }
        else if (trackView.name === 'article' && trackView.articleUrl && trackView.mediaItemRef && trackView.track) {
            let articleUrl = decodeURIComponent(trackView.articleUrl);
            let model = Model.getInstance('article');
            return model.getArticle(articleUrl).then( (article) => {
                // return track corresponding to mediaItemRef and track position
                let mediaItem = article.mediaItems.find( mi => mi.mediaItemRef === trackView.mediaItemRef);
                if (mediaItem) {
                    let track = mediaItem.tracks.find( tr => tr.position == trackView.track );
                    if (track) {
                        let safeUri = track.streamUrl.replace(/"/g, '\\"');
                        return safeUri;
                    }
                }
                // not found
                return libQ.reject('Track not found');
            });
        }
        else if (trackView.name === 'album' && trackView.albumUrl && trackView.track) {
            let albumUrl = decodeURIComponent(trackView.albumUrl);
            let model = Model.getInstance('album');
            let trackPosition = parseInt(trackView.track, 10);
            return model.getAlbum(albumUrl).then( (album) => {
                let albumTrack = album.tracks[trackPosition - 1];
                if (albumTrack) {
                    let safeUri = albumTrack.streamUrl.replace(/"/g, '\\"');
                    return safeUri;
                }
                return libQ.reject('Track not found');
            });
        }
        else {
            return libQ.reject('Invalid track uri: ' + track.uri);
        }
    }

    _doPlay(streamUrl, track) {
        let mpdPlugin = this.mpdPlugin;

        return mpdPlugin.sendMpdCommand('stop', [])
        .then( () => {
            return mpdPlugin.sendMpdCommand('clear', []);
        })
        .then( () => {
            return mpdPlugin.sendMpdCommand('addid "' + streamUrl + '"', []);
        })
        .then( (addIdResp) => {
            if (addIdResp && typeof addIdResp.Id != undefined) {
                let trackUrl = addIdResp.Id;

                let cmdAddTitleTag = {
                    command: 'addtagid',
                    parameters: [trackUrl, 'title', track.title]
                };
                let cmdAddAlbumTag = {
                    command: 'addtagid',
                    parameters: [trackUrl, 'album', track.album]
                }
                let cmdAddArtistTag = {
                    command: 'addtagid',
                    parameters: [trackUrl, 'artist', track.artist]
                }

                return mpdPlugin.sendMpdCommandArray([cmdAddTitleTag, cmdAddAlbumTag, cmdAddArtistTag]);
            }
            else {
                return libQ.resolve();
            }
        })
        .then( () => {
            bandcamp.getStateMachine().setConsumeUpdateService('mpd', false, false);
            return mpdPlugin.sendMpdCommand('play', []);
        });
    }

}

module.exports = PlayController;