'use strict';

//var io = require('socket.io-client');
var fs = require('fs-extra');
var libFsExtra = require('fs-extra');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var libQ = require('kew');
var config = new (require('v-conf'))();


// Define the ControllerVolstereo2mono class
module.exports = ControllerVolstereo2mono;

function ControllerVolstereo2mono(context) {
  var self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;

  self.configManager = self.context.configManager;
};

ControllerVolstereo2mono.prototype.onVolumioStart = function () {
  var self = this;
  var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
  return libQ.resolve();
};

ControllerVolstereo2mono.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

// Plugin methods -----------------------------------------------------------------------------

ControllerVolstereo2mono.prototype.onStop = function () {
  var self = this;
  var defer = libQ.defer();
  defer.resolve();
  return libQ.resolve();
};

ControllerVolstereo2mono.prototype.onStart = function () {
  var self = this;
  var defer = libQ.defer();
  defer.resolve();
  return defer.promise;
};

ControllerVolstereo2mono.prototype.onRestart = function () {
  var self = this;
};

ControllerVolstereo2mono.prototype.onInstall = function () {
  var self = this;
  //	//Perform your installation tasks here
};

ControllerVolstereo2mono.prototype.onUninstall = function () {
  var self = this;
  //Perform your installation tasks here
};

ControllerVolstereo2mono.prototype.getUIConfig = function () {
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


ControllerVolstereo2mono.prototype.getLabelForSelect = function (options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

ControllerVolstereo2mono.prototype.setUIConfig = function (data) {
  var self = this;

};

ControllerVolstereo2mono.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};


ControllerVolstereo2mono.prototype.setConf = function (varName, varValue) {
  var self = this;
  //Perform your installation tasks here
};

//here we save the asound.conf file config
ControllerVolstereo2mono.prototype.createASOUNDFile = function () {
  var self = this;

  var defer = libQ.defer();


  var folder = self.commandRouter.pluginManager.findPluginFolder('audio_interface', 'volstereo2mono');

  var alsaFile = folder + '/asound/volst2mono.postSt2mono.10.conf';
  return defer.promise;

};