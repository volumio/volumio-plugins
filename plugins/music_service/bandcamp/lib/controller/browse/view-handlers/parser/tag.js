'use strict';

const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');
const BaseParser = require(__dirname + '/base');

class TagParser extends BaseParser {

    parseToListItem(tag, uri, currentTagUrl) {
        let isSelected = tag.url === currentTagUrl;
        let title = tag.name;
        if (isSelected) {
            title = UIHelper.styleText(title, UIHelper.STYLES.LIST_ITEM_SELECTED);
        }
        return {
            service: 'bandcamp',
            type: 'bandcampTagItem',
            title,
            icon: isSelected ? 'fa fa-check' : 'fa',
            uri
        };
    }

    parseToHeader(tag) {
        let baseUri = this.getUri();
        let header = {
            'uri': baseUri,
            'service': 'bandcamp',
            'type': 'song',
            'title': tag.name,
            'artist': bandcamp.getI18n('BANDCAMP_HEADER_TAG'),
        };
        return header;
    }
}

module.exports = TagParser;