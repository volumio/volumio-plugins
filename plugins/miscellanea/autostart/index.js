'use strict';

var libQ = require('kew');
var config = new (require('v-conf'))();
var fs = require('fs-extra');

module.exports = autostart;

function autostart(context) {
    this.context = context;
    this.commandRouter = context.coreCommand;
    this.logger = context.logger;
    this.configManager = context.configManager;
    this.volumioReplaceAndPlay = context.coreCommand.replaceAndPlay;
}

autostart.prototype.onVolumioStart = function () {
    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    config.loadFile(configFile);

    var autoStartDelay = config.get('autoStartDelay') || 20000;

    setTimeout(this.executeAutoStart.bind(this), autoStartDelay);

    return libQ.resolve();
};

autostart.prototype.onStart = function () {
    this.loadI18nStrings();
    return libQ.resolve();
};

autostart.prototype.onStop = function () {
    return libQ.resolve();
};

autostart.prototype.onRestart = function () {
    return libQ.resolve();
};

autostart.prototype.executeAutoStart = function () {
    var self = this;

    var playFromLastPosition = config.get('playFromLastPosition') || false;
    var lastPosition = config.get('lastPosition') || -1;
    var autoStartMode = config.get('autoStartMode') || "1";
    var autoStartItemUri = config.get('autoStartItemUri');

    self.logger.info('AutoStart: getting queue');

    var queue = self.commandRouter.volumioGetQueue();
    if(autoStartMode === "2" && autoStartItemUri) {
        var autoStartItem = self.getAutoStartItem();
        self.commandRouter.replaceAndPlay(autoStartItem)
            .then(function(e){
                self.commandRouter.volumioPlay(e.firstItemIndex);
            });
    }
    else if (autoStartMode === "1" && queue && queue.length > 0) {
        self.logger.info('AutoStart: start playing -> queue is not empty');
        try {
            if (playFromLastPosition === true && lastPosition > -1 && queue.length > lastPosition) {
                self.commandRouter.volumioPlay(lastPosition);
            } else {
                self.commandRouter.volumioPlay();
            }
        } catch(err) {
            self.logger.error('AutoStart: unable to start play: ' + err);
        }
    }
};

autostart.prototype.saveQueueState = function() {
    if(config.get('playFromLastPosition') === true) {
        var state = this.commandRouter.volumioGetState();
        if(state && state.position) {
            config.set('lastPosition', state.position);
            // force dump to disk or config will not be saved before shutdown
            config.save();
        }
    }
}

autostart.prototype.autoStartAddQueueItems = function(queueItem) {
    this.commandRouter.replaceAndPlay = this.volumioReplaceAndPlay;
    if(queueItem && queueItem.uri) {
        this.setAutoStartItem(queueItem);
        this.commandRouter.pushToastMessage('success', 'Autostart', 
            this.getI18nString('AUTOSTART_SELECTION_SUCCESS') + queueItem.title);
    } else {
        this.commandRouter.pushToastMessage('error', 'Autostart', 
            this.getI18nString('AUTOSTART_SELECTION_FAILURE'));
    }
    return libQ.resolve();
}

autostart.prototype.deactivateSelectMode = function() {
    this.commandRouter.replaceAndPlay = this.volumioReplaceAndPlay;
    return libQ.resolve();
}

autostart.prototype.activateSelectMode = function() {
    this.commandRouter.replaceAndPlay = this.autoStartAddQueueItems.bind(this);
    this.commandRouter.pushToastMessage('success', 'Autostart', 
        this.getI18nString('AUTOSTART_SELECT_MODE_ACTIVATED'));
    return libQ.resolve();
}

autostart.prototype.getAutoStartItem = function () {
    return {
        uri: config.get('autoStartItemUri'), 
        title: config.get('autoStartItemTitle'), 
        albumart: config.get('autoStartItemAlbumArt'), 
        service: config.get('autoStartItemService')
    };
}

autostart.prototype.setAutoStartItem = function(queueItem) {
    config.set('autoStartItemUri', queueItem.uri);
    config.set('autoStartItemTitle', queueItem.title) || '';
    config.set('autoStartItemAlbumArt', queueItem.albumart || '');
    config.set('autoStartItemService', queueItem.service || '');
}

autostart.prototype.onVolumioReboot = function () {
    return libQ.resolve(this.saveQueueState());
}

autostart.prototype.onVolumioShutdown = function () {
    return libQ.resolve(this.saveQueueState());
}

autostart.prototype.loadI18nStrings = function () {
    var lang_code = this.commandRouter.sharedVars.get('language_code');
    try {
        this.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
        try {
            this.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + lang_code + '.json');
        } catch(err) {
            this.logger.info("AutoStart: No language file for: " + lang_code + ". Reverting to default.")
            this.i18nStrings = this.i18nStringsDefaults;
        }
    }
    catch(err) {
        this.logger.error("AutoStart: No default language file.")
    }
};

autostart.prototype.getI18nString = function (key) {
    return this.i18nStrings[key] || this.i18nStringsDefaults[key] || 'missing:' + key;
};

// Configuration Methods -----------------------------------------------------------------------------


autostart.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

autostart.prototype.getUIConfig = function () {
  var lang_code = this.commandRouter.sharedVars.get('language_code');
  var self = this;
  return this.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
      .then(function (uiconf) {
        uiconf.sections[0].content[0].value = config.get('autoStartDelay');
        uiconf.sections[0].content[1].value = config.get('autoStartMode') || "1";
        uiconf.sections[0].content[2].value = config.get('playFromLastPosition');
        uiconf.sections[0].content[3].value = config.get('autoStartItemTitle');
        uiconf.sections[0].content[4].value = config.get('autoStartItemUri');
        uiconf.sections[0].content[5].attributes.push({"src":config.get('autoStartItemAlbumArt')});
        uiconf.sections[0].content[6].value = self.commandRouter.replaceAndPlay !== self.volumioReplaceAndPlay;
        return uiconf;
      })
      .fail(function () {
        libQ.reject(new Error());
      });
};

autostart.prototype.setUIConfig = function (data) {

  config.set('autoStartDelay', data['autoStartDelay'] || 20000);

  var autoStartMode = data['autoStartMode'] || "1";
  config.set('autoStartMode', autoStartMode);

  if (autoStartMode === "1") {
    config.set('playFromLastPosition', data['playFromLastPosition'] || false);
    config.set('autoStartItemTitle', '');
    config.set('autoStartItemUri', '');
    config.set('autoStartItemAlbumArt', '');
    config.set('autoStartItemService', '');
    this.deactivateSelectMode();
  }
  else if (autoStartMode === "2") {
    config.set('playFromLastPosition', false);
    if(data['selectAutoStartItem'] === true)
        this.activateSelectMode();
    else
        this.deactivateSelectMode();
  }

  config.set('lastPosition', -1);

  this.commandRouter.pushToastMessage('success', 'Autostart', this.commandRouter.getI18nString("COMMON.CONFIGURATION_UPDATE_DESCRIPTION"));

  return libQ.resolve();
};

autostart.prototype.getConf = function (varName) {
};

autostart.prototype.setConf = function (varName, varValue) {
};
