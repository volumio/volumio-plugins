'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var CallMonitor = require('node-fritzbox-callmonitor')

module.exports = fritzcallmute;

function fritzcallmute(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

	this.playedBefore = false;
};

fritzcallmute.prototype.onVolumioStart = function() {
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
	this.ip = this.config.get('ip');
	this.port = this.config.get('port');
	this.waitafterhangupsec = this.config.get('waitafterhangupsec');
  return libQ.resolve();
};


fritzcallmute.prototype.onStart = function() {
  var self = this;
	var defer=libQ.defer();

	self.initCallMonitor();
	defer.resolve();

  return defer.promise;
};


fritzcallmute.prototype.stopCallMonitor = function() {
	var self = this;
	if (self.monitor) {
		// cleanup old listeners
		self.monitor.removeAllListeners();
	}
};

fritzcallmute.prototype.initCallMonitor = function() {
	var self = this;

	self.stopCallMonitor();

	// connect to fritzbox callmonitor
	self.monitor = new CallMonitor(self.ip, self.port);

	var mute = function() {
		var state = self.commandRouter.volumioGetState();

		// only mute if not stopped or paused
		if (state.status != undefined) {
			if( !(state.status==='stop' || state.status==='pause') ) {
				self.playedBefore = true;
				self.commandRouter.volumioToggle();
			}
		}

	}

	self.monitor.on('inbound', function (data) {
		self.logger.debug("fritzcallmute::inbound call");
		self.logger.debug(data);
		mute();
	});

	self.monitor.on('outbound', function (data) {
			self.logger.debug("fritzcallmute::outbound call");
			self.logger.debug(data);
			mute();
	});

	self.monitor.on('disconnected', function (data) {
		// hang up
		self.logger.debug("fritzcallmute::disconnected");
		self.logger.debug(data);
		// only start playing again if played before incoming or outgoing call
		if(self.playedBefore) {
			self.playedBefore = false;
			// start again after waitafterhangupsec
			if(self.waitafterhangupsec > 0) {
				self.logger.debug("fritzcallmute::start playing again after delay of " + self.waitafterhangupsec + " seconds.");
				setTimeout(function(){self.commandRouter.volumioToggle()}, self.waitafterhangupsec*1000);
			} else {
				self.commandRouter.volumioToggle();
			}
		}
	});

	self.monitor.on('error', function(error) {
		self.logger.error("fritzcallmute::error");
		self.logger.error(error);
		self.commandRouter.pushToastMessage('error','Error FritzBox Callmonitor:', error);
	});

	// Once the Plugin has successfull started resolve the promise
};

fritzcallmute.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    self.stopCallMonitor();
    // Once the Plugin has successfull stopped rinvertedesolve the promise
    defer.resolve();

    return libQ.resolve();
};

fritzcallmute.prototype.onRestart = function() {
    var self = this;
		self.initCallMonitor();
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

fritzcallmute.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;
		var lang_code = this.commandRouter.sharedVars.get('language_code');

		self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
																__dirname+'/i18n/strings_en.json',
																__dirname + '/UIConfig.json')
			.then(function(uiconf)	{
					uiconf.sections[0].content[0].value = self.config.get('ip');
					uiconf.sections[0].content[1].value = self.config.get('port');
					uiconf.sections[0].content[2].value = self.config.get('waitafterhangupsec');

					defer.resolve(uiconf);
					})
			.fail(function() {
					defer.reject(new Error());
					});
			return defer.promise;

}

fritzcallmute.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

fritzcallmute.prototype.updateSettings = function(data) {
	var self = this;

	// save settings
	self.config.set('ip', data['ip']);
	self.config.set('port', data['port']);
	self.config.set('waitafterhangupsec', data['waitafterhangupsec']);

	// set new settings
	self.ip = self.config.get('ip');
	self.port = self.config.get('port');
	self.waitafterhangupsec = self.config.get('waitafterhangupsec');
	// Restart CallMonitor...
	self.initCallMonitor();
	self.commandRouter.pushToastMessage('info','Settings saved, callmonitor restarted', ':-)');
};
