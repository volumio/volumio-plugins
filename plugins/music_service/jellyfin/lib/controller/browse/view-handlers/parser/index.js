'use strict';

const UserViewParser = require(__dirname + '/userview');
const AlbumParser = require(__dirname + '/album');
const PlaylistParser = require(__dirname + '/playlist');
const ArtistParser = require(__dirname + '/artist');
const AlbumArtistParser = require(__dirname + '/album-artist');
const GenreParser = require(__dirname + '/genre');
const SongParser = require(__dirname + '/song');
const CollectionParser = require(__dirname + '/collection');
const ServerParser = require(__dirname + '/server');

let typeToClass = {
    userView: UserViewParser,
    album: AlbumParser,
    playlist: PlaylistParser,
    artist: ArtistParser,
    albumArtist: AlbumArtistParser,
    genre: GenreParser,
    song: SongParser,
    collection: CollectionParser,
    server: ServerParser
};

let getInstance = (type, uri, curView, prevViews, apiClient) => {
    return new typeToClass[type](uri, curView, prevViews, apiClient);
}

module.exports = {
    getInstance: getInstance
};
