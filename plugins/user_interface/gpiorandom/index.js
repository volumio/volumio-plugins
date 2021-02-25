'use strict';
var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var Gpio = require('onoff').Gpio;

var running = false;
var button = null;
var nbsongs = null;

module.exports = gpiorandom;
function gpiorandom(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
}


gpiorandom.prototype.onVolumioStart = function() {
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
};


gpiorandom.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();
    
    self.load18nStrings();
    
    var gpionum = self.config.get('gpionum');
    if (isNaN(gpionum)) gpionum = 3;
    
    self.nbsongs = self.config.get('nbsongs');
    if (isNaN(self.nbsongs)) self.nbsongs = 20;
    
    self.logger.info("gpioRandom : init GPIO");
    self.button  = new Gpio(gpionum, 'in', 'falling', {debounceTimeout: 10, activeLow: true});

    // add listen to pushed button => call createPlaylist() then play
    self.button.watch((err, value) => {
        if (err) {
            self.logger.info("gpioRandom : error - " + err);
        }
        self.logger.info("gpioRandom : button pressed");
        self.createPlaylist();
    });
    
    self.running = true;
    
    // Once the Plugin has successfull started resolve the promise
    defer.resolve();

    return defer.promise;
};

gpiorandom.prototype.rand = function(max, min) {
    return Math.floor(Math.random() * (+max - +min)) + min;
}

gpiorandom.prototype.createPlaylist = function() {
    var self = this;
    var defer=libQ.defer();
    
    // stop before anything
    socket.emit('stop');
        
    // clear play list
    self.logger.info("gpioRandom : clear queue");
    socket.emit('clearQueue');    
    
    // get random song from collection and add them to lpay list
    self.logger.info("gpioRandom : start to browse library...");
    socket.emit('browseLibrary', {'uri':'albums://'});
    
    // start browsing album and adding song to queue
    socket.on('pushBrowseLibrary',function(data) {
        var item = data.navigation.lists[0].items[0];
        
        // whlie browsing, we encounter either songs : we add it to playlist...
        if (item.type == 'song') {
            self.logger.info("gpioRandom : add to queue - " + item.title);
            socket.emit('addToQueue', {'uri':item.uri});
        } else { // ... or folders : we scan them
            var list = data.navigation.lists[0].items;
            var random = self.rand(list.length - 1, 0);
            var select = list[random];
            
            self.logger.info("gpioRandom : browse into " + item.title);
            socket.emit('browseLibrary', {'uri':select.uri});
        }
    });
    
    // as son as maximum songs are in queue, stop listening to changes and start to play
    socket.on('pushQueue', function(data) {
        if (data.length >= self.nbsongs) {
            self.logger.info("gpioRandom : added "+self.nbsongs+ " - unregister library and queue event");
            socket.off('pushBrowseLibrary');
            socket.off('pushQueue');
            
            self.logger.info("gpioRandom : now start playing");
            socket.emit('play',{'value':0});
        } else {
            socket.emit('browseLibrary', {'uri':'albums://'});
        }
    });
    
    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
}

gpiorandom.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();
    
    self.logger.info("gpioRandom : free GPIO");
    if(typeof(self.button) == 'object') self.button.unexport();
    self.running = false;
    
    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};


gpiorandom.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


gpiorandom.prototype.saveSettings = function (data) {
    var self = this;
    var defer = libQ.defer();
      
    defer.resolve();
    
    if(isNaN(data['gpionum'])) data['gpionum'] = -1; 
    if(isNaN(data['nbsongs'])) data['nbsongs'] = -1;
    
    if(data['gpionum'] <= 0) {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_NOT_A_NUMBER_TITLE"), self.getI18nString("ERROR_NOT_A_NUMBER_MESSAGE"));
    } else if(data['nbsongs'] <= 0) {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_NOT_A_NUMBER_TITLE"), self.getI18nString("ERROR_NOT_A_NUMBER_MESSAGE"));
    } else {
            self.commandRouter.pushToastMessage('success', self.getI18nString("SUCCESS_TITLE"), self.getI18nString("SUCCESS_MESSAGE"));
    }
    
    self.config.set('gpionum', parseInt(data['gpionum']),10);
    self.config.set('nbsongs', parseInt(data['nbsongs']),10);
    
    return defer.promise;
    
};


gpiorandom.prototype.load18nStrings = function () {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
    } catch (e) {
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};


gpiorandom.prototype.getI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};

// Configuration Methods -----------------------------------------------------------------------------

gpiorandom.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            uiconf.sections[0].content[0].value = self.config.get('gpionum');
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

gpiorandom.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

gpiorandom.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

gpiorandom.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

gpiorandom.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

