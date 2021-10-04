'use strict';

const libQ = require('kew');
const BaseViewHandler = require(__dirname + '/base');

class ExplodableViewHandler extends BaseViewHandler {

    explode() {
        let self = this;

        let view = self.getCurrentView();
        if (view.noExplode) {
            return libQ.resolve([]);
        }

        let defer = libQ.defer();
        this.getSongsOnExplode().then( (songs) => {
            if (!Array.isArray(songs)) {
                self._parseSongForExplode(songs).then( (songInfo) => {
                    defer.resolve([songInfo]);
                });
            }
            else {
                let parsePromises = [];
                songs.forEach( (song, songIndex) => {
                    parsePromises.push(self._parseSongForExplode(song));
                });
                libQ.all(parsePromises).then( (songs) => {
                    let items = [];
                    songs.forEach( (song) => {
                        items.push(song);
                    });
                    defer.resolve(items);
                });
            }
        }).fail( (error) => {
            defer.reject(error);
        })

        return defer.promise;
    }

    getSongsOnExplode() {
        return libQ.resolve([]);
    }

    _parseSongForExplode(song) {
        let defer = libQ.defer();

        let data = {
            'service': 'jellyfin',
            'uri': this._getTrackUri(song),
            'type': 'song',
            'albumart': this.getAlbumArt(song),
            'artist': song.Artists.join(', '),
            'album': '',
            'name': song.Name,
            'title': song.Name
        };

        if (song.Album != undefined) {
            data.album = song.Album;
            defer.resolve(data);
        }
        else if (song.AlbumId != undefined) {
            // Some songs don't have Album names, e.g. WAV files. 
            // If AlbumId is available, then obtain the name from album
            let albumModel = this.getModel('album');
            albumModel.getAlbum(song.AlbumId).then( (album) => {
                data.album = album.Name;
                defer.resolve(data);
            }).fail( (error) => {
                defer.resolve(data);
            })
        }
        else {
            defer.resolve(data);
        }

        return defer.promise;
    }

    /**
     * Track uri:
     * jellyfin/{serverId}/song@songId={songId}
     */
    _getTrackUri(song) {
        return 'jellyfin/' + this.getCurrentView().serverId + '/song@songId=' + song.Id;
    }

}

module.exports = ExplodableViewHandler;