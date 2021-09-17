'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');

var position = 0;

module.exports = remote_previous;
function remote_previous(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



remote_previous.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

remote_previous.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();
   self.load18nStrings();


	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

remote_previous.prototype.truePrevious = function() {
     var self = this;
     var defer=libQ.defer();
     var position = 0;
     socket.emit('getState', '');
     socket.on('pushState', function (data) {
     if (data.position >= 1)
     {
       socket.on('pushState', function () {
       });
       socket.emit("play",{"value":data.position - 1});
     } else {
     socket.emit("play",{"value":0});
     }
     socket.off('pushState');
  });
  // Once the Plugin has successfully started resolve the promise
  defer.resolve();
  return libQ.resolve();
};


remote_previous.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

remote_previous.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


remote_previous.prototype.load18nStrings = function () {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
    } catch (e) {
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};

remote_previous.prototype.getI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};


// Configuration Methods -----------------------------------------------------------------------------

remote_previous.prototype.getUIConfig = function() {
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

remote_previous.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

remote_previous.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

remote_previous.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

remote_previous.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};


