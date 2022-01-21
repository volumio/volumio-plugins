'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');
const BaseViewHandler = require(__dirname + '/base');

const DISCOVER_OPTION_ICONS = {
    genre: 'fa fa-music',
    subgenre: 'fa fa-filter',
    sortBy: 'fa fa-sort',
    artistRecommendationType: 'fa fa-thumbs-o-up',
    location: 'fa fa-map-marker',
    format: 'fa fa-archive',
    time: 'fa fa-clock-o'
};

class DiscoverViewHandler extends BaseViewHandler {

    browse() {
        let view = this.getCurrentView();
        if (view.select) {
            return this._browseDiscoverOptions();
        }
        else {
            return this._browseDiscoverResults();
        }
    }

    _browseDiscoverResults() {
        let self = this;
        let defer = libQ.defer();
        
        let prevUri = self.constructPrevUri();       
        let view = self.getCurrentView();
        let model = self.getModel('discover');

        let options = {
            limit: view.inSection ? bandcamp.getConfigValue('itemsPerSectionDiscover', 11) : bandcamp.getConfigValue('itemsPerPage', 47)
        };

        if (view.pageRef) {
            let ref = self.parsePageRef(view.pageRef);
            options.pageToken = ref.pageToken;
            options.pageOffset = ref.pageOffset;
        }

        options = Object.assign(options, self._getDiscoverParamsFromUriOrDefault());
        
        model.getDiscoverOptions().then( (discoverOptions) => {

            return model.getDiscoverResults(options).then( (albums) => {
                let lists = [];
                lists.push(self._getParamsList(albums.params, discoverOptions));
                lists.push(self._getAlbumsList(albums));

                return lists;
            });

        }).then( (lists) => {
            let nav = {
                prev: {
                    uri: prevUri
                },
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

    _getDiscoverParamsFromUriOrDefault() {
        let view = this.getCurrentView();
        let params = {};
        if (view.genre) {
            params.genre = view.genre;

            if (view.subgenre) {
                params.subgenre = view.subgenre;
            }
        }
        if (view.sortBy) {
            params.sortBy = view.sortBy;

            if (view.artistRecommendationType) {
                params.artistRecommendationType = view.artistRecommendationType;
            }
        }
        if (view.location) {
            params.location = view.location;
        }
        if (view.format) {
            params.format = view.format;
        }
        if (view.time) {
            params.time = view.time;
        }

        if (Object.keys(params).length) {
            return params;
        }
        else {
            let defaultParams = bandcamp.getConfigValue('defaultDiscoverParams', null, true);
            return defaultParams || {};
        }
    }

    _getParamsList(params, discoverOptions) {
        let self = this;
        let baseUri = self._constructUriWithParams(params);
        let view = this.getCurrentView();
        let items = [];
        ['genre', 'subgenre', 'sortBy', 'artistRecommendationType', 'location', 'format', 'time'].forEach( (o) => {
            let paramValue = params[o];
            if (paramValue != undefined) {
                let optArr = discoverOptions[`${o}s`] || [];
                if (o === 'subgenre') {
                    optArr = optArr[params.genre] || [];
                }
                if (optArr.length) {
                    let opt = optArr.find( o => o.value == paramValue );
                    let title = opt ? opt.name : optArr[0].name;
                    items.push({
                        service: 'bandcamp',
                        type: 'bandcampDiscoverOption',
                        title,
                        icon: DISCOVER_OPTION_ICONS[o],
                        uri: baseUri + '@select=' + o
                    });
                }
            }
        });
        let setDefaultJS = `
                const params = ${JSON.stringify(params)};
                const payload = {
                    'endpoint': 'music_service/bandcamp',
                    'method': 'saveDefaultDiscoverParams',
                    'data': params
                };
                angular.element('#browse-page').scope().browse.socketService.emit('callMethod', payload);`
        let setDefaultLink = {
            url: '#',
            icon: { type: 'fa', class: 'fa fa-cog' },
            text: bandcamp.getI18n('BANDCAMP_SET_DEFAULT_DISCOVER_PARAMS'),
            onclick: setDefaultJS.replace(/\"/g, '&quot;').replace(/\r?\n|\r/g, '')
        };

        let links = [
            setDefaultLink,
            self._getBrowseByTagsLink()
        ];

        let title = UIHelper.constructListTitleWithLink(UIHelper.addBandcampIconToListTitle(bandcamp.getI18n(view.inSection ? 'BANDCAMP_DISCOVER_SHORT' : 'BANDCAMP_DISCOVER')), links, true);

        return {
            title,
            availableListViews: ['list'],
            items: items
        };
    }

    _getBrowseByTagsLink() {
        let baseUri = this.getUri();
        let gotoPath = baseUri + '/tag';
        let gotoText = bandcamp.getI18n('BANDCAMP_BROWSE_BY_TAGS');
        let gotoLink = {
            url: '#',
            text: gotoText,
            onclick: 'angular.element(\'#browse-page\').scope().browse.fetchLibrary({uri: \'' + gotoPath + '\'})',
            icon: {
                type: 'fa',
                class: 'fa fa-arrow-circle-right',
                float: 'right',
                color: '#54c688'
            }
        };
        return gotoLink;
    }

    _getAlbumsList(albums) {
        let self = this;
        let parser = self.getParser('album');
        let items = [];
        albums.items.forEach( (album) => {
            items.push(parser.parseToListItem(album));
        });
        let nextPageRef = self.constructPageRef(albums.nextPageToken, albums.nextPageOffset);
        if (nextPageRef) {
            let nextUri = self.constructNextUri(nextPageRef);
            items.push(self.constructNextPageItem(nextUri));
        }
        return {
            availableListViews: ['list', 'grid'],
            items: items
        };
    }

    _browseDiscoverOptions() {
        let self = this;
        let defer = libQ.defer();

        let prevUri = self.constructPrevUri();
        let view = self.getCurrentView();
        let model = self.getModel('discover');

        model.getDiscoverOptions().then( (discoverOptions) => {
            let optArr = discoverOptions[`${view.select}s`] || [];
            if (view.select === 'subgenre' && optArr) {
                optArr = optArr[view.genre] || [];
            }
            let items = [];
            optArr.forEach( (opt) => {
                let isSelected = opt.value == view[view.select];
                let title = opt.name;
                if (isSelected) {
                    title = UIHelper.styleText(title, UIHelper.STYLES.LIST_ITEM_SELECTED);
                }

                items.push({
                    service: 'bandcamp',
                    type: 'bandcampDiscoverOption',
                    title,
                    //icon: isSelected ? 'fa fa-check-circle-o' : 'fa fa-circle-o',
                    icon: isSelected ? 'fa fa-check' : 'fa',
                    uri: self._constructDiscoverOptionUri(view.select, opt.value)
                });
            });
            let title = bandcamp.getI18n(`BANDCAMP_SELECT_${view.select.toUpperCase()}`);
            title = UIHelper.addIconBefore(DISCOVER_OPTION_ICONS[view.select], title);
            let lists = [{
                title,
                availableListViews: ['list'],
                items: items
            }];
            let nav = {
                prev: {
                    uri: prevUri
                },
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

    _constructDiscoverOptionUri(option, value) {
        let prevViews = this.getPreviousViews();
        let curView = Object.assign({}, this.getCurrentView());

        if (curView[option] !== value) {
            delete curView.pageRef;
            delete curView.prevPageRefs;
            curView[option] = value;
        }
        delete curView.select;

        return this.constructUriFromViews(prevViews.concat(curView));
    }

    _constructUriWithParams(params) {
        let prevViews = this.getPreviousViews();
        let curView = Object.assign({}, this.getCurrentView(), params);

        return this.constructUriFromViews(prevViews.concat(curView));
    }

    /*constructPrevUri() {
        let prevUri = super.constructPrevUri();
        if (prevUri === 'bandcamp') {
            prevUri = '';
        }
        return prevUri;
    }*/
}

module.exports = DiscoverViewHandler;