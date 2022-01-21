'use strict';

const format = require('string-format');
const fs = require('fs-extra');

class JellyfinContext {

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
    }

    toast(type, message, title = "Jellyfin") {
        this._pluginContext.coreCommand.pushToastMessage(type, title, message);
    }

    getLogger() {
        return this._pluginContext.logger;
    }

    getDeviceInfo() {
        return this._pluginContext.coreCommand.getId();
    }

    getConfigValue(key, defaultValue = undefined) {
        if (this._pluginConfig.has(key)) {
            return this._pluginConfig.get(key);
        }
        else {
            return defaultValue;
        }
    }

    setConfigValue(key, value) {
        this._pluginConfig.set(key, value);
    }

    getAlbumArtPlugin() {
        let self = this;
        return self._getSingleton('albumArtPlugin', () => self._pluginContext.coreCommand.pluginManager.getPlugin('miscellanea', 'albumart'));
    }

    getMpdPlugin() {
        let self = this;
        return self._getSingleton('mpdPlugin', () => self._pluginContext.coreCommand.pluginManager.getPlugin('music_service', 'mpd'));
    }

    getStateMachine() {
        return this._pluginContext.coreCommand.stateMachine;
    }

    reset() {
        delete this._pluginContext;
        delete this._pluginConfig;
        
        this._singletons = {};
        this._data = {};
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
            } else {
                str = this._i18nDefaults[key];
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
                let language_code = self._pluginContext.coreCommand.sharedVars.get('language_code');
                self._i18n = fs.readJsonSync(i18nPath + '/strings_' + language_code + ".json");
            } catch(e) {
                self._i18n = fs.readJsonSync(i18nPath + '/strings_en.json');
            }

            self._i18nDefaults = fs.readJsonSync(i18nPath + '/strings_en.json');
        }
    }

    _onSystemLanguageChanged() {
        this._loadI18n();
    }

}

module.exports = new JellyfinContext();