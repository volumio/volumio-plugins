'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const ViewHandlerFactory = require(bandcampPluginLibRoot  + '/controller/browse/view-handlers/factory');
const UIHelper = require(bandcampPluginLibRoot + '/helper/ui');

class SearchController {

    search(query) {
        let self = this;
        let defer = libQ.defer();
        
        let safeQuery = encodeURIComponent(query.value.replace(/"/g, '\\"'));
        let searchUri = `bandcamp/search@query=${safeQuery}@combinedSearch=1`;

        let handler = ViewHandlerFactory.getHandler(searchUri);
        handler.browse().then( (result) => {
            if (result.navigation.lists.length && result.navigation.lists[0].items.length) {
                result.navigation.lists[0].title = UIHelper.addBandcampIconToListTitle(bandcamp.getI18n('BANDCAMP_SEARCH_TITLE'));
                defer.resolve(result.navigation.lists);
            }
            else {
                defer.resolve([]);
            }
        }).fail( (error) => {
            bandcamp.getLogger().error('[bandcamp-search] search() error:');
            bandcamp.getLogger().error(error);
            defer.resolve([]);
        });       

        return defer.promise;
    }
}

module.exports = SearchController;