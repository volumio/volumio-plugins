'use strict';

const libQ = require('kew');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const BaseModel = require(__dirname + '/../base');

class FilterSortModel extends BaseModel {

    constructor(apiClient) {
        super(apiClient);

        this.SORT_BYS = {
            'albums': [
                { name: jellyfin.getI18n('JELLYFIN_NAME'), value: 'SortName' },
                { name: jellyfin.getI18n('JELLYFIN_ALBUM_ARTIST'), value: 'AlbumArtist,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_COMMUNITY_RATING'), value: 'CommunityRating,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_CRITIC_RATING'), value: 'CriticRating,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_DATE_ADDED'), value: 'DateCreated,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_RELEASE_DATE'), value: 'ProductionYear,PremiereDate,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_RANDOM'), value: 'Random,SortName' }
            ],
            'songs': [
                { name: jellyfin.getI18n('JELLYFIN_TRACK_NAME'), value: 'Name' },
                { name: jellyfin.getI18n('JELLYFIN_ALBUM'), value: 'Album,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_ALBUM_ARTIST'), value: 'AlbumArtist,Album,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_ARTIST'), value: 'Artist,Album,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_DATE_ADDED'), value: 'DateCreated,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_DATE_PLAYED'), value: 'DatePlayed,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_PLAY_COUNT'), value: 'PlayCount,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_RELEASE_DATE'), value: 'PremiereDate,AlbumArtist,Album,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_RUNTIME'), value: 'Runtime,AlbumArtist,Album,SortName' },
                { name: jellyfin.getI18n('JELLYFIN_RANDOM'), value: 'Random,SortName' }
            ]
        };
        
        this.SORT_ORDERS = [
            { name: jellyfin.getI18n('JELLYFIN_ASCENDING'), value: 'Ascending' },
            { name: jellyfin.getI18n('JELLYFIN_DESCENDING'), value: 'Descending' }
        ];
    }

    getFilter(view = {}) {
        let sortBy = this._getSortBy(view);
        let sortOrder = this._getSortOrder(view);

        return libQ.resolve({
            type: 'sort',
            subfilters: [
                sortBy,
                sortOrder
            ],
            icon: 'fa fa-sort'
        });
    }

    getDefaultSelection(view) {
        return {
            sortBy: this.SORT_BYS[view.name][0]['value'],
            sortOrder: this.SORT_ORDERS[0]['value']
        };
    }

    _getSortBy(view) {
        let selected = view.sortBy || this.SORT_BYS[view.name][0]['value'];

        let options = this.SORT_BYS[view.name].map( f => ({
            name: f.name,
            value: f.value,
            selected: selected == f.value
        }) );

        return {
            type: 'sortby',
            title: jellyfin.getI18n('JELLYFIN_FILTER_SORT_BY_TITLE'),
            field: 'sortBy',
            icon: 'fa fa-sort',
            resettable: false,
            options
        };
    }

    _getSortOrder(view) {
        let selected = view.sortOrder || this.SORT_ORDERS[0]['value'];

        let options = this.SORT_ORDERS.map( f => ({
            name: f.name,
            value: f.value,
            selected: selected == f.value
        }) );
        
        return {
            type: 'sortOrder',
            title: jellyfin.getI18n('JELLYFIN_FILTER_SORT_ORDER_TITLE'),
            field: 'sortOrder',
            icon: 'fa fa-sort',
            resettable: false,
            options
        };
    }

}

module.exports = FilterSortModel;