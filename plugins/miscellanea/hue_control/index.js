'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = hueControl;
const io = require('socket.io-client');

function hueControl(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = new HueLogger(this.context.logger);
	this.configManager = this.context.configManager;

	this.volumioClient = null;
    this.playerStatus = null;

    this.switchOffTimer = null;
}

function HueLogger(volumioLogger) {
    var self = this;

    this.logger = volumioLogger;
}

HueLogger.prototype.info = function(message) {
    var self = this;
    self.logger.info(`tradfri_plugin: ${message}`);
}

HueLogger.prototype.warn = function(message) {
    var self = this;
    self.logger.warn(`tradfri_plugin: ${message}`);
}

HueLogger.prototype.error = function(message) {
    var self = this;
    self.logger.error(`tradfri_plugin: ${message}`);
}

HueLogger.prototype.debug = function(message) {
    var self = this;
    self.logger.debug(`tradfri_plugin: ${message}`);
}

hueControl.prototype.onVolumioStart = function()
{
	var self = this;

	self.logger.debug('onVolumioStart');
	
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

hueControl.prototype.onStart = function() {
	var self = this;

    self.logger.debug('onStart');
    console.log("onStart+");

	// connect to the volumio service and listen for player state changes
	self.volumioClient = io.connect('http://localhost:3000');
	self.volumioClient.on('pushState', self.onVolumioState.bind(self));
	// request the value of the current player state
	self.volumioClient.emit('getState', '');
	
	var defer=libQ.defer();


	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

hueControl.prototype.onStop = function() {
	var self = this;

	self.logger.debug('onStop');
	
	if (self.volumioClient) {
        self.volumioClient.disconnect();
        self.volumioClient = null;
    }

    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

hueControl.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};

// Volumio Connection -----------------------------------------------------------------------------

hueControl.prototype.onVolumioState = function(state) {
    var self = this;

    if (state.status != self.playerStatus) {
        self.playerStatus = state.status;

        self.logger.debug(`new player status: ${self.playerStatus}`);

        if (self.playerStatus == 'play') {
            // volumio is playing
            // stop timer if started
            if (self.switchOffTimer) {
                clearTimeout(self.switchOffTimer);
                self.switchOffTimer = null;
            }
			// switch on volumio device if available
			// TODO: Replace with hue function
            // if (self.tradfriDeviceOrGroup) {
            //     // tradfri device available
            //     self.logger.info(`switch on ${self.tradfriDeviceOrGroup.name}`);
            //     turnTradfriDeviceOrGroupOn(self.tradfriDeviceOrGroup);
            // }
        } else {
            // volumio is not playing
            // start timer if not already started
            if (!self.switchOffTimer) {
                self.logger.debug(`starting switch off timer`);
                self.switchOffTimer = setTimeout(
                    self.switchOffTimeout.bind(self),
                    self.config.get('switch_off_delay') * 1000
                );
            }
        }
    }
}

hueControl.prototype.switchOffTimeout = function() {
    var self = this;

    // timeout expired
    self.switchOffTimer = null;

	// switch off volumio device if available
	// TODO: Replace with hue function
    // if (self.tradfriDeviceOrGroup) {
    //     // tradfri device available
    //     self.logger.info(`switch off ${self.tradfriDeviceOrGroup.name}`);
    //     turnTradfriDeviceOrGroupOff(self.tradfriDeviceOrGroup);
    // }
}

// Configuration Methods -----------------------------------------------------------------------------

hueControl.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

	var lang_code = this.commandRouter.sharedVars.get('language_code');
	
	//TODO: Replace later
	var isConnected = false

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
			
			// Bridge Address
			uiconf.sections[0].content[0].value = self.config.get('hue_bridge_address');
			uiconf.sections[1].content[1].value = self.config.get('hue_bridge_address');

			// switch off delay
			uiconf.sections[2].content[0].value = self.config.get('switch_off_delay');

            // remove either the connect on or disconnect section
			var indexOfSectionToRemove = (isConnected) ? 0 : 1;
			uiconf.sections.splice(indexOfSectionToRemove, 1);

			// Remove device selection if bridge is not connected
			if(!isConnected) {
				uiconf.sections[2].sections.splice(1,1);
			}

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

hueControl.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

hueControl.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

hueControl.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

hueControl.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



