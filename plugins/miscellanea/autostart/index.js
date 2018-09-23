'use strict';

var libQ = require('kew');
var config = new (require('v-conf'))();

module.exports = autostart;

function autostart(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}

autostart.prototype.onVolumioStart = function () {
    var self = this;
    var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
    config.loadFile(configFile);

    var playFromLastPosition = config.get('playFromLastPosition') || false;
    var lastPosition = config.get('lastPosition') || -1;
    var autostartDelay = config.get('autostartDelay') || 10000;

    setTimeout(function () {
        self.logger.info('AutoStart - getting queue');
        var queue = self.commandRouter.volumioGetQueue();
        if (queue && queue.length > 0) {
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
        autostartDelay);

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

        uiconf.sections[0].content[0].value = config.get('playFromLastPosition');
        uiconf.sections[0].content[1].value = config.get('autostartDelay');
        return uiconf;
      })
      .fail(function () {
        libQ.reject(new Error());
      });
};

autostart.prototype.setUIConfig = function (data) {
  var playFromLastPosition = data['playFromLastPosition'] || false;
  var autostartDelay = data['autostartDelay'] || 10000;
  config.set('playFromLastPosition', playFromLastPosition);
  config.set('autostartDelay', autostartDelay);
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
