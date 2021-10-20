'use strict';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const ExplodableViewHandler = require(__dirname + '/explodable');

class DiscographyViewSupport extends ExplodableViewHandler {

    getDiscographyList(url) {
        let self = this;
        let defer = libQ.defer();
        
        let view = self.getCurrentView();
        let model = self.getModel('discography');
        let albumParser = self.getParser('album');
        let trackParser = self.getParser('track');

        let options = {
            limit: bandcamp.getConfigValue('itemsPerPage', 47),
            artistOrLabelUrl: url
        };

        if (view.pageRef) {
            let ref = self.parsePageRef(view.pageRef);
            options.pageToken = ref.pageToken;
            options.pageOffset = ref.pageOffset;
        }
       
        model.getDiscography(options).then( (results) => {
            let items = [];
            results.items.forEach( (result) => {
                if (result.type === 'album') {
                    items.push(albumParser.parseToListItem(result));
                }
                else {
                    items.push(trackParser.parseToListItem(result, true, true));
                }
            });
            let nextPageRef = self.constructPageRef(results.nextPageToken, results.nextPageOffset);
            if (nextPageRef) {
                let nextUri = self.constructNextUri(nextPageRef);
                items.push(self.constructNextPageItem(nextUri));
            }
            defer.resolve({
                title: bandcamp.getI18n('BANDCAMP_DISCOGRAPHY'),
                availableListViews: ['list', 'grid'],
                items: items
            });
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }

    getTracksOnExplode() {
        return libQ.reject("Operation not supported");
    }
}

module.exports = DiscographyViewSupport;