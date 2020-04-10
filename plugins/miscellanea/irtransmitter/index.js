'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = irtransmitter;
function irtransmitter(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



irtransmitter.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

irtransmitter.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

    var device = self.getAdditionalConf("system_controller", "system", "device");
    if (device == "Raspberry PI") {
//        self.enablePIOverlay();
    }
    self.logger.info('Adding IR transmitter parameters'+ JSON.stringify(device))

  self.addVolumeScripts();
	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

irtransmitter.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    self.removeVolumeScripts();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

irtransmitter.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

irtransmitter.prototype.getUIConfig = function() {
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

irtransmitter.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

irtransmitter.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

irtransmitter.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

irtransmitter.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// Actual working methods ----------------------------------------------------

// Adapted from Allo Relay attenuator plugin  (alloSteppedVolumeAttenuator)

irtransmitter.prototype.addVolumeScripts = function() {
    var self = this;

    var enabled = true;
    var setVolumeScript = '/data/plugins/miscellanea/irtransmitter/setvolume.sh';
    var getVolumeScript = '/data/plugins/miscellanea/irtransmitter/getvolume.sh';
    var setMuteScript = '/data/plugins/miscellanea/irtransmitter/togglemute.sh';
    var getMuteScript = '';
    var minVol = 0;
    var maxVol = 20;
    var mapTo100 = self.config.get('map_to_100', false);

    var data = {'enabled': enabled, 'setvolumescript': setVolumeScript, 'getvolumescript': getVolumeScript, 'setmutescript': setMuteScript,'getmutescript': getMuteScript, 'minVol': minVol, 'maxVol': maxVol, 'mapTo100': mapTo100};
    self.logger.info('Adding IR transmitter parameters'+ JSON.stringify(data))
    self.commandRouter.updateVolumeScripts(data);
};

irtransmitter.prototype.removeVolumeScripts = function() {
    var self = this;

    var enabled = false;
    var setVolumeScript = '';
    var getVolumeScript = '';
    var setMuteScript = '';
    var getMuteScript = '';
    var minVol = 0;
    var maxVol = 100;
    var mapTo100 = false;

    var data = {'enabled': enabled, 'setvolumescript': setVolumeScript, 'getvolumescript': getVolumeScript, 'setmutescript': setMuteScript,'getmutescript': getMuteScript, 'minVol': minVol, 'maxVol': maxVol, 'mapTo100': mapTo100};
    self.commandRouter.updateVolumeScripts(data);
};

irtransmitter.prototype.enablePIOverlay = function() {
    var defer = libQ.defer();
    var self = this;

    exec('/usr/bin/sudo /usr/bin/dtoverlay lirc-rpi gpio_in_pin=17', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error enabling lirc-rpi overlay: '+error);
                defer.reject();
            } else {
                self.logger.info('lirc-rpi overlay enabled');
                defer.resolve();
            }
        });

    return defer.promise;
};

irtransmitter.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
    var confs = self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
    return confs;
};
