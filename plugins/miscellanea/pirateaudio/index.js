'use strict';

var libQ = require('kew');
//var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
//var execSync = require('child_process').execSync;

module.exports = pirateaudio;

function pirateaudio(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
}

pirateaudio.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
};

pirateaudio.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

	// Once the Plugin has successfull started resolve the promise
	defer.resolve();
	self.startpirateaudioservice();
    return defer.promise;
};

pirateaudio.prototype.startpirateaudioservice = function () {
	const self = this;
	let defer = libQ.defer();
	exec("/usr/bin/sudo /bin/systemctl start pirateaudio.service", {
	  uid: 1000,
	  gid: 1000
	}, function (error, stdout, stderr) {
	  if (error) {
		self.logger.info('Pirate audio service failed to start. Check your configuration ' + error);
	  } else {
		self.commandRouter.pushConsoleMessage('Pirate audio service (daemon) started');
  
		defer.resolve();
	  }
	});
  };

pirateaudio.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();
	self.logger.info("Stopping Pirate audio service");
	exec("/usr/bin/sudo /bin/systemctl stop pirateaudio.service", {
		uid: 1000,
		gid: 1000
	}, function (error, stdout, stderr) { });
    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

pirateaudio.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

pirateaudio.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
			//Debug
			//self.logger.info('Funktion getUIConfig pirate:' + self.config.get('sleeptimer'));
			uiconf.sections[0].content[0].value.value = self.config.get('listmax');
			uiconf.sections[0].content[0].value.label = self.config.get('listmax');
			uiconf.sections[0].content[1].value.value = self.config.get('gpio_ybutton'); //works on fieldtype select
			uiconf.sections[0].content[1].value.label = self.config.get('gpio_ybutton'); //works on fieldtype select
			uiconf.sections[0].content[2].value = self.config.get('sleeptimer'); //works on fieldtype input, needs no label
			//uiconf.sections[0].content[1].value = self.config.get('listmax'); //geht bei Feld input
			//uiconf.sections[0].content[0].value = 6; //geht als statische Anzeige und bei Feld input
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

pirateaudio.prototype.getConfigurationFiles = function() {
	return ['config.json'];
};

pirateaudio.prototype.setUIConfig = function(data) {
	var defer = libQ.defer();
	var self = this;
	//Perform your tasks here
	//Debug
	//self.logger.info('Wert: ' + data['sleeptimer']);
	self.config.set('listmax', parseInt(data['listmax'].value));//works on fieldtype select
	self.config.set('gpio_ybutton', parseInt(data['gpio_ybutton'].value));//works on fieldtype select
	self.config.set('sleeptimer', parseInt(data['sleeptimer']));//works on fieldtype input
	exec("/usr/bin/sudo /bin/systemctl restart pirateaudio.service", {
		uid: 1000,
		gid: 1000
	  }, function (error, stdout, stderr) {
		if (error) {
		  self.logger.info('Pirate audio service failed to re-start. Check your configuration ' + error);
		} else {
		  self.commandRouter.pushConsoleMessage('Pirate audio service re-started');
	
		  defer.resolve();
		}
	  });
	self.commandRouter.pushToastMessage('success', 'Pirate Audio', this.commandRouter.getI18nString("COMMON.CONFIGURATION_UPDATE_DESCRIPTION"));
	//return libQ.resolve();
	return defer.promise;
};
