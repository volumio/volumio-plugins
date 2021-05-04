'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var mqtt = require('mqtt');

var running = false;
var currentState = "unknown";

module.exports = status2mqtt;

function status2mqtt(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
}


status2mqtt.prototype.onVolumioStart = function() {
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
        
        socket.on('pushState', function (state) {
            if (self.running) {
                if (state.status !== self.currentState) {
                    self.logger.info("Status2Mqtt: state changed from -" + self.currentState +"- to -" + state.status + "-");
                    self.sendMqttMessage(state);                   
                }
                self.currentState = state.status;
            }
        })

    return libQ.resolve();
}


status2mqtt.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();
    
    self.load18nStrings();
    self.running = true;
    
    // Once the Plugin has successfull started resolve the promise
    defer.resolve();

return defer.promise;
};


status2mqtt.prototype.sendMqttMessage = function(state) {
    var self = this;
    var server = self.config.get('server');
    
    if(!server.trim() || ( !server.startsWith('mqtt://') && !server.startsWith('mqtts://') )) {
        self.logger.info("status2mqtt: Server is not valid, not doing anything...");
        return;
    }
    
    // create a trimmed down json state for mqtt
    var mqttState = {
        'status' : state.status,
        'artist' : state.artist,
        'album'  : state.album ,
        'title'  : state.title
    };
    
    var mqttOptions = {
        clientId:self.config.get('clientid'),
        username:self.config.get('username'),
        password:self.config.get('password')
    }
    
    var mqttClient = mqtt.connect(server, mqttOptions);
    
    self.logger.info("status2mqtt: trying to connect to mqtt server " + server);
    
    mqttClient.on("connect",function(){
        self.logger.info("status2mqtt: mqtt connected");
        mqttClient.publish(self.config.get('topic'), JSON.stringify(mqttState));
        mqttClient.end();
    });
    
    mqttClient.on("error",function(error){
        self.logger.info("status2mqtt: Can't connect to mqtt server " +error);
        mqttClient.end();
    });
}


status2mqtt.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    self.running = false;
    
    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};


status2mqtt.prototype.onRestart = function() {
    var self = this;
    
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

status2mqtt.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            uiconf.sections[0].content[0].value = self.config.get('username');
            uiconf.sections[0].content[1].value = self.config.get('password');
            uiconf.sections[0].content[2].value = self.config.get('server');
            uiconf.sections[0].content[3].value = self.config.get('topic');
            uiconf.sections[0].content[3].value = self.config.get('clientid');

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

status2mqtt.prototype.saveSettings = function (data)
{
	var self = this;
	var defer = libQ.defer();

	self.config.set('username', data['username']);
        self.config.set('password', data['password']);
        self.config.set('server'  , data['server']);
        self.config.set('topic'   , data['topic']);
        self.config.set('clientid', data['clientid']);
	
        defer.resolve();
        
        if(!data['server'].trim()) {
            self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_SERVER_EMTPY_TITLE"), self.getI18nString("ERROR_SERVER_EMTPY_MESSAGE"));
        } else if(!data['server'].startsWith('mqtt://') && !data['server'].startsWith('mqtts://')) {
             self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_SERVER_INVALID_TITLE"), self.getI18nString("ERROR_SERVER_INVALID_MESSAGE"));
        } else {
            self.commandRouter.pushToastMessage('success', self.getI18nString("SUCCESS_TITLE"), self.getI18nString("SUCCESS_MESSAGE"));
        }
        
	return defer.promise;
};

status2mqtt.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

status2mqtt.prototype.load18nStrings = function () {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
    } catch (e) {
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};

status2mqtt.prototype.getI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};

status2mqtt.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

status2mqtt.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

status2mqtt.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};
