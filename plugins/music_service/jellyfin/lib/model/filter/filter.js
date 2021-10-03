'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const BaseModel = require(__dirname + '/../base');

class FilterFilterModel extends BaseModel {

    constructor(apiClient) {
        super(apiClient);

        this.FILTERS = {
            'albums': [
                { name: jellyfin.getI18n('JELLYFIN_FAVORITES'), value: 'IsFavorite' }
            ],
            'artists': [
                { name: jellyfin.getI18n('JELLYFIN_FAVORITES'), value: 'IsFavorite' }
            ],
            'albumArtists': [
                { name: jellyfin.getI18n('JELLYFIN_FAVORITES'), value: 'IsFavorite' }
            ],
            'songs': [
                { name: jellyfin.getI18n('JELLYFIN_FAVORITES'), value: 'IsFavorite' },
                { name: jellyfin.getI18n('JELLYFIN_PLAYED'), value: 'IsPlayed' },
                { name: jellyfin.getI18n('JELLYFIN_UNPLAYED'), value: 'IsUnplayed' }
            ]
        };
    }

    getFilter(view = {}) {
        let self = this;
        let defer = libQ.defer();

        let selected = view.filters != undefined ? view.filters.split(',') : [];

        let options = self.FILTERS[view.name].map( f => ({
            name: f.name,
            value: self._getValue(f.value, selected),
            selected: selected.includes(f.value)
        }) );

        defer.resolve({
            type: 'filter',
            title: jellyfin.getI18n('JELLYFIN_FILTER_FILTER_TITLE'),
            placeholder: jellyfin.getI18n('JELLYFIN_FILTER_FILTER_PLACEHOLDER'),
            field: 'filters',
            icon: 'fa fa-filter',
            resettable: true,
            options
        });

        return defer.promise;
    }

    _getValue(f, selected) {
        let newSelected = selected.filter( v => v != f );
        if (newSelected.length === selected.length) {
            newSelected = [...selected];
            newSelected.push(f);
        }
        return newSelected.join(',');
    }

    getDefaultSelection(view) {
        return {
            filters: undefined
        };
    }

}

module.exports = FilterFilterModel;