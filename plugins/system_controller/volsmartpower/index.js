'use strict';

var libQ = require('kew');
//var fs = require('fs-extra');
var Gpio = require('onoff').Gpio;
//var io = require('socket.io-client');
//var socket = io.connect('http://localhost:3000');
var actions = ["ShutDown", "BootOK", "SoftSD"];

module.exports = Volsmartpower;

function Volsmartpower(context) {
 var self = this;
 self.context = context;
 self.commandRouter = self.context.coreCommand;
 self.logger = self.context.logger;
 self.triggers = [];
}


Volsmartpower.prototype.onVolumioStart = function() {
 var self = this;

 var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
 this.config = new(require('v-conf'))();
 this.config.loadFile(configFile);

 self.logger.info("Volsmartpower initialized");

 return libQ.resolve();
};


Volsmartpower.prototype.getConfigurationFiles = function() {
 return ['config.json'];
};



Volsmartpower.prototype.onStart = function() {
 var self = this;
 var defer = libQ.defer();
 //	self.BootOK()
 self.createTriggers()
  .then(function(result) {
   self.logger.info("Volsmartpower started");
   defer.resolve();
  });

 return defer.promise;
};


Volsmartpower.prototype.onStop = function() {
 var self = this;
 var defer = libQ.defer();

 self.clearTriggers()
  .then(function(result) {
   self.logger.info("Volsmartpower stopped");
   defer.resolve();
  });

 return defer.promise;
};


Volsmartpower.prototype.onRestart = function() {
 var self = this;
};

Volsmartpower.prototype.onInstall = function() {
 var self = this;
};

Volsmartpower.prototype.onUninstall = function() {
 var self = this;
};

Volsmartpower.prototype.getConf = function(varName) {
 var self = this;
};

Volsmartpower.prototype.setConf = function(varName, varValue) {
 var self = this;
};

Volsmartpower.prototype.getAdditionalConf = function(type, controller, data) {
 var self = this;
};

Volsmartpower.prototype.setAdditionalConf = function() {
 var self = this;
};

Volsmartpower.prototype.setUIConfig = function(data) {
 var self = this;
};


Volsmartpower.prototype.getUIConfig = function() {
 var defer = libQ.defer();
 var self = this;

 self.logger.info('Volsmartpower: Getting UI config');

 var lang_code = this.commandRouter.sharedVars.get('language_code');

 self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
   __dirname + '/i18n/strings_en.json',
   __dirname + '/UIConfig.json')
  .then(function(uiconf) {

   var i = 0;
   actions.forEach(function(action, index, array) {

    // Strings for config
    var c1 = action.concat('.enabled');
    var c2 = action.concat('.pin');

    uiconf.sections[0].content[2 * i].value = self.config.get(c1);
    uiconf.sections[0].content[2 * i + 1].value.value = self.config.get(c2);
    uiconf.sections[0].content[2 * i + 1].value.label = self.config.get(c2).toString();

    i = i + 1;
   });

   defer.resolve(uiconf);
  })
  .fail(function() {
   defer.reject(new Error());
  });

 return defer.promise;
};

Volsmartpower.prototype.saveConfig = function(data) {
 var self = this;

 actions.forEach(function(action, index, array) {
  // Strings for data fields
  var s1 = action.concat('Enabled');
  var s2 = action.concat('Pin');

  // Strings for config
  var c1 = action.concat('.enabled');
  var c2 = action.concat('.pin');
  var c3 = action.concat('.value');

  self.config.set(c1, data[s1]);
  self.config.set(c2, data[s2]['value']);
  self.config.set(c3, 0);
 });

 self.clearTriggers()
  .then(self.createTriggers());

 self.commandRouter.pushToastMessage('success', "Volsmartpower", "Configuration saved");
};


Volsmartpower.prototype.createTriggers = function() {
 var self = this;

 self.logger.info('Volsmartpower: Reading config and creating triggers...');

 actions.forEach(function(action, index, array) {
  var c1 = action.concat('.enabled');
  var c2 = action.concat('.pin');

  var enabled = self.config.get(c1);
  var pin = self.config.get(c2);

  if (enabled === true) {
   //self.logger.info('Volsmartpower: '+ action + ' on pin ' + pin);
   if (action === 'BootOK') {
    var j = new Gpio(pin, 'out');
    j.writeSync(1);
    self.triggers.push(j);
    self.logger.info('Volsmartpower: ' + action + ' as output on pin ' + pin);
   } else {
    var j = new Gpio(pin, 'in', 'both');
    self.logger.info('Volsmartpower: ' + action + ' on pin ' + pin);
    j.watch(self.listener.bind(self, action));
    self.triggers.push(j);
   }

  }
 });

 return libQ.resolve();
};


Volsmartpower.prototype.clearTriggers = function() {
 var self = this;

 self.triggers.forEach(function(trigger, index, array) {
  self.logger.info("Volsmartpower: Destroying trigger " + index);

  trigger.unwatchAll();
  trigger.unexport();
 });

 self.triggers = [];

 return libQ.resolve();
};


Volsmartpower.prototype.listener = function(action, err, value) {
 var self = this;

 var c3 = action.concat('.value');
 var lastvalue = self.config.get(c3);
 if (action != 'BootOK') {
  // IF change AND high (or low?)
  if (value !== lastvalue && value === 1) {
   //do thing
   self[action]();

  }
  // remember value
  self.config.set(c3, value);
 }
};


//shutdown
Volsmartpower.prototype.SoftSD = function() {
 // console.log('Volsmartpower: SoftSD button pressed\n');
 this.commandRouter.reboot();
};

Volsmartpower.prototype.ShutDown = function() {
 //  console.log('Volsmartpower: shutdown button pressed\n');
 this.commandRouter.shutdown();
}
