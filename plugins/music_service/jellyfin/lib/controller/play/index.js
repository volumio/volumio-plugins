'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const Model = require(jellyfinPluginLibRoot + '/model');

class PlayController {

    constructor() {
        this.mpdPlugin = jellyfin.getMpdPlugin();
    }

    /**
     * Track uri:
     * jellyfin/{serverId}/song@songId={songId}
     */
    clearAddPlayTrack(track) {
        jellyfin.getLogger().info('[jellyfin-play] clearAddPlayTrack: ' + track.uri);

        let self = this;

        let songIdPrefix = 'song@songId=';
        let uri = track.uri.split('/');
        let serverId = uri[1];
        let songId;
        if (uri[2].startsWith(songIdPrefix)) {
            songId = uri[2].substring(songIdPrefix.length);
            if (songId === '') {
                songId = undefined;
            }
        }
        if (uri[0] !== 'jellyfin' || serverId == undefined || songId == undefined) {
            return libQ.reject('Invalid track uri: ' + track.uri);
        }
       
        let server = self._getAvailableServerById(serverId);
        if (!server) {
            return libQ.reject('Server unavailable');
        }

        let apiClient;
        return jellyfin.get('connectionManager').authenticate(server).then( (result) => {
            apiClient = result.apiClient;
            return libQ.resolve();
        }).then( () => {
            let model = Model.getInstance('song', apiClient);
            return model.getSong(songId);
        }).then( (song) => {
            let streamUrl = self._getStreamUrl(song, apiClient);
            let safeUri = streamUrl.replace(/"/g, '\\"');
            return safeUri;
        }).then( (streamUrl) => {
            return self._doPlay(streamUrl, track);
        }).then( (mpdPlayResult) => {
            self._markPlayed(serverId, songId, apiClient);
            return mpdPlayResult;
        }).fail( (error) => {
            jellyfin.getLogger().error('[jellyfin-play] clearAddPlayTrack() error');
            jellyfin.getLogger().error(error);
        });
    }

    stop() {
        jellyfin.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.stop();
    };

    pause() {
        jellyfin.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.pause();
    };
  
    resume() {
        jellyfin.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.resume();
    }
  
    seek(position) {
        jellyfin.getStateMachine().setConsumeUpdateService('mpd', false, false);
        return this.mpdPlugin.seek(position);
    }

    /*prefetch(trackBlock) {
        let uri = trackBlock.uri;
        let safeUri = uri.replace(/"/g, '\\"');
        let mpdPlugin = this.mpdPlugin;
        
        return mpdPlugin.sendMpdCommand('add "' + safeUri + '"', []).then( () => {
            return mpdPlugin.sendMpdCommand('consume 1', []);
        });
    };*/

    _getStreamUrl(song, apiClient) {
        let source = null;
        if (song.MediaSources) {
            // TODO We assume there's only one MediaSource. If multiple, should we sort by quality and use best?
            source = song.MediaSources[0];
        }

        let path = '/Audio/' + song.Id + '/stream';
        let params = { 'Static' : 'true' };
        if (source) {
            path += '.' + source.Container;
            params.MediaSourceId = source.Id;
            params.Tag = source.ETag;
        }

        let url = apiClient.getUrl(path, params);

        jellyfin.getLogger().info('[jellyfin-play] _getStreamUrl(' + song.Id + '): ' + url);
        return url;
    }

    _doPlay(streamUrl, track) {
        let mpdPlugin = this.mpdPlugin;

        return mpdPlugin.sendMpdCommand('stop', [])
        .then( () => {
            return mpdPlugin.sendMpdCommand('clear', []);
        })
        .then( () => {
            return mpdPlugin.sendMpdCommand('load "' + streamUrl + '"', []);
        })
        .fail( () => {
            // Send 'addid' command instead of 'add' to get mpd's Id of the song added.
            // We can then add tags using mpd's song Id.
            return mpdPlugin.sendMpdCommand('addid "' + streamUrl + '"', []);
        })
        .then( (addIdResp) => {
            // Set tags so that songs show the same title, album and artist as Jellyfin.
            // For songs that do not have metadata - either because it's not provided or the
            // song format does not support it - mpd will return different info than Jellyfin if we do
            // not set these tags beforehand. This also applies to DSFs - even though they support
            // metadata, mpd will not read it because doing so incurs extra overhead and delay.
            if (addIdResp && typeof addIdResp.Id != undefined) {
                let songId = addIdResp.Id;

                let cmdAddTitleTag = {
                    command: 'addtagid',
                    parameters: [songId, 'title', track.title]
                };
                let cmdAddAlbumTag = {
                    command: 'addtagid',
                    parameters: [songId, 'album', track.album]
                }
                let cmdAddArtistTag = {
                    command: 'addtagid',
                    parameters: [songId, 'artist', track.artist]
                }

                return mpdPlugin.sendMpdCommandArray([cmdAddTitleTag, cmdAddAlbumTag, cmdAddArtistTag]);
            }
            else {
                return libQ.resolve();
            }
        })
        .then( () => {
            jellyfin.getStateMachine().setConsumeUpdateService('mpd', false, false);
            return mpdPlugin.sendMpdCommand('play', []);
        });
    }

    _markPlayed(serverId, songId, apiClient) {
        let datePlayed = new Date( (new Date()).toUTCString() );
        apiClient.markPlayed(apiClient.getCurrentUserId(), songId, datePlayed).then(
            (result) => {
                jellyfin.getLogger().info('[jellyfin] markPlayed(' + serverId + ', ' + songId + '): Mark song as played.');
            },
            (error) => {
                jellyfin.getLogger().error('[jellyfin] markPlayed(' + serverId + ', ' + songId + '): Cannot mark song as played - ' + error);
            }
        );
    }

    _getAvailableServerById(serverId) {
        let availableServers = jellyfin.get('availableServers', []);
        for (let i = 0; i < availableServers.length; i++) {
            if (availableServers[i].getId() === serverId) {
                return availableServers[i];
            }
        }
    
        return null;
    }
}

module.exports = PlayController;