'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = randomizer;
function randomizer(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



randomizer.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    //var playFromLastPosition = config.get('playFromLastPosition') || false;
    //var lastPosition = config.get('lastPosition') || -1;
    //var autostartDelay = config.get('autostartDelay') || 20000;


    return libQ.resolve();
}

randomizer.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();


	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

randomizer.prototype.randomTracks = function() {
    var self = this;
    var defer=libQ.defer();
    exec('node /data/plugins/miscellanea/randomizer/randomTracks');
    
    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
}

randomizer.prototype.trackToAlbum = function() {
    var self = this;
    var defer=libQ.defer();
    exec('node /data/plugins/miscellanea/randomizer/trackToAlbum');

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
}
randomizer.prototype.randomAlbum = function() {
    var self = this;
    var defer=libQ.defer();
    exec('node /data/plugins/miscellanea/randomizer/randomAlbum');

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
}




randomizer.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

randomizer.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

randomizer.prototype.getUIConfig = function() {
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

randomizer.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

randomizer.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here

  var playFromLastPosition = data['playFromLastPosition'] || false;
  var numberOfTracks = data['numberOfTracks'] || 20000;
  config.set('playFromLastPosition', playFromLastPosition);
  config.set('autostartDelay', numberOfTracks);
  this.commandRouter.pushToastMessage('success', 'Randomizer', this.commandRouter.getI18nString("COMMON.CONFIGURATION_UPDATE_DESCRIPTION"));
//  this.commandRouter.pushToastMessage('success, numberOfTracks, this.commandRouter.getI18nString("COMMON.CONFIGURATION_UPDATE_DESCRIPTION"));



};

randomizer.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

randomizer.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};




