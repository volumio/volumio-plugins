'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const BaseViewHandler = require(__dirname + '/base');

class PlaylistViewHandler extends BaseViewHandler {

    browse() {
        let self = this;
        let defer = libQ.defer();

        let prevUri = self.constructPrevUri();
        let nextUri = self.constructNextUri();

        let view = self.getCurrentView();
        let model = self.getModel('playlist');
        let parser = self.getParser('playlist');
        let options = self.getModelOptions();

        model.getPlaylists(options).then( (playlists) => {
            let items = [];
            playlists.items.forEach( (playlist) => {
                items.push(parser.parseToListItem(playlist));
            });
            if (playlists.startIndex + playlists.items.length < playlists.total) {
                items.push(self.constructNextPageItem(nextUri));
            }
            return {
                prev: {
                    uri: prevUri
                },
                lists: [
                    {
                        availableListViews: items.length > 0 ? ['list', 'grid'] : ['list'],
                        items: items
                    }
                ]
            };
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

}

module.exports = PlaylistViewHandler;