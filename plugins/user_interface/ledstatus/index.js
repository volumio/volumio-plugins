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
var interval = null
var ledvalue = 0;
var led = null;
var prevState=null;

module.exports = ledstatus;
function ledstatus(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
}


ledstatus.prototype.onVolumioStart = function() {
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    socket.on('pushState', function (state) {
        if (self.running) {
            self.logger.info("LedStatus: state = " + state.status);
            if (state.status == "play") {
                if(self.prevState != "play") {
                    self.logger.info("LedStatus: play => start blinking led");
                    self.prevState="play";
                    self.startBlink();
                }
            } else {
                self.logger.info("LedStatus: stop => switch off led");
                self.prevState=null;
                self.stopBlink();
            }
        }
    });
        
    return libQ.resolve();
};


ledstatus.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();
    
    self.load18nStrings();
    
    var gpionum = self.config.get('gpionum');
    if (isNaN(gpionum)) gpionum = 12;
    
    self.logger.info("LedStatus : init GPIO");
    self.led  = new Gpio(gpionum, 'out');
    self.running = true;
    
    // Once the Plugin has successfull started resolve the promise
    defer.resolve();

    return defer.promise;
};

ledstatus.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();
    
    self.logger.info("LedStatus : free GPIO");
    self.led.unexport();
    self.running = false;
    
    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};


ledstatus.prototype.startBlink = function() {
    var self = this;
    var defer=libQ.defer();
    
    var milisec = self.config.get('intmilisec');
    var gpionum = self.config.get('gpionum');
    if (isNaN(gpionum)) gpionum = 12;
    
    self.logger.info("LedStatus : set interval for blinking");
    
    self.interval = setInterval( function() {
        self.led.read()
            .then(value => self.led.write(value ^ 1))
            .catch(err => self.logger.info(err));
    }, milisec);
};


ledstatus.prototype.stopBlink = function() {
    var self = this;
    var defer=libQ.defer();
    
    self.logger.info("LedStatus : remove blinking interval");
    
    if(self.interval) {
        clearInterval(self.interval);
        self.led.writeSync(0);
    }
};


ledstatus.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


ledstatus.prototype.saveSettings = function (data) {
    var self = this;
    var defer = libQ.defer();

    self.config.set('gpionum', parseInt(data['gpionum']),10);
    self.config.set('intmilisec', parseInt(data['intmilisec'],10));
    
    defer.resolve();
    
    if(data['gpionum'] <= 0) {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_NOT_A_NUMBER_TITLE"), self.getI18nString("ERROR_NOT_A_NUMBER_MESSAGE"));
    } else if(data['intmilisec'] <= 0) {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_NOT_A_NUMBER_TITLE"), self.getI18nString("ERROR_NOT_A_NUMBER_MESSAGE"));
    } else {
            self.commandRouter.pushToastMessage('success', self.getI18nString("SUCCESS_TITLE"), self.getI18nString("SUCCESS_MESSAGE"));
    }
    
    return defer.promise;
    
};


ledstatus.prototype.load18nStrings = function () {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
    } catch (e) {
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};


ledstatus.prototype.getI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};

// Configuration Methods -----------------------------------------------------------------------------

ledstatus.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            uiconf.sections[0].content[0].value = self.config.get('gpionum');
            uiconf.sections[0].content[1].value = self.config.get('intmilisec');
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

ledstatus.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

ledstatus.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ledstatus.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ledstatus.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

