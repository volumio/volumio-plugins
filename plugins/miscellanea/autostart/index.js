'use strict';

var libQ = require('kew');
var config = new (require('v-conf'))();

module.exports = autostart;

function autostart(context) {
    this.context = context;
    this.commandRouter = context.coreCommand;
    this.logger = context.logger;
    this.configManager = context.configManager;
    this.volumioReplaceAndPlay = context.coreCommand.replaceAndPlay;
}

autostart.prototype.onVolumioStart = function () {
    var self = this;
    var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
    config.loadFile(configFile);

    var playFromLastPosition = config.get('playFromLastPosition') || false;
    var lastPosition = config.get('lastPosition') || -1;
    var autoStartDelay = config.get('autoStartDelay') || 20000;
    var autoStartMode = config.get('autoStartMode') || "1";
    var autoStartItemUri = config.get('autoStartItemUri');

    setTimeout(function () {
        self.logger.info('AutoStart - getting queue');
        var queue = self.commandRouter.volumioGetQueue();
        if(autoStartMode === "2" && autoStartItemUri) {
            return self.commandRouter.replaceAndPlay(self.getAutoStartItem())
                .then(function(e){
                    return self.commandRouter.volumioPlay(e.firstItemIndex);
                });
        }
        else if (autoStartMode === "1" && queue && queue.length > 0) {
            self.logger.info('AutoStart - start playing -> queue is not empty');
            try {
                if (playFromLastPosition === true && lastPosition > -1) {
                    self.commandRouter.volumioPlay(lastPosition);
                } else {
                    self.commandRouter.volumioPlay();
                }
            } catch(err) {
                self.logger.error('AutoStart - unable to start play - volumio: ' + err);
            }
        }}, 
        autoStartDelay);

    return libQ.resolve();
};

autostart.prototype.onStart = function () {
    return libQ.resolve();
};

autostart.prototype.onStop = function () {
  return libQ.resolve();
};

autostart.prototype.onRestart = function () {
  var self = this;
  // Optional, use if you need it
};

autostart.prototype.saveQueueState = function() {
    if(config.get('playFromLastPosition') === true) {
        var state = this.commandRouter.volumioGetState();
        if(state && state.position) {
            config.set('lastPosition', state.position);
            //force dump to disk or config will not be saved before shutdown
            config.save();
        }
    }
}

autostart.prototype.autoStartAddQueueItems = function(queueItem) {
    this.logger.info(JSON.stringify(queueItem));
    this.commandRouter.replaceAndPlay = this.volumioReplaceAndPlay;
    if(queueItem && queueItem.uri) {
        this.setAutoStartItem(queueItem);
        this.commandRouter.pushToastMessage('success', 'Autostart', 'Autostart successfully cofigured to use ' + queueItem.title);
    } else {
        this.commandRouter.pushToastMessage('error', 'Autostart', 'Unable to configure Autostart to use chosen item');
    }
    return this.commandRouter.replaceAndPlay.call(this.commandRouter, queueItem);
}

autostart.prototype.selectAutoStartItem = function() {
    this.commandRouter.replaceAndPlay = this.autoStartAddQueueItems.bind(this);
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
    return libQ.resolve();
}

autostart.prototype.onVolumioReboot = function () {
    return libQ.resolve(this.saveQueueState());
}

autostart.prototype.onVolumioShutdown = function () {
    return libQ.resolve(this.saveQueueState());
}

// Configuration Methods -----------------------------------------------------------------------------


autostart.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

autostart.prototype.getUIConfig = function () {
  var lang_code = this.commandRouter.sharedVars.get('language_code');

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
  }
  else if (autoStartMode === "2") {
    config.set('playFromLastPosition', false);
  }

  config.set('lastPosition', -1);

  this.commandRouter.pushToastMessage('success', 'Autostart', this.commandRouter.getI18nString("COMMON.CONFIGURATION_UPDATE_DESCRIPTION"));

  return libQ.resolve();
};

autostart.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};

autostart.prototype.setConf = function (varName, varValue) {
  var self = this;
  //Perform your installation tasks here
};
