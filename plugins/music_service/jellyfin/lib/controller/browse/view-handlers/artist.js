'use strict';

const libQ = require('kew');
const BaseViewHandler = require(__dirname + '/base');

class ArtistViewHandler extends BaseViewHandler {

    browse() {
        let self = this;
        let defer = libQ.defer();

        let prevUri = self.constructPrevUri();
        let nextUri = self.constructNextUri();
        
        let view = self.getCurrentView();
        let parser = self.getParser('artist');

        let showFilters = view.fixedView == undefined && view.search == undefined;
        let filterListPromise;

        if (showFilters) {
            let saveFiltersKey = `${ view.parentId }.${ self._getArtistType() }`;
            self.saveFilters(saveFiltersKey);
            filterListPromise = self.getFilterList(saveFiltersKey, 'az', 'filter', 'genre');
        }
        else {
            filterListPromise = libQ.resolve(null);
        }

        filterListPromise.then( result => {
            let lists, options;
            if (result) {
                lists = result.list;
                options = self.getModelOptions(Object.assign({}, view, result.selection));
            }
            else {
                lists = [];
                options = self.getModelOptions();
            }
            return self._getArtists(options).then( (result) => {
                let items = [];
                result.items.forEach( (artist) => {
                    items.push(parser.parseToListItem(artist));
                });
                if (view.startIndex + result.items.length < result.total) { // don't use result.StartIndex (always returns 0)
                    items.push(self.constructNextPageItem(nextUri));
                }
                lists.push({
                    availableListViews: items.length > 0 ? ['list', 'grid'] : ['list'],
                    items: items
                });
                return {
                    prev: {
                        uri: prevUri
                    },
                    lists    
                };
            });
        })
        .then( nav => self.setPageTitle(view, nav) )
        .then ( nav => {
            defer.resolve({
                navigation: nav
            });
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    _getArtists(options) {
        let model = this.getModel('artist');
        return model.getArtists(options);
    }

    _getArtistType() {
        return 'artist';
    }

}

module.exports = ArtistViewHandler;