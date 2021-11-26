'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');
const ExplodableViewHandler = require(__dirname + '/explodable');

const ARTICLE_CATEGORY_ALL = {
    url: 'all',
    name: 'All categories'
};

class ArticleViewHandler extends ExplodableViewHandler {

    browse() {
        let view = this.getCurrentView();
        if (view.articleUrl) {
            return this._browseArticle(decodeURIComponent(view.articleUrl));
        }
        else if (view.select) {
            return this._browseArticleCategories();
        }
        else {
            return this._browseArticleList();
        }
    }

    _browseArticleList() {
        let self = this;

        let prevUri = self.constructPrevUri();

        return self._getCategoryFromUriOrDefault().then( (category) => {
            let lists = [self._getParamsList(category)];
            
            return self._getArticleList(category).then( (articleList) => {
                lists.push(articleList);
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
        });
    }

    _getCategoryFromUriOrDefault() {
        let self = this;
        let defer = libQ.defer();

        let view = self.getCurrentView();
        if (view.categoryUrl === ARTICLE_CATEGORY_ALL.url) {
            defer.resolve(ARTICLE_CATEGORY_ALL);
        }
        else if (view.categoryUrl) {
            let categoryUrl = decodeURIComponent(view.categoryUrl);
            let model = self.getModel('article');
            model.getArticleCategories().then( (sections) => {
                let category = self._findCategoryInSections(categoryUrl, sections);
                if (category) {
                    defer.resolve(category);
                }
                else {
                    defer.resolve(ARTICLE_CATEGORY_ALL);
                }
            }).fail( (error) => {
                defer.resolve(ARTICLE_CATEGORY_ALL);
            });
        }
        else {
            defer.resolve(bandcamp.getConfigValue('defaultArticleCategory', ARTICLE_CATEGORY_ALL, true));
        }

        return defer.promise;
    }

    _findCategoryInSections(categoryUrl, sections) {
        let result;
        for (let i = 0; i < sections.length; i++) {
            let section = sections[i];
            if (section.sections) {
                result = this._findCategoryInSections(categoryUrl, section.sections);
                if (result) {
                    return result;
                }
            }
            else if (section.categories) {
                for (let ci = 0; ci < section.categories.length; ci++) {
                    let category = section.categories[ci];
                    if (category.url === categoryUrl) {
                        return category;
                    }
                }
            }
        }
        return null;
    }

    _getParamsList(category) {
        let setDefaultJS = `
                const params = ${JSON.stringify(category)};
                const payload = {
                    'endpoint': 'music_service/bandcamp',
                    'method': 'saveDefaultArticleCategory',
                    'data': params
                };
                angular.element('#browse-page').scope().browse.socketService.emit('callMethod', payload);`
        let setDefaultLink = {
            url: '#',
            icon: { type: 'fa', class: 'fa fa-cog' },
            text: bandcamp.getI18n('BANDCAMP_SET_DEFAULT_ARTICLE_CATEGORY'),
            onclick: setDefaultJS.replace(/\"/g, '&quot;').replace(/\r?\n|\r/g, '')
        };
        let title = UIHelper.constructListTitleWithLink(UIHelper.addBandcampIconToListTitle(bandcamp.getI18n('BANDCAMP_DAILY')), setDefaultLink, true);
        let paramsList = {
            title,
            availableListViews: ['list'],
            items: []
        };
        let categoryName = category.url !== ARTICLE_CATEGORY_ALL.url ? category.name : bandcamp.getI18n('BANDCAMP_ALL_CATEGORIES');
        paramsList.items.push({
            service: 'bandcamp',
            type: 'bandcampArticleCategory',
            title: categoryName,
            icon: 'fa fa-filter',
            uri: this.getUri() + '@select=category'
        });
        return paramsList;
    }

    _getArticleList(category) {
        let self = this;
        let view = self.getCurrentView();
        let model = self.getModel('article');
        let parser = self.getParser('article');

        let options = {
            limit: view.inSection ? bandcamp.getConfigValue('itemsPerSection', 5) : bandcamp.getConfigValue('itemsPerPage', 47)
        };

        if (view.pageRef) {
            let ref = self.parsePageRef(view.pageRef);
            options.pageToken = ref.pageToken;
            options.pageOffset = ref.pageOffset;
        }

        if (category.url !== ARTICLE_CATEGORY_ALL.url) {
            options.categoryUrl = category.url;
        }

        return model.getArticles(options).then( (results) => {
            let items = [];
            results.items.forEach( (article) => {
                items.push(parser.parseToListItem(article));
            });
            let nextPageRef = self.constructPageRef(results.nextPageToken, results.nextPageOffset);
            if (nextPageRef) {
                let nextUri = self.constructNextUri(nextPageRef);
                items.push(self.constructNextPageItem(nextUri));
            }
            return {
                availableListViews: ['list', 'grid'],
                items: items
            };
        });
    }

    _browseArticleCategories() {
        let self = this;

        let prevUri = self.constructPrevUri();
        let model = self.getModel('article');

        return self._getCategoryFromUriOrDefault().then( (currentCategory) => {
            let firstList = {
                title: UIHelper.addIconBefore('fa fa-filter', bandcamp.getI18n('BANDCAMP_ARTICLE_CATEGORIES')),
                availableListViews: ['list'],
                items: []
            };
            let allCategoriesTitle = bandcamp.getI18n('BANDCAMP_ALL_CATEGORIES');
            let isAllCategories = currentCategory.url === ARTICLE_CATEGORY_ALL.url;
            if (isAllCategories) {
                allCategoriesTitle = UIHelper.styleText(allCategoriesTitle, UIHelper.STYLES.LIST_ITEM_SELECTED);
            }
            firstList.items.push({
                service: 'bandcamp',
                type: 'bandcampArticleCategory',
                title: allCategoriesTitle,
                icon: isAllCategories ? 'fa fa-check' : 'fa',
                uri: self._constructArticleCategoryUri(ARTICLE_CATEGORY_ALL.url)
            })
            return model.getArticleCategories().then( (sections) => {
                let lists = self._getArticleCategoryListPerSection(sections, isAllCategories ? null : currentCategory);
                lists.unshift(firstList);

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
        });
    }

    _getArticleCategoryListPerSection(sections, currentCategory, lists = []) {
        let self = this;

        sections.forEach( (section) => {
            if (section.sections) {
                self._getArticleCategoryListPerSection(section.sections, currentCategory, lists);
            }
            else if (section.categories) {
                let categoryList = {
                    title: section.title,
                    availableListViews: ['list'],
                    items: []
                };
                section.categories.forEach( (category) => {
                    let isSelected = currentCategory ? currentCategory.url === category.url : false;
                    let title = category.name;
                    if (isSelected) {
                        title = UIHelper.styleText(title, UIHelper.STYLES.LIST_ITEM_SELECTED);
                    }
                    categoryList.items.push({
                        service: 'bandcamp',
                        type: 'bandcampArticleCategory',
                        title,
                        icon: isSelected ? 'fa fa-check' : 'fa',
                        uri: self._constructArticleCategoryUri(category.url)
                    });
                })
                lists.push(categoryList);
            }
        });

        return lists;
    }

    _constructArticleCategoryUri(categoryUrl) {
        let prevViews = this.getPreviousViews();
        let curView = Object.assign({}, this.getCurrentView());
        let currentCategoryUrl = curView.categoryUrl ? decodeURIComponent(curView.categoryUrl) : null;

        if (currentCategoryUrl !== categoryUrl) {
            delete curView.pageRef;
            delete curView.prevPageRefs;
            if (categoryUrl) {
                curView.categoryUrl = encodeURIComponent(categoryUrl);
            }
            else {
                delete curView.categoryUrl;
            }
        }
        delete curView.select;

        return this.constructUriFromViews(prevViews.concat(curView));
    }

    _browseArticle(articleUrl) {
        let self = this;
        let defer = libQ.defer();
        
        let prevUri = self.constructPrevUri();
        let articleModel = self.getModel('article');
        let articleParser = self.getParser('article');

        articleModel.getArticle(articleUrl).then( (article) => {
            let nav = {
                prev: {
                    uri: prevUri
                },
                info: articleParser.parseToHeader(article),
                lists: self._getArticleSectionLists(article)
            };

            defer.resolve({
                navigation: nav
            });

        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    _getArticleSectionLists(article) {
        // Each 'list' in Volumio contains the article section's text,
        // as well as the track featured in the next section (if any).
        // If the article covers a single media item (album / track) and
        // there is no nextSection, then all tracks will be shown instead
        // of just the featured track.
        let articleParser = this.getParser('article');
        let isSingleMediaItem = article.mediaItems.length === 1;
        //article.category.url.endsWith('/album-of-the-day');
        let lists = [];
        for (let sectionIndex = 0; sectionIndex < article.sections.length; sectionIndex++) {
            let section = article.sections[sectionIndex];
            let nextSection = article.sections[sectionIndex + 1];
            let title = '',
                items = [];

            // First section has 'View on Bandcamp' link
            if (sectionIndex === 0) {
                let viewArticleLink = {
                    url: article.url,
                    text: bandcamp.getI18n('BANDCAMP_VIEW_LINK_ARTICLE'),
                    icon: { type: 'bandcamp' },
                    target: '_blank'
                };
                title = UIHelper.constructListTitleWithLink('', viewArticleLink, true);
            }

            // Section text
            title += UIHelper.wrapInDiv(this._formatArticleText(section.text), UIHelper.STYLES.ARTICLE_SECTION.TEXT);

            // Next section's featured track (or all tracks if single media item)
            if (isSingleMediaItem && !nextSection) {
                let album = article.mediaItems.find( mi => mi.type === 'album' );
                if (album) {
                    let albumTitle = '';
                    if (album.artist) {
                        albumTitle = UIHelper.styleText(album.artist.name, UIHelper.STYLES.ARTICLE_SECTION.MEDIA_ITEM_ARTIST) + '<br/>';
                    }
                    albumTitle += UIHelper.styleText(album.name, UIHelper.STYLES.ARTICLE_SECTION.MEDIA_ITEM_NAME);
                    let titleWithGoto = UIHelper.constructListTitleWithLink(albumTitle, this._getGoToMediaItemLink(album), true);
                    titleWithGoto = UIHelper.wrapInDiv(titleWithGoto, 'position: relative; top: 18px;');
                    title += titleWithGoto;
                    album.tracks.forEach( (track) => {
                        items.push(articleParser.parseMediaItemTrack(article, album, track));
                    })
                }
            }
            else if (nextSection && nextSection.mediaItemRef) {
                let mediaItem = article.mediaItems.find( mi => mi.mediaItemRef === nextSection.mediaItemRef);
                if (mediaItem) {
                    let featuredTrack = mediaItem.tracks.find( tr => tr.position == mediaItem.featuredTrackPosition );
                    if (featuredTrack) {
                        let mediaItemTitle = '';
                        if (nextSection.heading) {
                            if (mediaItem.artist) {
                                mediaItemTitle = UIHelper.styleText(mediaItem.artist.name, UIHelper.STYLES.ARTICLE_SECTION.MEDIA_ITEM_ARTIST) + '<br/>';
                            }
                            mediaItemTitle += UIHelper.styleText(mediaItem.name, UIHelper.STYLES.ARTICLE_SECTION.MEDIA_ITEM_NAME);
                        }
                        let titleWithGoto = UIHelper.constructListTitleWithLink(mediaItemTitle, this._getGoToMediaItemLink(mediaItem), true);
                        if (!nextSection.heading) {
                            titleWithGoto = UIHelper.wrapInDiv(titleWithGoto, 'position: relative; top: 28px;');
                        }
                        else {
                            titleWithGoto = UIHelper.wrapInDiv(titleWithGoto, 'position: relative; top: 18px;');
                        }
                        title += titleWithGoto;
                        items.push(articleParser.parseMediaItemTrack(article, mediaItem, featuredTrack));
                    }
                }
            }

            if (sectionIndex > 0) {
                title = UIHelper.wrapInDiv(title, 'width: 100%; margin-top: -48px;');
            }
            else {
                title = UIHelper.wrapInDiv(title, 'width: 100%;');
            }

            lists.push({
                title,
                availableListViews: ['list'],
                items
            });
        }

        let moreUri = this.getUri() + '/articles@categoryUrl=' + encodeURIComponent(article.category.url);
        let moreItem = {
            service: 'bandcamp',
            type: 'item-no-menu',
            'title': bandcamp.getI18n('BANDCAMP_MORE_CATEGORY_ARTICLES', article.category.name),
            'uri': moreUri + '@noExplode=1',
            'icon': 'fa fa-arrow-circle-right'
        };

        let last = lists[lists.length - 1];
        if (last && last.items.length === 0) {
            last.items.push(moreItem);
        }
        else {
            lists.push({
                availableListViews: ['list'],
                items: [moreItem]
            })
        }

        return lists;
    }

    _formatArticleText(s) {
        return s.replace(/(?:\r\n|\r|\n)/g, '<br/>');
    }

    _getGoToMediaItemLink(mediaItem) {
        let baseUri = this.getUri();
        let gotoPath = baseUri + (mediaItem.type === 'album' ? '/album@albumUrl=' : '/track@trackUrl=') + encodeURIComponent(mediaItem.url);
        let gotoText = mediaItem.type === 'album' ? bandcamp.getI18n('BANDCAMP_GO_TO_ALBUM') : bandcamp.getI18n('BANDCAMP_GO_TO_TRACK');
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

    _constructUriWithParams(params) {
        let prevViews = this.getPreviousViews();
        let curView = Object.assign({}, this.getCurrentView(), params);

        return this.constructUriFromViews(prevViews.concat(curView));
    }

    getTracksOnExplode() {
        let self = this;

        let view = self.getCurrentView();
        if (!view.articleUrl) {
            return libQ.reject("Operation not supported");
        }

        let _setTrackProps = (track, article, mediaItem) => {
            let _track = Object.assign({}, track);
            // set props so track can be parsed
            _track.thumbnail = mediaItem.imageUrl;
            _track.artist = mediaItem.artist || {};
            if (mediaItem.type === 'album') {
                _track.album = {
                    name: mediaItem.name,
                    url: mediaItem.url
                };
            }

            // for _getTrackUri()
            _track.articleUrl = article.url;
            _track.mediaItemRef = mediaItem.mediaItemRef;

            return _track;
        }

        let model = self.getModel('article');
        return model.getArticle(decodeURIComponent(view.articleUrl)).then( (article) => {
            if (view.mediaItemRef && view.track) {
                // return track corresponding to mediaItemRef and track position
                let mediaItem = article.mediaItems.find( mi => mi.mediaItemRef === view.mediaItemRef);
                if (mediaItem) {
                    let track = mediaItem.tracks.find( tr => tr.position == view.track );
                    if (track) {
                        return _setTrackProps(track, article, mediaItem);
                    }
                }
                // not found
                return [];
            }
            else {
                // return all featured tracks
                let tracks = [];
                article.mediaItems.forEach( (mediaItem) => {
                    let track = mediaItem.tracks.find( tr => tr.position == mediaItem.featuredTrackPosition );
                    if (track) {
                        tracks.push(_setTrackProps(track, article, mediaItem));
                    }
                });
                return tracks;
            }
        });
    }

    /**
     * Override
     * 
     * Track uri:
     * bandcamp/article@articleUrl={articleUrl}@mediaItemRef={...}@track={trackPosition}@artistUrl={...}@albumUrl={...}
     */
    _getTrackUri(track) {
        let artistUrl = track.artist ? encodeURIComponent(track.artist.url) : null;
        let albumUrl = track.album ? encodeURIComponent(track.album.url) : artistUrl;

        let uri = `bandcamp/article@articleUrl=${encodeURIComponent(track.articleUrl)}@mediaItemRef=${track.mediaItemRef}@track=${track.position}`;

        if (artistUrl) {
            uri += `@artistUrl=${artistUrl}`;
        }
        if (albumUrl) {
            uri += `@albumUrl=${albumUrl}`;
        }

        return uri;
    }
}

module.exports = ArticleViewHandler;