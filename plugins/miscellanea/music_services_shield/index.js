'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = musicServicesShield;
function musicServicesShield(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
}



musicServicesShield.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

	try {
		exec('/bin/echo volumio | /usr/bin/sudo -S /data/plugins/miscellanea/music_services_shield/moveallprocesses.sh', {
		   uid: 1000,
		   gid: 1000
		}, function (error, stdout, stderr) {
			if (error) {
				self.logger.info('failed ' + error);
			} else if (stdout) {
				self.logger.info('succeeded ' + stdout);
			} else if (stderr) {
				self.logger.info('failed ' + stderr);
			} else {
				self.logger.info('succeeded');
			}
		})
	 } catch (e) {
		self.logger.info('Error moving processes to user CPU set', e);
	 }

    return libQ.resolve();
}

musicServicesShield.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

	try {
		self.commandRouter.pushToastMessage('info', 'Attempting to move processes to user CPU set', 'Please wait');

		exec('/bin/echo volumio | /usr/bin/sudo -S /data/plugins/miscellanea/music_services_shield/moveallprocesses.sh', {
		   uid: 1000,
		   gid: 1000
		}, function (error, stdout, stderr) {
			if (error) {
				self.logger.info('failed ' + error);
				self.commandRouter.pushToastMessage('error', 'Could not move processes to user CPU set!', error);
			} else if (stdout) {
				self.logger.info('succeeded ' + stdout);
				self.commandRouter.pushToastMessage('success', 'Moved processes to user CPU set', stdout);
			} else if (stderr) {
				self.logger.info('failed ' + stderr);
				self.commandRouter.pushToastMessage('error', 'Could not move processes to user CPU set!', stderr);
			} else {
				self.logger.info('succeeded ' + stdout);
				self.commandRouter.pushToastMessage('success', 'Moved processes to user CPU set', '');
			}
		})
	 } catch (e) {
		self.logger.info('Error moving processes to user CPU set', e);
		self.commandRouter.pushToastMessage('error', 'Error moving processes to user CPU set', e);
	 }

	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

musicServicesShield.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

musicServicesShield.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


musicServicesShield.prototype.listUserTasks = function() {
    var self = this;
	var tasks;
	tasks = '<p>not found</p>';
	var outputFile;
	outputFile = '/data/plugins/miscellanea/music_services_shield/out.txt';
	try {
		exec('/data/plugins/miscellanea/music_services_shield/usertaskstable.sh ' + outputFile, {
			uid: 1000,
			gid: 1000
		 }, function (error, stdout, stderr) {
			 if (error) {
				 self.logger.info('failed ' + error);
				 self.commandRouter.pushToastMessage('error', 'Could not list user tasks!', error);
				} else if (stderr) {
					self.logger.info('failed ' + stderr);
					self.commandRouter.pushToastMessage('error', 'Could not list user tasks!', stderr);
				} else {
 					fs.readFile(outputFile, 'utf8', function (err, tasks) {
					if (err) {
					   self.logger.info('Error reading tasks', err);
					} else {
						self.logger.info('user tasks ' + stdout);
						var modalData = {
						   title: 'User Tasks',
						   message: tasks,
						   size: 'lg',
						   buttons: [{
							  name: 'Close',
							  class: 'btn btn-warning',
							  emit: 'closeModals',
							  payload: ''
						   },]
						}
						self.commandRouter.broadcastMessage("openModal", modalData);
					}
				 });	 
			}
		 })
	 } catch (e) {
		self.logger.error('Could not establish connection with Push Updates Facility: ' + e);
	 }
};


// Configuration Methods -----------------------------------------------------------------------------

musicServicesShield.prototype.getUIConfig = function() {
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

musicServicesShield.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

musicServicesShield.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

musicServicesShield.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

musicServicesShield.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


musicServicesShield.prototype.addToBrowseSources = function () {

	// Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

musicServicesShield.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;


    return response;
};



// Define a method to clear, add, and play an array of tracks
musicServicesShield.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'musicServicesShield::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

musicServicesShield.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'musicServicesShield::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
musicServicesShield.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'musicServicesShield::stop');


};

// Spop pause
musicServicesShield.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'musicServicesShield::pause');


};

// Get state
musicServicesShield.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'musicServicesShield::getState');


};

//Parse state
musicServicesShield.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'musicServicesShield::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
musicServicesShield.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'musicServicesShield::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


musicServicesShield.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI

	return defer.promise;
};

musicServicesShield.prototype.getAlbumArt = function (data, path) {

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





musicServicesShield.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

musicServicesShield.prototype._searchArtists = function (results) {

};

musicServicesShield.prototype._searchAlbums = function (results) {

};

musicServicesShield.prototype._searchPlaylists = function (results) {


};

musicServicesShield.prototype._searchTracks = function (results) {

};

musicServicesShield.prototype.goto=function(data){
    var self=this
    var defer=libQ.defer()

// Handle go to artist and go to album function

     return defer.promise;
};
