'use strict';

var libQ = require('kew');
var libNet = require('net');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var net = require('net');
var os = require('os');
var currentMac = '';
var pTimer = require('./pausableTimer');

var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var lastfm = require("simple-lastfm");
var crypto = require('crypto');

// Add your service(s) here!
var supportedSongServices = ["mpd", "airplay", "volspotconnect", "volspotconnect2", "spop", "radio_paradise", "80s80s"];
var supportedStreamServices = ["webradio"];

// Define the ControllerLastFM class
module.exports = ControllerLastFM;

function ControllerLastFM(context) 
{
	var self = this;
	self.previousState = null;
	self.updatingNowPlaying = false;
	self.timeToPlay = 0;
	self.previousScrobble = 
		{	artist: '',
			title: '',
			scrobbleTime: 0
		};
	
	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
	
	this.memoryTimer;
};

ControllerLastFM.prototype.onVolumioStart = function()
{
	var self = this;
	var initialize = false;
	this.configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	self.getConf(this.configFile);
	
	self.logger.info('[LastFM] scrobbler initiated!');
	self.logger.info('[LastFM] extended logging: ' + self.config.get('enable_debug_logging'));
	self.logger.info('[LastFM] try scrobble radio plays: ' + self.config.get('scrobbleFromStream'));
	self.currentTimer = new pTimer(self.context, self.config.get('enable_debug_logging'));
	
	socket.on('pushState', function (state) {
		// Create the timer object
		if(!self.currentTimer)
		{
			self.currentTimer = new pTimer(self.context, self.config.get('enable_debug_logging'));
			if(self.config.get('enable_debug_logging'))
				self.logger.info('[LastFM] created new timer object');
		}
		else
		{
			if(self.config.get('enable_debug_logging'))
				self.logger.info('[LastFM] using existing timer');
		}
		
		var scrobbleThresholdInMilliseconds = 0;
		if(supportedSongServices.indexOf(state.service) != -1)
			scrobbleThresholdInMilliseconds = state.duration * (self.config.get('scrobbleThreshold') / 100) * 1000;
		if(supportedStreamServices.indexOf(state.service) != -1)
			scrobbleThresholdInMilliseconds = self.config.get('streamScrobbleThreshold') * 1000;
				
		// Set initial previousState object
		var init = '';
		if(self.previousState == null)
		{
			self.previousState = state;
			initialize = true;
			init = ' | Initializing: true';
		}
		
		if(self.config.get('enable_debug_logging'))
			self.logger.info('--------------------------------------------------------------------// [LastFM] new state has been pushed; status: ' + state.status + ' | service: ' + state.service + ' | duration: ' + state.duration + ' | title: ' + state.title + ' | previous title: ' + self.previousState.title + init);
		
		// Scrobble from all services, or at least try to -> improves forward compatibility
		if(state.status == 'play')
		{
			if(self.config.get('enable_debug_logging'))
				self.logger.info('Playback detected, evaluating parameters for scrobbling...');
			
			// Always (try to) update 'now playing'
			self.updateNowPlaying(state);
			
			/* 
				Either same song and previously stopped/paused
				Or different song (artist or title differs)
			*/
			if
			(
				(self.previousState.artist == state.artist && self.previousState.title == state.title && ((self.previousState.status == 'pause' || self.previousState.status == 'stop') || initialize || (self.previousState.duration != state.duration))) 
				|| (self.currentTimer && !self.currentTimer.isActive && (self.previousScrobble.artist != state.artist || self.previousScrobble.title != state.title))
			)
			{
				if(self.config.get('enable_debug_logging'))
					self.logger.info('[LastFM] Continuing playback or different song.');
								
				// Song service, since duration is > 0
				if(state.duration > 0)
				{
					if(self.config.get('enable_debug_logging'))
						self.logger.info('[LastFM] timeToPlay for current track: ' + self.timeToPlay);
					
					// Continuing playback, timeToPlay was populated
					if(self.timeToPlay > 0)
					{
						if(self.config.get('enable_debug_logging'))
							self.logger.info('[LastFM] Continuing scrobble, starting new timer for the remainder of ' + self.timeToPlay + ' milliseconds [' + state.artist + ' - ' + state.title + '].');
						
						self.stopAndStartTimer(self.timeToPlay, state, scrobbleThresholdInMilliseconds);
					}					
					else
					{
						// Create a new timer
						if(scrobbleThresholdInMilliseconds > 0)
						{
							if(self.config.get('enable_debug_logging'))
								self.logger.info('[LastFM] starting new timer for ' + scrobbleThresholdInMilliseconds + ' milliseconds [' + state.artist + ' - ' + state.title + '].');
								
							self.stopAndStartTimer(scrobbleThresholdInMilliseconds, state, scrobbleThresholdInMilliseconds);
						}
						else
						{
							if(self.config.get('enable_debug_logging'))
								self.logger.info('[LastFM] can not scrobble; state object: ' + JSON.stringify(state));
						}
					}
				}
				else if (state.duration == 0 && state.service == 'webradio')
				{
					if(self.config.get('enable_debug_logging'))
						self.logger.info('[LastFM] starting new timer for ' + scrobbleThresholdInMilliseconds + ' milliseconds [webradio: ' + state.title + '].');
					
					self.stopAndStartTimer(scrobbleThresholdInMilliseconds, state, scrobbleThresholdInMilliseconds);
				}
				
				if(initialize)
						initialize = false;
			}
			else if (self.previousState.artist == state.artist && self.previousState.title == state.title && self.previousState.duration != state.duration && !self.currentTimer.isActive)
			{
				// Airplay fix, the duration is propagated at a later point in time
				var addition = (state.duration - self.previousState.duration) * (self.config.get('scrobbleThreshold') / 100) * 1000;
				self.logger.info('[LastFM] updating timer, previous duration is obsolete; adding ' + addition + ' milliseconds.');
				self.currentTimer.addMilliseconds(addition, function(scrobbler){							
						self.scrobble(state, self.config.get('scrobbleThreshold'), scrobbleThresholdInMilliseconds);
						self.currentTimer.stop();
						self.timeToPlay = 0;
					});				
			}
			else if (self.previousState.artist == state.artist && self.previousState.title == state.title && self.previousState.duration == state.duration)
			{
				// Just a state update, no action necessary
				if(self.config.get('enable_debug_logging'))
					self.logger.info('[LastFM] same state, different update... no action required.');
			}
			else
			{
				if(self.config.get('enable_debug_logging'))
					self.logger.info('[LastFM] could not process current state: ' + JSON.stringify(state));
			}
			// else = multiple pushStates without change, ignoring them
		}
		else if (state.status == 'pause')
		{
			if(self.currentTimer.isActive)
			{
				self.timeToPlay = self.currentTimer.pause();
				self.previousState = state;
			}
		}
		else if (state.status == 'stop')
		{
			if(self.config.get('enable_debug_logging'))
				self.logger.info('[LastFM] stopping timer, song has ended.');
			
			if(self.currentTimer.isActive)
			{
				self.currentTimer.stop();
				self.previousState = state;
			}
			self.timeToPlay = 0;
		}
		
		self.previousState = state;
	});
	
	return libQ.resolve();	
};

ControllerLastFM.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};

// Plugin methods -----------------------------------------------------------------------------

ControllerLastFM.prototype.onStop = function() {
	var self = this;
	self.logger.info("performing onStop action");
	
	return libQ.resolve();
};

ControllerLastFM.prototype.stop = function() {
	var self = this;
	self.logger.info("performing stop action");
	
	return libQ.resolve();
};

ControllerLastFM.prototype.onStart = function() {
	var self = this;
	self.logger.info("performing onStart action");
	
	return libQ.resolve();
};

ControllerLastFM.prototype.onRestart = function() 
{
	var self = this;
	self.logger.info("performing onRestart action");
};

ControllerLastFM.prototype.onInstall = function() 
{
	var self = this;
	self.logger.info("performing onInstall action");
};

ControllerLastFM.prototype.onUninstall = function() 
{
	// Perform uninstall tasks here!
	self.logger.info("performing onUninstall action");
};

ControllerLastFM.prototype.getUIConfig = function() {
    var self = this;
	var defer = libQ.defer();    
    var lang_code = this.commandRouter.sharedVars.get('language_code');
	self.getConf(this.configFile);
	self.logger.info("Loaded the previous config.");
	
	var thresholds = fs.readJsonSync((__dirname + '/options/thresholds.json'),  'utf8', {throws: false});
	
	self.commandRouter.i18nJson(__dirname+'/i18n/strings_' + lang_code + '.json',
		__dirname + '/i18n/strings_en.json',
		__dirname + '/UIConfig.json')
    .then(function(uiconf)
    {
		self.logger.info("## populating UI...");
		
		// Credentials settings
		uiconf.sections[0].content[0].value = self.config.get('API_KEY');
		uiconf.sections[0].content[1].value = self.config.get('API_SECRET');		
		uiconf.sections[0].content[2].value = self.config.get('username');
		if(self.config.get('password') != undefined && self.config.get('password') != '')
			uiconf.sections[0].content[3].value = self.config.get('password');
		else
			uiconf.sections[0].content[3].value = '******';
		self.logger.info("1/3 settings loaded");
		
		// Scrobble settings
		for (var n = 0; n < thresholds.percentages.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[0].options', {
				value: thresholds.percentages[n].perc,
				label: thresholds.percentages[n].desc
			});
			
			if(thresholds.percentages[n].perc == parseInt(self.config.get('scrobbleThreshold')))
			{
				uiconf.sections[1].content[0].value.value = thresholds.percentages[n].perc;
				uiconf.sections[1].content[0].value.label = thresholds.percentages[n].desc;
			}
		}
		uiconf.sections[1].content[1].value = self.config.get('pushToastOnScrobble');
		uiconf.sections[1].content[2].value = self.config.get('scrobbleFromStream');
		uiconf.sections[1].content[3].value = self.config.get('streamScrobbleThreshold');
		self.logger.info("2/3 settings loaded");
		
		uiconf.sections[2].content[0].value = self.config.get('enable_debug_logging');
		self.logger.info("3/3 settings loaded");
		
		self.logger.info("Populated config screen.");
				
		defer.resolve(uiconf);
	})
	.fail(function()
	{
		defer.reject(new Error());
	});

	return defer.promise;
};

ControllerLastFM.prototype.setUIConfig = function(data) {
	var self = this;
	
	self.logger.info("Updating UI config");
	var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');
	
	return libQ.resolve();
};

ControllerLastFM.prototype.getConf = function(configFile) {
	var self = this;
	this.config = new (require('v-conf'))()
	this.config.loadFile(configFile)
	
	return libQ.resolve();
};

ControllerLastFM.prototype.setConf = function(conf) {
	var self = this;
	return libQ.resolve();
};

// Public Methods ---------------------------------------------------------------------------------------

ControllerLastFM.prototype.stopAndStartTimer = function(timerLength, state, scrobbleThresholdInMilliseconds)
{
	var self = this;
	var defer = libQ.defer();
	
	try
	{
		self.currentTimer.stop();
		self.currentTimer.start(timerLength, function(scrobbler){
			if(self.config.get('enable_debug_logging'))
				self.logger.info('[LastFM] scrobbling from restarted timer.');
			self.scrobble(state, self.config.get('scrobbleThreshold'), scrobbleThresholdInMilliseconds);
			self.currentTimer.stop();
			self.timeToPlay = 0;
		});		
		defer.resolve();
	}
	catch (ex)
	{
		self.logger.error('[LastFM] An error occurred during timer reset; ' + ex);
		self.logger.info('[LastFM] STATE; ' + JSON.stringify(state));
	}
		
	return defer.promise;
};

ControllerLastFM.prototype.updateCredentials = function (data)
{
	var self = this;
	var defer = libQ.defer();

	self.config.set('API_KEY', data['API_KEY']);
	self.config.set('API_SECRET', data['API_SECRET']);
	self.config.set('username', data['username']);
	if(data['storePassword'] && data['password'] != undefined && data['password'] != '' && data['password'] != '******')
		self.config.set('password', data['password']);
	self.config.set('authToken', md5(data['username'] + md5(data['password'])));
	defer.resolve();
	
	self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved authentication settings.");

	return defer.promise;
};

ControllerLastFM.prototype.updateScrobbleSettings = function (data)
{
	var self = this;
	var defer = libQ.defer();

	self.config.set('scrobbleThreshold', data['scrobbleThreshold'].value);
	self.config.set('pushToastOnScrobble', data['pushToastOnScrobble']);
	self.config.set('scrobbleFromStream', data['scrobbleFromStream']);
	self.config.set('streamScrobbleThreshold', data['streamScrobbleThreshold']);
	defer.resolve();
	
	self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved scrobble settings.");

	return defer.promise;
};

ControllerLastFM.prototype.updateDebugSettings = function (data)
{
	var self = this;
	var defer = libQ.defer();

	self.config.set('enable_debug_logging', data['enable_debug_logging']);
	defer.resolve();
	
	self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved debug settings.");

	return defer.promise;
};

// Scrobble Methods -------------------------------------------------------------------------------------

ControllerLastFM.prototype.formatScrobbleData = function (state)
{
	var scrobbleData =
	{
		artist: state.artist,
		title: state.title,
		album: state.album == null ? '' : state.album
	};

	if(scrobbleData.title != undefined && scrobbleData.title.indexOf('-') > -1 && !scrobbleData.artist)
	{
		try
		{
			var info = state.title.split('-');
			scrobbleData.artist = info[0].trim();
			scrobbleData.title = info[1].trim();
		}
		catch (ex)
		{
			self.logger.error('[LastFM] An error occurred during parse; ' + ex);
			self.logger.info('[LastFM] STATE; ' + JSON.stringify(state));
		}
	}

	return scrobbleData;
};

ControllerLastFM.prototype.updateNowPlaying = function (state)
{
	var self = this;
	var defer = libQ.defer();
	self.updatingNowPlaying = true;
	
	if(self.config.get('enable_debug_logging'))
		self.logger.info('[LastFM] Updating now playing');
	
	var scrobbleData = self.formatScrobbleData(state);
	
	if (
		(self.config.get('API_KEY') != '') &&
		(self.config.get('API_SECRET') != '') &&
		(self.config.get('username') != '') &&
		(self.config.get('authToken') != '') &&
		scrobbleData.artist != undefined &&
		scrobbleData.title != undefined &&
		scrobbleData.album != undefined
	)
	{
		if(self.config.get('enable_debug_logging'))
			self.logger.info('[LastFM] trying to authenticate...');
				
		var lfm = new lastfm({
			api_key: self.config.get('API_KEY'),
			api_secret: self.config.get('API_SECRET'),
			username: self.config.get('username'),
			authToken: self.config.get('authToken')
		});
		
		lfm.getSessionKey(function(result) {
			if(result.success) {
				if(self.config.get('enable_debug_logging'))
					self.logger.info('[LastFM] authenticated successfully!');
				// Use the last.fm corrections data to check whether the supplied track has a correction to a canonical track
				lfm.getCorrection({
					artist: scrobbleData.artist,
					track: scrobbleData.title,
					callback: function(result) {
						if(result.success)
						{
							// Try to correct the artist
							if(result.correction.artist.name != undefined && result.correction.artist.name != '' && scrobbleData.artist != result.correction.artist.name)
							{	
								self.logger.info('[LastFM] corrected artist from: ' + scrobbleData.artist + ' to: ' + result.correction.artist.name);
								scrobbleData.artist = result.correction.artist.name;
							}
							
							// Try to correct the track title
							if(result.correction.name != undefined && result.correction.name != '' && scrobbleData.title != result.correction.name)
							{	
								self.logger.info('[LastFM] corrected track title from: ' + scrobbleData.title + ' to: ' + result.correction.name);
								scrobbleData.title = result.correction.name;
							}
						}
						else
							self.logger.info('[LastFM] request failed with error: ' + result.error);
					}
				})

				// Used to notify Last.fm that a user has started listening to a track. Parameter names are case sensitive.
				lfm.scrobbleNowPlayingTrack({
					artist: scrobbleData.artist,
					track: scrobbleData.title,
					album: scrobbleData.album,
					duration: state.duration,
					callback: function(result) {
						if(!result.success)
							console.log("in callback, finished: ", result);
						else
						{
							if(self.config.get('enable_debug_logging'))
								self.logger.info('[LastFM] updated "now playing" | artist: ' + scrobbleData.artist + ' | title: ' + scrobbleData.title);
						}
					}
				});
			} else {
				self.logger.info("[LastFM] Error: " + result.error);
			}
		});
	}
	else
	{
		// Configuration errors
		if(self.config.get('API_KEY') == '')
			self.logger.info('[LastFM] configuration error; "API_KEY" is not set.');
		if(self.config.get('API_SECRET') == '')
			self.logger.info('[LastFM] configuration error; "API_SECRET" is not set.');
		if(self.config.get('username') == '')
			self.logger.info('[LastFM] configuration error; "username" is not set.');
		if(self.config.get('authToken') == '')
			self.logger.info('[LastFM] configuration error; "authToken" is not set.');
	}

	//self.currentTimer = null;
	self.updatingNowPlaying = false;
	return defer.promise;
};

ControllerLastFM.prototype.scrobble = function (state, scrobbleThreshold, scrobbleThresholdInMilliseconds)
{
	var self = this;
	var defer = libQ.defer();
	
	var now = new Date().getTime();
	var artist = state.artist;
	var title = state.title;
	var album = state.album == null ? '' : state.album;
	
	if(state.title != undefined && !state.artist && state.title.indexOf(' - ') > -1)
	{
		try
		{
			var info = state.title.split('-');
			artist = info[0].trim();
			title = info[1].trim();
		}
		catch (ex)
		{
			self.logger.error('[LastFM] An error occurred during parse; ' + ex);
			self.logger.info('[LastFM] STATE; ' + JSON.stringify(state));
		}
	}
	else if(state.name != undefined && !state.artist && state.name.indexOf(' - ') > -1)
	{
		try
		{
			var info = state.name.split('-');
			artist = info[0].trim();
			title = info[1].trim();
		}
		catch (ex)
		{
			self.logger.error('[LastFM] An error occurred during parse; ' + ex);
			self.logger.info('[LastFM] STATE; ' + JSON.stringify(state));
		}
	}
	
	if(self.config.get('enable_debug_logging'))
	{
		self.logger.info('[LastFM] checking previously scrobbled song...');
		self.logger.info('[LastFM] previous scrobble: ' + JSON.stringify(self.previousScrobble));
	}
		
	if (
		(self.config.get('API_KEY') != '') &&
		(self.config.get('API_SECRET') != '') &&
		(self.config.get('username') != '') &&
		(self.config.get('authToken') != '') &&
		artist != undefined &&
		title != undefined &&
		album != undefined	
	)
	{
		if(self.config.get('enable_debug_logging'))
			self.logger.info('[LastFM] trying to authenticate for scrobbling...');
		
		var lfm = new lastfm({
			api_key: self.config.get('API_KEY'),
			api_secret: self.config.get('API_SECRET'),
			username: self.config.get('username'),
			authToken: self.config.get('authToken')
		});
		
		lfm.getSessionKey(function(result) {
			if(result.success)
			{		
				if(self.config.get('enable_debug_logging'))
					self.logger.info('[LastFM] authenticated successfully for scrobbling!');
				
				// Use the last.fm corrections data to check whether the supplied track has a correction to a canonical track
				lfm.getCorrection({
					artist: artist,
					track: title,
					callback: function(result) {
						if(result.success)
						{
							//self.logger.info("[LastFM] callback, finished: ", JSON.stringify(result));
							
							// Try to correct the artist
							if(result.correction.artist.name != undefined && result.correction.artist.name != '' && artist != result.correction.artist.name)
							{	
								self.logger.info('[LastFM] corrected artist from: ' + artist + ' to: ' + result.correction.artist.name);
								artist = result.correction.artist.name;
							}
							
							// Try to correct the track title
							if(result.correction.name != undefined && result.correction.name != '' && title != result.correction.name)
							{	
								self.logger.info('[LastFM] corrected track title from: ' + title + ' to: ' + result.correction.name);
								title = result.correction.name;
							}
						}
						else
							self.logger.info('[LastFM] request failed with error: ' + result.error);
					}
				});
				
				if(self.config.get('enable_debug_logging'))
					self.logger.info('[LastFM] preparing to scrobble...');

				lfm.scrobbleTrack({
					artist: artist,
					track: title,
					album: album,
					callback: function(result) {
						if(!result.success)
							console.log("in callback, finished: ", result);
						
						if(album == null || album == '')
							album = '[unknown album]';
						
						if(self.config.get('pushToastOnScrobble'))
							self.commandRouter.pushToastMessage('success', 'Scrobble succesful', 'Scrobbled: ' + artist + ' - ' + title + ' (' + album + ').');
						self.logger.info('[LastFM] Scrobble successful for: ' + artist + ' - ' + title + ' (' + album + ').');
					}
				});	
			}
			else
			{
				self.logger.info("[LastFM] Error: " + result.error);
			}
		});
		
		self.previousScrobble.artist = artist;
		self.previousScrobble.title = title;
		self.clearScrobbleMemory((state.duration * 1000) - scrobbleThresholdInMilliseconds);
	}
	else
	{
		// Configuration errors
		if(self.config.get('API_KEY') == '')
			self.logger.info('[LastFM] configuration error; "API_KEY" is not set.');
		if(self.config.get('API_SECRET') == '')
			self.logger.info('[LastFM] configuration error; "API_SECRET" is not set.');
		if(self.config.get('username') == '')
			self.logger.info('[LastFM] configuration error; "username" is not set.');
		if(self.config.get('authToken') == '')
			self.logger.info('[LastFM] configuration error; "authToken" is not set.');
	}
	
	//self.currentTimer = null;
	return defer.promise;
};

function md5(string) {
	return crypto.createHash('md5').update(string, 'utf8').digest("hex");
}

ControllerLastFM.prototype.clearScrobbleMemory = function (remainingtimeToPlay)
{
	var self = this;
	self.memoryTimer = setInterval(function(clear)
	{
		self.previousScrobble.artist = '';
		self.previousScrobble.title = '';
	}
	, remainingtimeToPlay);
}