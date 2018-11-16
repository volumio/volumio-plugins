'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var Gpio = require('onoff').Gpio;

module.exports = pirMotionDetectionAutoplay;
function pirMotionDetectionAutoplay(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

	//self.pirPlaylistPlaying = false;
}

pirMotionDetectionAutoplay.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

pirMotionDetectionAutoplay.prototype.startDetectionForContinuingMode = function() {
	var self = this;
	var lastMotion = false;

	(function watchPirSensorForContinuationMode() {
		self.gpioPir.watch(function (err, value) {
			if (err) throw err;
			self.gpioPir.unwatch();
			lastMotion = Date.now();
			var state =  self.commandRouter.stateMachine.getState();
			var queue = self.commandRouter.stateMachine.getQueue();
			if(queue.length) {
				// + random option
				if(state.status != 'play') {
					self.commandRouter.stateMachine.play();
				}
			} else {
				self.commandRouter.pushToastMessage(
					'info',
					'PIR motion detection autoplay',
					'Motion detected but no items to play in queue.'
				);
			}
			setTimeout(function() {
				if(Date.now() >= lastMotion + 1000*60) {
					self.commandRouter.stateMachine.pause(); // config option for stop or pause on motion detection?
					watchPirSensorForContinuationMode();
				}
			}, 1000*60);
		});
	})();
}

pirMotionDetectionAutoplay.prototype.startDetectionForPlaylistMode = function() {
	var self = this;

	if(!self.config.get('playlist')) {
		self.commandRouter.pushToastMessage(
			'success',
			'PIR motion detection autoplay',
			'No playlist was configured for motion detection.'
		);
	} else {
		(function watchPirSensor() {
				self.gpioPir.watch(function (err, value) {
					if (err) throw err;
					self.gpioPir.unwatch();

					var stopAfterTimeout = true;
					var state =  self.commandRouter.stateMachine.getState();
					if(state.status != 'play') {
						if(!self.pirPlaylistPlaying) {
							if(self.config.get('random')) {
								self.commandRouter.stateMachine.setRandom(true);
							}
							self.commandRouter.playListManager.playPlaylist(self.config.get('playlist'));
							self.pirPlaylistPlaying = true;
							stopAfterTimeout = true;
						}

					} else {
						self.pirPlaylistPlaying = false;
						stopAfterTimeout = false;
					}

					setTimeout(function() {
						if(stopAfterTimeout) {
							self.commandRouter.stateMachine.stop();
							self.pirPlaylistPlaying = false;

							var playlistContentPromise = self.commandRouter.playListManager.getPlaylistContent(self.config.get('playlist'));
							playlistContentPromise.then(function (playlistContent) {
								if (err) throw err;
								if(self.config.get('random')) {
									self.commandRouter.stateMachine.setRandom(false);
								}
								var queue = self.commandRouter.stateMachine.getQueue();
								playlistContent.forEach(function(playlistEntry) {
									var entryInQueue = queue.findIndex(function(queueEntry) {
										return queueEntry.uri == playlistEntry.uri;
									});
									if(entryInQueue >= 0) {
										self.commandRouter.stateMachine.removeQueueItem({value: entryInQueue});
									}
								});
							});
						}
						watchPirSensor();
					}, self.config.get('duration')*1000*60);
				});
		})();
	}
}

pirMotionDetectionAutoplay.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

    self.initGPIO();

	var startDetection = function() {
		self.detectionIsActive = (self.config.get('gpio_switch')) ? self.gpioSwitch.readSync() ^ 1 : 1;

		if(self.gpioLed) {
			self.gpioLed.writeSync(self.detectionIsActive);
		}

		if(self.detectionIsActive) {
			if(self.config.get('playlist_mode') == false) {
				self.startDetectionForContinuingMode();
			} else {
				self.startDetectionForPlaylistMode();
			}
		} else {
			self.commandRouter.stateMachine.stop();
			self.pirPlaylistPlaying = false;
		}
	};

	startDetection();

	if(self.config.get('gpio_switch')) {
		self.gpioSwitch.watch(function(err, value) {
			if (err) throw err;
			startDetection();
	  	});
	}

	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

pirMotionDetectionAutoplay.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

	console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ STOP');

	self.commandRouter.stateMachine.stop();
	self.freeGPIO();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

pirMotionDetectionAutoplay.prototype.onRestart = function() {
    var self = this;

	console.log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ RESTART');

	self.commandRouter.stateMachine.stop();
	self.freeGPIO();
};

// GPIO handling -------------------------------------------------------------------------------------

pirMotionDetectionAutoplay.prototype.initGPIO = function() {
    var self = this;

	self.gpioPir = new Gpio(self.config.get('gpio_pir'), 'in', 'rising');
	if(self.config.get('enable_switch') && self.config.get('gpio_switch')) {
		self.gpioSwitch = new Gpio(self.config.get('gpio_switch'), 'in', 'both', {'debounceTimeout': 10});
	}
	if(self.config.get('enable_led') && self.config.get('gpio_led')) {
		self.gpioLed = new Gpio(self.config.get('gpio_led'), 'out');
		self.gpioLed.writeSync(self.detectionIsActive);
	}
};

pirMotionDetectionAutoplay.prototype.freeGPIO = function() {
    var self = this;

    self.gpioPir.unexport();
	if(self.gpioLed) {
		self.gpioLed.writeSync(0);
		self.gpioLed.unexport();
	}
	if(self.gpioSwitch) {
		self.gpioSwitch.unexport();
	}
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
		self.gpioPir.watch(function (err, value) {
		    if (err) throw err;
			self.commandRouter.pushToastMessage(
				'success',
				'PIR motion detection autoplay',
				'Motion detected!'
			);
		});
	}, 1000);

	setTimeout(function() {
		self.gpioPir.unwatch();
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

	self.config.set('gpio_pir', data['gpio_pir']);
	self.config.set('playlist_mode', data['playlist_mode']);
	self.config.set('playlist', data['playlist']);
	self.config.set('random', data['random']);
	self.config.set('duration', data['duration'][0]);
	self.config.set('enable_switch', data['enable_switch']);
	self.config.set('gpio_switch', data['gpio_switch']);
	self.config.set('enable_led', data['enable_led']);
	self.config.set('gpio_led', data['gpio_led']);

	self.freeGPIO();
	self.onStart();

	self.commandRouter.pushToastMessage('success',
		'PIR motion detection autoplay',
		self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY')
	);
};

pirMotionDetectionAutoplay.prototype.getLabelForSelect = function (options, key) {
	var n = options.length;
	for (var i = 0; i < n; i++) {
		if (options[i].value == key)
			return options[i].label;
	}

	return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
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
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value', self.config.get('gpio_pir', false));
		    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value', self.config.get('playlist_mode', false));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[3].value', self.config.get('playlist', false));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value', self.config.get('random', false));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[5].config.bars[0].value', self.config.get('duration', false));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[6].value', self.config.get('enable_switch', false));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[7].value', self.config.get('gpio_switch', false));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[8].value', self.config.get('enable_led', false));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[9].value', self.config.get('gpio_led', false));

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
