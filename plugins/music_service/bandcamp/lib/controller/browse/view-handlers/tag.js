'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');
const ObjectHelper = require(bandcampPluginLibRoot + '/helper/object');
const ExplodableViewHandler = require(__dirname + '/explodable');

const FILTER_ICONS = {
    sort: 'fa fa-sort',
    location: 'fa fa-map-marker',
    format: 'fa fa-archive',
};
const FILTER_NAMES = ['format', 'location', 'sort'];

class TagViewHandler extends ExplodableViewHandler {

    browse() {
        let view = this.getCurrentView();
        if (view.select) {
            return view.select === 'tag' ? this._browseTags() : this._browseFilterOptions();
        }
        else if (view.tagUrl) {
            return this._browseReleases();
        }
        else {
            return this._browseTags();
        }
    }

    _browseTags() {
        let self = this;
        let defer = libQ.defer();

        let prevUri = self.constructPrevUri();
        let view = self.getCurrentView();
        let model = self.getModel('tag');
        let tagUrl = view.tagUrl ? decodeURIComponent(view.tagUrl) : null;

        model.getTags().then( (tags) => {
            
            let lists = [
                self._getTagsList(tags, 'tags', bandcamp.getI18n('BANDCAMP_TAGS'), 'fa fa-tag', tagUrl),
                self._getTagsList(tags, 'locations', bandcamp.getI18n('BANDCAMP_LOCATIONS'), 'fa fa-map-marker', tagUrl)
            ];
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

    _getTagsList(tags, key, title, icon, currentTagUrl) {
        let parser = this.getParser('tag');
        let items = [];
        tags[key].forEach( (tag) => {
            items.push(parser.parseToListItem(tag, this._constructTagUrl(tag.url), currentTagUrl));
        });
        title = UIHelper.addIconBefore(icon, title);
        return {
            title,
            availableListViews: ['list'],
            items
        };
    }

    _browseReleases() {
        let self = this;
        let defer = libQ.defer();
        
        let prevUri = self.constructPrevUri();       
        let view = self.getCurrentView();
        let model = self.getModel('tag');
        let tagUrl = decodeURIComponent(view.tagUrl);

        let options = {
            limit: bandcamp.getConfigValue('itemsPerPage', 47)
        };

        if (view.pageRef) {
            let ref = self.parsePageRef(view.pageRef);
            options.pageToken = ref.pageToken;
            options.pageOffset = ref.pageOffset;
        }
        
        model.getReleasesByTagFilterOptions(tagUrl).then( (filterOptions) => {

            let filters = {};
            filterOptions.filter( filter => FILTER_NAMES.includes(filter.name) ).forEach( filter => {
                let selectedOption = filter.options.find( o => o.selected );
                if (selectedOption) {
                    filters[filter.name] = selectedOption.value;
                }
            });
            options.filters = ObjectHelper.assignProps(filters, view, FILTER_NAMES);
            options.tagUrl = tagUrl;

            return model.getReleasesByTag(options).then( (releases) => {
                let baseUri = self._constructUriWithParams(releases.filters);
                let lists = [];
                lists.push(self._getSelectTagList(baseUri));
                lists.push(self._getFilterOptionsList(releases.filters, filterOptions, baseUri));
                lists.push(self._getReleasesList(releases));

                return lists;
            });

        }).then( (lists) => {
            let nav = {
                prev: {
                    uri: prevUri
                },
                lists
            };
            return {
                navigation: nav
            };

        }).then( (nav) => {
            model.getTag(tagUrl).then( (tag) => {
                let tagParser = self.getParser('tag');
                nav.navigation.info = tagParser.parseToHeader(tag);
                if (nav.navigation.lists[2].items.length) {
                    nav.navigation.info.albumart = nav.navigation.lists[2].items[0].albumart;
                }
                defer.resolve(nav);
            }).fail( (error) => {
                defer.resolve(nav);
            })

        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    _getSelectTagList(baseUri) {
        let items = [];
        items.push({
            service: 'bandcamp',
            type: 'bandcampTagOption',
            title: bandcamp.getI18n('BANDCAMP_SELECT_TAG'),
            icon: 'fa fa-tag',
            uri: baseUri + '@select=tag'
        });
        return {
            availableListViews: ['list'],
            items: items
        };
    }

    _getFilterOptionsList(current, all, baseUri) {
        let items = [];
        FILTER_NAMES.forEach( (o) => {
            let filterValue = current[o];
            if (filterValue != undefined) {
                let filter = all.find( f => f.name === o) || null;
                if (filter) {
                    let opt = filter.options.find( o => o.value == filterValue );
                    let title = opt ? opt.name : filterValue;
                    items.push({
                        service: 'bandcamp',
                        type: 'bandcampFilterOption',
                        title,
                        icon: FILTER_ICONS[o],
                        uri: baseUri + '@select=' + o
                    });
                }
            }
        });

        return {
            title: bandcamp.getI18n('BANDCAMP_RELEASES'),
            availableListViews: ['list'],
            items: items
        };
    }

    _getReleasesList(releases) {
        let self = this;
        let albumParser = self.getParser('album');
        let trackParser = self.getParser('track');
        let items = [];
        releases.items.forEach( (release) => {
            if (release.type === 'album') {
                items.push(albumParser.parseToListItem(release));
            }
            else if (release.type === 'track') {
                items.push(trackParser.parseToListItem(release, true, true));
            }
        });
        let nextPageRef = self.constructPageRef(releases.nextPageToken, releases.nextPageOffset);
        if (nextPageRef) {
            let nextUri = self.constructNextUri(nextPageRef);
            items.push(self.constructNextPageItem(nextUri));
        }
        return {
            availableListViews: ['list', 'grid'],
            items: items
        };
    }

    _browseFilterOptions() {
        let self = this;
        let defer = libQ.defer();

        let prevUri = self.constructPrevUri();
        let view = self.getCurrentView();
        let model = self.getModel('tag');
        let tagUrl = decodeURIComponent(view.tagUrl);

        model.getReleasesByTagFilterOptions(tagUrl).then( (filterOptions) => {
            let filter = filterOptions.find( f => f.name === view.select ) || null;
            let items = [];
            if (filter) {
                filter.options.forEach( (opt) => {
                    let isSelected = opt.value == view[view.select];
                    let title = opt.name;
                    if (isSelected) {
                        title = UIHelper.styleText(title, UIHelper.STYLES.LIST_ITEM_SELECTED);
                    }

                    items.push({
                        service: 'bandcamp',
                        type: 'bandcampFilterOption',
                        title,
                        icon: isSelected ? 'fa fa-check' : 'fa',
                        uri: self._constructFilterOptionUrl(view.select, opt.value)
                    });
                });
            }
            let title = bandcamp.getI18n(`BANDCAMP_SELECT_${view.select.toUpperCase()}`);
            title = UIHelper.addIconBefore(FILTER_ICONS[view.select], title);
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

    _constructTagUrl(tagUrl) {
        let prevViews = this.getPreviousViews();
        let curView = Object.assign({}, this.getCurrentView());

        if (curView.tagUrl !== tagUrl) {
            delete curView.pageRef;
            delete curView.prevPageRefs;
            curView.tagUrl = encodeURIComponent(tagUrl);
        }
        delete curView.select;

        return this.constructUriFromViews(prevViews.concat(curView));
    }

    _constructFilterOptionUrl(option, value) {
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

    getTracksOnExplode() {
        let self = this;

        let view = self.getCurrentView();
        if (!view.tagUrl) {
            return libQ.reject("Operation not supported");
        }

        //let defer = libQ.defer();
        let model = self.getModel('tag');
        let tagUrl = decodeURIComponent(view.tagUrl);

        let options = {
            limit: bandcamp.getConfigValue('itemsPerPage', 47)
        };

        if (view.pageRef) {
            let ref = self.parsePageRef(view.pageRef);
            options.pageToken = ref.pageToken;
            options.pageOffset = ref.pageOffset;
        }
        
        return model.getReleasesByTagFilterOptions(tagUrl).then( (filterOptions) => {

            let filters = {};
            filterOptions.filter( filter => FILTER_NAMES.includes(filter.name) ).forEach( filter => {
                let selectedOption = filter.options.find( o => o.selected );
                if (selectedOption) {
                    filters[filter.name] = selectedOption.value;
                }
            });
            options.filters = ObjectHelper.assignProps(filters, view, FILTER_NAMES);
            options.tagUrl = tagUrl;

            return model.getReleasesByTag(options).then( (releases) => {
                let tracks = [];
                releases.items.filter( r => r.type === 'track' || (r.featuredTrack && r.featuredTrack.streamUrl) ).forEach( release => {
                    let track;
                    if (release.type === 'album') {
                        track = {
                            name: release.featuredTrack.name,
                            thumbnail: release.thumbnail,
                            artist: release.artist,
                            album: {
                                name: release.name,
                                url: release.url
                            },
                            position: release.featuredTrack.position,
                            streamUrl: release.featuredTrack.streamUrl
                        }
                    }
                    else {
                        track = {
                            name: release.name,
                            url: release.url,
                            thumbnail: release.thumbnail,
                            artist: release.artist,
                            streamUrl: release.featuredTrack ? release.featuredTrack.streamUrl : null
                        }
                    }
                    tracks.push(track);
                });

                //defer.resolve(tracks);
                return tracks;

            })
        });
    }

    /**
     * Override
     * 
     * Track uri:
     * bandcamp/stream@streamUrl={...}
     */
    _getTrackUri(track) {
        let artistUrl = encodeURIComponent(track.artist.url);
        let albumUrl = track.album ? encodeURIComponent(track.album.url) : artistUrl;

        if (track.album) {
            return `bandcamp/album@albumUrl=${albumUrl}@track=${track.position}@artistUrl=${artistUrl}`;
        }
        else {
            return `bandcamp/track@trackUrl=${encodeURIComponent(track.url)}@artistUrl=${artistUrl}@albumUrl=${albumUrl}`;
        }
        
    }

}

module.exports = TagViewHandler;