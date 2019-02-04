'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var request = require("request");
var NanoTimer = require('nanotimer');
var moment = require('moment');
var sleep = require('sleep');

module.exports = nanosoundCd;
function nanosoundCd(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
	self.servicename = 'nanosound_cd';
	self.tracktype = 'NanoSound CD'
	self.timer = null;
}

nanosoundCd.prototype.saveConfig = function(data) {
	var self = this;
	var defer = libQ.defer();
	self.logger.info(data);
	self.config.set('upsampling', data['upsampling'].value);
	self.config.set('extractformat', data['extractformat'].value);
	
	//workaround to allow state to be pushed when not in a volatile state
	

	self.commandRouter.pushToastMessage('success', "Saved", "NanoSound CD settings saved");


	var samplingconfig = this.config.get('upsampling');

	if(samplingconfig=='1')
		self.samplerate = '44.1->176.4khz';
	else if(samplingconfig=='2')
		self.samplerate = '44.1->88.1khz';
	else
		self.samplerate = '44.1khz';

	
	self.commandRouter.stateMachine.stop().then(function()
	{
		exec('/usr/bin/sudo /bin/systemctl restart nanosoundcd_web', {uid:1000,gid:1000},
		function (error, stdout, stderr) {
			if(error != null) {
					self.logger.info('Error starting NanoSound CD' + error);
					self.commandRouter.pushToastMessage('error', 'nanosoundcd', 'Problem with starting NanoSound CD:' + error);
			} else {
					self.logger.info('NanoSound CD daemon started');
					self.commandRouter.pushToastMessage('success', 'nanosoundcd', 'NanoSound CD daemon restarting. Please wait around 10s before playing CD');

			}
			

		});
		return defer.resolve();
	});

}



nanosoundCd.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

nanosoundCd.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

	self.addToBrowseSources();

	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

	var samplingconfig = this.config.get('upsampling');

	if(samplingconfig=='1')
		self.samplerate = '44.1->176.4khz';
	else if(samplingconfig=='2')
		self.samplerate = '44.1->88.1khz';
	else
		self.samplerate = '44.1khz';

	exec('/usr/bin/sudo /bin/systemctl start nanosoundcd_web', {uid:1000,gid:1000},
		function (error, stdout, stderr) {
			if(error != null) {
					self.logger.info('Error starting NanoSound CD' + error);
					self.commandRouter.pushToastMessage('error', 'nanosoundcd', 'Problem with starting NanoSound CD:' + error);
			} else {
					self.logger.info('NanoSound CD daemon started');
					self.commandRouter.pushToastMessage('success', 'nanosoundcd', 'NanoSound CD daemon starting');
					
			}
		});		



	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

nanosoundCd.prototype.onStop = function() {
    var self = this;
	var defer=libQ.defer();
	
	self.commandRouter.stateMachine.stop().then(function()
	{
		// Once the Plugin has successfull stopped resolve the promise
		exec('/usr/bin/sudo /bin/systemctl stop nanosoundcd_web', {uid:1000,gid:1000},
		function (error, stdout, stderr) {
			if(error != null) {
					self.logger.info('Error stopping NanoSound CD' + error);
					self.commandRouter.pushToastMessage('error', 'nanosoundcd', 'Problem with stopping NanoSound CD:' + error);
			} else {
					self.logger.info('NanoSound CD daemon stopped');
					self.commandRouter.pushToastMessage('success', 'nanosoundcd', 'NanoSound CD daemon stopping');
					
			}
		});
		return defer.resolve();
	});

	





};

nanosoundCd.prototype.onRestart = function() {
    var self = this;
	// Optional, use if you need it
	exec('/usr/bin/sudo /bin/systemctl restart nanosoundcd_web', {uid:1000,gid:1000},
		                                                                    function (error, stdout, stderr) {
                		                                                        if(error != null) {
                                		                                                self.logger.info('Error starting NanoSound CD' + error);
                                                		                                self.commandRouter.pushToastMessage('error', 'nanosoundcd', 'Problem with starting NanoSound CD:' + error);
                                                                		        } else {
                                                                                		self.logger.info('NanoSound CD daemon started');
                                                                               			self.commandRouter.pushToastMessage('success', 'nanosoundcd', 'NanoSound CD daemon restarting. Please wait around 10s before playing CD');
																						sleep.sleep(5);
		                                                                        }
																				

										  });
										  
	

	defer.resolve();

	return libQ.resolve();
};


// Configuration Methods -----------------------------------------------------------------------------

nanosoundCd.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', self.config.get('upsampling'));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', self.config.get('extractformat'));
			
			
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label',  uiconf.sections[0].content[0].options[self.config.get('upsampling')-1].label);
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label',  uiconf.sections[0].content[1].options[self.config.get('extractformat')-1].label);

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

nanosoundCd.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

nanosoundCd.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

nanosoundCd.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

nanosoundCd.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


nanosoundCd.prototype.addToBrowseSources = function () {

	// Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
	var data = {name: 'NanoSound CD', uri: 'nanosound_cd',plugin_type:'music_service',plugin_name:'nanosound_cd', albumart: '/albumart?sourceicon=music_service/nanosound_cd/nanosoundcd.svg'};


    this.commandRouter.volumioAddToBrowseSources(data);
};

nanosoundCd.prototype.listCD=function()
{
	var defer=libQ.defer();
	
	var url = "http://127.0.0.1:5002/cdmeta2"
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if (!error && httpresponse.statusCode === 200) {
			var cdmeta = body
			var response={
				navigation: {
					prev: {
						uri: 'nanosound_cd'
					},
					"lists": [
						{
							"availableListViews": [
								"list"
							],
							"items": [

								{
									service: 'nanosound_cd',
									type: 'song',
									title: '[Whole CD]',
									artist: cdmeta[0]['artist_name'],
									album: cdmeta[0]['album_name'],
									icon: 'fa fa-music',
									uri: 'nanosound_cd/playall'
								}
							]
						}
					]
				}
			};

			var i;
			for(i = 0; i< cdmeta.length ; i++)
			{
				response.navigation.lists[0].items.push({
					service: 'nanosound_cd',
					type: 'song',
					title: cdmeta[i]['track_name'],
					artist:cdmeta[i]['artist_name'],
					album: cdmeta[i]['album_name'],
					icon: 'fa fa-music',
					uri: 'nanosound_cd/' + cdmeta[i]['track_number']
				});
			}

			console.log(cdmeta.length) // Print the json response
			defer.resolve(response);
			//cdmeta = body[0]
			//var items = []
			/*for (songmeta in cdmeta)
			{
				
			}*/
		}
	})

	return defer.promise;
}

nanosoundCd.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;
	
	if (curUri.startsWith('nanosound_cd')) {
	    if (curUri == 'nanosound_cd') {
			response = self.listCD();
        }
    }


    return response;
};

nanosoundCd.prototype.playNextTrack2 = function(position) {
	var self = this;
	self.commandRouter.stateMachine.next();
	/*
			var self = this;
			var defer = libQ.defer();

			var url = "http://127.0.0.1/api/v1/commands/?cmd=next"
			
			request({
			url: url,
			json: true
			}, function (error, httpresponse, body) {
				self.commandRouter.pushConsoleMessage('********[' + Date.now() + '] ' + 'nanosoundCd::playNextTrack2 ' + body);
				self.timer = new RPTimer(self.playNextTrack2.bind(self), [0], 5000);
				return libQ.resolve()
			});

	return defer.promise;
	*/

}

/*
nanosoundCd.prototype.playNextTrack = function(position) {
	var self = this;
	var defer = libQ.defer();
	self.commandRouter.pushConsoleMessage('********[' + Date.now() + '] ' + 'nanosoundCd::PlayNextTrack ' + position);
	
	//var vState = self.commandRouter.stateMachine.getState();

	if(position < 	self.commandRouter.stateMachine.playQueue.arrayQueue.length)
	{
		var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[position];
		

		if(queueItem.service=='nanosound_cd')
		{
			var uriSplitted=queueItem.uri.split('/');
			var trackno = uriSplitted[1];

			self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::PlayNextTrack ' + queueItem.uri);
	
			var url = "http://127.0.0.1:5002/playtrack?usecachedmeta=True&track=" + trackno
			request({
			url: url,
			json: true
			}, function (error, httpresponse, body) {

				queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[position];
		
				if(body["status"]!="ERROR")
				{
					var rpState = {
					status: 'play',
					service: 'nanosound_cd',
					type: 'track',
					trackType: self.tracktype,
					uri: queueItem.uri,
					name: queueItem.name,
					title: queueItem.title,
					streaming: false,
					artist: queueItem.artist,
					album: queueItem.album,
					seek: 0,
					samplerate: self.samplerate,
					bitdepth: '16 bit',
					channels: 2
					};
					self.state = rpState;
					self.commandRouter.servicePushState(rpState, 'nanosound_cd');
				}

				//workaround to allow state to be pushed when not in a volatile state
			
				var vState = self.commandRouter.stateMachine.getState();

				vState.position = position;
				
				
				queueItem.name = queueItem.name;
				queueItem.artist = queueItem.title;
				queueItem.album = queueItem.album;
				queueItem.trackType = self.tracktype;
				queueItem.duration = body["length"];
				queueItem.samplerate = self.samplerate;
				queueItem.bitdepth = '16 bit';
				queueItem.channels = 2;
				queueItem.streaming = false;


				self.commandRouter.stateMachine.currentSeek = 0;
				self.commandRouter.stateMachine.playbackStart=Date.now();
				self.commandRouter.stateMachine.currentSongDuration=body["length"];
				self.commandRouter.stateMachine.askedForPrefetch=false;
				self.commandRouter.stateMachine.prefetchDone=false;
				self.commandRouter.stateMachine.simulateStopStartDone=false;
				
				self.state = rpState;
				self.commandRouter.servicePushState(rpState, 'nanosound_cd');
				self.commandRouter.logger.info("*************curduration:" + body["length"]);
				self.timer = new RPTimer(self.playNextTrack.bind(self), [vState.position+1], 5000);

				return libQ.resolve(rpState)
			});
			

		}
	}
	return defer.promise;

};

nanosoundCd.prototype.hello = function(pos) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::hello');
	
};
*/

// Define a method to clear, add, and play an array of tracks
nanosoundCd.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	var defer = libQ.defer();

	if (self.timer) {
        self.timer.clear();
    }
	
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::clearAddPlayTrack');
	//self.timer = new RPTimer(self.hello.bind(self), [vState.position+1], queueItem.duration*2000);

	
	self.commandRouter.logger.info("RUN1:");
	var uriSplitted=track.uri.split('/');
	var trackno = uriSplitted[1];
	//self.commandRouter.logger.info('play:' + trackno);
	var url = "http://127.0.0.1:5002/playtrack?usecachedmeta=True&track=" + trackno
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {
		self.commandRouter.logger.info("RUN2");

		var tname=track.name;;
		var tartist=track.artist;
		var talbum=track.album;

		if(body["status"]!="ERROR")
		{

			//get track info from body
			var rpState = {
			status: 'play',
			service: 'nanosound_cd',
			type: 'track',
			trackType: self.tracktype,
			uri: track.uri,
			name: tname,
			title: tname,
			streaming: false,
			artist: tartist,
			album: talbum,
			duration: body["length"],
			seek: 0,
			samplerate: self.samplerate,
			bitdepth: '16bit',
			channels: 2
			};

			//workaround to allow state to be pushed when not in a volatile state
			
			var vState = self.commandRouter.stateMachine.getState();

			
			var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];

			queueItem.name = tname;
			queueItem.artist = tartist;
			queueItem.album = talbum;
			queueItem.trackType = self.tracktype;
			queueItem.duration = body["length"];
			queueItem.samplerate = self.samplerate;
			queueItem.bitdepth = '16bit';
			queueItem.channels = 2;
			queueItem.streaming = false;


			self.commandRouter.stateMachine.currentSeek = 0;
			self.commandRouter.stateMachine.playbackStart=Date.now();
			self.commandRouter.stateMachine.currentSongDuration=body["length"];
			self.commandRouter.stateMachine.askedForPrefetch=false;
			self.commandRouter.stateMachine.prefetchDone=false;
			self.commandRouter.stateMachine.simulateStopStartDone=false;
			self.commandRouter.logger.info("curduration:" + body["length"]);

			self.state = rpState;
			self.commandRouter.servicePushState(rpState, 'nanosound_cd');
			self.commandRouter.logger.info("*************curduration:" + body["length"]);
			//self.timer = new RPTimer(self.hello.bind(self), [vState.position+1], queueItem.duration*2000);
			self.timer = new RPTimer(self.playNextTrack2.bind(self), [vState.position], self.commandRouter.stateMachine.currentSongDuration * 1000);
			
    		
		}
		return libQ.resolve(rpState)
	})

	
	
	return defer.promise;
	
	/*r.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::clearAddPlayTrack');
	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);*/
};

function liftOff(timer){
    timer.clearInterval();
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::liftoff');
}

nanosoundCd.prototype.seek = function (timepos) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::seek');

	if (self.timer) {
        self.timer.clear();
    }

	var defer = libQ.defer();
	var url = "http://127.0.0.1:5002/seek?sec=" + (timepos/1000)
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if(body["status"]!="ERROR")
		{
			var statusst='play'
			if(body["status"]=="State.Paused")
				statusst='pause'

			if(body["status"]=="State.Playing")
				statusst='play'

			//get track info from body
			var rpState = {
			status: statusst,
			service: 'nanosound_cd',
			type: 'track',
			streaming: false,
			trackType: self.tracktype,
			duration: body["length"],
			samplerate: self.samplerate,
			bitdepth: '16bit',
			channels: 2
			};

			var vState = self.commandRouter.stateMachine.getState();
			var queueItem = self.commandRouter.stateMachine.playQueue.arrayQueue[vState.position];


			self.timer = new RPTimer(self.playNextTrack2.bind(self), [vState.position], (rpState.duration -  body["playprogress"]) * 1000);
			
			self.commandRouter.pushConsoleMessage('[' + vState.position + ' ' + queueItem.name + ' ' + queueItem.trackType + ' ' + queueItem.uri + ' ' + queueItem.duration + '] ' + 'nanosoundCd::name');
	

			self.state = rpState;
			self.commandRouter.servicePushState(rpState, 'nanosound_cd');
		}
		defer.resolve();
	})
	return defer.promise;
};

// Stop
nanosoundCd.prototype.stop = function() {
	var self = this;

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::stop');
	if (self.timer) {
        self.timer.clear();
    }
	//self.commandRouter.logger.info('play:' + trackno);
	var url = "http://127.0.0.1:5002/stop2"
	var defer = libQ.defer();
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if(body["status"]!="ERROR")
		{

			//get track info from body
			var rpState = {
			status: 'stop'
			};

			self.state = rpState;
			self.commandRouter.servicePushState(rpState, 'nanosound_cd');
		}
		defer.resolve();
	});
	return defer.promise;
};

nanosoundCd.prototype.resume = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::resume');
	var defer = libQ.defer();
	var url = "http://127.0.0.1:5002/playtoggle2"
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if (self.timer) {
            self.timer.resume();
        }

		if(body["status"]!="ERROR")
		{
			var statusst='play'
			if(body["status"]=="State.Paused")
				statusst='pause'

			if(body["status"]=="State.Playing")
				statusst='play'

			//get track info from body
			var rpState = {
			status: statusst,
			service: 'nanosound_cd',
			type: 'track',
			streaming: false,
			trackType: self.tracktype,
			duration: body["length"],
			samplerate: self.samplerate,
			bitdepth: '16bit',
			channels: 2
			};

			self.state = rpState;
			self.commandRouter.servicePushState(rpState, 'nanosound_cd');
		}
		defer.resolve();
	})

	return defer.promise;
};


// Spop pause
nanosoundCd.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::pause');

	if (self.timer) {
		self.timer.pause();
	}

	var defer = libQ.defer();
	var url = "http://127.0.0.1:5002/playtoggle2"

	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if(body["status"]!="ERROR")
		{


			var statusst='play'
			if(body["status"]=="State.Paused")
				statusst='pause'

			if(body["status"]=="State.Playing")
				statusst='play'

			//get track info from body
			var rpState = {
			status: statusst,
			service: 'nanosound_cd',
			type: 'track',
			streaming: false,
			trackType: self.tracktype,
			duration: body["length"],
			samplerate: self.samplerate,
			bitdepth: '16bit',
			channels: 2
			};


			self.state = rpState;
			self.commandRouter.servicePushState(rpState, 'nanosound_cd');
		}
		defer.resolve();
	})
	return defer.promise;
};

// Get state
nanosoundCd.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::getState');


};

//Parse state
nanosoundCd.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
nanosoundCd.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


nanosoundCd.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI
	var uriSplitted;
	

	self.logger.info("exploding")
	var url = "http://127.0.0.1:5002/cachedcdmeta"
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {
		
		var cachedmeta = body
		
		if (!error && httpresponse.statusCode === 200) {

			if (self.timer) {
				self.timer.clear();
			}


			if (uri.startsWith('nanosound_cd/playall')) {
				var response=[];
				var i;
				for(i=0;i<cachedmeta.length;i++)
				{
					var tname = cachedmeta[i]['track_name'];
					var ttitle =  cachedmeta[i]['track_name'];
					var tartist = cachedmeta[i]['artist_name'];
					var talbum = cachedmeta[i]['album_name'];

					if(tname==null)
					{
						tname = "Track " + cachedmeta[i]['track_number'];
						ttitle = "Track " + cachedmeta[i]['track_number'];
						tartist = "Unknown Artist";
						talbum = "Unknown Album";
					}

					var item={
						uri:  'nanosound_cd/' + cachedmeta[i]['track_number'],
						service: 'nanosound_cd',
						type: 'song',
						name:  tname,
						title: ttitle,
						artist:tartist,
						album: talbum,
						streaming: false,
						//duration: 10,
						albumart: '/albumart?sourceicon=music_service/nanosound_cd/nanosoundcd.svg',
						samplerate: self.samplerate,
						bitdepth: '16bit',
						trackType: self.tracktype
			
					};
				
					response.push(item);
				}
				defer.resolve(response);
			}
			else if (uri.startsWith('nanosound_cd/')) {
				uriSplitted=uri.split('/');
				var trackno = uriSplitted[1];

				var response=[];

				var tname = cachedmeta[trackno -1]['track_name'];
				var ttitle =  cachedmeta[trackno -1]['track_name'];
				var tartist = cachedmeta[trackno -1]['artist_name'];
				var talbum = cachedmeta[trackno -1]['album_name'];

				if(tname==null)
				{
					tname = "Track " + trackno;
					ttitle = "Track " + trackno;
					tartist = "Unknown Artist";
					talbum = "Unknown Album";
				}

				var item={
					uri: 'nanosound_cd/' + trackno,
					service: 'nanosound_cd',
					type: 'song',
					name:  tname,
					title: ttitle,
					artist:tartist,
					album: talbum,
					albumart: '/albumart?sourceicon=music_service/nanosound_cd/nanosoundcd.svg',
					streaming: false,
					//duration: 10,
					//duration: resJson.tracks[i]x`.duration/1000,
					//albumart: albumart,
					samplerate: self.samplerate,
					bitdepth: '16bit',
					trackType: self.tracktype
		
				};
				response.push(item);
				defer.resolve(response);
			}
		
		}
	})
	return defer.promise;
};

nanosoundCd.prototype.getAlbumArt = function (data, path) {

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





nanosoundCd.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

nanosoundCd.prototype._searchArtists = function (results) {

};

nanosoundCd.prototype._searchAlbums = function (results) {

};

nanosoundCd.prototype._searchPlaylists = function (results) {


};

nanosoundCd.prototype._searchTracks = function (results) {

};

function RPTimer(callback, args, delay) {
    var start, remaining = delay;

    var nanoTimer = new NanoTimer();

    RPTimer.prototype.pause = function () {
        nanoTimer.clearTimeout();
        remaining -= new Date() - start;
    };

    RPTimer.prototype.resume = function () {
        start = new Date();
		nanoTimer.clearTimeout();
        nanoTimer.setTimeout(callback, args, remaining + 'm');
    };

    RPTimer.prototype.clear = function () {
        nanoTimer.clearTimeout();
    };

    this.resume();
}; 