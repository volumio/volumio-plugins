'use strict';

var exec = require('child_process').exec;
var os = require('os');
var libQ = require('kew');
// Define the TouchDisplay class
module.exports = TouchDisplay;


function TouchDisplay(context) {
	var self = this;
	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;

}


TouchDisplay.prototype.onStop = function() {
	var self = this;

	self.logger.info("Stopping touch display controller");
	exec("/usr/bin/sudo /bin/systemctl stop volumio-kiosk.service", function (error, stdout, stderr) {
		if(error){
			self.logger.info('Cannot stop Touch Display')
		}
	});

	return libQ.resolve();
};

TouchDisplay.prototype.onStart = function() {
	var self = this;

	var defer=libQ.defer();

	self.startKiosk()
		.then(function(e)
		{
			self.logger.info('Kiosk Started');
			defer.resolve();
		})
		.fail(function(e)
		{
			defer.reject(new Error());
		});

	return defer.promise;
};

TouchDisplay.prototype.startKiosk = function() {
	var self = this;

	var defer=libQ.defer();

	exec("/usr/bin/sudo /bin/systemctl start volumio-kiosk.service", {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.logger.info('Cannot start Volumio Kiosk: '+ error);
			defer.reject();
		}
		else {
			self.logger.info('Volumio Kiosk Started');
			defer.resolve();
		}
	});

	return defer.promise;
};

TouchDisplay.prototype.getUIConfig = function() {
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

TouchDisplay.prototype.saveDisplayOptions = function() {
	var self = this;

};
