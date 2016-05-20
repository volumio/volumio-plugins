'use strict';

var fs = require('fs-extra');
var exec = require('child_process').exec;
var os = require('os');
var spawn = require('child_process').spawn; 
var execSync = require('child_process').execSync;
// Define the UnmuteDigiamp class
module.exports = UnmuteDigiamp;


function UnmuteDigiamp(context) {
	var self = this;
	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;

}

UnmuteDigiamp.prototype.onVolumioStart = function () {
	var self = this;
	exec('/usr/bin/sudo "echo 22 > /sys/class/gpio/export"' ,{uid:1000,gid:1000}, function (error, stdout, stderr) {
		
	if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while accessing gpio: ' + error);
		}
		else {
			self.commandRouter.pushConsoleMessage('Gpio access ok');
		}
		});
	exec('/usr/bin/sudo "echo out >/sys/class/gpio/gpio22/direction"' ,{uid:1000,gid:1000}, function (error, stdout, stderr) {
	if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while starting gpio direction: ' + error);
		}
		else {
			self.commandRouter.pushConsoleMessage('gpio direction ok');
		}
		});
	exec('/usr/bin/sudo "echo 1 >/sys/class/gpio/gpio22/value"',{uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {	
	
			self.commandRouter.pushConsoleMessage('The following error occurred while starting unmuting Pi-amp+: ' + error);
		}
		else {
			self.commandRouter.pushConsoleMessage('Pi-amp unmuted');
		}
		});
	
};

UnmuteDigiamp.prototype.onStart = function () {
	var self = this;

};

UnmuteDigiamp.prototype.onStop = function () {
	var self = this;
	//Perform startup tasks here
};

UnmuteDigiamp.prototype.onRestart = function () {
	var self = this;

};

UnmuteDigiamp.prototype.onInstall = function () {
	var self = this;
	//Perform your installation tasks here
};

UnmuteDigiamp.prototype.onUninstall = function () {
	var self = this;
	//Perform your installation tasks here
};

UnmuteDigiamp.prototype.getUIConfig = function () {
	var self = this;


};

UnmuteDigiamp.prototype.setUIConfig = function (data) {
	var self = this;
	//Perform your installation tasks here
};

UnmuteDigiamp.prototype.getConf = function (varName) {
	var self = this;
	//Perform your installation tasks here
};

UnmuteDigiamp.prototype.setConf = function (varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

//Optional functions exposed for making development easier and more clear
UnmuteDigiamp.prototype.getSystemConf = function (pluginName, varName) {
	var self = this;
	//Perform your installation tasks here
};

UnmuteDigiamp.prototype.setSystemConf = function (pluginName, varName) {
	var self = this;
	//Perform your installation tasks here
};

UnmuteDigiamp.prototype.getAdditionalConf = function () {
	var self = this;
	//Perform your installation tasks here
};

UnmuteDigiamp.prototype.setAdditionalConf = function () {
	var self = this;
	//Perform your installation tasks here
};


