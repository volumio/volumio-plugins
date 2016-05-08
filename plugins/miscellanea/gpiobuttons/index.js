'use strict';

var fs = require('fs-extra');
var exec = require('child_process').exec;
var os = require('os');
var GPIO = require('onoff').Gpio,
// Define the Gpiobuttons class
module.exports = Gpiobuttons;


function Gpiobuttons(context) {
	var self = this;
	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;

}

Gpiobuttons.prototype.onVolumioStart = function () {
	var self = this;
	
};

Gpiobuttons.prototype.onStart = function () {
	var self = this;

};

Gpiobuttons.prototype.onStop = function () {
	var self = this;
	//Perform startup tasks here
};

Gpiobuttons.prototype.onRestart = function () {
	var self = this;

};

Gpiobuttons.prototype.onInstall = function () {
	var self = this;
	//Perform your installation tasks here
};

Gpiobuttons.prototype.onUninstall = function () {
	var self = this;
	//Perform your installation tasks here
};

Gpiobuttons.prototype.getUIConfig = function () {
	var self = this;


};

Gpiobuttons.prototype.setUIConfig = function (data) {
	var self = this;
	//Perform your installation tasks here
};

Gpiobuttons.prototype.getConf = function (varName) {
	var self = this;
	//Perform your installation tasks here
};

Gpiobuttons.prototype.setConf = function (varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

//Optional functions exposed for making development easier and more clear
Gpiobuttons.prototype.getSystemConf = function (pluginName, varName) {
	var self = this;
	//Perform your installation tasks here
};

Gpiobuttons.prototype.setSystemConf = function (pluginName, varName) {
	var self = this;
	//Perform your installation tasks here
};

Gpiobuttons.prototype.getAdditionalConf = function () {
	var self = this;
	//Perform your installation tasks here
};

Gpiobuttons.prototype.setAdditionalConf = function () {
	var self = this;
	//Perform your installation tasks here
};


