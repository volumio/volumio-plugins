'use strict';

const path = require('path');
global.bandcampPluginLibRoot = path.resolve(__dirname) + '/lib';

const libQ = require('kew');
const bandcamp = require(bandcampPluginLibRoot + '/bandcamp');
const SearchController = require(bandcampPluginLibRoot + '/controller/search');
const BrowseController = require(bandcampPluginLibRoot + '/controller/browse');
const PlayController = require(bandcampPluginLibRoot + '/controller/play');
const ViewHelper = require(bandcampPluginLibRoot + '/helper/view');

module.exports = ControllerBandcamp;

function ControllerBandcamp(context) {
	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}

ControllerBandcamp.prototype.getUIConfig = function() {
    let self = this;
    let defer = libQ.defer();

    let lang_code = self.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
    .then( (uiconf) => {
        let generalUIConf = uiconf.sections[0];
        let cacheUIConf = uiconf.sections[1];

        // General   
        generalUIConf.content[0].value = bandcamp.getConfigValue('itemsPerPage', 47);
        generalUIConf.content[1].value = bandcamp.getConfigValue('combinedSearchResults', 17);
        generalUIConf.content[2].value = bandcamp.getConfigValue('searchByItemType', true);

        // Cache
        let cacheMaxEntries = bandcamp.getConfigValue('cacheMaxEntries', 5000);
        let cacheTTL = bandcamp.getConfigValue('cacheTTL', 1800);
        let cacheEntryCount = bandcamp.getCache().getEntryCount();
        cacheUIConf.content[0].value = cacheMaxEntries;
        cacheUIConf.content[1].value = cacheTTL;
        cacheUIConf.description = cacheEntryCount > 0 ? bandcamp.getI18n('BANDCAMP_CACHE_STATS', cacheEntryCount, Math.round(bandcamp.getCache().getMemoryUsageInKB()).toLocaleString()) : bandcamp.getI18n('BANDCAMP_CACHE_EMPTY');

        defer.resolve(uiconf);
    })
    .fail( (error) => {
            bandcamp.getLogger().error('[bandcamp] getUIConfig(): Cannot populate Bandcamp configuration - ' + error);
            defer.reject(new Error());
        }
    );

    return defer.promise;
};

ControllerBandcamp.prototype.configSaveGeneralSettings = function(data) {
    let itemsPerPage = parseInt(data['itemsPerPage'], 10);
    let combinedSearchResults = parseInt(data['combinedSearchResults'], 10);
    if (!itemsPerPage) {
        bandcamp.toast('error', bandcamp.getI18n('BANDCAMP_SETTINGS_ERR_ITEMS_PER_PAGE'));
        return;
    }
    if (!combinedSearchResults) {
        bandcamp.toast('error', bandcamp.getI18n('BANDCAMP_SETTINGS_ERR_COMBINED_SEARCH_RESULTS'));
        return;
    }

    this.config.set('itemsPerPage', itemsPerPage);
    this.config.set('combinedSearchResults', combinedSearchResults);
    this.config.set('searchByItemType', data.searchByItemType);
    
    bandcamp.toast('success', bandcamp.getI18n('BANDCAMP_SETTINGS_SAVED'));   
}

ControllerBandcamp.prototype.configSaveCacheSettings = function(data) {
    let cacheMaxEntries = parseInt(data['cacheMaxEntries'], 10);
    let cacheTTL = parseInt(data['cacheTTL'], 10);
    if (cacheMaxEntries < 1000) {
        bandcamp.toast('error', bandcamp.getI18n('BANDCAMP_SETTINGS_ERR_CACHE_MAX_ENTRIES'));
        return;
    }
    if (cacheTTL < 600) {
        bandcamp.toast('error', bandcamp.getI18n('BANDCAMP_SETTINGS_ERR_CACHE_TTL'));
        return;
    }

    this.config.set('cacheMaxEntries', cacheMaxEntries);
    this.config.set('cacheTTL', cacheTTL);

    bandcamp.getCache().setMaxEntries(cacheMaxEntries);
    bandcamp.getCache().setTTL(cacheTTL);

    bandcamp.toast('success', bandcamp.getI18n('BANDCAMP_SETTINGS_SAVED'));
    this.refreshUIConfig();
}

ControllerBandcamp.prototype.configClearCache = function() {
    bandcamp.getCache().clear();
    bandcamp.toast('success', bandcamp.getI18n('BANDCAMP_CACHE_CLEARED'));
    this.refreshUIConfig();
}


ControllerBandcamp.prototype.refreshUIConfig = function() {
    let self = this;
    
    self.commandRouter.getUIConfigOnPlugin('music_service', 'bandcamp', {}).then( (config) => {
        self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
}

ControllerBandcamp.prototype.onVolumioStart = function() {
	let configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
}

ControllerBandcamp.prototype.onStart = function() {
    bandcamp.init(this.context, this.config);

    this.browseController = new BrowseController();
    this.searchController = new SearchController();
    this.playController = new PlayController();

    this.addToBrowseSources();

    return libQ.resolve();
};

ControllerBandcamp.prototype.onStop = function() {
    this.commandRouter.volumioRemoveToBrowseSources('Bandcamp');

    this.browseController = null;
    this.searchController = null;
    this.playController = null;

    bandcamp.reset();

	return libQ.resolve();
};

ControllerBandcamp.prototype.getConfigurationFiles = function() {
    return ['config.json'];
}

ControllerBandcamp.prototype.addToBrowseSources = function () {
	let data = {
        name: 'Bandcamp Discover',
        uri: 'bandcamp',
        plugin_type: 'music_service',
        plugin_name: 'bandcamp',
        albumart: '/albumart?sourceicon=music_service/bandcamp/assets/images/bandcamp.png'
    };
	this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerBandcamp.prototype.handleBrowseUri = function(uri) {
    return this.browseController.browseUri(uri);
}

ControllerBandcamp.prototype.explodeUri = function (uri) {
    return this.browseController.explodeUri(uri);
};

ControllerBandcamp.prototype.clearAddPlayTrack = function(track) {  
    return this.playController.clearAddPlayTrack(track);
}

ControllerBandcamp.prototype.stop = function () {
    return this.playController.stop();
};

ControllerBandcamp.prototype.pause = function () {
    return this.playController.pause();
};
  
ControllerBandcamp.prototype.resume = function () {
    return this.playController.resume();
}
  
ControllerBandcamp.prototype.seek = function (position) {
    return this.playController.seek(position);
}

ControllerBandcamp.prototype.search = function(query) {
    return this.searchController.search(query);
}

ControllerBandcamp.prototype.goto = function(data) {
    let views = ViewHelper.getViewsFromUri(data.uri);
    let trackView = views[1];
    if (!trackView && trackView.name !== 'track' && trackView.name !== 'show') {
        return this.browseController.browseUri('bandcamp');
    }
    if (data.type === 'album' && trackView.albumUrl) {
        return this.browseController.browseUri('bandcamp/album@albumUrl=' + trackView.albumUrl);
    }
    else if (data.type === 'artist' && trackView.artistUrl) {
        return this.browseController.browseUri('bandcamp/artist@artistUrl=' + trackView.artistUrl);
    }
    else if (trackView.name === 'show') {
        return this.browseController.browseUri('bandcamp/shows@showUrl=' + trackView.showUrl);
    }
    else if (trackView.name === 'article') {
        return this.browseController.browseUri('bandcamp/articles@articleUrl=' + trackView.articleUrl);
    }
    else {
        return this.browseController.browseUri('bandcamp');
    }
}

ControllerBandcamp.prototype.saveDefaultDiscoverParams = function(data) {
    this.config.set('defaultDiscoverParams', JSON.stringify(data));
    bandcamp.toast('success', bandcamp.getI18n('BANDCAMP_SETTINGS_SAVED'));
}

ControllerBandcamp.prototype.saveDefaultArticleCategory = function(data) {
    this.config.set('defaultArticleCategory', JSON.stringify(data));
    bandcamp.toast('success', bandcamp.getI18n('BANDCAMP_SETTINGS_SAVED'));
}