'use strict';

const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');

class AlbumArtHandler {

    constructor(apiClient) {
        this._apiClient = apiClient;
        this._albumArtPlugin = jellyfin.getAlbumArtPlugin();
    }

    getAlbumArt(item) {
        if (item.ImageTags && item.ImageTags.Primary) {
            return this._getAlbumArtWithApiClient(item);
        }

        let baseImgPath = 'music_service/jellyfin/assets/images/';
        let url;
        let defaultImg;

        // UserView - playlist
        if (item.Type === 'UserView' && item.CollectionType && item.CollectionType === 'playlists') {
            defaultImg = 'playlist.png';
        }
        // Library
        else if (item.Type === 'CollectionFolder' && item.CollectionType === 'music') {
            defaultImg = 'album.png';
        }
        // Music albums - fetch from web if possible (using AlbumArt plugin)
        else if (item.Type === 'MusicAlbum') {
            if (item.AlbumArtist) {
                url = this._getAlbumArtWithPlugin({
                    album: item.Name,
                    artist: item.AlbumArtist
                });
            }
            defaultImg = 'album.png';
        }
        // Artist - get art of artist
        else if (item.Type === 'MusicArtist') {
            url = this._getAlbumArtWithPlugin({
                artist: item.Name
            });
            defaultImg = 'avatar.png';
        }
        // Playlist
        else if (item.Type === 'Playlist') {
            defaultImg = 'playlist.png';
        }
        // Genre
        else if (item.Type === 'MusicGenre') {
            defaultImg = 'genre.png';
        }
        // Album songs - get art of album
        else if (item.Type === 'Audio' && item.AlbumId && item.AlbumPrimaryImageTag) {
            let album = { Id: item.AlbumId };
            url = this._getAlbumArtWithApiClient(album);
        }
        else {
            url = '/albumart';
        }

        if (defaultImg != undefined) {
            url = (url ? url + '&' : '/albumart?');
            url += 'sourceicon=' + encodeURIComponent(baseImgPath + defaultImg);
        }

        return url;
    }

    _getAlbumArtWithApiClient(item) {
        let options = {
            type:  'Primary',
            maxWidth:   400,
            maxHeight:  400,
            index:      0
        };
    
        return this._apiClient.getImageUrl(item.Id, options);
    }

    _getAlbumArtWithPlugin(data, path, icon) {
        return this._albumArtPlugin.getAlbumArt(data, path, icon);
    }

}

module.exports = AlbumArtHandler;