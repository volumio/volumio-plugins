'use strict';

var fs = require('fs-extra');
var libFsExtra = require('fs-extra');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var libQ = require('kew');
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
  var self = this;
  var defer = libQ.defer();
  defer.resolve();
  return libQ.resolve();
};

peppyalapipe.prototype.onStart = function () {
  var self = this;
  var defer = libQ.defer();
  defer.resolve();
  return defer.promise;
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


peppyalapipe.prototype.getLabelForSelect = function (options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

peppyalapipe.prototype.setUIConfig = function (data) {
  var self = this;

};

peppyalapipe.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};


peppyalapipe.prototype.setConf = function (varName, varValue) {
  var self = this;
  //Perform your installation tasks here
};

//here we save the asound.conf file config
peppyalapipe.prototype.createASOUNDFile = function () {
  var self = this;

  var defer = libQ.defer();


  var folder = self.commandRouter.pluginManager.findPluginFolder('audio_interface', 'volstereo2mono');

  var alsaFile = folder + '/asound/volumioPeppyalsa.postPeppyalsa.10.conf';
  return defer.promise;

};