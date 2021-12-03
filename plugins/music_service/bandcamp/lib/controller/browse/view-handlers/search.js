'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');
const BaseViewHandler = require(__dirname + '/base');

class SearchViewHandler extends BaseViewHandler {

    browse() {
        let self = this;
        let defer = libQ.defer();
        
        let prevUri = self.constructPrevUri();       
        let view = self.getCurrentView();
        let model = self.getModel('search');
        let parser = self.getParser('search');

        let options = {
            limit: view.combinedSearch ? bandcamp.getConfigValue('combinedSearchResults', 17) : bandcamp.getConfigValue('itemsPerPage', 47)
        };

        if (view.pageRef) {
            let ref = self.parsePageRef(view.pageRef);
            options.pageToken = ref.pageToken;
            options.pageOffset = ref.pageOffset;
        }

        if (view.query) {
            options.query = decodeURIComponent(view.query);
        }

        if (view.itemType) {
            options.itemType = view.itemType;
        }
        
        model.getSearchResults(options).then( (results) => {
            let items = [];
            results.items.forEach( (result) => {
                items.push(parser.parseToListItem(result));
            });
            let nextPageRef = self.constructPageRef(results.nextPageToken, results.nextPageOffset);
            if (nextPageRef) {
                let nextUri = self.constructNextUri(nextPageRef);
                items.push(self.constructNextPageItem(nextUri));
            }

            let nav = {
                prev: {
                    uri: prevUri
                },
                lists: [
                    {
                        availableListViews: ['list', 'grid'],
                        items: items
                    }
                ]
            };

            let titleKey;
            switch(options.itemType) {
                case 'artistsAndLabels':
                    titleKey = 'BANDCAMP_SEARCH_ARTISTS_AND_LABELS_TITLE';
                    break;
                case 'albums':
                    titleKey = 'BANDCAMP_SEARCH_ALBUMS_TITLE';
                    break;
                case 'tracks':
                    titleKey = 'BANDCAMP_SEARCH_TRACKS_TITLE';
                    break;
                default:
                    titleKey = 'BANDCAMP_SEARCH_TITLE';
            }
            if (!view.combinedSearch) {
                titleKey += '_FULL';
            }
            nav.lists[0].title = UIHelper.addBandcampIconToListTitle(bandcamp.getI18n(titleKey, options.query));

            defer.resolve({
                navigation: nav
            });

        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }
}

module.exports = SearchViewHandler;