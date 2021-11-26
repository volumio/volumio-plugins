'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const BaseModel = require(__dirname + '/../base');

class YearFilterModel extends BaseModel {

    getFilter(view = {}) {
        let self = this;
        let defer = libQ.defer();

        let selected = view.years != undefined ? view.years.split(',') : [];

        let queryOptions = {
            parentId: view.parentId,
        };
        if (view.name == 'albums') {
            queryOptions.IncludeItemTypes = 'MusicAlbum';
        }
        else if (view.name == 'songs') {
            queryOptions.IncludeItemTypes = 'Audio';
        }
        
        self.getFilters(queryOptions).then( filters => {
            let options = filters.Years.map( year => ({
                name: year,
                value: self._getValue(year, selected),
                selected: selected.includes(year.toString())
            }) );

            defer.resolve({
                type: 'year',
                title: jellyfin.getI18n('JELLYFIN_FILTER_YEAR_TITLE'),
                placeholder: jellyfin.getI18n('JELLYFIN_FILTER_YEAR_PLACEHOLDER'),
                field: 'years',
                icon: 'fa fa-calendar-o',
                resettable: true,
                options
            });
        });

        return defer.promise;
    }

    getDefaultSelection(view) {
        return {
            years: undefined
        };
    }

    _getValue(year, selected) {
        let newSelected = selected.filter( v => v != year );
        if (newSelected.length === selected.length) {
            newSelected = [...selected];
            newSelected.push(year);
        }
        return newSelected.join(',');
    }

}

module.exports = YearFilterModel;