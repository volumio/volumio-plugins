'use strict';

const ViewHelper = require(bandcampPluginLibRoot + '/helper/view');
const RootViewHandler = require(__dirname + '/root');
const DiscoverViewHandler = require(__dirname + '/discover');
const ArtistViewHandler = require(__dirname + '/artist');
const LabelViewHandler = require(__dirname + '/label');
const AlbumViewHandler = require(__dirname + '/album');
const TrackViewHandler = require(__dirname + '/track');
const SearchViewHandler = require(__dirname + '/search');
const ShowViewHandler = require(__dirname + '/show');
const ArticleViewHandler = require(__dirname + '/article');
const TagViewHandler = require(__dirname + '/tag');

class ViewHandlerFactory {

    static getHandler(uri) {
        let self = this;

        let views = ViewHelper.getViewsFromUri(uri);
        let curView = views.pop();
        let prevViews = views;
        return new self._viewToClass[curView.name](uri, curView, prevViews);
    }
}

ViewHandlerFactory._viewToClass = {
    'root': RootViewHandler,
    'discover': DiscoverViewHandler,
    'artist': ArtistViewHandler,
    'label': LabelViewHandler,
    'album': AlbumViewHandler,
    'track': TrackViewHandler,
    'search': SearchViewHandler,
    'shows': ShowViewHandler,
    'articles': ArticleViewHandler,
    'tag': TagViewHandler
}

module.exports = ViewHandlerFactory;