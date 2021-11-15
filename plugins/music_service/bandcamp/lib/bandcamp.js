'use strict';

const format = require('string-format');
const fs = require('fs-extra');
const Cache = require(__dirname + '/core/cache');

class BandcampContext {

    constructor() {
        this._singletons = {};
        this._data = {};
    }

    set(key, value) {
        this._data[key] = value;
    }

    get(key, defaultValue = undefined) {
        return (this._data[key] != undefined) ? this._data[key] : defaultValue;
    }

    init(pluginContext, pluginConfig) {
        this._pluginContext = pluginContext;
        this._pluginConfig = pluginConfig;

        this._loadI18n();
        if (!this._i18CallbackRegistered) {
            this._pluginContext.coreCommand.sharedVars.registerCallback('language_code', this._onSystemLanguageChanged.bind(this));
            this._i18CallbackRegistered = true;
        }

        this._cache = new Cache(this.getConfigValue('cacheTTL', 1800), this.getConfigValue('cacheMaxEntries', 5000));
    }

    toast(type, message, title = "Bandcamp Discover") {
        this._pluginContext.coreCommand.pushToastMessage(type, title, message);
    }

    getLogger() {
        return this._pluginContext.logger;
    }

    getDeviceInfo() {
        return this._pluginContext.coreCommand.getId();
    }

    getConfigValue(key, defaultValue = undefined, json = false) {
        if (this._pluginConfig.has(key)) {
            let val = this._pluginConfig.get(key);
            if (json) {
                try {
                    return JSON.parse(val);
                } catch (e) {
                    return defaultValue;
                }
            }
            else {
                return val;
            }
        }
        else {
            return defaultValue;
        }
    }

    getMpdPlugin() {
        let self = this;
        return self._getSingleton('mpdPlugin', () => self._pluginContext.coreCommand.pluginManager.getPlugin('music_service', 'mpd'));
    }

    getStateMachine() {
        return this._pluginContext.coreCommand.stateMachine;
    }

    getCache() {
        return this._cache;
    }

    reset() {
        delete this._pluginContext;
        delete this._pluginConfig;
        
        this._singletons = {};
        this._data = {};

        this._cache.clear();
        this._cache.close();
        delete this._cache;
    }

    _getSingleton(key, getValue) {
        if (this._singletons[key] == undefined) {
            this._singletons[key] = getValue();
        }
        return this._singletons[key];
    }

    getI18n(key, ...formatValues) {
        let str;

        if (key.indexOf('.') > 0) {
            let mainKey = key.split('.')[0];
            let secKey = key.split('.')[1];
            if (this._i18n[mainKey][secKey] !== undefined) {
                str = this._i18n[mainKey][secKey];
            } else {
                str = this._i18nDefaults[mainKey][secKey];
            }

        } else {
            if (this._i18n[key] !== undefined) {
                str = this._i18n[key];
            } 
            else if (this._i18nDefaults[key] !== undefined) {
                str = this._i18nDefaults[key];
            }
            else {
                str = key;
            }
        }

        if (str && formatValues.length) {
            str = format(str, ...formatValues);
        }
        
        return str;
    }

    _loadI18n() {
        let self = this;

        if (self._pluginContext) {
            let i18nPath = __dirname + '/../i18n';
            
            try {
                self._i18nDefaults = fs.readJsonSync(i18nPath + '/strings_en.json');
            } catch (e) {
                self._i18nDefaults = {};
            }
            
            try {
                let language_code = self._pluginContext.coreCommand.sharedVars.get('language_code');
                self._i18n = fs.readJsonSync(i18nPath + '/strings_' + language_code + ".json");
            } catch(e) {
                self._i18n = self._i18nDefaults;
            }            
        }
    }

    _onSystemLanguageChanged() {
        this._loadI18n();
    }

}

module.exports = new BandcampContext();