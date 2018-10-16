'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

var Gpio = require('onoff').Gpio;

var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');

module.exports = pirMotionDetectionAutoplay;
function pirMotionDetectionAutoplay(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



pirMotionDetectionAutoplay.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

pirMotionDetectionAutoplay.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

    self.initGPIO();

	if(!self.config.get('playlist')) {
		self.commandRouter.pushToastMessage(
			'success',
			'PIR motion detection autoplay',
			'No playlist was configured for motion detection.'
		);
	} else {
		(function watchPirSensor() {
			self.gpio.watch(function (err, value) {
				if (err) throw err;
				self.gpio.unwatch();
				socket.emit('playPlaylist', {'name': self.config.get('playlist')});
				setTimeout(function() {
					socket.emit('stop');
					watchPirSensor();
				}, self.config.get('duration')*1000*60);
			});
		})();
	}

	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

pirMotionDetectionAutoplay.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

	self.freeGPIO();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

pirMotionDetectionAutoplay.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};

// GPIO handling -------------------------------------------------------------------------------------

pirMotionDetectionAutoplay.prototype.initGPIO = function() {
    var self = this;

	self.gpio = new Gpio(self.config.get('pin'), 'in', 'rising'); //{'debounceTimeout': self.config.get('duration')}
};

// stop claiming output port
pirMotionDetectionAutoplay.prototype.freeGPIO = function() {
    var self = this;

    self.gpio.unexport();
};

pirMotionDetectionAutoplay.prototype.pirTest = function() {
	var self = this;

	self.commandRouter.pushToastMessage(
		'success',
		'PIR motion detection autoplay',
		// Toast messages not translatable yet?
		//self.commandRouter.getI18nString('PIR_MOTION_DETECTION_AUTOPLAY.PIR_TEST_START')
		'Starting motion sensor test for 60 seconds.'
	);

	setTimeout(function() {
		self.gpio.watch(function (err, value) {
		    if (err) throw err;
			self.commandRouter.pushToastMessage(
				'success',
				'PIR motion detection autoplay',
				'Motion detected!'
			);
		});
	}, 1000);

	setTimeout(function() {
		self.gpio.unwatch();
		self.commandRouter.pushToastMessage(
			'info',
			'PIR motion detection autoplay',
			'Test time for motion sensor has ended.'
		);
	}, 60000);

	return libQ.resolve();
}

// Configuration Methods -----------------------------------------------------------------------------

pirMotionDetectionAutoplay.prototype.saveConfig = function(data)
{
	var self = this;

	self.config.set('pin', data['pin']);
	self.config.set('playlist', data['playlist']);
	self.config.set('duration', data['duration'][0]);

	self.commandRouter.pushToastMessage('success',
		'PIR motion detection autoplay',
		self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY')
	);
};

pirMotionDetectionAutoplay.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value', self.config.get('pin', false));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value', self.config.get('playlist', false));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[3].config.bars[0].value', self.config.get('duration', false));
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

pirMotionDetectionAutoplay.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

pirMotionDetectionAutoplay.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

pirMotionDetectionAutoplay.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

pirMotionDetectionAutoplay.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


pirMotionDetectionAutoplay.prototype.addToBrowseSources = function () {

	// Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

pirMotionDetectionAutoplay.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;


    return response;
};



// Define a method to clear, add, and play an array of tracks
pirMotionDetectionAutoplay.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'pirMotionDetectionAutoplay::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

pirMotionDetectionAutoplay.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'pirMotionDetectionAutoplay::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
pirMotionDetectionAutoplay.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'pirMotionDetectionAutoplay::stop');


};

// Spop pause
pirMotionDetectionAutoplay.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'pirMotionDetectionAutoplay::pause');


};

// Get state
pirMotionDetectionAutoplay.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'pirMotionDetectionAutoplay::getState');


};

//Parse state
pirMotionDetectionAutoplay.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'pirMotionDetectionAutoplay::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
pirMotionDetectionAutoplay.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'pirMotionDetectionAutoplay::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


pirMotionDetectionAutoplay.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI

	return defer.promise;
};

pirMotionDetectionAutoplay.prototype.getAlbumArt = function (data, path) {

	var artist, album;

	if (data != undefined && data.path != undefined) {
		path = data.path;
	}

	var web;

	if (data != undefined && data.artist != undefined) {
		artist = data.artist;
		if (data.album != undefined)
			album = data.album;
		else album = data.artist;

		web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large'
	}

	var url = '/albumart';

	if (web != undefined)
		url = url + web;

	if (web != undefined && path != undefined)
		url = url + '&';
	else if (path != undefined)
		url = url + '?';

	if (path != undefined)
		url = url + 'path=' + nodetools.urlEncode(path);

	return url;
};





pirMotionDetectionAutoplay.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

pirMotionDetectionAutoplay.prototype._searchArtists = function (results) {

};

pirMotionDetectionAutoplay.prototype._searchAlbums = function (results) {

};

pirMotionDetectionAutoplay.prototype._searchPlaylists = function (results) {


};

pirMotionDetectionAutoplay.prototype._searchTracks = function (results) {

};
