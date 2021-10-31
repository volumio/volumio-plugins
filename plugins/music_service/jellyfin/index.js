'use strict';

const path = require('path');
global.jellyfinPluginLibRoot = path.resolve(__dirname) + '/lib';

const libQ = require('kew');
const { URL } = require('url');
const jellyfin = require(jellyfinPluginLibRoot + '/jellyfin');
const Server = require(jellyfinPluginLibRoot + '/core/server');
const ConnectionManager = require(jellyfinPluginLibRoot + '/core/connect');
const ServerPoller = require(jellyfinPluginLibRoot + '/util/poller');
const SearchController = require(jellyfinPluginLibRoot + '/controller/search');
const BrowseController = require(jellyfinPluginLibRoot + '/controller/browse');
const PlayController = require(jellyfinPluginLibRoot + '/controller/play');

module.exports = ControllerJellyfin;

function ControllerJellyfin(context) {
	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}

ControllerJellyfin.prototype.getUIConfig = function() {
    let self = this;
    let defer = libQ.defer();

    let lang_code = self.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
    .then( (uiconf) => {
        let removeServerUIConf = uiconf.sections[1];
        let browseSettingsUIConf = uiconf.sections[2];
        let playAddUIConf = uiconf.sections[3];
        let searchSettingsUIConf = uiconf.sections[4];
        let myMediaLibraryUIConf = uiconf.sections[5];

        // Remove Server section
        let servers = self.getServerSettingsFromConfig();
        servers.forEach( (server, index) => {
            self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[0].options', {
                value: index,
                label: server.url
            });
        });
        if (servers.length) {
            removeServerUIConf.content[0].value.value = 0;
            removeServerUIConf.content[0].value.label = servers[0].url;
        }

        // Browse Settings section
        let itemsPerPage = jellyfin.getConfigValue('itemsPerPage', 47);
        let showAllAlbumTracks = jellyfin.getConfigValue('showAllAlbumTracks', true);
        let showAllPlaylistTracks = jellyfin.getConfigValue('showAllPlaylistTracks', true);
        let rememberFilters = jellyfin.getConfigValue('rememberFilters', true);
        browseSettingsUIConf.content[0].value = itemsPerPage;
        browseSettingsUIConf.content[1].value = showAllAlbumTracks;
        browseSettingsUIConf.content[2].value = showAllPlaylistTracks;
        browseSettingsUIConf.content[3].value = rememberFilters;

        // Play / Add to Queue section
        let maxTracks = jellyfin.getConfigValue('maxTracks', 100);
        let noMaxTracksSingleAlbum = jellyfin.getConfigValue('noMaxTracksSingleAlbum', true);
        let noMaxTracksSinglePlaylist = jellyfin.getConfigValue('noMaxTracksSinglePlaylist', true);
        playAddUIConf.content[0].value = maxTracks;
        playAddUIConf.content[1].value = noMaxTracksSingleAlbum;
        playAddUIConf.content[2].value = noMaxTracksSinglePlaylist;

        // Search Settings section
        let searchAlbums = jellyfin.getConfigValue('searchAlbums', true);
        let searchAlbumsResultCount = jellyfin.getConfigValue('searchAlbumsResultCount', 11);
        let searchArtists = jellyfin.getConfigValue('searchArtists', true);
        let searchArtistsResultCount = jellyfin.getConfigValue('searchArtistsResultCount', 11);
        let searchSongs = jellyfin.getConfigValue('searchSongs', true);
        let searchSongsResultCount = jellyfin.getConfigValue('searchSongsResultCount', 11);
        searchSettingsUIConf.content[0].value = searchAlbums;
        searchSettingsUIConf.content[1].value = searchAlbumsResultCount;
        searchSettingsUIConf.content[2].value = searchArtists;
        searchSettingsUIConf.content[3].value = searchArtistsResultCount;
        searchSettingsUIConf.content[4].value = searchSongs;
        searchSettingsUIConf.content[5].value = searchSongsResultCount;

        // My Media / Library
        let showLatestMusicSection = jellyfin.getConfigValue('showLatestMusicSection', true);
        let latestMusicSectionItems = jellyfin.getConfigValue('latestMusicSectionItems', 11);
        let showRecentlyPlayedSection = jellyfin.getConfigValue('showRecentlyPlayedSection', true);
        let recentlyPlayedSectionItems = jellyfin.getConfigValue('recentlyPlayedSectionItems', 5);
        let showFrequentlyPlayedSection = jellyfin.getConfigValue('showFrequentlyPlayedSection', true);
        let frequentlyPlayedSectionItems = jellyfin.getConfigValue('frequentlyPlayedSectionItems', 5);
        let showFavoriteArtistsSection = jellyfin.getConfigValue('showFavoriteArtistsSection', true);
        let favoriteArtistsSectionItems = jellyfin.getConfigValue('favoriteArtistsSectionItems', 5);
        let showFavoriteAlbumsSection = jellyfin.getConfigValue('showFavoriteAlbumsSection', true);
        let favoriteAlbumsSectionItems = jellyfin.getConfigValue('favoriteAlbumsSectionItems', 5);
        let showFavoriteSongsSection = jellyfin.getConfigValue('showFavoriteSongsSection', true);
        let favoriteSongsSectionItems = jellyfin.getConfigValue('favoriteSongsSectionItems', 5);
        let collectionInSectionItems = jellyfin.getConfigValue('collectionInSectionItems', 11);
        myMediaLibraryUIConf.content[0].value = showLatestMusicSection;
        myMediaLibraryUIConf.content[1].value = latestMusicSectionItems;
        myMediaLibraryUIConf.content[2].value = showRecentlyPlayedSection;
        myMediaLibraryUIConf.content[3].value = recentlyPlayedSectionItems;
        myMediaLibraryUIConf.content[4].value = showFrequentlyPlayedSection;
        myMediaLibraryUIConf.content[5].value = frequentlyPlayedSectionItems;
        myMediaLibraryUIConf.content[6].value = showFavoriteArtistsSection;
        myMediaLibraryUIConf.content[7].value = favoriteArtistsSectionItems;
        myMediaLibraryUIConf.content[8].value = showFavoriteAlbumsSection;
        myMediaLibraryUIConf.content[9].value = favoriteAlbumsSectionItems;
        myMediaLibraryUIConf.content[10].value = showFavoriteSongsSection;
        myMediaLibraryUIConf.content[11].value = favoriteSongsSectionItems;
        myMediaLibraryUIConf.content[12].value = collectionInSectionItems;

        defer.resolve(uiconf);
    })
    .fail( (error) => {
            jellyfin.getLogger().error('[jellyfin] getUIConfig(): Cannot populate Jellyfin configuration - ' + error);
            defer.reject(new Error());
        }
    );

    return defer.promise;
};

ControllerJellyfin.prototype.getServerSettingsFromConfig = function() {
    let self = this;

    try {
        let setting = jellyfin.getConfigValue('servers', '[]');
        let result = JSON.parse(setting);
        if (Array.isArray(result)) {
            return result;
        }
        else {
            return [];
        }
    } catch (error) {
        jellyfin.getLogger().error('[jellyfin] getServerSettingsFromConfig(): Failed to obtain server settings - ' + error + ' Returning empty array.');
        return [];
    }
}

ControllerJellyfin.prototype.configAddServer = function(data) {  
    if (data['host'] == undefined || data['host'].trim() === '') {
        jellyfin.toast('error', jellyfin.getI18n('JELLYFIN_SPECIFY_HOST'));
        return;
    }

    let host = data['host'].trim();
    try {
        let url = new URL(host);
    } catch (error) {
        jellyfin.toast('error', jellyfin.getI18n('JELLYFIN_INVALID_HOST'));
        return;
    }

    let username = data['username'] != undefined ? data['username'] : '';
    let password = data['password'] != undefined ? data['password'] : '';

    let servers = this.getServerSettingsFromConfig();
    servers.push({
        url: host,
        username: username,
        password: password
    });
    this.config.set('servers', JSON.stringify(servers));
    jellyfin.toast('success', jellyfin.getI18n('JELLYFIN_SERVER_ADDED'));
    this.pollServers();
    this.refreshUIConfig();
}

ControllerJellyfin.prototype.configRemoveServer = function(data) {
    let index = data['server_entry'].value;
    if (index !== '') {
        let servers = this.getServerSettingsFromConfig();
        servers.splice(index, 1);
        this.config.set('servers', JSON.stringify(servers));
        jellyfin.toast('success', jellyfin.getI18n('JELLYFIN_SERVER_REMOVED'));
        this.pollServers();
        this.refreshUIConfig();
    }
}

ControllerJellyfin.prototype.saveBrowseSettings = function(data) {
    let self = this;

    let showKeys = [
        'showAllAlbumTracks',
        'showAllPlaylistTracks',
        'rememberFilters'
    ];
    showKeys.forEach( (key) => {
        self.config.set(key, data[key]);
    });

    let itemsPerPage = parseInt(data['itemsPerPage'], 10);
    if (itemsPerPage) {
        self.config.set('itemsPerPage', itemsPerPage);
        jellyfin.toast('success', jellyfin.getI18n('JELLYFIN_SETTINGS_SAVED'));
    }
    else {
        jellyfin.toast('error', jellyfin.getI18n('JELLYFIN_SETTINGS_ERR_ITEMS_PER_PAGE'));
    }
}

ControllerJellyfin.prototype.savePlayAddSettings = function(data) {
    let self = this;

    let noMaxTrackKeys = [
        'noMaxTracksSingleAlbum',
        'noMaxTracksSinglePlaylist'
    ];
    noMaxTrackKeys.forEach( (key) => {
        self.config.set(key, data[key]);
    });
    let maxTracks = parseInt(data['maxTracks'], 10);
    if (maxTracks) {
        self.config.set('maxTracks', maxTracks);
        jellyfin.toast('success', jellyfin.getI18n('JELLYFIN_SETTINGS_SAVED'));
    }
    else {
        jellyfin.toast('error', jellyfin.getI18n('JELLYFIN_SETTINGS_ERR_MAX_TRACK'));
    }
}

ControllerJellyfin.prototype.saveSearchSettings = function(data) {
    let self = this;

    let searchKeys = [
        'searchAlbums',
        'searchArtists',
        'searchSongs'
    ]
    searchKeys.forEach( (key) => {
        self.config.set(key, data[key]);
    });

    let resultCountKeys = [
        'searchAlbumsResultCount',
        'searchArtistsResultCount',
        'searchSongsResultCount'
    ];
    let hasInvalidResultCountValue = false;
    resultCountKeys.forEach(( key) => {
        let value = parseInt(data[key], 10);
        if (value) {
            self.config.set(key, value);
        }
        else {
            hasInvalidResultCountValue = true;
        }
    });

    if (hasInvalidResultCountValue) {
        jellyfin.toast('error', jellyfin.getI18n('JELLYFIN_SETTINGS_ERR_RESULT_COUNT'));
    }
    else {
        jellyfin.toast('success', jellyfin.getI18n('JELLYFIN_SETTINGS_SAVED'));
    }
}

ControllerJellyfin.prototype.saveMyMediaLibrarySettings = function(data) {
    let self = this;

    let showKeys = [
        'showLatestMusicSection',
        'showRecentlyPlayedSection',
        'showFrequentlyPlayedSection',
        'showFavoriteArtistsSection',
        'showFavoriteAlbumsSection',
        'showFavoriteSongsSection'
    ]
    showKeys.forEach( (key) => {
        self.config.set(key, data[key]);
    });

    let itemsKeys = [
        'latestMusicSectionItems',
        'recentlyPlayedSectionItems',
        'frequentlyPlayedSectionItems',
        'favoriteArtistsSectionItems',
        'favoriteAlbumsSectionItems',
        'favoriteSongsSectionItems',
        'collectionInSectionItems'
    ];
    let hasInvalidItemsValue = false;
    itemsKeys.forEach(( key) => {
        let value = parseInt(data[key], 10);
        if (value) {
            self.config.set(key, value);
        }
        else {
            hasInvalidItemsValue = true;
        }
    });

    if (hasInvalidItemsValue) {
        jellyfin.toast('error', jellyfin.getI18n('JELLYFIN_SETTINGS_ERR_NUM_ITEMS'));
    }
    else {
        jellyfin.toast('success', jellyfin.getI18n('JELLYFIN_SETTINGS_SAVED'));
    }
}

ControllerJellyfin.prototype.refreshUIConfig = function() {
    let self = this;
    
    self.commandRouter.getUIConfigOnPlugin('music_service', 'jellyfin', {}).then( (config) => {
        self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
}

ControllerJellyfin.prototype.onVolumioStart = function() {
	let configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
}

ControllerJellyfin.prototype.onStart = function() {
    jellyfin.init(this.context, this.config);
    jellyfin.set('connectionManager', new ConnectionManager());

    this.serverPoller = new ServerPoller();
    this.browseController = new BrowseController();
    this.searchController = new SearchController();
    this.playController = new PlayController();

    this.addToBrowseSources();
    this.pollServers();

    return libQ.resolve();
};

ControllerJellyfin.prototype.onStop = function() {
    this.serverPoller.stop();   
    this.commandRouter.volumioRemoveToBrowseSources('Jellyfin');

    this.serverPoller = null;
    this.browseController = null;
    this.searchController = null;
    this.playController = null;

    jellyfin.reset();

    // TODO: Logout jellyfin
	return libQ.resolve();
};

ControllerJellyfin.prototype.getConfigurationFiles = function() {
    return ['config.json'];
}

ControllerJellyfin.prototype.addToBrowseSources = function () {
	let data = {
        name: 'Jellyfin',
        uri: 'jellyfin',
        plugin_type: 'music_service',
        plugin_name:'jellyfin',
        albumart: '/albumart?sourceicon=music_service/jellyfin/assets/images/jellyfin-mono.png'
    };
	this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerJellyfin.prototype.handleBrowseUri = function(uri) {
    return this.browseController.browseUri(uri);
}

ControllerJellyfin.prototype.explodeUri = function (uri) {
    return this.browseController.explodeUri(uri);
};

ControllerJellyfin.prototype.clearAddPlayTrack = function(track) {  
    return this.playController.clearAddPlayTrack(track);
}

ControllerJellyfin.prototype.stop = function () {
    return this.playController.stop();
};

ControllerJellyfin.prototype.pause = function () {
    return this.playController.pause();
};
  
ControllerJellyfin.prototype.resume = function () {
    return this.playController.resume();
}
  
ControllerJellyfin.prototype.seek = function (position) {
    return this.playController.seek(position);
}

/*ControllerJellyfin.prototype.prefetch = function (trackBlock) {
    return this.playController.prefetch(trackBlock);
};*/

ControllerJellyfin.prototype.search = function(query) {
    return this.searchController.search(query);
}

ControllerJellyfin.prototype.pollServers = function() {
    this.serverPoller.start(Server.fromPluginSettings(this.getServerSettingsFromConfig()));
}
