'use strict';

var libQ = require('kew');
// var fs = require('fs-extra');
// var config = new (require('v-conf'))();
// var exec = require('child_process').exec;
// var execSync = require('child_process').execSync;
var mpd = require('mpd');


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

  var mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
  if (!mpdPlugin) {

    self.logger.error('AutoStart - unable to start, mpdPlugin is not defined!');
    return libQ.resolve();
  }

  var mpdHost = mpdPlugin.getConfigParam('nHost');
  var mpdPort = mpdPlugin.getConfigParam('nPort');

  self.logger.info('AutoStart - connecting mpd on host: ' + mpdHost + '; port: ' + mpdPort);

  var client = mpd.connect({
    host : mpdHost,
    port : mpdPort
  });

  client.on('ready', function() {
    self.logger.info('AutoStart - mpd ready');

    setTimeout(function () {
      self.logger.info('AutoStart - getting queue');
      var queue = self.commandRouter.volumioGetQueue();
      if (queue && queue.length > 0) {
        self.logger.info('AutoStart - start playing -> queue is not empty');
        try {
          self.commandRouter.volumioPlay();
        } catch(err) {
          this.logger.error('AutoStart - unable to start play - volumio: ' + err);
        }
      }
    }, 5000);
  });

  return libQ.resolve();
};

autostart.prototype.onStart = function () {
  var self = this;
  var defer = libQ.defer();


  // Once the Plugin has successfull started resolve the promise
  defer.resolve();

  return defer.promise;
};

autostart.prototype.onStop = function () {
  var self = this;
  var defer = libQ.defer();

  // Once the Plugin has successfull stopped resolve the promise
  defer.resolve();

  return libQ.resolve();
};

autostart.prototype.onRestart = function () {
  var self = this;
  // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

autostart.prototype.getUIConfig = function () {
  var defer = libQ.defer();
  var self = this;

  var lang_code = this.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
      .then(function (uiconf) {


        defer.resolve(uiconf);
      })
      .fail(function () {
        defer.reject(new Error());
      });

  return defer.promise;
};


autostart.prototype.setUIConfig = function (data) {
  var self = this;
  //Perform your installation tasks here
};

autostart.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};

autostart.prototype.setConf = function (varName, varValue) {
  var self = this;
  //Perform your installation tasks here
};
