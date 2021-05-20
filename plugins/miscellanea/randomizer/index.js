'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

var tracks = null;
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


    return libQ.resolve();
}

randomizer.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();
    self.load18nStrings();

    // Once the Plugin has successfull started resolve the promise
    defer.resolve();

    return defer.promise;
};

randomizer.prototype.randomTracks = function() {
    var self = this;
    var defer=libQ.defer();
    self.tracks = self.config.get('tracks');
    if (isNaN(self.tracks)) { 
      exec('node /data/plugins/miscellanea/randomizer/randomTracks');
    } else {
      exec('node /data/plugins/miscellanea/randomizer/randomTracks '+ self.config.get('tracks') );
    }
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


randomizer.prototype.saveSettings = function (data) {
    var self = this;
    var defer = libQ.defer();
      
    defer.resolve();
  
    if(isNaN(data['tracks'])) data['tracks'] = -1;
    
    if(data['tracks'] <= 0) {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_NUMBER_PLEASE_TITLE"), self.getI18nString("ERROR_NUMBER_PLEASE_MESSAGE"));
      } else {
        self.commandRouter.pushToastMessage('success', self.getI18nString("SUCCESS_TITLE"), self.getI18nString("SUCCESS_MESSAGE"));
    }
    self.config.set('tracks', parseInt(data['tracks']),10);

    return defer.promise;
    
};


randomizer.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {

            uiconf.sections[0].content[0].value = self.config.get('tracks');
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};




randomizer.prototype.load18nStrings = function () {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
    } catch (e) {
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};


randomizer.prototype.getI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};


// Configuration Methods -----------------------------------------------------------------------------


randomizer.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

randomizer.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here

};

randomizer.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

randomizer.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};




