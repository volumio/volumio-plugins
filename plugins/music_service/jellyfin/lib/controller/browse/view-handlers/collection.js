'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin')
const BaseViewHandler = require(__dirname + '/base');

class CollectionViewHandler extends BaseViewHandler {

    browse() {
        let self = this;
        let defer = libQ.defer();
        let baseUri = self.getUri();
        let prevUri = self.constructPrevUri();
        let view = self.getCurrentView();
        let collectionId = view.parentId;
        let listPromises;

        if (view.itemType) {
            listPromises = [ self._getList(collectionId, view.itemType, baseUri) ];
        }
        else {
            listPromises = [
                self._getList(collectionId, 'album', baseUri, true),
                self._getList(collectionId, 'artist', baseUri, true),
                self._getList(collectionId, 'playlist', baseUri, true),
                self._getList(collectionId, 'song', baseUri, true)
            ];
        }

        libQ.all(listPromises).then( (lists) => {
            let finalLists = [];
            lists.forEach( (list) => {
                if (list.items.length) {
                    finalLists.push(list);
                }
            });
            return {
                prev: {
                    uri: prevUri
                },
                lists: finalLists
            }
        })
        .then( nav => self.setPageTitle(view, nav) )
        .then( nav => {
            defer.resolve({
                navigation: nav
            });
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    _getList(collectionId, itemType, baseUri, inSection = false) {
        let self = this;
        let defer = libQ.defer();

        let options = this.getModelOptions();
        if (inSection) {
            options.limit = jellyfin.getConfigValue('collectionInSectionItems', 11);
        }
        let moreUri = inSection ? `${ baseUri }/collection@parentId=${ collectionId }@itemType=${ itemType }` : self.constructNextUri();
        let title = jellyfin.getI18n(`JELLYFIN_${ itemType.toUpperCase() }S`);

        let model = self.getModel('collection');
        let parser = self.getParser(itemType);

        let fetch;
        switch (itemType) {
            case 'album':
                fetch = model.getAlbums(options);
                break;
            case 'artist':
                fetch = model.getArtists(options);
                break;
            case 'playlist':
                fetch = model.getPlaylists(options);
                break;
            case 'song':
                fetch = model.getSongs(options);
                break;
            default:
                fetch = libQ.resolve();
        }
        fetch.then( result => {
            let items = [];
            if (result) {
                result.items.forEach( item => {
                    if (itemType === 'artist') {
                        items.push(parser.parseToListItem(item, true));
                    }
                    else {
                        items.push(parser.parseToListItem(item));
                    }
                });
                if (result.startIndex + result.items.length < result.total) {
                    items.push(this.constructNextPageItem(moreUri, "<span style='color: #7a848e;'>" + jellyfin.getI18n('JELLYFIN_VIEW_MORE') + "</span>"));
                }
            }
            defer.resolve({
                title,
                availableListViews: ['list', 'grid'],
                items
            });
        }).fail( error => {
            defer.resolve({
                items: []
            })
        });

        return defer.promise;
    }
}

module.exports = CollectionViewHandler;