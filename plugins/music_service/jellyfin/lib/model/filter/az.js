'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const BaseModel = require(__dirname + '/../base');

const AZ = ['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z'];

class AZFilterModel extends BaseModel {

    getFilter(view = {}) {
        let defer = libQ.defer();

        let options = AZ.map( c => ({
            name: c,
            value: c,
            selected: c == view.nameStartsWith
        }) );
        
        defer.resolve({
            type: 'az',
            title: jellyfin.getI18n('JELLYFIN_FILTER_AZ_TITLE'),
            placeholder: jellyfin.getI18n('JELLYFIN_FILTER_AZ_PLACEHOLDER'),
            field: 'nameStartsWith',
            icon: 'fa fa-font',
            resettable: true,
            options
        });

        return defer.promise;
    }

    getDefaultSelection(view) {
        return {
            nameStartsWith: undefined
        };
    }

}

module.exports = AZFilterModel;