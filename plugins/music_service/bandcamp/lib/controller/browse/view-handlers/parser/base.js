'use strict';

const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');

class BaseParser {

    constructor(uri, curView, prevViews, apiClient) {
        this._uri = uri;
        this._curView = curView;
        this._prevViews = prevViews;
        this._apiClient = apiClient;
    }

    parseToListItem(item) {
        return null;
    }

    parseToHeader(item) {
        return null;
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

    addType(type, text) {
        return UIHelper.addTextBefore(text, bandcamp.getI18n('BANDCAMP_' + type.toUpperCase()), UIHelper.STYLES.RESOURCE_TYPE);
    }
}

module.exports = BaseParser;