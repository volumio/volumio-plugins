'use strict';

var fs = require('fs-extra');
var libFsExtra = require('fs-extra');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var libQ = require('kew');
const { setFlagsFromString } = require('v8');
var config = new (require('v-conf'))();


// Define the peppyalapipe class
module.exports = peppyalapipe;

function peppyalapipe(context) {
  var self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;

  self.configManager = self.context.configManager;
};

peppyalapipe.prototype.onVolumioStart = function () {
  var self = this;
  var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
  return libQ.resolve();
};

peppyalapipe.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

// Plugin methods -----------------------------------------------------------------------------

peppyalapipe.prototype.onStop = function () {
  const self = this;
  let defer = libQ.defer();
  self.logger.info("Stopping PeppyMeter service");
  self.commandRouter.stateMachine.stop().then(function () {
    exec("/usr/bin/sudo /bin/systemctl stop peppy.service", {
      uid: 1000,
      gid: 1000
    }, function (error, stdout, stderr) { })
    socket.off();
  });
  defer.resolve();
  return libQ.resolve();
};

peppyalapipe.prototype.onStart = function () {
  var self = this;
  var defer = libQ.defer();
  self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'updateALSAConfigFile')
  
  .then(function (e) {
    var pipeDefer = libQ.defer();
    exec("/usr/bin/mkfifo /tmp/myfifopeppy" + "; /bin/chmod 777 /tmp/myfifopeppy", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
      if (error) {
        self.logger.warn("An error occurred when creating fifo", error);
      }
      pipeDefer.resolve();
    });
    return pipeDefer.promise;
  });
  defer.resolve();
  self.startpeppyservice()
  return defer.promise;
};

peppyalsa.prototype.startpeppyservice = function () {
  const self = this;
  let defer = libQ.defer();
  exec("/usr/bin/sudo /bin/systemctl start peppy.service", {
    uid: 1000,
    gid: 1000
  }, function (error, stdout, stderr) {
    if (error) {
      self.logger.info('peppyMeter failed to start. Check your configuration ' + error);
    } else {
      self.commandRouter.pushConsoleMessage('PeppyMeter Daemon Started');
     # self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('START_BRUTEFIR'));

      defer.resolve();
    }
  });
};

peppyalapipe.prototype.onRestart = function () {
  var self = this;
};

peppyalapipe.prototype.onInstall = function () {
  var self = this;
  //	//Perform your installation tasks here
};

peppyalapipe.prototype.onUninstall = function () {
  var self = this;
  //Perform your installation tasks here
};

peppyalapipe.prototype.getUIConfig = function () {
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

/*
peppyalapipe.prototype.getLabelForSelect = function (options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};
*/
peppyalapipe.prototype.setUIConfig = function (data) {
  var self = this;

};

peppyalapipe.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};


peppyalapipe.prototype.setConf = function (varName, varValue) {
  var self = this;
};