'use strict';

const UserViewModel = require(__dirname + '/userview');
const AlbumModel = require(__dirname + '/album');
const PlaylistModel = require(__dirname + '/playlist');
const ArtistModel = require(__dirname + '/artist');
const AlbumArtistModel = require(__dirname + '/album-artist');
const GenreModel = require(__dirname + '/genre');
const SongModel = require(__dirname + '/song');
const CollectionModel = require(__dirname + '/collection');
const AZFilterModel = require(__dirname + '/filter/az');
const GenreFilterModel = require(__dirname + '/filter/genre');
const YearFilterModel = require(__dirname + '/filter/year');
const FilterFilterModel = require(__dirname + '/filter/filter');
const SortFilterModel = require(__dirname + '/filter/sort');

let typeToClass = {
    userView: UserViewModel,
    album: AlbumModel,
    playlist: PlaylistModel,
    artist: ArtistModel,
    albumArtist: AlbumArtistModel,
    genre: GenreModel,
    song: SongModel,
    collection: CollectionModel,
    'filter.az': AZFilterModel,
    'filter.genre': GenreFilterModel,
    'filter.year': YearFilterModel,
    'filter.filter': FilterFilterModel,
    'filter.sort': SortFilterModel
};

let getInstance = (type, apiClient) => {
    return new typeToClass[type](apiClient);
}

module.exports = {
    getInstance: getInstance
};