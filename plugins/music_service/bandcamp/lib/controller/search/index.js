'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const ViewHandlerFactory = require(bandcampPluginLibRoot  + '/controller/browse/view-handlers/factory');

class SearchController {

    search(query) {
        let defer = libQ.defer();
        
        let safeQuery = encodeURIComponent(query.value.replace(/"/g, '\\"'));
        let searchUri = `bandcamp/search@query=${safeQuery}@combinedSearch=1`;

        let browsePromises = [];
        if (bandcamp.getConfigValue('searchByItemType', true)) {
            ['artistsAndLabels', 'albums', 'tracks'].forEach( itemType => {
                let handler = ViewHandlerFactory.getHandler(searchUri + '@itemType=' + itemType);
                browsePromises.push(handler.browse());
            });
        }
        else {
            let handler = ViewHandlerFactory.getHandler(searchUri);
            browsePromises.push(handler.browse());
        }

        libQ.all(browsePromises).then( results => {
            let lists = [];
            results.forEach( result => {
                result.navigation.lists.forEach( list => {
                    if (list.items.length > 0) {
                        lists.push(list);
                    }
                });
            });
            defer.resolve(lists);
        }).fail( (error) => {
            bandcamp.getLogger().error('[bandcamp-search] search() error:');
            bandcamp.getLogger().error(error);
            defer.resolve([]);
        });       

        return defer.promise;
    }
}

module.exports = SearchController;