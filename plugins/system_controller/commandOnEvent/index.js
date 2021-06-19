'use strict';
var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');

var running = false;
var prevState=null;

module.exports = commandOnEvent;
function commandOnEvent(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
}


commandOnEvent.prototype.onVolumioStart = function() {
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    socket.on('pushState', function (state) {
        if (self.running) {
            self.logger.info("commandOnEvent: state = " + state.status + " / prevState = " + self.prevState);

            if (state.status.localeCompare(self.prevState) != 0) {
                self.logger.info("commandOnEvent: state changed launch assigned command if any");
                self.prevState=state.status;
                self.launchCommand(state.status);
            }
        }
    });

    return libQ.resolve();
};


commandOnEvent.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();

    self.load18nStrings();
    self.running = true;

    // Once the Plugin has successfull started resolve the promise
    defer.resolve();

    return defer.promise;
};

commandOnEvent.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    self.running = false;

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};


commandOnEvent.prototype.launchCommand = function(state) {
    var self = this;
    var defer=libQ.defer();

    var commandStr = self.config.get('command'+state);

    if (commandStr!="" && typeof commandStr != "undefined") {
        self.logger.info("commandOnEvent: found command for " + state + ": " + commandStr);

        const { spawn } = require('child_process');
        var command = spawn(commandStr, [ state ]);
        command.stdout.on('data', (data) => {
            self.logger.info("commandOnEvent : " + data);
        });

        command.stderr.on('data', (data) => {
            self.logger.error("commandOnEvent : " + data);
        });
    }

    defer.resolve();

    return libQ.resolve();
};



commandOnEvent.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


commandOnEvent.prototype.saveSettings = function (data) {
    var self = this;
    var defer = libQ.defer();

    self.config.set('commandstop' , data['commandstop' ]);
    self.config.set('commandpause', data['commandpause']);
    self.config.set('commandplay' , data['commandplay']);

    self.commandRouter.pushToastMessage('success', self.getI18nString("SUCCESS_TITLE"), self.getI18nString("SUCCESS_MESSAGE"));

    defer.resolve();

    return defer.promise;
};


commandOnEvent.prototype.load18nStrings = function () {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
    } catch (e) {
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};


commandOnEvent.prototype.getI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};

// Configuration Methods -----------------------------------------------------------------------------

commandOnEvent.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            uiconf.sections[0].content[0].value = self.config.get('commandstop');
            uiconf.sections[0].content[1].value = self.config.get('commandpause');
            uiconf.sections[0].content[2].value = self.config.get('commandplay');
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

commandOnEvent.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

commandOnEvent.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

commandOnEvent.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

commandOnEvent.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

