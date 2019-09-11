'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var request = require("request");
var NanoTimer = require('nanotimer');
var moment = require('moment');
var sleep = require('system-sleep');

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

nanosoundCd.prototype.saveReg = function(data) {
	var self = this;
	var defer = libQ.defer();
	
	self.commandRouter.pushToastMessage('success', "NanoSound CD", "Registering...");

	var url = "http://127.0.0.1:5002/activate?email=" +  data['email'] + "&orderno=" + data['orderno']

	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if(body["response"]=="OK")
		{
			self.config.set('email', data['email']);
			self.config.set('orderno', data['orderno']);
			self.commandRouter.pushToastMessage('success', "NanoSound CD", "NanoSound CD registration successful. Thank you!");

		}
		else if(body["response"]=="FAILED")
		{
			self.config.set('email', "");
			self.config.set('orderno', "");
			self.commandRouter.pushToastMessage('error', "NanoSound CD", body["message"]);

		}
		else if(body["response"]=="ALREADY")
		{
			self.config.set('email', data['email']);
			self.config.set('orderno', data['orderno']);
			self.commandRouter.pushToastMessage('success', "NanoSound CD", body["message"]);

		}
		defer.resolve();
	})
	return defer.promise;
}


nanosoundCd.prototype.saveConfig = function(data) {
	var self = this;
	var defer = libQ.defer();
	

	var lang_code = this.commandRouter.sharedVars.get('language_code');

	if (fs.existsSync('/mnt/' + data['savepath'])) {
		self.config.set('savepath',data['savepath'])
	}
	else
	{
		self.commandRouter.pushToastMessage('error', "NanoSound CD", "Path does not exists:" + "/mnt/" + data['savepath']);
		self.config.set('savepath','INTERNAL')
	}

	if(self.config.get('email')=="")
	{
		self.config.set('upsampling','3');
		self.commandRouter.pushToastMessage('success', "NanoSound CD", "Upsampling and Extraction are only available in full version");
	}
	else
	{
		self.config.set('upsampling', data['upsampling'].value);
	}
	self.config.set('extractformat', data['extractformat'].value);
	self.config.set('prestart', data['prestart']);
	self.config.set('loadalbumart', data['loadalbumart'].value);

	self.commandRouter.pushToastMessage('success', "NanoSound CD", "NanoSound CD settings saved");


	var samplingconfig = this.config.get('upsampling');

	if(samplingconfig=='1')
		self.samplerate = '44.1->176.4khz';
	else if(samplingconfig=='2')
		self.samplerate = '44.1->88.1khz';
	else
		self.samplerate = '44.1khz';


	//Wait for file to save
	sleep(2000);
	var vState = self.commandRouter.stateMachine.getState();
	if(vState.trackType == self.tracktype)
	{
		self.commandRouter.stateMachine.stop().then(function()
		{
			exec('/usr/bin/sudo /bin/systemctl restart nanosoundcd_web', {uid:1000,gid:1000},
			function (error, stdout, stderr) {
				if(error != null) {
						self.logger.error('Error starting NanoSound CD: ' + error);
						self.commandRouter.pushToastMessage('error', 'NanoSound CD', 'Problem with starting NanoSound CD:' + error);
						defer.resolve();
				} else {
						self.logger.info('NanoSound CD daemon started');
						self.commandRouter.pushToastMessage('success', 'NanoSound CD', 'NanoSound CD daemon restarting. Please wait around 10s before playing CD');
						defer.resolve();
				}
				
	
			});
		});
	}
	else
	{
		exec('/usr/bin/sudo /bin/systemctl restart nanosoundcd_web', {uid:1000,gid:1000},
			function (error, stdout, stderr) {
				if(error != null) {
						self.logger.error('Error starting NanoSound CD: ' + error);
						self.commandRouter.pushToastMessage('error', 'NanoSound CD', 'Problem with starting NanoSound CD:' + error);
						defer.resolve();
				} else {
						self.logger.info('NanoSound CD daemon started');
						self.commandRouter.pushToastMessage('success', 'NanoSound CD', 'NanoSound CD daemon restarting. Please wait around 10s before playing CD');
						defer.resolve();
				}
				
	
			});
	}
	


	return defer.promise
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

	exec('/usr/bin/sudo /bin/systemctl start nanosoundcd_progressweb', {uid:1000,gid:1000},
		function (error, stdout, stderr) {
		
		exec('/usr/bin/sudo /bin/systemctl start nanosoundcd_web', {uid:1000,gid:1000},
			function (error, stdout, stderr) {
				if(error != null) {
						self.logger.error('Error starting NanoSound CD: ' + error);
						self.commandRouter.pushToastMessage('error', 'NanoSound CD', 'Problem with starting NanoSound CD:' + error);
						defer.resolve();

				} else {
						self.logger.info('NanoSound CD daemon started');
						self.commandRouter.pushToastMessage('success', 'NanoSound CD', 'NanoSound CD daemon starting');
						defer.resolve();

						
				}
			});		
	});
    return defer.promise;
};

nanosoundCd.prototype.onStop = function() {
    var self = this;
	var defer=libQ.defer();
	
	self.commandRouter.stateMachine.stop().then(function()
	{
		// Once the Plugin has successfull stopped resolve the promise

		exec('/usr/bin/sudo /bin/systemctl stop nanosoundcd_progressweb', {uid:1000,gid:1000},
		function (error, stdout, stderr) {

			exec('/usr/bin/sudo /bin/systemctl stop nanosoundcd_web', {uid:1000,gid:1000},
			function (error, stdout, stderr) {
				if(error != null) {
						self.logger.error('Error stopping NanoSound CD:' + error);
						self.commandRouter.pushToastMessage('error', 'NanoSound CD', 'Problem with stopping NanoSound CD:' + error);
						defer.resolve();
				} else {
						self.logger.info('NanoSound CD daemon stopped');
						self.commandRouter.pushToastMessage('success', 'NanoSound CD', 'NanoSound CD daemon stopping');
						defer.resolve();
						
				}
			});

		});
		
	});

	



	return defer.promise;

};

nanosoundCd.prototype.eject = function() {
	var self = this;
	var defer = libQ.defer();
	exec('eject', {uid:1000,gid:1000},
		                                                                    function (error, stdout, stderr) {
                		                                                        if(error != null) {
                                		                                                self.logger.error('Error ejecting' + error);
                                                		                                self.commandRouter.pushToastMessage('error', 'NanoSound CD', 'Error ejecting' + error);
                                                                		        } else {
                                                                                		self.logger.info('NanoSound CD daemon started');
                                                                               			self.commandRouter.pushToastMessage('success', 'NanoSound CD', 'Ejected');
		                                                                        }
																				
																				defer.resolve();
										  });
										  
	return defer.promise;
};

nanosoundCd.prototype.onRestart = function() {
	var self = this;
	var defer = libQ.defer();
	// Optional, use if you need it

	exec('/usr/bin/sudo /bin/systemctl restart nanosoundcd_progressweb', {uid:1000,gid:1000},
		function (error, stdout, stderr) {

	exec('/usr/bin/sudo /bin/systemctl restart nanosoundcd_web', {uid:1000,gid:1000},
		                                                                    function (error, stdout, stderr) {
                		                                                        if(error != null) {
                                		                                                self.logger.error('Error starting NanoSound CD: ' + error);
                                                		                                self.commandRouter.pushToastMessage('error', 'NanoSound CD', 'Problem with starting NanoSound CD:' + error);
                                                                		        } else {
                                                                                		self.logger.info('NanoSound CD daemon started');
                                                                               			self.commandRouter.pushToastMessage('success', 'NanoSound CD', 'NanoSound CD daemon restarting. Please wait around 10s before playing CD');
																						sleep(3000);
		                                                                        }
																				
																				defer.resolve();
										  });
										  
	
	});

	return defer.promise;
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
			if(self.config.get('email')=="")
			{
				self.config.set('upsampling','3');
			}
			
			self.configManager.setUIConfigParam(uiconf, 'sections[2].content[0].value', self.config.get('email'));
			self.configManager.setUIConfigParam(uiconf, 'sections[2].content[1].value', self.config.get('orderno'));
			
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', self.config.get('upsampling'));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', self.config.get('extractformat'));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value', self.config.get('prestart'));
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[3].value', self.config.get('savepath'));
			
	
				
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label',  uiconf.sections[0].content[0].options[self.config.get('upsampling')-1].label);
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label',  uiconf.sections[0].content[1].options[self.config.get('extractformat')-1].label);

			if(self.config.has('loadalbumart'))
			{
				self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.value', self.config.get('loadalbumart'));
				self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.label',  uiconf.sections[0].content[4].options[self.config.get('loadalbumart')-1].label);
			}
			else
			{
				self.config.set('loadalbumart',"1");
				self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.label', "No");
			}
			
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

nanosoundCd.prototype.testPlay=function()
{
	var self = this;
	var defer=libQ.defer();

	self.commandRouter.pushToastMessage('success', 'NanoSound CD', "Testing to play Track 1");
						

	var url = "http://127.0.0.1:5003/testplay"
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {
		if (!error && httpresponse.statusCode === 200) {
			
			if(body["status"] == "DONE")
			{
				self.commandRouter.pushToastMessage('success', 'NanoSound CD', "Playing track 1");
				
				defer.resolve();
			}
			else if(body["status"] == "FAILED")
			{
				self.commandRouter.pushToastMessage('error', 'NanoSound CD', body["message"]);
				
				defer.resolve();
			}
			else
			{
				self.commandRouter.pushToastMessage('error', 'NanoSound CD', "Unknown error");
				defer.resolve();
				
			}
				
		}
		else
		{
			self.commandRouter.pushToastMessage('error', 'NanoSound CD', "Unknown error");
				
			defer.resolve();
		}
	});

	return defer.promise;
}


nanosoundCd.prototype.showversion=function()
{
	var self = this;
	var defer=libQ.defer();

	var url = "http://127.0.0.1:5002/version";
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if (!error && httpresponse.statusCode === 200) {
			if(("dated" in body) && ("version" in body))
			{
				self.commandRouter.pushToastMessage('success', 'NanoSound CD', "Build:" + body["version"] + " Date:" + body["dated"]);
				defer.resolve();
			}	
		}
		else
		{
			self.commandRouter.pushToastMessage('error', 'NanoSound CD', "Cannot get version");
			defer.resolve();
		}
		
	});

	return defer.promise;

}

nanosoundCd.prototype.upgrade=function()
{
	var self = this;
	var defer=libQ.defer();

	var url = "http://127.0.0.1:5002/updateavailable";
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if (!error && httpresponse.statusCode === 200) {
			if(("updateavail" in body))
			{
				if(body['updateavail']==true)
				{
					self.commandRouter.pushToastMessage('success', 'NanoSound CD', "Upgrading... It will take a few minutes");

					var upgradeurl = "http://127.0.0.1:5002/upgrade";
					request({
					url: upgradeurl,
					json: true
					}, function (error, httpresponse, body) {
						if(body['status']=='OK')
						{
							self.commandRouter.pushToastMessage('success', 'NanoSound CD', "Upgrade successful. Volumio restarting.....");
							
							exec('/usr/bin/sudo /bin/systemctl restart nanosoundcd_progressweb', {uid:1000,gid:1000},
									function (error, stdout, stderr) {

									exec('/usr/bin/sudo /bin/systemctl restart nanosoundcd_web', {uid:1000,gid:1000},
																											function (error, stdout, stderr) {
																												if(error != null) {
																														self.logger.error('Error starting NanoSound CD: ' + error);
																														self.commandRouter.pushToastMessage('error', 'NanoSound CD', 'Problem with starting NanoSound CD:' + error);
																														defer.resolve();
																												} else {
																														self.logger.info('NanoSound CD updated');
																														self.commandRouter.pushToastMessage('success', 'NanoSound CD', 'Volumio and NanoSound CD daemon restarting');
																														sleep(3000);

																														exec('/usr/bin/sudo volumio vrestart', {uid:1000,gid:1000},
																														function (error, stdout, stderr) {
																															defer.resolve();
																														});

																												}
																												
																												
										});
																		
									
								});


						}
						else
						{
							self.commandRouter.pushToastMessage('success', 'NanoSound CD', "Upgrade failed");
							defer.resolve();
						}

					});
				}
					
				if(body['updateavail']==false)
				{

					self.commandRouter.pushToastMessage('success', 'NanoSound CD', "Already on latest version");
					defer.resolve();
				}
			}	
		}
		else
		{
			self.commandRouter.pushToastMessage('error', 'NanoSound CD', "Cannot upgrade");
			defer.resolve();
		}
		
	});

	return defer.promise;
}


nanosoundCd.prototype.setupAudio=function()
{
	var self = this;
	var defer=libQ.defer();

	var url = "http://127.0.0.1:5002/setupaudio";
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if (!error && httpresponse.statusCode === 200) {
			if(body["status"]=="OK")
			{
				self.commandRouter.pushToastMessage('success', 'NanoSound CD', body["message"]);
				defer.resolve();
			}
			else if(body["status"]=="CHANGED")
			{
				self.commandRouter.pushToastMessage('error', 'NanoSound CD', body["message"]);
				defer.resolve();
			}
		}
		else
		{
			self.commandRouter.pushToastMessage('error', 'NanoSound CD', "Error when trying to configure audio");
			defer.resolve();
		}
		
	});

	return defer.promise;
}


nanosoundCd.prototype.extractAll=function()
{
	var self = this;
	var defer=libQ.defer();

	var vState = self.commandRouter.stateMachine.getState();
	self.commandRouter.logger.info(vState);
	if(vState.trackType == self.tracktype)
	{
		self.commandRouter.stateMachine.stop();
	}
	
	var url = "http://127.0.0.1:5003/ripprogress";
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if (!error && httpresponse.statusCode === 200) {

			if(!("status" in body) || (body["status"] == "DONE") || (body["status"] == "ABORTED"))
			{

				self.commandRouter.pushToastMessage('success', "NanoSound CD", "Extraction Starting...");
	
				var url = "http://127.0.0.1:5002/ripcd"
				request({
				url: url,
				json: true
				}, function (error, httpresponse, body) {

					self.commandRouter.logger.info(body);
					if (!error && httpresponse.statusCode === 200) {
						
						if(body["status"] == "OK")
							self.commandRouter.pushToastMessage('success', 'NanoSound CD', body["message"]);
						
						if(body["status"] == "FAILED")
							self.commandRouter.pushToastMessage('error', 'NanoSound CD', body["message"]);

						defer.resolve();

					}
					else
					{
						self.commandRouter.pushToastMessage('error', 'NanoSound CD', "Extraction cannot be performed. Please check CD and CD/DVD Drive. This function is only support in full version");
						defer.resolve();
					}
				})
			}
				
			if(body["status"] == "NOTDONE")
			{
				var totalsongs = body["torip"].length
				var found = false
				var message = ""

				for (var i = 1; i <= totalsongs; i++) {
					if(String(i) in body)
					{
						found = true
						var pct = body[String(i)]
						if(pct!=1.0)
						{
							message = "Extracting Track " + String(i) + " - " + Math.round(pct*10000) / 100 + "%. " + String(i) + "/" + String(totalsongs) + " tracks";
						}
							
					} 
				}
				
				if(found)
					self.commandRouter.pushToastMessage('error', 'NanoSound CD', 'Extraction still in progress. ' + message);
				else
					self.commandRouter.pushToastMessage('error', 'NanoSound CD',"Extraction still in progress. Restart NanoSound CD plugin if you want to abort.");
				
				defer.resolve();
			}
			
		}
		else
		{
			self.commandRouter.pushToastMessage('error', 'NanoSound CD', "Problem with NanoSound CD progress service");
			defer.resolve();
		}
	})


	return defer.promise;
}

nanosoundCd.prototype.extractStatus=function()
{
	var self = this;
	var defer=libQ.defer();
	var url = "http://127.0.0.1:5003/ripprogress";
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if (!error && httpresponse.statusCode === 200) {

			if(!("status" in body))
			{
				self.commandRouter.pushToastMessage('success', 'NanoSound CD', "No extraction has started");
			}

			if(body["status"] == "DONE")
				self.commandRouter.pushToastMessage('success', 'NanoSound CD', "Extraction completed on " + body["riplastupdate"]);
			
			if(body["status"] == "ABORTED")
				self.commandRouter.pushToastMessage('error', 'NanoSound CD', "Extraction aborted. Please try again.");

			if(body["status"] == "NOTDONE")
			{
				var totalsongs = body["torip"].length
				var found = false
				var message = ""

				for (var i = 1; i <= totalsongs; i++) {
					if(String(i) in body)
					{
						found = true
						var pct = body[String(i)]
						if(pct!=1.0)
						{
							message = "Extracting Track " + String(i) + " - " + Math.round(pct*10000) / 100 + "%. " + String(i) + "/" + String(totalsongs) + " tracks";
						}
							
					} 
				}
				
				if(found)
					self.commandRouter.pushToastMessage('success', 'NanoSound CD',message);
				else
					self.commandRouter.pushToastMessage('success', 'NanoSound CD',"Extraction starting");
				
			}
			


			defer.resolve();

		}
		else
		{
			self.commandRouter.pushToastMessage('error', 'NanoSound CD', "Problem with NanoSound CD progress service");
			defer.resolve();
		}
	})
	return defer.promise;

}

nanosoundCd.prototype.listCD=function()
{
	var defer=libQ.defer();
	var self = this;
	var url = "http://127.0.0.1:5002/cdmeta2";
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {

		if (!error && httpresponse.statusCode === 200) {
			var cdmeta = body

			if(cdmeta.length>0)
			{
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
				defer.resolve(response);

			}
			else
			{
				self.commandRouter.pushToastMessage('error', 'NanoSound CD', 'Cannot detect CD/DVD Drive or no CD in drive');
						
				defer.resolve({});
			}
			
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

}


// Define a method to clear, add, and play an array of tracks
nanosoundCd.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	var defer = libQ.defer();

	if (self.timer) {
        self.timer.clear();
    }
	
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosoundCd::clearAddPlayTrack');
	
	var uriSplitted=track.uri.split('/');
	var trackno = uriSplitted[1];
	//self.commandRouter.logger.info('play:' + trackno);
	var url = "http://127.0.0.1:5002/playtrack?usecachedmeta=True&track=" + trackno;
	request({
	url: url,
	json: true
	}, function (error, httpresponse, body) {
		
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
			
			var timerIntervalSec = self.commandRouter.stateMachine.currentSongDuration - self.config.get('prestart')

			if(timerIntervalSec<=0)
				timerIntervalSec = 0.1

			self.timer = new RPTimer(self.playNextTrack2.bind(self), [vState.position], timerIntervalSec * 1000);
			
    		
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

			var timerIntervalSec = rpState.duration -  body["playprogress"] - self.config.get('prestart')

			if(timerIntervalSec<=0)
				timerIntervalSec = 0.1

			self.timer = new RPTimer(self.playNextTrack2.bind(self), [vState.position], timerIntervalSec * 1000);
			
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
					var talbumart = cachedmeta[i]['album_art'];

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
						//albumart: '/albumart?sourceicon=music_service/nanosound_cd/nanosoundcd_200.png',
						albumart: talbumart,
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
				var talbumart = cachedmeta[trackno -1]['album_art'];

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
					//albumart: '/albumart?sourceicon=music_service/nanosound_cd/nanosoundcd_200.png',
					albumart: talbumart,
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
