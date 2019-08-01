'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = new50;
function new50(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



new50.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

new50.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

        self.addToBrowseSources();

	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

new50.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

new50.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

new50.prototype.getUIConfig = function() {
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

new50.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

new50.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

new50.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

new50.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


new50.prototype.addToBrowseSources = function () {
    var self = this;
	// Use this function to add your music service plugin to music sources
    self.commandRouter.volumioAddToBrowseSources({
        name: 'NEW_50',
        //name: self.getRadioI18nString('NEW_50'),
        uri: 'new_50',
        plugin_type: 'music_service',
        plugin_name: "new_50",
        albumart: '/albumart?sourceicon=music_service/new_50/new.png'
    });
};

new50.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;


    return response;
};



// Define a method to clear, add, and play an array of tracks
new50.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'new50::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

new50.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'new50::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
new50.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'new50::stop');


};

// Spop pause
new50.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'new50::pause');


};

// Get state
new50.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'new50::getState');


};

//Parse state
new50.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'new50::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
new50.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'new50::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


new50.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI

	return defer.promise;
};

new50.prototype.getAlbumArt = function (data, path) {

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





new50.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

new50.prototype._searchArtists = function (results) {

};

new50.prototype._searchAlbums = function (results) {

};

new50.prototype._searchPlaylists = function (results) {


};

new50.prototype._searchTracks = function (results) {

};

new50.prototype.goto=function(data){
    var self=this
    var defer=libQ.defer()

// Handle go to artist and go to album function

     return defer.promise;
};
