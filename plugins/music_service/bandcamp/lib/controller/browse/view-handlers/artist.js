'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');
const DiscographyViewSupport = require(__dirname + '/discography');

class ArtistViewHandler extends DiscographyViewSupport {

    browse() {
        let self = this;

        let url = decodeURIComponent(self.getTargetUrl());
        if (!url) {
            return libQ.reject('Invalid target URL');
        }

        let defer = libQ.defer();
        let promises = [
            self.getHeader(url),
            self.getLists(url)
        ];

        libQ.all(promises).then( (results) => {
            let header = results[0];
            let lists = results[1];

            if (header.rawInfo.label) {
                let baseUri = self.getUri();
                let labelLink = {
                    icon: 'fa fa-link',
                };
                // Check if we're coming from the label:
                // label -> artist ; or
                // label -> album -> artist
                let getBackToUri = (labelUrl, matchLevel) => {
                    let prevViews = self.getPreviousViews();
                    let viewToMatch = prevViews[prevViews.length - (matchLevel + 1)];
                    if (viewToMatch && viewToMatch.name === 'label' && decodeURIComponent(viewToMatch.labelUrl) === labelUrl) {
                        return self.constructUriFromViews(prevViews.slice(0, prevViews.length - matchLevel));
                    }
                    return null;
                }

                let backToUri = getBackToUri(header.rawInfo.label.url, 0) || getBackToUri(header.rawInfo.label.url, 1);
                if (backToUri) {
                    labelLink.title = bandcamp.getI18n('BANDCAMP_BACK_TO', header.rawInfo.label.name);
                    labelLink.uri = backToUri;
                }
                else {
                    labelLink.title = header.rawInfo.label.name,
                    labelLink.uri =  baseUri + '/label@labelUrl=' + encodeURIComponent(header.rawInfo.label.url)
                }
                let links = {
                    availableListViews: ['list'],
                    items: [labelLink]
                };
                lists.unshift(links);
            }

            let link = {
                url,
                text: self.getViewLinkText(),
                icon: { type: 'bandcamp' },
                target: '_blank'
            };
            if (lists.length > 1) {
                lists[1].title = UIHelper.constructListTitleWithLink(lists[1].title, link, false);
            }
            else {
                lists[0].title = UIHelper.constructListTitleWithLink(lists[0].title, link, true);
            }

            let nav = {
                prev: {
                    uri: self.constructPrevUri()
                },
                info: header,
                lists
            };

            defer.resolve({
                navigation: nav
            });
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    getTargetUrl() {
        return this.getCurrentView().artistUrl;
    }

    getHeaderInfo(url) {
        return this.getModel('artist').getArtist(url);
    }

    getHeaderParser() {
        return this.getParser('artist');
    }

    getHeader(url) {
        let self = this;
        let defer = libQ.defer();

        self.getHeaderInfo(url).then( (info) => {
            let header = self.getHeaderParser().parseToHeader(info);
            header.rawInfo = info;
            defer.resolve(header);
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    getLists(url) {
        let defer = libQ.defer();

        this.getDiscographyList(url).then( (list) => {
            defer.resolve([list]);
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    getViewLinkText() {
        return bandcamp.getI18n('BANDCAMP_VIEW_LINK_ARTIST');
    }

    getTracksOnExplode() {
        let self = this;
        let defer = libQ.defer();

        let url = self.getTargetUrl();
        if (!url) {
            return libQ.reject("Invalid url");
        }

        let model = self.getModel('discography');
        let options = {
            limit: 1,
            artistOrLabelUrl: decodeURIComponent(url)
        };
        model.getDiscography(options).then( (results) => {
            let first = results.items[0] || {};
            if (first.type === 'track') {
                let trackModel = self.getModel('track');
                return trackModel.getTrack(first.url);
            }
            else if (first.type === 'album') {
                let albumModel = self.getModel('album');
                return albumModel.getAlbum(first.url).then( (album) => {
                    return album.tracks;
                })
            }
            else {
                return [];
            }
        }).then( (tracks) => {
            defer.resolve(tracks);
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }
}

module.exports = ArtistViewHandler;