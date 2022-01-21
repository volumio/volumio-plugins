'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const Model = require(jellyfinPluginLibRoot + '/model')
const Parser = require(__dirname + '/parser');
const AlbumArtHandler = require(jellyfinPluginLibRoot + '/util/albumart');

class BaseViewHandler {

    constructor(uri, curView, prevViews) {
        this._uri = uri;
        this._curView = curView;
        this._prevViews = prevViews;
        this._apiClient = null;
        this._models = {};
        this._parsers = {};
    }

    browse() {
        return libQ.resolve([]);
    }

    explode() {
        return libQ.reject("Operation not supported");
    }

    getUri() {
        return this._uri;
    }

    getCurrentView() {
        return this._curView;
    }

    getPreviousViews() {
        return this._prevViews;
    }

    setApiClient(apiClient) {
        this._apiClient = apiClient;
    }

    getApiClient() {
        return this._apiClient;
    }

    getModel(type) {
        if (this._models[type] == undefined) {
            this._models[type] = Model.getInstance(type, this.getApiClient());
        }
        return this._models[type];
    }

    getParser(type) {
        if (this._parsers[type] == undefined) {
            this._parsers[type] = Parser.getInstance(type, this.getUri(), this.getCurrentView(), this.getPreviousViews(), this.getApiClient());
        }
        return this._parsers[type];
    }

    getAlbumArt(item) {
        if (this._albumArtHandler == undefined) {
            this._albumArtHandler = new AlbumArtHandler(this.getApiClient());
        }
        return this._albumArtHandler.getAlbumArt(item);
    }

    constructPrevUri() {
        let curView = this.getCurrentView();
        let prevViews = this.getPreviousViews();
       
        let segments = [];
        
        prevViews.forEach( (view) => {
            segments.push(this._constructUriSegment(view));
        });
        
        if (curView.startIndex) {
            segments.push(this._constructUriSegment(curView, -jellyfin.getConfigValue('itemsPerPage', 47)));
        }

        return segments.join('/');
    }

    constructNextUri() {
        let curView = this.getCurrentView();
        let prevViews = this.getPreviousViews();
       
        let segments = [];
        
        prevViews.forEach( (view) => {
            segments.push(this._constructUriSegment(view));
        });

        segments.push(this._constructUriSegment(curView, jellyfin.getConfigValue('itemsPerPage', 47)));

        return segments.join('/');
    }

    _constructUriSegment(view, addToStartIndex = 0) {

        let segment;
        if (view.name === 'root') {
            segment = 'jellyfin';
        }
        else if (view.name === 'userViews') {
            segment = view.serverId;
        }
        else {
            segment = view.name;
        }

        let skip = ['name', 'startIndex', 'serverId', 'saveFilter', 'noExplode'];
        Object.keys(view).filter( key => !skip.includes(key) ).forEach( (key) => {
            segment += '@' + key + '=' + view[key];
        });

        let startIndex = 0;
        if (addToStartIndex) {
            startIndex = view.startIndex + addToStartIndex;
            if (startIndex < 0) {
                startIndex = 0;
            }
        }
        if (startIndex > 0) {
            segment += '@startIndex=' + startIndex;
        }

        return segment;
    }

    constructNextPageItem(nextUri, title = "<span style='color: #7a848e;'>" + jellyfin.getI18n('JELLYFIN_NEXT_PAGE') + "</span>") {
        let data = {
            service: 'jellyfin',
            type: 'streaming-category',
            'title': title,
            'uri': nextUri + '@noExplode=1',
            'icon': 'fa fa-arrow-circle-right'
        }
        return data;
    }

    getModelOptions(bundle) {
        let defaults = {
            startIndex: 0,
            limit: jellyfin.getConfigValue('itemsPerPage', 47),
            sortBy: 'SortName',
            sortOrder: 'Ascending'
        };
        let props = Object.assign(defaults, bundle || this.getCurrentView());
        let options = this._assignIfExists(props, {}, [
            'startIndex',
            'limit',
            'sortBy',
            'sortOrder',
            'recursive',
            'includeMediaSources',
            'parentId',
            'artistId',
            'albumArtistId',
            'genreId',
            'genreIds', // comma-delimited
            'search', // URI-encoded string
            'filters', // comma-delimited; e.g. 'IsFavorite, IsPlayed'
            // 'genres', // comma-delimited; each genre name is URI-encoded
            'years', // comma-delimited
            'nameStartsWith'
        ]);

        if (options.search != undefined) {
            options.search = decodeURIComponent(options.search);
        }

        return options;
    }

    _assignIfExists(from, to, props) {
        props.forEach( p => {
            if (from[p] != undefined) {
                to[p] = from[p];
            }
        });

        return to;
    }

    /**
     * Returns object:
     * {
     *  sortBy: ...
     *  sortOrder: ...
     *  genreIds: ...
     *  ...
     * }
     * @param {*} saveKey Key used to retrieve a saved selection
     * @param {...any} types Filter types
     */
    _getFilterSelection(saveKey, ...types) {
        let self = this;

        let defaultSelection = self._getDefaultFilterSelection(...types);
        let savedSelection = self._getSavedFilterSelection(saveKey);

        let selectionFromView = {};
        let fields = Object.keys(defaultSelection);
        let view = self.getCurrentView();
        fields.forEach( f => {
            if (view[f] != undefined) {
                selectionFromView[f] = view[f];
            }
        });
        
        // Remove fields with undefined values from default selection
        let cleanDefaultSelection = {};
        for (const [field, value] of Object.entries(defaultSelection)) {
            if (value != undefined) {
                cleanDefaultSelection[field] = value;
            }
        }

        return Object.assign(
            {}, cleanDefaultSelection, savedSelection, selectionFromView);
    }

    _getDefaultFilterSelection(...types) {
        let self = this;
        let view = self.getCurrentView();
        let selections = types.map( t => {
            let model = self.getModel(`filter.${t}`);
            return model.getDefaultSelection(view);
        });

        return Object.assign({}, ...selections);
    }

    _getSavedFilterSelection(key) {
        let remember = jellyfin.getConfigValue('rememberFilters', true);
        if (remember) {
            let view = this.getCurrentView();
            let selection = jellyfin.getConfigValue('savedFilters');
            if (selection != undefined) {
                let fullKey = view.serverId + '.' + key;
                selection = JSON.parse(selection);
                return selection[fullKey] || {};
            }
        }
        else {
            return {};
        }
    }

    getFilterList(saveKey, ...types) {
        let self = this;
        let defer = libQ.defer();
        let baseUri = self.getUri();

        let filterView = self._getFilterSelection(saveKey, ...types);
        let view = self.getCurrentView();
        filterView.name = view.name;
        let promises = types.map( t => {
            let model = self.getModel(`filter.${t}`);
            return model.getFilter(filterView);
        });
        libQ.all(promises).then( filters => {
            let listItems = [];
            filters.forEach( filter => {
                let title;
                if (filter.subfilters) {
                    let subfilterTexts = filter.subfilters.map( f => self._getFilterListItemText(f) );
                    title = subfilterTexts.join(', ');
                }
                else {
                    title = self._getFilterListItemText(filter);
                }

                listItems.push({
                    service: 'jellyfin',
                    type: 'jellyfinFilter',
                    title,
                    icon: filter.icon,
                    uri: baseUri + `/filter.${filter.type}@filterView=${ encodeURIComponent(JSON.stringify(filterView)) }`
                });
            });
            let list = [
                {
                    availableListViews: ['list'],
                    items: listItems
                }
            ]
            defer.resolve({
                list,
                selection: filterView
            });
        });

        return defer.promise;
    }

    _getFilterListItemText(filter) {
        let selected = filter.options.filter( o => o.selected ) ;
        if (selected.length > 0) {
            return selected.map( o => o.name ).join(', ');
        }
        else {
            return filter.placeholder;
        }
    }

    setPageTitle(view, nav) {
        let self = this;
        let defer = libQ.defer();
        
        let getLink = data => {
            let onclick = `angular.element('#browse-page').scope().browse.fetchLibrary({uri: '${ data.uri }'})`;
            return `<a href="#" onclick="${ onclick }">${ data.text }</a>`;
        };

        let itemText;
        // If first list already has a title, use that. Otherwise, deduce from view.
        if (nav.lists[0].title != undefined) {
            itemText = nav.lists[0].title;
        }
        else if (view.fixedView != undefined) {
            let itemTextKey;
            switch(view.fixedView) {
                case 'latest':
                    itemTextKey = `LATEST_${view.name.toUpperCase()}`;
                    break;
                case 'recentlyPlayed':
                    itemTextKey = `RECENTLY_PLAYED_${view.name.toUpperCase()}`;
                    break;
                case 'frequentlyPlayed':
                    itemTextKey = `FREQUENTLY_PLAYED_${view.name.toUpperCase()}`;
                    break;
                case 'favorite':
                    itemTextKey = `FAVORITE_${view.name.toUpperCase()}`;
                    break;
                default:
                    itemTextKey = null;
            }
            itemText = itemTextKey ? jellyfin.getI18n(`JELLYFIN_${itemTextKey}`) : '';
        }
        else if (view.search != undefined) {
            let itemName = jellyfin.getI18n(`JELLYFIN_${view.name.toUpperCase()}`);
            itemText = itemName ? jellyfin.getI18n('JELLYFIN_ITEMS_MATCHING', itemName, view.search) : '';
        }
        else {
            itemText = jellyfin.getI18n(`JELLYFIN_${view.name.toUpperCase()}`);
        }

        // Crumb links
        let serverLinkData = {
            uriSegment: `jellyfin/${ view.serverId }`,
            text: self.getApiClient().serverInfo().Name
        };
        let allViews = self.getPreviousViews().concat([ view ]);
        // For 'Latest Albums in <library>' referred directly from 'My Media'
        if (view.name === 'albums' && view.parentId) {
            allViews.push({
                name: 'library',
                parentId: view.parentId
            });
        }
        let processedViews = [];
        // First is always server link
        let linkPromises = [ libQ.resolve(serverLinkData) ];
        // Subsequent links
        for (let i = 2; i < allViews.length; i++) {
            let pv = allViews[i];
            if (!processedViews.includes(pv.name)) {
                if (pv.name === 'collections') {
                    let model = self.getModel('userView');
                    let linkDataFetch = model.getUserView(pv.parentId)
                        .then( userView => {
                            return {
                                uriSegment: `collections@parentId=${ pv.parentId }`,
                                text: userView.Name
                            };
                        });
                    linkPromises.push(linkDataFetch);
                }
                else if (pv.name === 'collection') {
                    let model = self.getModel('collection');
                    let linkDataFetch = model.getCollection(pv.parentId)
                        .then( collection => {
                            return {
                                uriSegment: `collection@parentId=${ pv.parentId }`,
                                text: collection.Name
                            };
                        });
                    linkPromises.push(linkDataFetch);
                }
                else if (pv.name === 'playlists') {
                    linkPromises.push(libQ.resolve({
                        uriSegment: 'playlists',
                        text: jellyfin.getI18n('JELLYFIN_PLAYLISTS')
                    }));
                }
                else if (pv.name === 'library') {
                    let model = self.getModel('userView');
                    let linkDataFetch = model.getUserView(pv.parentId)
                        .then( userView => {
                            return {
                                uriSegment: `library@parentId=${ pv.parentId }`,
                                text: userView.Name
                            };
                        });
                    linkPromises.push(linkDataFetch);
                }
                processedViews.push(pv.name);
            }
        }
        let crumbLinks = libQ.all(linkPromises).then( linkResults => {
            let lastLinkUri;
            let links = [];
            linkResults.forEach( linkData => {
                let linkUri;
                if (lastLinkUri) {
                    linkUri = `${ lastLinkUri }/${ linkData.uriSegment }`;
                }
                else {
                    linkUri = linkData.uriSegment;
                }
                lastLinkUri = linkUri;
                links.push({
                    uri: linkUri,
                    text: linkData.text
                });
            })
            return links;
        });

        crumbLinks.then( links => {
            if (itemText || links.length > 0) {
                let jointLinks = [];
                links.forEach( (link, i) => {
                    if (jointLinks.length > 0) {
                        jointLinks += '<i class="fa fa-angle-right" style="margin: 0px 10px;"></i>';
                    }
                    jointLinks += `<span${ i > 0 && i === links.length - 1 ? ' style="font-size: 18px;"' : ''}>${ getLink(link) }</span>`;
                });
                nav.lists[0].title = `
                <div style="width: 100%;">
                    <div style="display: flex; align-items: center; font-size: 14px; border-bottom: 1px dotted; border-color: #666; padding-bottom: 10px;">
                        <img src="/albumart?sourceicon=${ encodeURIComponent('music_service/jellyfin/assets/images/jellyfin.svg') }" style="width: 18px; height: 18px; margin-right: 8px;">${ jointLinks }
                    </div>
                    ${ itemText && itemText != links[links.length - 1].text ? `<div style="margin-top: 25px;">${ itemText }</div>` : ''}
                </div>`;
            }
            defer.resolve(nav);
        })

        return defer.promise;
    }

    saveFilters(key) {
        let remember = jellyfin.getConfigValue('rememberFilters', true);
        let view = this.getCurrentView();
        if (remember && view.saveFilter != undefined) {
            let saveFilterInfo = JSON.parse(decodeURIComponent(view.saveFilter));
            let saved = jellyfin.getConfigValue('savedFilters');
            if (saved == undefined) {
                saved = {};
            }
            else {
                saved = JSON.parse(saved);
            }
            let fullKey = view.serverId + '.' + key;
            if (saved[fullKey] == undefined) {
                saved[fullKey] = {};
            }
            if (saveFilterInfo.value != null) {
                saved[fullKey][saveFilterInfo.field] = saveFilterInfo.value;
            }
            else {
                delete saved[fullKey][saveFilterInfo.field];
            }
            let savedJson = JSON.stringify(saved);
            jellyfin.setConfigValue('savedFilters', savedJson);

            jellyfin.getLogger().info('[jellyfin-browse] Filters saved: ' + savedJson);
        }
    }
}

module.exports = BaseViewHandler