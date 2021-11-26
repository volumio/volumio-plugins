'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');
const ExplodableViewHandler = require(__dirname + '/explodable');

class AlbumViewHandler extends ExplodableViewHandler {

    browse() {
        let view = this.getCurrentView();

        if (view.albumUrl) {
            return this._browseAlbum(decodeURIComponent(view.albumUrl));
        }

        return libQ.resolve([]);
    }

    _browseAlbum(albumUrl) {
        let self = this;
        let defer = libQ.defer();

        let prevUri = self.constructPrevUri();       
        let model = self.getModel('album');
        let albumParser = self.getParser('album');
        let trackParser = self.getParser('track');
       
        model.getAlbum(albumUrl).then( (album) => {
            let items = [];
            album.tracks.forEach( (track) => {
                items.push(trackParser.parseToListItem(track));
            });
            let lists = [{
                availableListViews: ['list'],
                items: items
            }];
            let nav = {
                prev: {
                    uri: prevUri
                },
                info: albumParser.parseToHeader(album),
                lists
            };
            return self._addArtistLink(nav, album.artist);

        }).then( (nav) => {
            let link = {
                url: albumUrl,
                text: bandcamp.getI18n('BANDCAMP_VIEW_LINK_ALBUM'),
                icon: { type: 'bandcamp' },
                target: '_blank'
            };
            if (nav.lists.length > 1) { // artist link added
                nav.lists[1].title = UIHelper.constructListTitleWithLink('', link, false);
            }
            else {
                nav.lists[0].title = UIHelper.constructListTitleWithLink('', link, true);
            }
            defer.resolve({
                navigation: nav
            });
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    _addArtistLink(nav, artist) {
        let self = this;
        let defer = libQ.defer();

        // Check if we're coming from artist view.
        // If not, include artist link.
        let prevViews = self.getPreviousViews();
        let lastView = prevViews[prevViews.length - 1];
        if (lastView.name !== 'artist') {
            // Check if artist is also a label
            let model = self.getModel('artist');
            model.getArtist(artist.url).then( (artist) => {
                let baseUri = self.getUri();
                let artistLink = {
                    icon: 'fa fa-user',
                    title: bandcamp.getI18n('BANDCAMP_MORE_FROM', artist.name)
                };
                if (artist.isLabel) {
                    artistLink.uri = baseUri + '/label@labelUrl=' + encodeURIComponent(artist.url);
                }
                else {
                    artistLink.uri = baseUri + '/artist@artistUrl=' + encodeURIComponent(artist.url);
                }
                let links = {
                    availableListViews: ['list'],
                    items: [artistLink]
                };
                nav.lists.unshift(links);
                defer.resolve(nav);
            }).fail( (error) => {
                defer.resolve(nav);
            });
        }
        else {
            defer.resolve(nav);
        }
        
        return defer.promise;
    }

    getTracksOnExplode() {
        let self = this;

        let view = self.getCurrentView();
        if (!view.albumUrl) {
            return libQ.reject("Operation not supported");
        }

        let defer = libQ.defer();
        let model = self.getModel('album');

        model.getAlbum(decodeURIComponent(view.albumUrl)).then( (album) => {
            if (view.track) {
                defer.resolve(album.tracks[view.track - 1]);
            }
            else {
                defer.resolve(album.tracks);
            }
        }).fail( (error) => {
            defer.reject(error);
        })

        return defer.promise;
    }

}

module.exports = AlbumViewHandler;