'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = alloSteppedVolumeAttenuator;
function alloSteppedVolumeAttenuator(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



alloSteppedVolumeAttenuator.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);


    return libQ.resolve();
}

alloSteppedVolumeAttenuator.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();


	self.startRattenu();
	defer.resolve();

    return defer.promise;
};

alloSteppedVolumeAttenuator.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
	self.removeVolumeScripts();
    defer.resolve();

    return libQ.resolve();
};

alloSteppedVolumeAttenuator.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

alloSteppedVolumeAttenuator.prototype.getUIConfig = function() {
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


alloSteppedVolumeAttenuator.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

alloSteppedVolumeAttenuator.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

alloSteppedVolumeAttenuator.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};


alloSteppedVolumeAttenuator.prototype.startRattenu = function () {
	var self = this;

    exec("echo volumio | sudo -S /usr/bin/r_attenu -d > /dev/null 2>&1", {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
        if (error !== null) {

            self.logger.info('Error, cannot start R ATTENU '+error)
        } else {
            self.logger.info('R Attenu started')
			self.addVolumeScripts();
        }
    });

};

alloSteppedVolumeAttenuator.prototype.addVolumeScripts = function() {
    var self = this;

    var data = {'enabled':false, 'setvolumescript':'/data/plugins/accessory/allo_stepped_volume_attenuator/setvolume.sh', 'getvolumescript':'/data/plugins/accessory/allo_stepped_volume_attenuator/getvolume.sh'};
    self.commandRouter.updateVolumeScripts(data);
};

alloSteppedVolumeAttenuator.prototype.removeVolumeScripts = function() {
    var self = this;
    var data = {'enabled':false, 'setvolumescript':'', 'getvolumescript':''};
    self.commandRouter.updateVolumeScripts(data);
};