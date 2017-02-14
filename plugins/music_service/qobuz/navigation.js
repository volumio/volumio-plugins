'use strict';

module.exports = Navigation;

function Navigation() {

    var browse = function (views, items, prevUri) {
        return {
            navigation: {
                lists: [
                    {
                        "availableListViews": views,
                        "items": items
                    }
                ],
                "prev": {
                    uri: prevUri
                }
            }
        };
    };

    var searchResults = function (views, items, type, title) {
        return {
            type: type,
            title: title,
            availableListViews: views,
            items: items
        };
    };

    var item = function (type, title, artist, album, albumart, icon, uri) {
        return {
            service: 'qobuz',
            type: type,
            title: title,
            artist: artist,
            album: album,
            albumart: albumart,
            icon: icon,
            uri: uri
        };
    };

    var folder = function (title, artist, album, uri) {
        return item('folder', title, artist, album, '', 'fa fa-folder-open-o', uri);
    };

    var track = function (title, artist, album, uri) {
        return item('song', title, artist, album, '', 'fa fa-microphone', uri);
    };

    var navigationFolder = function (title, uri) {
        return folder(title, "", "", uri);
    };

    var editorialTypes = function () {
        return [
            { name: 'New Releases', value: 'new' },
            { name: 'Best Sellers', value: 'bestsellers' },
            { name: 'Most Streamed', value: 'moststreamed' },
            { name: 'Press Awards', value: 'press' },
            { name: 'Selected by Qobuz', value: 'editor' },
            { name: 'Selected by the Media', value: 'mostfeatured' }
        ];
    }

    return {
        browse: browse,
        editorialTypes: editorialTypes,
        searchResults: searchResults,
        item: item,
        folder: folder,
        track: track,
        navigationFolder: navigationFolder
    };
}