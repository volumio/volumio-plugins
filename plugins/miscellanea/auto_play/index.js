'use strict';
var libQ = require('kew');
var MPD = require('node-mpd');


module.exports = ControllerAutoPlay;

function ControllerAutoPlay(context) {
	var self = this;

  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
}


/*
 * This method can be defined by every plugin which needs to be informed of the startup of Volumio.
 * The Core controller checks if the method is defined and executes it on startup if it exists.
 */
ControllerAutoPlay.prototype.onVolumioStart = function () {
	var self = this;

  var mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
  var mpdHost = mpdPlugin.getConfigParam('nHost');
  var mpdPort = mpdPlugin.getConfigParam('nPort');

  self.logger.info('ControllerAutoPlay - connecting mpd on host: ' + mpdHost + '; port: ' + mpdPort);

  var mpd = new MPD({
    host : mpdHost,
    port : mpdPort
  });

  mpd.on("ready", function() {
    self.logger.info('ControllerAutoPlay - mpd ready');
    mpd.disconnect();

    setTimeout(function () {
      self.logger.info('ControllerAutoPlay - getting queue');
      var queue = self.commandRouter.volumioGetQueue();
      if (queue && queue.length > 0) {
        self.logger.info('ControllerAutoPlay - start playing -> queue is not empty');
        self.commandRouter.volumioPlay();
      }
    }, 5000);
  });

  mpd.connect();

  return libQ.resolve();
};


ControllerAutoPlay.prototype.onStart = function() {
  var self = this;

  return libQ.resolve();
};


ControllerAutoPlay.prototype.onStop = function () {
  var self = this;
  //Perform stop tasks here
};

ControllerAutoPlay.prototype.onRestart = function () {
  var self = this;
  //Perform restart tasks here
};

ControllerAutoPlay.prototype.onInstall = function () {
  var self = this;
  //Perform your installation tasks here
};

ControllerAutoPlay.prototype.onUninstall = function () {
  var self = this;
  //Perform your deinstallation tasks here
};

ControllerAutoPlay.prototype.getUIConfig = function() {
  var defer = libQ.defer();
  var self = this;

  var lang_code = this.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
      __dirname+'/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
      .then(function(uiconf)
      {
        defer.resolve(uiconf);
      })
      .fail(function()
      {
        defer.reject(new Error());
      });

  return defer.promise;
};


ControllerAutoPlay.prototype.setUIConfig = function(data)
{

};
