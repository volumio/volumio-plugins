
'use strict';

var io = require('socket.io-client');
var libQ = require('kew');
var fs = require('fs-extra');
var Gpio = require('onoff').Gpio;
var raspdacDisplay = require('./raspdacDisplay');

// Define the ControllerRaspDac class
module.exports = ControllerRaspDac;

function ControllerRaspDac(context) {
      // This fixed variable will let us refer to 'this' object at deeper scopes
      var self = this;

      self.context = context;
      self.commandRouter = this.context.coreCommand;
      self.logger = this.context.logger;
}

ControllerRaspDac.prototype.onVolumioStart = function()
{
      var self = this;
      self.logger.info("RaspDac initialized");
      return libQ.resolve();
}

ControllerRaspDac.prototype.onVolumioReboot = function()
{
      var self = this;
      self.raspdacDisplay.close();
      self.softShutdown.writeSync(1);
}

ControllerRaspDac.prototype.onVolumioShutdown = function()
{
      var self = this;
      var defer = libQ.defer();
      
      self.raspdacDisplay.close();
      self.softShutdown.writeSync(1);
      setTimeout(function(){
            self.softShutdown.writeSync(0);
            defer.resolve();
          }, 1000);
      
      return defer;
}

ControllerRaspDac.prototype.getConfigurationFiles = function()
{
      return ['config.json'];
}

ControllerRaspDac.prototype.addToBrowseSources = function () {
      var self = this;
};

// Plugin methods -----------------------------------------------------------------------------
ControllerRaspDac.prototype.onStart = function() {
      var self = this;

      // Set Button GPIO
      self.softShutdown = new Gpio(4, 'out');
      self.shutdownButton = new Gpio(17, 'in', 'both');
      self.bootOk = new Gpio(22, 'high');

      self.shutdownButton.watch(self.hardShutdownRequest.bind(this));

      // Set LCD
      self.raspdacDisplay = new raspdacDisplay(self.context);

      self.configFile=self.commandRouter.pluginManager.getConfigurationFile(self.context,'config.json');

      //self.applyConf(self.getConf());
      self.logger.info("RaspDac started");

      return libQ.resolve();
};

ControllerRaspDac.prototype.onStop = function() {
      var self = this;
      self.shutdownButton.unwatchAll();
      self.shutdownButton.unexport();
      self.bootOk.unexport();
      self.softShutdown.unexport();

      self.raspdacDisplay.close();
      
      return libQ.resolve();
};

ControllerRaspDac.prototype.onRestart = function() {
      var self = this;
};

ControllerRaspDac.prototype.onInstall = function() {
      var self = this;
      //Perform your installation tasks here
};

ControllerRaspDac.prototype.onUninstall = function() {
      var self = this;
      //Perform your installation tasks here
};

ControllerRaspDac.prototype.stop = function() {
};


ControllerRaspDac.prototype.getConf = function(varName) {
      var self = this;
      this.config = new (require('v-conf'))()
      this.config.loadFile(configFile)

      return libQ.resolve();
};

ControllerRaspDac.prototype.setConf = function(varName, varValue) {
      var self = this;
      //Perform your installation tasks here
};

ControllerRaspDac.prototype.applyConf = function(conf) {
      var self = this;
};

ControllerRaspDac.prototype.getUIConfig = function() {
      var defer = libQ.defer();
      var self = this;

      var lang_code = self.commandRouter.sharedVars.get('language_code');

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

ControllerRaspDac.prototype.setUIConfig = function(data) {
      var self = this;
      self.logger.info("Updating UI config");
      var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');

      return libQ.resolve();
};

// user_interface plugin Methods
ControllerRaspDac.prototype.pushState = function(state) {
      var self = this;  
      self.raspdacDisplay.pushState(state);
      return libQ.resolve();
}

ControllerRaspDac.prototype.pushQueue = function(state) {
      var self = this;
      return libQ.resolve();
}

// Public Methods ---------------------------------------------------------------------------------------

// Button Management
ControllerRaspDac.prototype.hardShutdownRequest = function(err, value) {
// if the hard shutdown is activated should be ok to just shutdown. 
      // the "bootOK" GPIO will turn off as part of the system shutdown.
      // ...after which the power will be cut a few seconds later by the hardware
      self.commandRouter.shutdown();
};
