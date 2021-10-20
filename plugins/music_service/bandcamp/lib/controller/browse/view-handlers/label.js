'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');
const ArtistViewHandler = require(__dirname + '/artist');

class LabelViewHandler extends ArtistViewHandler {

    getTargetUrl() {
        return this.getCurrentView().labelUrl;
    }

    getHeaderInfo(url) {
        return this.getModel('label').getLabel(url);
    }

    getHeaderParser() {
        return this.getParser('label');
    }

    getLists(url) {
        let self = this;
        let defer = libQ.defer();
        let viewType = self.getCurrentView().view;
        let getList = viewType === 'artists' ? self.getLabelArtistsList(url) : self.getDiscographyList(url);
        
        getList.then( (list) => {
            let baseUri = self.getUri();
            let viewLink = {};
            if (viewType === 'artists') {
                viewLink.icon = 'fa fa-music';
                viewLink.title = bandcamp.getI18n('BANDCAMP_DISCOGRAPHY');
                viewLink.uri = baseUri + '/label@labelUrl=' + encodeURIComponent(url) + '@view=discography';
            }
            else {
                viewLink.icon = 'fa fa-users';
                viewLink.title = bandcamp.getI18n('BANDCAMP_LABEL_ARTISTS');
                viewLink.uri = baseUri + '/label@labelUrl=' + encodeURIComponent(url) + '@view=artists';
            }
            let links = {
                availableListViews: ['list'],
                items: [viewLink]
            };
            defer.resolve([links, list]);
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    getLabelArtistsList(url) {
        let self = this;
        let defer = libQ.defer();
        
        let view = self.getCurrentView();
        let model = self.getModel('artist');
        let parser = self.getParser('artist');

        let options = {
            limit: bandcamp.getConfigValue('itemsPerPage', 47),
            labelUrl: url
        };

        if (view.pageRef) {
            let ref = self.parsePageRef(view.pageRef);
            options.pageToken = ref.pageToken;
            options.pageOffset = ref.pageOffset;
        }
       
        model.getArtists(options).then( (artists) => {
            let items = [];
            artists.items.forEach( (artist) => {
                items.push(parser.parseToListItem(artist));
            });
            let nextPageRef = self.constructPageRef(artists.nextPageToken, artists.nextPageOffset);
            if (nextPageRef) {
                let nextUri = self.constructNextUri(nextPageRef);
                items.push(self.constructNextPageItem(nextUri));
            }

            defer.resolve({
                title: bandcamp.getI18n('BANDCAMP_LABEL_ARTISTS'),
                availableListViews: ['list', 'grid'],
                items: items
            });

        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    getViewLinkText() {
        return bandcamp.getI18n('BANDCAMP_VIEW_LINK_LABEL');
    }
}

module.exports = LabelViewHandler;