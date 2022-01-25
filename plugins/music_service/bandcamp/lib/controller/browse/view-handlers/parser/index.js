'use strict';

const AlbumParser = require(__dirname + '/album');
const ArtistParser = require(__dirname + '/artist');
const LabelParser = require(__dirname + '/label');
const TrackParser = require(__dirname + '/track');
const SearchResultParser = require(__dirname + '/search');
const ShowParser = require(__dirname + '/show');
const ArticleParser = require(__dirname + '/article');
const TagParser = require(__dirname + '/tag');

let typeToClass = {
    album: AlbumParser,
    artist: ArtistParser,
    label: LabelParser,
    track: TrackParser,
    search: SearchResultParser,
    show: ShowParser,
    article: ArticleParser,
    tag: TagParser
};

let getInstance = (type, uri, curView, prevViews) => {
    return new typeToClass[type](uri, curView, prevViews);
}

module.exports = {
    getInstance: getInstance
};
