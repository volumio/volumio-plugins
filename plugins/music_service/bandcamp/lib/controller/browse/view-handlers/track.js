'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');
const AlbumViewHandler = require(__dirname + '/album');

class TrackViewHandler extends AlbumViewHandler {

    browse() {
        let view = this.getCurrentView();

        if (view.trackUrl) {
            return this._browseTrack(decodeURIComponent(view.trackUrl));
        }

        return libQ.resolve([]);
    }

    _browseTrack(trackUrl) {
        let self = this;
        let defer = libQ.defer();

        let model = self.getModel('track');     
        model.getTrack(trackUrl).then( (track) => {
            
            // Return album view if this track belongs to an album
            if (track.album && track.album.url) {
                self._browseAlbum(track.album.url).then( (result) => {
                    defer.resolve(result);
                }).fail( (error) => {
                    defer.resolve(error);
                })
            }
            else {
                let prevUri = self.constructPrevUri();       
                let parser = self.getParser('track');
        
                let items = [
                    parser.parseToListItem(track)
                ];

                let link = {
                    url: trackUrl,
                    text: bandcamp.getI18n('BANDCAMP_VIEW_LINK_TRACK'),
                    icon: { type: 'bandcamp' },
                    target: '_blank'
                };
                let nav = {
                    prev: {
                        uri: prevUri
                    },
                    info: parser.parseToHeader(track),
                    lists: [
                        {
                            title: UIHelper.constructListTitleWithLink('', link, true),
                            availableListViews: ['list'],
                            items: items
                        }
                    ]
                };

                defer.resolve({
                    navigation: nav
                });
            }
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    getTracksOnExplode() {
        let self = this;

        let view = self.getCurrentView();
        if (!view.trackUrl) {
            return libQ.reject("Operation not supported");
        }

        let model = self.getModel('track');
        return model.getTrack(decodeURIComponent(view.trackUrl));
    }

}

module.exports = TrackViewHandler;