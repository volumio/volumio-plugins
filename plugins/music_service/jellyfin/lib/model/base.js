'use strict';

const libQ = require('kew');

class BaseModel {

    constructor(apiClient) {
        this._apiClient = apiClient;
    }

    getApiClient() {
        return this._apiClient;
    }

    getItems(queryOptions, tag = '', apiMethod) {
        let defer = libQ.defer();
        let apiClient = this.getApiClient();

        if (apiMethod == undefined) {
            apiMethod = 'getItems';
        }
        apiClient[apiMethod](apiClient.getCurrentUserId(), queryOptions).then(
            (result) => {
                defer.resolve({
                    items: result.Items,
                    startIndex: result.StartIndex,
                    total: result.TotalRecordCount,
                    tag: tag
                });
            },
            (error) => {
                defer.reject(error);
            }
        );

        return defer.promise;
    }

    getItem(itemId) {
        let defer = libQ.defer();
        let apiClient = this.getApiClient();

        apiClient.getItem(apiClient.getCurrentUserId(), itemId).then(
            (item) => {
                defer.resolve(item);
            },
            (error) => {
                defer.reject(error);
            }
        );

        return defer.promise;
    }

    getFilters(options) {
        let defer = libQ.defer();
        let apiClient = this.getApiClient();
        
        let queryOptions = Object.assign({}, options, {
            UserId: apiClient.getCurrentUserId()
        });

        apiClient.getJSON(apiClient.getUrl('Items/Filters', queryOptions)).then(
            (result) => {
                defer.resolve(result);
            },
            (error) => {
                defer.reject(error);
            }
        );

        return defer.promise;
    }

    getBaseQueryOptions(options = {}, itemType) {
        let queryOptions = {
            SortBy: 'SortName',
            SortOrder: 'Ascending',
            Recursive: true,
            ImageTypeLimit: 1,
            EnableImageTypes: 'Primary',
        };

        if (itemType != undefined) {
            queryOptions.IncludeItemTypes = itemType;
        }

        if (options.parentId != undefined) {
            queryOptions.ParentId = options.parentId;
        }

        if (options.startIndex != undefined) {
            queryOptions.StartIndex = options.startIndex;
        }
        if (options.limit != undefined) {
            queryOptions.Limit = options.limit;
        }

        if (options.sortBy != undefined) {
            queryOptions.SortBy = options.sortBy;
        }
        if (options.sortOrder != undefined) {
            queryOptions.SortOrder = options.sortOrder;
        }

        if (options.recursive != undefined) {
            queryOptions.Recursive = options.recursive ? true : false;
        }

        if (options.artistId != undefined) {
            queryOptions.ArtistIds = options.artistId;
        }
        if (options.albumArtistId != undefined) {
            queryOptions.AlbumArtistIds = options.albumArtistId;
        }
        if (options.genreId != undefined) {
            queryOptions.GenreIds = options.genreId;
        }
        else if (options.genreIds != undefined) {
            queryOptions.GenreIds = options.genreIds;
        }

        if (options.filters != undefined) {
            queryOptions.Filters = options.filters;
        }

        if (options.years != undefined) {
            queryOptions.Years = options.years;
        }

        if (options.nameStartsWith != undefined) {
            queryOptions.NameStartsWith = options.nameStartsWith;
        }

        if (options.search) {
            queryOptions.SearchTerm = options.search;
        }

        return queryOptions;
    }
}

module.exports = BaseModel;