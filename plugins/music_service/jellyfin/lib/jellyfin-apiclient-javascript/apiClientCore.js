const ApiClient = require('./apiClient');

const localPrefix = 'local:';
const localViewPrefix = 'localview:';

function isLocalId(str) {
    return startsWith(str, localPrefix);
}

function isLocalViewId(str) {
    return startsWith(str, localViewPrefix);
}

function isTopLevelLocalViewId(str) {
    return str === 'localview';
}

function stripLocalPrefix(str) {
    let res = stripStart(str, localPrefix);
    res = stripStart(res, localViewPrefix);

    return res;
}

function startsWith(str, find) {
    if (str && find && str.length > find.length) {
        if (str.indexOf(find) === 0) {
            return true;
        }
    }

    return false;
}

function stripStart(str, find) {
    if (startsWith(str, find)) {
        return str.substr(find.length);
    }

    return str;
}

function createEmptyList() {
    const result = {
        Items: [],
        TotalRecordCount: 0
    };

    return result;
}

function convertGuidToLocal(guid) {
    if (!guid) {
        return null;
    }

    if (isLocalId(guid)) {
        return guid;
    }

    return `local:${guid}`;
}

function adjustGuidProperties(downloadedItem) {
    downloadedItem.Id = convertGuidToLocal(downloadedItem.Id);
    downloadedItem.SeriesId = convertGuidToLocal(downloadedItem.SeriesId);
    downloadedItem.SeasonId = convertGuidToLocal(downloadedItem.SeasonId);

    downloadedItem.AlbumId = convertGuidToLocal(downloadedItem.AlbumId);
    downloadedItem.ParentId = convertGuidToLocal(downloadedItem.ParentId);
    downloadedItem.ParentThumbItemId = convertGuidToLocal(downloadedItem.ParentThumbItemId);
    downloadedItem.ParentPrimaryImageItemId = convertGuidToLocal(downloadedItem.ParentPrimaryImageItemId);
    downloadedItem.PrimaryImageItemId = convertGuidToLocal(downloadedItem.PrimaryImageItemId);
    downloadedItem.ParentLogoItemId = convertGuidToLocal(downloadedItem.ParentLogoItemId);
    downloadedItem.ParentBackdropItemId = convertGuidToLocal(downloadedItem.ParentBackdropItemId);

    downloadedItem.ParentBackdropImageTags = null;
}

function getLocalView(instance, serverId, userId) {
    return instance.getLocalFolders(serverId, userId).then((views) => {
        let localView = null;

        if (views.length > 0) {
            localView = {
                Name: instance.downloadsTitleText || 'Downloads',
                ServerId: serverId,
                Id: 'localview',
                Type: 'localview',
                IsFolder: true
            };
        }

        return Promise.resolve(localView);
    });
}

/**
 * Creates a new api client instance
 * @param {String} serverAddress
 * @param {String} clientName s
 * @param {String} applicationVersion
 */
class ApiClientCore extends ApiClient {
    constructor(
        serverAddress,
        clientName,
        applicationVersion,
        deviceName,
        deviceId,
        devicePixelRatio,
        localAssetManager
    ) {
        super(serverAddress, clientName, applicationVersion, deviceName, deviceId, devicePixelRatio);
        this.localAssetManager = localAssetManager;
    }

    getPlaybackInfo(itemId, options, deviceProfile) {
        const onFailure = () => ApiClient.prototype.getPlaybackInfo.call(instance, itemId, options, deviceProfile);

        if (isLocalId(itemId)) {
            return this.localAssetManager.getLocalItem(this.serverId(), stripLocalPrefix(itemId)).then((item) => {
                // TODO: This was already done during the sync process, right? If so, remove it
                const mediaSources = item.Item.MediaSources.map((m) => {
                    m.SupportsDirectPlay = true;
                    m.SupportsDirectStream = false;
                    m.SupportsTranscoding = false;
                    m.IsLocal = true;
                    return m;
                });

                return {
                    MediaSources: mediaSources
                };
            }, onFailure);
        }

        var instance = this;
        return this.localAssetManager.getLocalItem(this.serverId(), itemId).then((item) => {
            if (item) {
                const mediaSources = item.Item.MediaSources.map((m) => {
                    m.SupportsDirectPlay = true;
                    m.SupportsDirectStream = false;
                    m.SupportsTranscoding = false;
                    m.IsLocal = true;
                    return m;
                });

                return instance.localAssetManager.fileExists(item.LocalPath).then((exists) => {
                    if (exists) {
                        const res = {
                            MediaSources: mediaSources
                        };

                        return Promise.resolve(res);
                    }

                    return ApiClient.prototype.getPlaybackInfo.call(instance, itemId, options, deviceProfile);
                }, onFailure);
            }

            return ApiClient.prototype.getPlaybackInfo.call(instance, itemId, options, deviceProfile);
        }, onFailure);
    }

    getItems(userId, options) {
        const serverInfo = this.serverInfo();
        let i;

        if (serverInfo && options.ParentId === 'localview') {
            return this.getLocalFolders(serverInfo.Id, userId).then((items) => {
                const result = {
                    Items: items,
                    TotalRecordCount: items.length
                };

                return Promise.resolve(result);
            });
        } else if (
            serverInfo &&
            options &&
            (isLocalId(options.ParentId) ||
                isLocalId(options.SeriesId) ||
                isLocalId(options.SeasonId) ||
                isLocalViewId(options.ParentId) ||
                isLocalId(options.AlbumIds))
        ) {
            return this.localAssetManager.getViewItems(serverInfo.Id, userId, options).then((items) => {
                items.forEach((item) => {
                    adjustGuidProperties(item);
                });

                const result = {
                    Items: items,
                    TotalRecordCount: items.length
                };

                return Promise.resolve(result);
            });
        } else if (options && options.ExcludeItemIds && options.ExcludeItemIds.length) {
            const exItems = options.ExcludeItemIds.split(',');

            for (i = 0; i < exItems.length; i++) {
                if (isLocalId(exItems[i])) {
                    return Promise.resolve(createEmptyList());
                }
            }
        } else if (options && options.Ids && options.Ids.length) {
            const ids = options.Ids.split(',');
            let hasLocal = false;

            for (i = 0; i < ids.length; i++) {
                if (isLocalId(ids[i])) {
                    hasLocal = true;
                }
            }

            if (hasLocal) {
                return this.localAssetManager.getItemsFromIds(serverInfo.Id, ids).then((items) => {
                    items.forEach((item) => {
                        adjustGuidProperties(item);
                    });

                    const result = {
                        Items: items,
                        TotalRecordCount: items.length
                    };

                    return Promise.resolve(result);
                });
            }
        }

        return ApiClient.prototype.getItems.call(this, userId, options);
    }

    getUserViews(options, userId) {
        const instance = this;

        options = options || {};

        const basePromise = ApiClient.prototype.getUserViews.call(instance, options, userId);

        if (!options.enableLocalView) {
            return basePromise;
        }

        return basePromise.then((result) => {
            const serverInfo = instance.serverInfo();
            if (serverInfo) {
                return getLocalView(instance, serverInfo.Id, userId).then((localView) => {
                    if (localView) {
                        result.Items.push(localView);
                        result.TotalRecordCount++;
                    }

                    return Promise.resolve(result);
                });
            }

            return Promise.resolve(result);
        });
    }

    getItem(userId, itemId) {
        if (!itemId) {
            throw new Error('null itemId');
        }

        if (itemId) {
            itemId = itemId.toString();
        }

        let serverInfo;

        if (isTopLevelLocalViewId(itemId)) {
            serverInfo = this.serverInfo();

            if (serverInfo) {
                return getLocalView(this, serverInfo.Id, userId);
            }
        }

        if (isLocalViewId(itemId)) {
            serverInfo = this.serverInfo();

            if (serverInfo) {
                return this.getLocalFolders(serverInfo.Id, userId).then((items) => {
                    const views = items.filter((item) => item.Id === itemId);

                    if (views.length > 0) {
                        return Promise.resolve(views[0]);
                    }

                    // TODO: Test consequence of this
                    return Promise.reject();
                });
            }
        }

        if (isLocalId(itemId)) {
            serverInfo = this.serverInfo();

            if (serverInfo) {
                return this.localAssetManager.getLocalItem(serverInfo.Id, stripLocalPrefix(itemId)).then((item) => {
                    adjustGuidProperties(item.Item);

                    return Promise.resolve(item.Item);
                });
            }
        }

        return ApiClient.prototype.getItem.call(this, userId, itemId);
    }

    getLocalFolders(userId) {
        const serverInfo = this.serverInfo();
        userId = userId || serverInfo.UserId;

        return this.localAssetManager.getViews(serverInfo.Id, userId);
    }

    getNextUpEpisodes(options) {
        if (options.SeriesId) {
            if (isLocalId(options.SeriesId)) {
                return Promise.resolve(createEmptyList());
            }
        }

        return ApiClient.prototype.getNextUpEpisodes.call(this, options);
    }

    getSeasons(itemId, options) {
        if (isLocalId(itemId)) {
            options.SeriesId = itemId;
            options.IncludeItemTypes = 'Season';
            return this.getItems(this.getCurrentUserId(), options);
        }

        return ApiClient.prototype.getSeasons.call(this, itemId, options);
    }

    getEpisodes(itemId, options) {
        if (isLocalId(options.SeasonId) || isLocalId(options.seasonId)) {
            options.SeriesId = itemId;
            options.IncludeItemTypes = 'Episode';
            return this.getItems(this.getCurrentUserId(), options);
        }

        // get episodes by recursion
        if (isLocalId(itemId)) {
            options.SeriesId = itemId;
            options.IncludeItemTypes = 'Episode';
            return this.getItems(this.getCurrentUserId(), options);
        }

        return ApiClient.prototype.getEpisodes.call(this, itemId, options);
    }

    getLatestOfflineItems(options) {
        // Supported options
        // MediaType - Audio/Video/Photo/Book/Game
        // Limit
        // Filters: 'IsNotFolder' or 'IsFolder'

        options.SortBy = 'DateCreated';
        options.SortOrder = 'Descending';

        const serverInfo = this.serverInfo();

        if (serverInfo) {
            return this.localAssetManager.getViewItems(serverInfo.Id, null, options).then((items) => {
                items.forEach((item) => {
                    adjustGuidProperties(item);
                });

                return Promise.resolve(items);
            });
        }

        return Promise.resolve([]);
    }

    getThemeMedia(userId, itemId, inherit) {
        if (isLocalViewId(itemId) || isLocalId(itemId) || isTopLevelLocalViewId(itemId)) {
            return Promise.reject();
        }

        return ApiClient.prototype.getThemeMedia.call(this, userId, itemId, inherit);
    }

    getSpecialFeatures(userId, itemId) {
        if (isLocalId(itemId)) {
            return Promise.resolve([]);
        }

        return ApiClient.prototype.getSpecialFeatures.call(this, userId, itemId);
    }

    getSimilarItems(itemId, options) {
        if (isLocalId(itemId)) {
            return Promise.resolve(createEmptyList());
        }

        return ApiClient.prototype.getSimilarItems.call(this, itemId, options);
    }

    updateFavoriteStatus(userId, itemId, isFavorite) {
        if (isLocalId(itemId)) {
            return Promise.resolve();
        }

        return ApiClient.prototype.updateFavoriteStatus.call(this, userId, itemId, isFavorite);
    }

    getScaledImageUrl(itemId, options) {
        if (isLocalId(itemId) || (options && options.itemid && isLocalId(options.itemid))) {
            const serverInfo = this.serverInfo();
            const id = stripLocalPrefix(itemId);

            return this.localAssetManager.getImageUrl(serverInfo.Id, id, options);
        }

        return ApiClient.prototype.getScaledImageUrl.call(this, itemId, options);
    }

    reportPlaybackStart(options) {
        if (!options) {
            throw new Error('null options');
        }

        if (isLocalId(options.ItemId)) {
            return Promise.resolve();
        }

        return ApiClient.prototype.reportPlaybackStart.call(this, options);
    }

    reportPlaybackProgress(options) {
        if (!options) {
            throw new Error('null options');
        }

        if (isLocalId(options.ItemId)) {
            const serverInfo = this.serverInfo();

            if (serverInfo) {
                const instance = this;
                return this.localAssetManager
                    .getLocalItem(serverInfo.Id, stripLocalPrefix(options.ItemId))
                    .then((item) => {
                        const libraryItem = item.Item;

                        if (libraryItem.MediaType === 'Video' || libraryItem.Type === 'AudioBook') {
                            libraryItem.UserData = libraryItem.UserData || {};
                            libraryItem.UserData.PlaybackPositionTicks = options.PositionTicks;
                            libraryItem.UserData.PlayedPercentage = Math.min(
                                libraryItem.RunTimeTicks
                                    ? 100 * ((options.PositionTicks || 0) / libraryItem.RunTimeTicks)
                                    : 0,
                                100
                            );
                            return instance.localAssetManager.addOrUpdateLocalItem(item);
                        }

                        return Promise.resolve();
                    });
            }

            return Promise.resolve();
        }

        return ApiClient.prototype.reportPlaybackProgress.call(this, options);
    }

    reportPlaybackStopped(options) {
        if (!options) {
            throw new Error('null options');
        }

        if (isLocalId(options.ItemId)) {
            const serverInfo = this.serverInfo();

            const action = {
                Date: new Date().getTime(),
                ItemId: stripLocalPrefix(options.ItemId),
                PositionTicks: options.PositionTicks,
                ServerId: serverInfo.Id,
                Type: 0, // UserActionType.PlayedItem
                UserId: this.getCurrentUserId()
            };

            return this.localAssetManager.recordUserAction(action);
        }

        return ApiClient.prototype.reportPlaybackStopped.call(this, options);
    }

    getIntros(itemId) {
        if (isLocalId(itemId)) {
            return Promise.resolve({
                Items: [],
                TotalRecordCount: 0
            });
        }

        return ApiClient.prototype.getIntros.call(this, itemId);
    }

    getInstantMixFromItem(itemId, options) {
        if (isLocalId(itemId)) {
            return Promise.resolve({
                Items: [],
                TotalRecordCount: 0
            });
        }

        return ApiClient.prototype.getInstantMixFromItem.call(this, itemId, options);
    }

    getItemDownloadUrl(itemId) {
        if (isLocalId(itemId)) {
            const serverInfo = this.serverInfo();

            if (serverInfo) {
                return this.localAssetManager
                    .getLocalItem(serverInfo.Id, stripLocalPrefix(itemId))
                    .then((item) => Promise.resolve(item.LocalPath));
            }
        }

        return ApiClient.prototype.getItemDownloadUrl.call(this, itemId);
    }
}

module.exports = ApiClientCore;
