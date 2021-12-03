'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin')
const BaseViewHandler = require(__dirname + '/base');

class CollectionsViewHandler extends BaseViewHandler {

    browse() {
        let self = this;
        let defer = libQ.defer();

        let prevUri = self.constructPrevUri();
        let nextUri = self.constructNextUri();

        let view = self.getCurrentView();
        let model = self.getModel('collection');
        let parser = self.getParser('collection');
        let options = self.getModelOptions();

        model.getCollections(options).then( collections => {
            let items = [];
            collections.items.forEach( collection => {
                items.push(parser.parseToListItem(collection));
            });
            if (collections.startIndex + collections.items.length < collections.total) {
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

module.exports = CollectionsViewHandler;