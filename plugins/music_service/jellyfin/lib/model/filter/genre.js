'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const BaseModel = require(__dirname + '/../base');

class GenreFilterModel extends BaseModel {

    getFilter(view = {}) {
        let self = this;
        let defer = libQ.defer();

        let selected = view.genreIds != undefined ? view.genreIds.split(',') : [];

        let queryOptions = {
            SortBy: 'SortName',
            SortOrder: 'Ascending',
            Recursive: true,
            parentId: view.parentId
        };
        self.getItems(queryOptions, '', 'getMusicGenres').then( genres => {
            let options = genres.items.map( genre => ({
                name: genre.Name,
                value: self._getValue(genre.Id, selected),
                selected: selected.includes(genre.Id)
            }) );

            defer.resolve({
                type: 'genre',
                title: jellyfin.getI18n('JELLYFIN_FILTER_GENRE_TITLE'),
                placeholder: jellyfin.getI18n('JELLYFIN_FILTER_GENRE_PLACEHOLDER'),
                field: 'genreIds',
                icon: 'fa fa-music',
                resettable: true,
                options
            });
        });

        return defer.promise;
    }

    getDefaultSelection(view) {
        return {
            genreIds: undefined
        };
    }

    _getValue(genreId, selected) {
        let newSelected = selected.filter( v => v != genreId );
        if (newSelected.length === selected.length) {
            newSelected = [...selected];
            newSelected.push(genreId);
        }
        return newSelected.join(',');
    }

}

module.exports = GenreFilterModel;