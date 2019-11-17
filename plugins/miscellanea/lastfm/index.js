'use strict';

var config = new (require('v-conf'))();
var crypto = require('crypto');
var currentMac = '';
var exec = require('child_process').exec;
var fs = require('fs-extra');
var http = require('http');
var io = require('socket.io-client');
var pTimer = require('./pausableTimer');
var socket = io.connect('http://localhost:3000');
var lastfm = require("simple-lastfm");
var libNet = require('net');
var libQ = require('kew');
var net = require('net');
var os = require('os');

var supportedSongServices; // = ["mpd", "airplay", "volspotconnect", "volspotconnect2", "spop", "radio_paradise", "80s80s"];
var supportedStreamingServices; // = ["webradio"];

// Define the ControllerLastFM class
module.exports = ControllerLastFM;

function ControllerLastFM(context) 
{
	var self = this;
	self.previousState = null;
	self.updatingNowPlaying = false;
	self.timeToPlay = 0;
	self.apiResponse = null;
	self.previousScrobble = 
		{	artist: '',
			title: '',
			scrobbleTime: 0
		};
	self.scrobbleData =
	{
		artist: '',
		title: '',
		album: ''
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
	supportedSongServices = self.config.get('supportedSongServices').split(',');
	supportedStreamingServices = self.config.get('supportedStreamingServices').split(',');
	if(self.config.get('enable_debug_logging'))
	{
		self.logger.info('[LastFM] supported song services: ' + JSON.stringify(supportedSongServices));
		self.logger.info('[LastFM] supported streaming services: ' + JSON.stringify(supportedStreamingServices));
	}
	
	self.logger.info('[LastFM] scrobbler initiated!');
	self.logger.info('[LastFM] extended logging: ' + self.config.get('enable_debug_logging'));
	self.logger.info('[LastFM] try scrobble stream/radio plays: ' + self.config.get('scrobbleFromStream'));
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
		if(supportedStreamingServices.indexOf(state.service) != -1)
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
		{
			self.logger.info('--------------------------------------------------------------------// [LastFM] new state has been pushed; status: ' + state.status + ' | service: ' + state.service + ' | duration: ' + state.duration + ' | title: ' + state.title + ' | previous title: ' + self.previousState.title + init);
			if(self.currentTimer)
				self.logger.info('=================> [timer] is active: ' + self.currentTimer.isActive + ' | can continue: ' + self.currentTimer.canContinue + ' | timer started at: ' + self.currentTimer.timerStarted);
		}
		
		self.formatScrobbleData(state);
		
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
	self.logger.info("Performing onStop action");
	
	return libQ.resolve();
};

ControllerLastFM.prototype.stop = function() {
	var self = this;
	self.logger.info("Performing stop action");
	
	return libQ.resolve();
};

ControllerLastFM.prototype.onStart = function() {
	var self = this;
	self.logger.info("Performing onStart action");
	self.addToBrowseSources();
	
	return libQ.resolve();
};

ControllerLastFM.prototype.onRestart = function() 
{
	var self = this;
	self.logger.info("Performing onRestart action");
};

ControllerLastFM.prototype.onInstall = function() 
{
	var self = this;
	self.logger.info("Performing onInstall action");
};

ControllerLastFM.prototype.onUninstall = function() 
{
	// Perform uninstall tasks here!
	self.logger.info("Performing onUninstall action");
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
		uiconf.sections[1].content[0].value = self.config.get('supportedSongServices');
		for (var n = 0; n < thresholds.percentages.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[0].options', {
				value: thresholds.percentages[n].perc,
				label: thresholds.percentages[n].desc
			});
			
			if(thresholds.percentages[n].perc == parseInt(self.config.get('scrobbleThreshold')))
			{
				uiconf.sections[1].content[1].value.value = thresholds.percentages[n].perc;
				uiconf.sections[1].content[1].value.label = thresholds.percentages[n].desc;
			}
		}
		uiconf.sections[1].content[2].value = self.config.get('pushToastOnScrobble');
		uiconf.sections[1].content[3].value = self.config.get('scrobbleFromStream');
		uiconf.sections[1].content[4].value = self.config.get('supportedStreamingServices');
		uiconf.sections[1].content[5].value = self.config.get('streamScrobbleThreshold');
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

ControllerLastFM.prototype.addToBrowseSources = function () {
    var data = { 
		name: 'LastFM', 
		uri: 'lastfm', 
		plugin_type: 'miscellanea', 
		plugin_name: 'lastfm',
		icon: 'fa fa-lastfm',
		albumart: '/albumart?sourceicon=miscellanea/lastfm/lastfm_fill.svg'
		};
    this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerLastFM.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    var response;
    if (curUri == 'lastfm') {
        response = self.browseRoot('lastfm');
    }
	else if (curUri.startsWith('lastfm')) {
        self.logger.info('[LastFM] browsing to: ' + curUri);
		
		if(curUri == 'lastfm/similar_artist')
			response = self.getSimilarArtists('similar_artist');
		else if (curUri == 'lastfm/similar_tracks')
			response = self.getSimilarTracks('similar_tracks');
    }
    return response
        .fail(function (e) {
            self.logger.info('[' + Date.now() + '] ' + '[LastFM] handleBrowseUri failed');
            libQ.reject(new Error());
        });
};

ControllerLastFM.prototype.browseRoot = function(uri) {
  var self = this;
  self.fTree = [ 
		{ label: 'Similar Artists', uri: 'similar_artist', icon: 'fa fa-users'},
		{ label: 'Similar Tracks', uri: 'similar_tracks', icon: 'fa fa-music'}
	];
  var defer = libQ.defer();

  var rootTree = {
    navigation: {
      lists: [
        {
          availableListViews: [
            'grid', 'list',
          ],
          items: [
          ],
        },
      ],
      prev: {
        uri: '/',
      },
    },
  };

  for (var f in self.fTree) {
    
    rootTree.navigation.lists[0].items.push({
      service: 'lastfm',
      type: 'category',
      title: self.fTree[f].label,
      artist: '',
      album: '',
      icon: self.fTree[f].icon,
	  albumart: '',
      uri: 'lastfm/' + self.fTree[f].uri,
    });
  }
  defer.resolve(rootTree);
    
  return defer.promise;
};

// Handle browse events----------------------------------------------------------------------------------

ControllerLastFM.prototype.getSimilarArtists = function(uri) {
	var self = this;
	var defer = libQ.defer();
	var artworkURL = 'https://lastfm-img2.akamaized.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png';
  
	var call = self.apiCall('artist.getsimilar', self.scrobbleData);
	call.then(function(response){
		
		var jsonResp = JSON.parse(response);
		var rootTree = 
		{
			navigation: {
				lists: [
				{
					availableListViews: [
						'grid', 'list',
					],
					items: [],
				}],
				prev: {
					uri: 'lastfm',
				},
			},
		};
		
		self.checkURL('donotenable')
		.then(function(artworkProviderOnline)
		{
			for (var art in jsonResp.similarartists.artist)
			{
				if(artworkProviderOnline)
				{
					// This part is not working correctly just yet, might need some rework					
					var call = self.fetchArtwork(jsonResp.similarartists.artist[art].mbid);
					call.then(function(fanartData)
					{
						if(self.config.get('enable_debug_logging'))
							self.logger.info('[LastFM] Artwork response: ' + JSON.stringify(fanartData));
						if(fanartData.artistthumb[0].url != undefined || fanartData.artistthumb[0].url != '')
							defer.resolve(fanartData.artistthumb[0].url);
					})
					.then(function(applyArtwork)
					{
						rootTree.navigation.lists[0].items.push({
							service: 'lastfm',
							type: 'artistinfo',
							title: '',
							artist: jsonResp.similarartists.artist[art].name,
							mbid: jsonResp.similarartists.artist[art].mbid,
							albumart: jsonResp.similarartists.artist[art].image[3]['#text'],
							uri: "search/any/" + jsonResp.similarartists.artist[art].name,
						});
					});
				}
				else
				{
					rootTree.navigation.lists[0].items.push({
						service: 'lastfm',
						type: 'artistinfo',
						title: '',
						artist: jsonResp.similarartists.artist[art].name,
						mbid: jsonResp.similarartists.artist[art].mbid,
						albumart: artworkURL,
						uri: "search/any/" + jsonResp.similarartists.artist[art].name,
					});
				}
			}
		})
		.then(function(resolveInfo)
		{
			self.logger.info('[LastFM] items: ' + JSON.stringify(rootTree.navigation.lists[0].items));
			defer.resolve(rootTree);
		});
	})
	.fail(function()
	{
		defer.reject(new Error('An error occurred while listing similar artists'));
	});
	
	return defer.promise;
};

ControllerLastFM.prototype.getSimilarTracks = function(uri) {
	var self = this;
	var defer = libQ.defer();
  
	var call = self.apiCall('track.getsimilar', self.scrobbleData);
	call.then(function(response){
		
		var jsonResp = JSON.parse(response);
		
		var rootTree = 
		{
			navigation: {
				lists: [
				{
					availableListViews: [
						'grid', 'list',
					],
					items: [],
				}],
				prev: {
					uri: 'lastfm',
				},
			},
		};
		
		if(jsonResp.similartracks.track.length < 1)
			self.commandRouter.pushToastMessage('info', "No results", "The query yielded no results, no similar track could be found for " + self.scrobbleData.artist + ' - ' + self.scrobbleData.title);
		
		for (var trk in jsonResp.similartracks.track)
		{	
			rootTree.navigation.lists[0].items.push({
				service: 'lastfm',
				type: 'track',
				title: jsonResp.similartracks.track[trk].name,
				artist: jsonResp.similartracks.track[trk].artist.name,
				mbid: jsonResp.similartracks.track[trk].artist.mbid,
				albumart: jsonResp.similartracks.track[trk].image[3]['#text'],
				uri: "search/any/" + jsonResp.similartracks.track[trk].name,
			});
		}
		
		self.logger.info('[LastFM] items: ' + JSON.stringify(rootTree.navigation.lists[0].items));
		defer.resolve(rootTree);
	})
	.fail(function()
	{
		defer.reject(new Error('An error occurred while listing playlists'));
	});
	
	return defer.promise;
};

ControllerLastFM.prototype.apiCall = function (method, predicate)
{
	var self = this;
	var defer = libQ.defer();
	var url = 'ws.audioscrobbler.com';
	
	self.checkURL(url)
	.then(function (APIStatus)
	{
		if(APIStatus)
		{
			self.commandRouter.pushToastMessage('info', "Calling LastFM API", "Please standby for results (method: " + method + "), this might take a few seconds.");			
			if(predicate != undefined && predicate.artist != undefined && predicate.title != undefined)
			{
				var query = '';
				switch(method)
				{
					case 'artist.getsimilar':
						query = '/2.0/?method=artist.getsimilar&artist=' + encodeURIComponent(predicate.artist).trim();
						break;
					case 'track.getsimilar':
						query = '/2.0/?method=track.getsimilar&artist=' + encodeURIComponent(predicate.artist).trim() + '&track=' + encodeURIComponent(predicate.title).trim();
						break;
					default:
						query = 'method = ' + method;
						break;
				}
				
				self.logger.info('Method: ' + method + ' | query: ' + query);
				
				if(self.config.get('enable_debug_logging'))
					self.logger.info('[LastFM] Trying to call api with method ' + method + ' and predicate: ' + JSON.stringify(predicate));
				
				http.get({
						host: url,
						port: 80,
						path: query + '&api_key=' + self.config.get('API_KEY') + '&format=json&limit=54'
					}, function(res) {
						var body = '';
						res.on('data', function(chunk) {
							body += chunk;
						});
						res.on('end', function() {
							defer.resolve(body);
						});
					});
			}
			else
				self.logger.info('[LastFM] Predicate not set, could not populate menu for ' + method);
		}
		else
		{
			self.commandRouter.pushToastMessage('error', "Calling LastFM API failed", "Could not reach API, please check your connection and/or log files.");	
			defer.reject();
		}
	});
	
	return defer.promise;
};

// Public Methods ---------------------------------------------------------------------------------------

ControllerLastFM.prototype.checkURL = function(url)
{
	var self = this;
	var defer = libQ.defer();
	try
	{
		var options = {method: 'HEAD', host: url, port: 80, path: '/'};
		var req = http.request(options, function(r) {
			if(self.config.get('enable_debug_logging'))
				self.logger.info('[LastFM] URL check (' + url + ') returned code ' + r.statusCode);
			defer.resolve(true);
		});
		req.on('error', function(err) {
			self.logger.error('[LastFM] Webresource (' + url + ') not available. ' + err);
			defer.resolve(false);
		});		
		req.end();
	}
	catch (ex)
	{
		self.logger.error('[LastFM] URL availability check finished with error. ' + ex);
		defer.reject();
	}
	
	return defer.promise;
};

ControllerLastFM.prototype.fetchArtwork = function(mbid)
{
	var self = this;
	var defer = libQ.defer();
	var url = 'webservice.fanart.tv';
	var apikey = '';
	var options = {host: url, port: 80, path: '/v3/music/' + mbid + '&?api_key=' + apikey + '&format=json'};
	
	try
	{
		http.get(options, function(res) {
			var body = '';
			res.on('data', function(chunk) {
				body += chunk;
			});
			res.on('error', function(err) {
				self.logger.error('[LastFM] Artwork lookup failed. ' + err);
			});
			res.on('end', function() {
				self.logger.info(body);
				defer.resolve(body);
			});
		});
	}
	catch (ex)
	{
		self.logger.error('[LastFM] Could not complete artwork lookup. ' + ex);
		defer.reject();
	}
	return defer.promise;
};

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
		defer.reject();
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
	if(data['storePassword'] && data['passowrd'] != undefined && data['passowrd'] != '' && data['passowrd'] != '******')
		self.config.set('password', data['password']);
	self.config.set('authToken', md5(data['username'] + md5(data['password'])));
	defer.resolve();
	
	self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved authentication settings.");

	return defer.promise;
};

ControllerLastFM.prototype.updateScrobbleSettings = function (data)
{
	var self = this;
	var defer=libQ.defer();

	self.config.set('supportedSongServices', data['supportedSongServices']);
	self.config.set('scrobbleThreshold', data['scrobbleThreshold'].value);
	self.config.set('pushToastOnScrobble', data['pushToastOnScrobble']);
	self.config.set('scrobbleFromStream', data['scrobbleFromStream']);
	self.config.set('supportedStreamingServices', data['supportedStreamingServices']);
	self.config.set('streamScrobbleThreshold', data['streamScrobbleThreshold']);
	defer.resolve();
	
	this.configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	self.getConf(this.configFile);
	
	self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved scrobble settings.");

	return defer.promise;
};

ControllerLastFM.prototype.updateDebugSettings = function (data)
{
	var self = this;
	var defer=libQ.defer();

	self.config.set('enable_debug_logging', data['enable_debug_logging']);
	defer.resolve();
	
	self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved debug settings.");

	return defer.promise;
};

// Scrobble Methods -------------------------------------------------------------------------------------

ControllerLastFM.prototype.formatScrobbleData = function (state)
{
	var self = this;
	var defer = libQ.defer();
	
	self.scrobbleData.artist = state.artist;
	self.scrobbleData.title = state.title
	self.scrobbleData.album = state.album == null ? '' : state.album
	
	if(((self.scrobbleData.title != undefined && !self.scrobbleData.artist) || supportedStreamingServices.indexOf(state.service) != -1) && self.scrobbleData.title.indexOf('-') > -1 )
	{	
		try
		{
			var info = state.title.split('-');
			self.scrobbleData.artist = info[0].trim();
			self.scrobbleData.title = info[1].trim();
			self.scrobbleData.album = '';
		}
		catch (ex)
		{
			self.logger.error('[LastFM] An error occurred during parse; ' + ex);
			self.logger.info('[LastFM] STATE; ' + JSON.stringify(state));
		}
	}
	defer.resolve();

	return defer.promise;
};

ControllerLastFM.prototype.updateNowPlaying = function (state)
{
	var self = this;
	var defer = libQ.defer();
	self.updatingNowPlaying = true;
	
	if(self.config.get('enable_debug_logging'))
		self.logger.info('[LastFM] Updating now playing');
	
	self.formatScrobbleData(state);
	
	if (
		(self.config.get('API_KEY') != '') &&
		(self.config.get('API_SECRET') != '') &&
		(self.config.get('username') != '') &&
		(self.config.get('authToken') != '') &&
		self.scrobbleData.artist != undefined &&
		self.scrobbleData.title != undefined &&
		self.scrobbleData.album != undefined
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
					artist: self.scrobbleData.artist,
					track: self.scrobbleData.title,
					callback: function(result) {
						if(result.success)
						{
							// Try to correct the artist
							if(result.correction.artist.name != undefined && result.correction.artist.name != '' && self.scrobbleData.artist != result.correction.artist.name)
							{	
								self.logger.info('[LastFM] corrected artist from: ' + self.scrobbleData.artist + ' to: ' + result.correction.artist.name);
								self.scrobbleData.artist = result.correction.artist.name;
							}
							
							// Try to correct the track title
							if(result.correction.name != undefined && result.correction.name != '' && self.scrobbleData.title != result.correction.name)
							{	
								self.logger.info('[LastFM] corrected track title from: ' + self.scrobbleData.title + ' to: ' + result.correction.name);
								self.scrobbleData.title = result.correction.name;
							}
						}
						else
							self.logger.info('[LastFM] request failed with error: ' + result.error);
					}
				})

				// Used to notify Last.fm that a user has started listening to a track. Parameter names are case sensitive.
				lfm.scrobbleNowPlayingTrack({
					artist: self.scrobbleData.artist,
					track: self.scrobbleData.title,
					album: self.scrobbleData.album,
					duration: state.duration,
					callback: function(result) {
						if(!result.success)
							console.log("in callback, finished: ", result);
						else
						{
							if(self.config.get('enable_debug_logging'))
								self.logger.info('[LastFM] updated "now playing" | artist: ' + self.scrobbleData.artist + ' | title: ' + self.scrobbleData.title);
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
	self.formatScrobbleData(state);
	
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
		self.scrobbleData.artist != undefined &&
		self.scrobbleData.title != undefined &&
		self.scrobbleData.album != undefined	
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
					artist: self.scrobbleData.artist,
					track: self.scrobbleData.title,
					callback: function(result) {
						if(result.success)
						{							
							// Try to correct the artist
							if(result.correction.artist.name != undefined && result.correction.artist.name != '' && self.scrobbleData.artist != result.correction.artist.name)
							{	
								self.logger.info('[LastFM] corrected artist from: ' + artist + ' to: ' + result.correction.artist.name);
								self.scrobbleData.artist = result.correction.artist.name;
							}
							
							// Try to correct the track title
							if(result.correction.name != undefined && result.correction.name != '' && self.scrobbleData.title != result.correction.name)
							{	
								self.logger.info('[LastFM] corrected track title from: ' + title + ' to: ' + result.correction.name);
								self.scrobbleData.title = result.correction.name;
							}
						}
						else
							self.logger.info('[LastFM] request failed with error: ' + result.error);
					}
				});
				
				if(self.config.get('enable_debug_logging'))
					self.logger.info('[LastFM] preparing to scrobble...');

				lfm.scrobbleTrack({
					artist: self.scrobbleData.artist,
					track: self.scrobbleData.title,
					album: self.scrobbleData.album,
					callback: function(result) {
						if(!result.success)
							console.log("in callback, finished: ", result);
						
						if(self.scrobbleData.album == undefined || self.scrobbleData.album == '')
							self.scrobbleData.album = '[unknown album]';
						
						if(self.config.get('pushToastOnScrobble'))
							self.commandRouter.pushToastMessage('success', 'Scrobble succesful', 'Scrobbled: ' + self.scrobbleData.artist + ' - ' + self.scrobbleData.title + ' (' + self.scrobbleData.album + ').');
						if(self.config.get('enable_debug_logging'))
							self.logger.info('[LastFM] Scrobble successful for: ' + self.scrobbleData.artist + ' - ' + self.scrobbleData.title + ' (' + self.scrobbleData.album + ').');
					}
				});	
			}
			else
			{
				self.logger.info("[LastFM] Error: " + result.error);
			}
		});
		
		self.previousScrobble.artist = self.scrobbleData.artist;
		self.previousScrobble.title = self.scrobbleData.title;
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

/*
	
	P R E P A R A T I O N   F O R   F U T U R E   F U N C T I O N A L I T I E S

*/

ControllerLastFM.prototype.generateDependencylist = function ()
{
	var self = this;
	fs.readdir(__dirname + "/node_modules", function (err, dirs)
	{
		if (err) {
			console.log(err);
			return;
		}
		
		dirs.forEach(function(dir)
		{
			if (dir.indexOf(".") !== 0)
			{
				var packageJsonFile = __dirname + "/node_modules/" + dir + "/package.json";
				if (fs.existsSync(packageJsonFile))
				{
					fs.readFile(packageJsonFile, function (err, data)
					{
						if (err)
							console.log(err);
						else
						{
							var json = JSON.parse(data);
							self.logger.info('"'+json.name+'": "^' + json.version + '",');
						}
					});
				}
			}
		});
	});
};