'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = hueControl;
function hueControl(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



hueControl.prototype.onVolumioStart = function()
{
	var self = this;

	self.logger.debug('onVolumioStart');
	
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

hueControl.prototype.onStart = function() {
	var self = this;

	self.logger.debug('onStart');
	
    var self = this;
	var defer=libQ.defer();


	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

hueControl.prototype.onStop = function() {
	var self = this;

    self.logger.debug('onStop');

    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

hueControl.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

hueControl.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

	var lang_code = this.commandRouter.sharedVars.get('language_code');
	
	//TODO: Replace later
	var isConnected = false

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
			
			// Bridge Address
			uiconf.sections[0].content[0].value = self.config.get('hue_bridge_address');
			uiconf.sections[1].content[1].value = self.config.get('hue_bridge_address');

			// switch off delay
			uiconf.sections[2].content[0].value = self.config.get('switch_off_delay');

            // remove either the connect on or disconnect section
			var indexOfSectionToRemove = (isConnected) ? 0 : 1;
			
			uiconf.sections.splice(indexOfSectionToRemove, 1);

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

hueControl.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

hueControl.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

hueControl.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

hueControl.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


hueControl.prototype.addToBrowseSources = function () {

	// Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

hueControl.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;


    return response;
};



// Define a method to clear, add, and play an array of tracks
hueControl.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'hueControl::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

hueControl.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'hueControl::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
hueControl.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'hueControl::stop');


};

// Spop pause
hueControl.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'hueControl::pause');


};

// Get state
hueControl.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'hueControl::getState');


};

//Parse state
hueControl.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'hueControl::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
hueControl.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'hueControl::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


hueControl.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI

	return defer.promise;
};

hueControl.prototype.getAlbumArt = function (data, path) {

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





hueControl.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

hueControl.prototype._searchArtists = function (results) {

};

hueControl.prototype._searchAlbums = function (results) {

};

hueControl.prototype._searchPlaylists = function (results) {


};

hueControl.prototype._searchTracks = function (results) {

};

hueControl.prototype.goto=function(data){
    var self=this
    var defer=libQ.defer()

// Handle go to artist and go to album function

     return defer.promise;
};
