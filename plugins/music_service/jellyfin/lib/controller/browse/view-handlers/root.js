'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const BaseViewHandler = require(__dirname + '/base');

class RootViewHandler extends BaseViewHandler {

    browse() {
        let self = this;
        let parser = self.getParser('server');

        let availableServers = jellyfin.get('availableServers', []);

        let items = [];
        availableServers.forEach(server => {
            items.push(parser.parseToListItem(server));
        });
      
        return libQ.resolve({
            navigation: {
                prev: {
                    uri: '/'
                },
                lists: [
                    {
                        availableListViews: items.length > 0 ? ['list', 'grid'] : ['list'],
                        items: items
                    }
                ]
            }
        });
    }
    
}

module.exports = RootViewHandler;