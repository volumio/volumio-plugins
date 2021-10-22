'use strict';

const libQ = require('kew');
const bcfetch = require('bandcamp-fetch');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const BaseModel = require(__dirname + '/base');
const Label = require(bandcampPluginLibRoot + '/core/entities/label.js');

class LabelModel extends BaseModel {

    getLabel(labelUrl) {
        let self = this;
        let defer = libQ.defer();

        bandcamp.getCache().cacheOrPromise(self.getCacheKeyForFetch('label', { labelUrl }), () => {
            return bcfetch.limiter.getArtistOrLabelInfo(labelUrl, {
                imageFormat: self.getArtistImageFormat()
            });
        }).then( (info) => {
            defer.resolve(new Label(info.url, info.name, info.imageUrl, info.location));
        }).fail( (error) => {
            defer.reject(error);
        });

        return defer.promise;
    }
}

module.exports = LabelModel;