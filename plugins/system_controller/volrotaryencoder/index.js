'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
const rotaryEncoder = require('onoff-rotary');
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
 var config = new(require('v-conf'))();
var actions = ["volumeUp", "volumeDown"];

module.exports = volrotaryencoder;

function volrotaryencoder(context) {
	var self = this;
	self.context=context;
	self.commandRouter = self.context.coreCommand;
	self.logger = self.context.logger;
	self.triggers = [];
}


volrotaryencoder.prototype.onVolumioStart = function () {
	var self = this;

	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

	self.logger.info("Rotary encoder initialized");
	
	return libQ.resolve();	
};


volrotaryencoder.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};


volrotaryencoder.prototype.onStart = function () {
	var self = this;
	var defer=libQ.defer();

			self.logger.info("rotary encoder started");
			defer.resolve();
		
	
    return defer.promise;
};


volrotaryencoder.prototype.onStop = function () {
	var self = this;
	var defer=libQ.defer();

			self.logger.info("rotary encoder stopped");
			defer.resolve();
		
	
    return defer.promise;
};


volrotaryencoder.prototype.onRestart = function () {
	var self = this;
};

volrotaryencoder.prototype.onInstall = function () {
	var self = this;
};

volrotaryencoder.prototype.onUninstall = function () {
	var self = this;
};

volrotaryencoder.prototype.getConf = function (varName) {
	var self = this;
};

volrotaryencoder.prototype.setConf = function(varName, varValue) {
	var self = this;
};

volrotaryencoder.prototype.getAdditionalConf = function (type, controller, data) {
	var self = this;
};

volrotaryencoder.prototype.setAdditionalConf = function () {
	var self = this;
};

volrotaryencoder.prototype.setUIConfig = function (data) {
	var self = this;
};


volrotaryencoder.prototype.getUIConfig = function () {
	var defer = libQ.defer();
	var self = this;
	var lang_code = this.commandRouter.sharedVars.get('language_code');

        self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
                __dirname+'/i18n/strings_en.json',
                __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {

value = self.config.get('volumeUp');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[0].options'), value));
value = self.config.get('volumeDown');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[1].options'), value));
//console.log(volumeUp);
var value;
            defer.resolve(uiconf);
		})
        .fail(function()
        {
            defer.reject(new Error());
        });

        return defer.promise;
};

 volrotaryencoder.prototype.getLabelForSelect = function(options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
   if (options[i].value == key)
    return options[i].label;
  }

  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';

 };

/*
volrotaryencoder.prototype.getrotary
var self = this;
var volumeUp = self.config.get('volumeUp')
var vdown = self.config.get('volumeDown')

   const myEncoder = rotaryEncoder(volumeUp, vdown); 
    myEncoder.on('rotation', direction => {
        if (direction > 0) {
	self.fvolumeUp
            console.log('Encoder rotated right');
        } else {
	self.fvolumeDown
            console.log('Encoder rotated left');
        }
    });
*/
volrotaryencoder.prototype.saverotaryConfig = function(data){
	var self = this;
	var defer = libQ.defer();
  self.config.set('volumeUp', data['volumeUp'].value);
  self.config.set('volumeDown', data['volumeDown'].value);
//  self.logger.info('Rotary Configurations have been set');
  self.commandRouter.pushToastMessage('success', "Configuration update", 'Rotary settings successfully applied');
  return defer.promise;
};




//Volume up
volrotaryencoder.prototype.fvolumeUp = function() {
  socket.emit('volume','+');
};

//Volume down
volrotaryencoder.prototype.fvolumeDown = function() {
  socket.emit('volume','-');
}//