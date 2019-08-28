'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var Gpio = require("onoff").Gpio;
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = ap3Controller;
function ap3Controller(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

	self.ap3sel;
	self.ap3up;
	self.ap3down;
}

ap3Controller.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

	return libQ.resolve();
}

ap3Controller.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

	self.loadAp3Resource();
	self.addToBrowseSources();

	self.createGPIO();

	self.serviceName = "ap3_controller";

	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

	return defer.promise;
};

ap3Controller.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

	self.freeGPIO();

	// Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

	return libQ.resolve();
};

ap3Controller.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

ap3Controller.prototype.getUIConfig = function() {
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

ap3Controller.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

ap3Controller.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ap3Controller.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ap3Controller.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


ap3Controller.prototype.addToBrowseSources = function () {
	var self = this;

	//self.logger.info("[ap3] addToBrowseSources");

	var data = {
		name: 'AP3 Controller', 
		uri: 'ap3', 
		plugin_type:'music_service', 
		plugin_name:'ap3_controller',
		albumart: '/albumart?sourceicon=music_service/ap3_controller/ap3_controller.svg'
	};
	this.commandRouter.volumioAddToBrowseSources(data);

};

ap3Controller.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    var response;

    if (curUri.startsWith('ap3')) {
        if (curUri == 'ap3') {
			response = self.getRootContent();
		}
		else if (curUri === 'ap3/sel') {
			self.toggleGPIO('sel');
			response = self.getRootContent();
		}
		else if (curUri === 'ap3/stb') {
			self.toggleGPIO('stb');
			response = self.getRootContent();
		}
		else if (curUri === 'ap3/up') {
			self.toggleGPIO('up');
			response = self.getRootContent();
		}
		else if (curUri === 'ap3/down') {
			self.toggleGPIO('down');
			response = self.getRootContent();
		}
		else {
			response = libQ.reject();
		}
    }

    return response;	
};


ap3Controller.prototype.loadAp3Resource = function() {
	var self=this;
  
	var ap3Resource = fs.readJsonSync(__dirname+'/ap3_resources.json');

	var baseNavigation = ap3Resource.baseNavigation;
	self.rootNavigation = JSON.parse(JSON.stringify(baseNavigation));
	//self.rootNavigation.navigation.prev.uri = '/';

	//self.rootMenu = ap3Resource.rootMenu;
}


ap3Controller.prototype.getRootContent = function() {
	var self=this;
	var response;
	var defer = libQ.defer();
  
	response = self.rootNavigation;

	defer.resolve(response);

	return defer.promise;
  };
  

// Define a method to clear, add, and play an array of tracks
ap3Controller.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ap3Controller::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

ap3Controller.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ap3Controller::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
ap3Controller.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ap3Controller::stop');


};

// Spop pause
ap3Controller.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ap3Controller::pause');


};

// Get state
ap3Controller.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ap3Controller::getState');


};

//Parse state
ap3Controller.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ap3Controller::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
ap3Controller.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ap3Controller::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


ap3Controller.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	self.commandRouter.logger.info("explodeUri");

	// Mandatory: retrieve all info for a given URI
	switch (uri) {
		case 'ap3/sel': {
			self.commandRouter.logger.info("ap3/sel");
			defer.resolve();
			break;
		}
		case 'ap3/stb': {
			self.commandRouter.logger.info("ap3/stb");
			defer.resolve();
			break;
		}
		case 'ap3/up': {
			self.commandRouter.logger.info("ap3/up");
			defer.resolve();
			break;
		}
		case 'ap3/down': {
			self.commandRouter.logger.info("ap3/down");
			defer.resolve();
			break;
		}
		default: {
			defer.resolve();
		}
	}

	return defer.promise;
};

ap3Controller.prototype.getAlbumArt = function (data, path) {

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





ap3Controller.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

ap3Controller.prototype._searchArtists = function (results) {

};

ap3Controller.prototype._searchAlbums = function (results) {

};

ap3Controller.prototype._searchPlaylists = function (results) {


};

ap3Controller.prototype._searchTracks = function (results) {

};

ap3Controller.prototype.goto=function(data){
    var self=this
    var defer=libQ.defer()

// Handle go to artist and go to album function

     return defer.promise;
};



ap3Controller.prototype.createGPIO = function() 
{
    var self = this;

	self.ap3sel = new Gpio(23,'out');
	self.ap3up = new Gpio(24,'out');
	self.ap3down = new Gpio(15,'out'); // 15:AP3 17:AP2

	self.ap3sel.writeSync(0);
	self.ap3up.writeSync(0);
	self.ap3down.writeSync(0);
};

ap3Controller.prototype.freeGPIO = function() 
{
    var self = this;

    self.ap3sel.unexport();
    self.ap3up.unexport();
    self.ap3down.unexport();
};

ap3Controller.prototype.toggleGPIO = function(action)
{
	var self = this;
	var defer = libQ.defer();
	
	self.logger.info("[ap3] "+action);

	switch(action) {
		case 'stb': {
			self.ap3up.writeSync(1);
			self.ap3down.writeSync(1);
			setTimeout(function() {
				self.ap3up.writeSync(0);
				self.ap3down.writeSync(0);
				defer.resolve();
			}, 1);
			break;
		}
		case 'sel': {
			self.ap3sel.writeSync(1);
			setTimeout(function() {
				self.ap3sel.writeSync(0);
				defer.resolve();
			}, 1);
			break;
		}
		case 'up': {
			self.ap3up.writeSync(1);
			setTimeout(function() {
				self.ap3up.writeSync(0);
				setTimeout(function() {
					self.ap3up.writeSync(1);
					setTimeout(function() {
						self.ap3up.writeSync(0);
						defer.resolve();
					}, 1);
				}, 1);
			}, 1);
			break;
		}
		case 'down': {
			self.ap3down.writeSync(1);
			setTimeout(function() {
				self.ap3down.writeSync(0);
				setTimeout(function() {
					self.ap3down.writeSync(1);
					setTimeout(function() {
						self.ap3down.writeSync(0);
						defer.resolve();
					}, 1);
				}, 1);
			}, 1);
			break;
		}
	}

	return defer;
};
