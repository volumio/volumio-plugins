'use strict';

const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const ArtistParser = require(__dirname + '/artist');

class LabelParser extends ArtistParser {

    parseToHeader(label) {
        let header = super.parseToHeader(label);
        header.artist = bandcamp.getI18n('BANDCAMP_HEADER_LABEL');
        return header;
    }
}

module.exports = LabelParser;