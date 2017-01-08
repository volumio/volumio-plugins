'use strict';

var exec = require('child_process').exec;
var os = require('os');
var libQ = require('kew');
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var Gpio = require('onoff').Gpio,
shutdown = new Gpio(14, 'high');
var status = 'stop';

// Define the AmpSwitchController class
module.exports = AmpSwitchController;


function AmpSwitchController(context) {
	var self = this;
	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;
	this.configManager = this.context.configManager;
    self.timer;

}

AmpSwitchController.prototype.onVolumioStart = function()
{
	var self = this;
    self.logger.info("AmpSwitch loaded");

}

AmpSwitchController.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

AmpSwitchController.prototype.onStart = function() {
	var self = this;

	var defer=libQ.defer();

    socket.emit('getState','');

    socket.once('pushState', function (state) {
        status=state.status;
    });
    self.ampGPIOInit();
    self.logger.info('AmpSwitch started');
    defer.resolve();

	return defer.promise;
};

AmpSwitchController.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    self.freeGPIO();
    clearInterval(self.timer);
    return defer.promise;
};

AmpSwitchController.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;

	return defer.promise;
};

AmpSwitchController.prototype.ampGPIOInit = function() {
    var self = this;

    self.timer = setInterval(self.pollStatus.bind(self),2000);
    if(status=='play') {
        self.on();
    } else if(status=='stop' || status=='pause') {
        self.off();
    }
    self.logger.info('AmpSwitch initialized');
};

AmpSwitchController.prototype.pollStatus = function() {
    var self = this;

    self.logger.info('Polling status (' + status + ')');
    socket.emit('getState','');

    socket.once('pushState', function (state) {
        if(state.status=='play' && state.status != status){
            status=state.status;
            self.on();
        } else if((state.status=='pause' || state.status=='stop') && (status!='pause' && status!='stop')){
            status=state.status;
            self.off();
        }
    });
};

AmpSwitchController.prototype.on = function() {

    self.logger.info('AmpSwitch: Output ON');
    shutdown.writeSync(1);
};


AmpSwitchController.prototype.off = function() {

    self.logger.info('AmpSwitch: Output OFF');
    shutdown.writeSync(0);
};

AmpSwitchController.prototype.freeGPIO = function() {
    var self = this;

    shutdown.unexport();
};
