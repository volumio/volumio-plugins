'use strict';

var fs = require('fs-extra');
var exec = require('child_process').exec;
var os = require('os');

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
	exec('/usr/bin/sudo sh -c "echo 22 > /sys/class/gpio/export"', function (error, stdout, stderr) {
		});
	exec('/usr/bin/sudo sh -c "echo out >/sys/class/gpio/gpio22/direction"' , function (error, stdout, stderr) {
		});
	exec('/usr/bin/sudo sh -c "echo 1 >/sys/class/gpio/gpio22/value"' , function (error, stdout, stderr) {
		})
	
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


