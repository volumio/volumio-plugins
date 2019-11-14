'use strict';

var exec = require('child_process').exec;
var os = require('os');
var libQ = require('kew');
var Gpio = require('onoff').Gpio;
var shutdown, shutdowndetect, rolloff;

// Define the TubeAmpController class
module.exports = TubeAmpController;


function TubeAmpController(context) {
	var self = this;
	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;
	this.configManager = this.context.configManager;


}

TubeAmpController.prototype.onVolumioStart = function()
{
	var self = this;
	var defer=libQ.defer();

	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

	defer.resolve();
	return defer.promise;

}

TubeAmpController.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

TubeAmpController.prototype.onStop = function() {
	var self = this;
	var defer=libQ.defer();

	self.stopGpioWatch()
		.then(function(e)
		{
			self.logger.info('Tube Amp Gpio Controller Stopped');
			defer.resolve();
		})
		.fail(function(e)
		{
			defer.reject(new Error());
		});

	return defer.promise;
};

TubeAmpController.prototype.onStart = function() {
	var self = this;

	var defer=libQ.defer();


	self.tubeGpioInit()
	defer.resolve();

	return defer.promise;
};

TubeAmpController.prototype.tubeGpioInit = function() {
	var self = this;
	var rolloff_mode =0;

	var rolloffsetting = self.config.get('enable_roll_off');

	shutdown = new Gpio(22, 'high');
	shutdowndetect = new Gpio(24, 'in', 'rising'),
	rolloff = new Gpio(13, 'low');

	if (rolloffsetting){
		rolloff_mode =1;
	}

	rolloff.write(rolloff_mode, function (err) { // Asynchronous write.
		if (err) {
			self.logger.info('Cannot set rollof gpio')
		} else {
			self.logger.info('Rolloff GPIO set to Value: '+rolloff_mode)
		}
	});


	shutdowndetect.watch(function (err, value) {
		var self = this;
		if (err) {
			throw err;
		} if (value == 1) {
			console.log('Shutdown Knob: shutting down');
			return self.commandRouter.shutdown();
		}
	});

};

TubeAmpController.prototype.stopGpioWatch = function() {
	var self = this;
	var defer=libQ.defer();

	shutdown.unexport()
	shutdowndetect.unwatchAll();
	shutdowndetect.unexport();
	rolloff.unexport();
	
	defer.resolve();
	return defer.promise;
};

TubeAmpController.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;

	var lang_code = this.commandRouter.sharedVars.get('language_code');

	self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
		__dirname+'/i18n/strings_en.json',
		__dirname + '/UIConfig.json')
		.then(function(uiconf)
		{
			uiconf.sections[0].content[0].value = self.config.get('enable_roll_off');
			defer.resolve(uiconf);
		})
		.fail(function()
		{
			defer.reject(new Error());
		});

	return defer.promise;
};

TubeAmpController.prototype.saveTubeDacOptions = function(data) {
	var self = this;
	var message = 'Disabled'

	self.config.set('enable_roll_off', data.rolloff_setting);
	self.tubeGpioInit();
	if ( data.rolloff_setting) {
		message = 'Enabled'
	}
	self.commandRouter.pushToastMessage('success','High Frequency Rolloff', message);
};
