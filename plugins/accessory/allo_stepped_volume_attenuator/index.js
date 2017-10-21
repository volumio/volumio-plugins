'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = alloSteppedVolumeAttenuator;
function alloSteppedVolumeAttenuator(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



alloSteppedVolumeAttenuator.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

alloSteppedVolumeAttenuator.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();


	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

alloSteppedVolumeAttenuator.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

alloSteppedVolumeAttenuator.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

alloSteppedVolumeAttenuator.prototype.getUIConfig = function() {
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


alloSteppedVolumeAttenuator.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

alloSteppedVolumeAttenuator.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

alloSteppedVolumeAttenuator.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


alloSteppedVolumeAttenuator.prototype.addToBrowseSources = function () {

	// Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

alloSteppedVolumeAttenuator.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;


    return response;
};



// Define a method to clear, add, and play an array of tracks
alloSteppedVolumeAttenuator.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'alloSteppedVolumeAttenuator::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

alloSteppedVolumeAttenuator.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'alloSteppedVolumeAttenuator::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
alloSteppedVolumeAttenuator.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'alloSteppedVolumeAttenuator::stop');


};

// Spop pause
alloSteppedVolumeAttenuator.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'alloSteppedVolumeAttenuator::pause');


};

// Get state
alloSteppedVolumeAttenuator.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'alloSteppedVolumeAttenuator::getState');


};

//Parse state
alloSteppedVolumeAttenuator.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'alloSteppedVolumeAttenuator::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
alloSteppedVolumeAttenuator.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'alloSteppedVolumeAttenuator::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


alloSteppedVolumeAttenuator.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI

	return defer.promise;
};

alloSteppedVolumeAttenuator.prototype.getAlbumArt = function (data, path) {

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





alloSteppedVolumeAttenuator.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

alloSteppedVolumeAttenuator.prototype._searchArtists = function (results) {

};

alloSteppedVolumeAttenuator.prototype._searchAlbums = function (results) {

};

alloSteppedVolumeAttenuator.prototype._searchPlaylists = function (results) {


};

alloSteppedVolumeAttenuator.prototype._searchTracks = function (results) {

};
