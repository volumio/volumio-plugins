'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var exec = require('child_process').exec;
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

//Define RoonBridge class
module.exports = RoonBridgePlugin;

function RoonBridgePlugin(context) {
	var self = this;
    // Save a reference to the parent commandRouter
    self.context = context;
    self.commandRouter = self.context.coreCommand;
    self.logger=self.commandRouter.logger;

}


RoonBridgePlugin.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
    return libQ.resolve();
};

RoonBridgePlugin.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();
	exec('/usr/bin/sudo /bin/systemctl start roonbridge.service', {uid:1000, gid:1000}, function (error, stdout, stderr) {
        if (error) {
            self.logger.error('Cannot start Roon Bridge ' + error);
            defer.reject(error);
        } else {
            defer.resolve('');
        }
	});

    return defer.promise;
};

RoonBridgePlugin.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();
	exec('/usr/bin/sudo /bin/systemctl stop roonbridge.service', {uid:1000, gid:1000}, function (error, stdout, stderr) {
        if (error) {
            self.logger.error('Cannot kill Roon Bridge ' + error);
            defer.reject(error);
        } else {
            defer.resolve('');
        }
	});
    return defer.promise;
};

RoonBridgePlugin.prototype.onRestart = function() {
	var self = this;
    exec('/usr/bin/sudo /bin/systemctl restart roonbridge.service', {uid:1000, gid:1000}, function (error, stdout, stderr) {
        if (error) {
            self.logger.error('Cannot restart Roon Bridge ' + error);
            defer.reject(error);
        } else {
            defer.resolve('');
		}
    });
};


// Configuration Methods -----------------------------------------------------------------------------

RoonBridgePlugin.prototype.getUIConfig = function() {
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

RoonBridgePlugin.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

RoonBridgePlugin.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

RoonBridgePlugin.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

RoonBridgePlugin.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


RoonBridgePlugin.prototype.addToBrowseSources = function () {

	// Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

RoonBridgePlugin.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;


    return response;
};



// Define a method to clear, add, and play an array of tracks
RoonBridgePlugin.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

RoonBridgePlugin.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
RoonBridgePlugin.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::stop');


};

// Spop pause
RoonBridgePlugin.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::pause');


};

// Get state
RoonBridgePlugin.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::getState');


};

//Parse state
RoonBridgePlugin.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
RoonBridgePlugin.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerExamplePlugin::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


RoonBridgePlugin.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI

	return defer.promise;
};

RoonBridgePlugin.prototype.getAlbumArt = function (data, path) {

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





RoonBridgePlugin.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

RoonBridgePlugin.prototype._searchArtists = function (results) {

};

RoonBridgePlugin.prototype._searchAlbums = function (results) {

};

RoonBridgePlugin.prototype._searchPlaylists = function (results) {


};

RoonBridgePlugin.prototype._searchTracks = function (results) {

};

RoonBridgePlugin.prototype.goto=function(data){
    var self=this
    var defer=libQ.defer()

// Handle go to artist and go to album function

     return defer.promise;
};
