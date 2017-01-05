'use strict';

var libQ = require('kew');
var Gpio = require('onoff').Gpio;

// Define the AmpSwitchController class
module.exports = AmpSwitchController;


function AmpSwitchController(context) {
	var self = this;
	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;
	this.configManager = this.context.configManager;


}

AmpSwitchController.prototype.onVolumioStart = function()
{
	var self = this;

}

AmpSwitchController.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

AmpSwitchController.prototype.onStop = function() {
	var self = this;
	var defer=libQ.defer();

	return defer.promise;
};

AmpSwitchController.prototype.onStart = function() {
	var self = this;

	var defer=libQ.defer();


    self.logger.info('AmpSwitch started');
    defer.resolve();

	return defer.promise;
};

AmpSwitchController.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;

	return defer.promise;
};
