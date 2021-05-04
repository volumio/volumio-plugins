'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

module.exports = nanosoundone;
function nanosoundone(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
	this.logger.info("Starting NanoSound One Plug-in");
	self.triggers = [];
}

nanosoundone.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
    var confs = self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
    return confs;
};

nanosoundone.prototype.onVolumioStart = function()
{
	var self = this;
	
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
	this.logger.info("Starting NanoSound One");
    	return libQ.resolve();
}

nanosoundone.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

nanosoundone.prototype.saveConfig = function(data) {
	var self = this;
    var defer = libQ.defer();
	self.logger.debug(data['oledDisplay']);
	self.config.set('model', data['model'].value);
	
	//defer.resolve();
	self.commandRouter.pushToastMessage('success', "Saved", "NanoSound One settings saved.");
	//self.clearTriggers()
	//self.createTriggers();
	

	
    
    return defer.promise;
}

nanosoundone.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

 	var device = self.getAdditionalConf("system_controller", "system", "device");
 	

	//-------------- START OF LIRC SETUP --------------------
	//setup LIRC hardware.conf
	//Now setup by install.sh
	//self.createHardwareConf(device);

	//setup lirc config files
	self.commandRouter.pushToastMessage('info', "NanoSound One", "Plug in starting");	
	/*
	exec('/usr/bin/sudo /bin/chmod -R 777 /etc/lirc/*', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error setting lirc conf file perms: '+error);
            } else {
                self.logger.info('lirc permissions set');
                exec('/bin/cp -r ' + __dirname +'/configurations/* /etc/lirc/', {uid:1000,gid:1000},
                    function (error, stdout, stderr) {
                        if(error != null) {
                            self.logger.info('Error copying configurations: '+error);
                            self.commandRouter.pushToastMessage('error', 'NanoSound', self.commandRouter.getI18nString('COMMON.SETTINGS_SAVE_ERROR'));
                        } else {
                            self.logger.info('lirc correctly updated');
                            self.commandRouter.pushToastMessage('success', 'NanoSound', self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
                            setTimeout(function(){
                                //if (data.ir_profile.notify == undefined){
                                //    self.restartLirc(true);
                                //}

                            },1000)

                        }
                    });

            }
        });
	*/

	
	//---------------- End of LIRC setup -------------------
	self.restartNSLirc(true);
	
	//---------------- Start of GPIO setup -----------------


	//self.createTriggers();


	//-----------------------------------------------------

	//---------------- Set up OLED ---------------
	
                        	

                       

										 exec('/usr/bin/sudo /bin/systemctl start nanosound_lirc', {uid:1000,gid:1000},
		                                                                    function (error, stdout, stderr) {
                		                                                        if(error != null) {
                                		                                                self.logger.info('Error starting NanoSound Infrared' + error);
																						self.commandRouter.pushToastMessage('error', 'NanoSound One', 'Problem with starting NanoSound Infrared:' + error);
																						defer.reject();
                                                                		        } else {
                                                                                		self.logger.info('NanoSound Infrared started');
                                                                               			self.commandRouter.pushToastMessage('success', 'NanoSound One', 'NanoSound Infrared daemon started');
																						defer.resolve();

		                                                                        }
																				

                		                  });




                          

	


	// Once the Plugin has successfull started resolve the promise
	
    return defer.promise;
};

/*
nanosoundone.prototype.clearTriggers = function () {
	var self = this;
	
	self.triggers.forEach(function(trigger, index, array) {
  		self.logger.info("NanoSound remove trigger " + index);

		trigger.unwatchAll();
		trigger.unexport();		
	});
	
	self.triggers = [];

	return libQ.resolve();	
};*/

/*
nanosoundone.prototype.createTriggers = function() {
	var self = this;

	self.logger.info('NanoSound - Creating button triggers');


	var model = self.config.get("model");
	var actions = [];
	var pins = []

	self.logger.info('NanoSound - Creating button triggers for ' + model);

	if(model=="PiSwitchCap")
	{
		return libQ.resolve();
	}
	else if(model=="DAC2")
	{
		actions = ["playPause", "previous", "next", "shutdown"];
		pins = [16,12,5,4]
	}
	else
	{	//DAC, ProdBoard
		actions = ["playPause", "volumeUp", "volumeDown", "previous", "next", "shutdown"];
		pins = [13,10,9,11,12,4]
	}
	
	actions.forEach(function(action, index, array) {
		
		var pin = pins[index];		
		
		self.logger.info(action + ' on pin ' + pin);
		var j = new Gpio(pin,'in','both',{debounceTimeout: 20});
		j.watch(self.listener.bind(self,action));
		self.triggers.push(j);
		
	});
		
	return libQ.resolve();
};
*/

nanosoundone.prototype.listener = function(action,err,value){
	var self = this;

	var c3 = action.concat('.value');
	var lastvalue = self.config.get(c3);

	// IF change AND high (or low?)
	if(value !== lastvalue && value === 1){
		//do thing
		self[action]();
	}
	// remember value
	self.config.set(c3,value);
};


/*
//Play / Pause
nanosoundone.prototype.playPause = function() {
  //this.logger.info('Play/pause button pressed');
  socket.emit('getState','');
  socket.once('pushState', function (state) {
    if(state.status=='play' && state.service=='webradio'){
      socket.emit('stop');
    } else if(state.status=='play'){
      socket.emit('pause');
    } else {
      socket.emit('play');
    }
  });
};

//next on playlist
nanosoundone.prototype.next = function() {
  //this.logger.info('GPIO-Buttons: next-button pressed');
  socket.emit('next')
};

//previous on playlist
nanosoundone.prototype.previous = function() {
  //this.logger.info('GPIO-Buttons: previous-button pressed');
  socket.emit('prev')
};

//Volume up
nanosoundone.prototype.volumeUp = function() {
  //this.logger.info('GPIO-Buttons: Vol+ button pressed');
  socket.emit('volume','+');
};

//Volume down
nanosoundone.prototype.volumeDown = function() {
  //this.logger.info('GPIO-Buttons: Vol- button pressed\n');
  socket.emit('volume','-');
};

//shutdown
nanosoundone.prototype.shutdown = function() {
  // this.logger.info('GPIO-Buttons: shutdown button pressed\n');
  this.commandRouter.shutdown();
};*/


nanosoundone.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();
	

					exec('/usr/bin/sudo /bin/systemctl stop nanosound_lirc.service', {uid:1000,gid:1000},
						function (error, stdout, stderr) {
							if(error != null) {
								self.logger.info('Cannot stop NanoSound Infrared service: '+error);
								defer.reject();
							} else {
								self.logger.info('NanoSound Infrared stopped');
								defer.resolve();
							}
							
						});

    return defer.promise;
};

nanosoundone.prototype.onRestart = function() {
    var self = this;
	// Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

nanosoundone.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;
	
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	
	self.config = new (require('v-conf'))();
	self.config.loadFile(configFile);

    var lang_code = this.commandRouter.sharedVars.get('language_code');

	self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
			
					

			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', self.config.get('model'));
			
			var modellabel=""
			if(self.config.get('model')=="NANOSOUNDONE")
				modellabel="NANOSOUNDONE"
			
			self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label', modellabel);
			
			
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};



nanosoundone.prototype.setUIConfig = function(data) {
	var self = this;

	return libQ.resolve();
};

nanosoundone.prototype.getConf = function(varName) {
	var self = this;


	return libQ.resolve();
};

nanosoundone.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
	return libQ.resolve();
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


nanosoundone.prototype.addToBrowseSources = function () {

	// Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

nanosoundone.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;


    return response;
};



// Define a method to clear, add, and play an array of tracks
nanosoundone.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

nanosoundone.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
nanosoundone.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::stop');


};

// Spop pause
nanosoundone.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::pause');


};

// Get state
nanosoundone.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::getState');


};

//Parse state
nanosoundone.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
nanosoundone.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


nanosoundone.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI

	return defer.promise;
};

nanosoundone.prototype.getAlbumArt = function (data, path) {

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





nanosoundone.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

nanosoundone.prototype._searchArtists = function (results) {

};

nanosoundone.prototype._searchAlbums = function (results) {

};

nanosoundone.prototype._searchPlaylists = function (results) {


};

nanosoundone.prototype._searchTracks = function (results) {

};


nanosoundone.prototype.restartNSLirc = function (message) {
	var self = this;

    exec('/usr/bin/sudo /bin/systemctl stop nanosound_lirc', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Cannot kill irexec: '+error);
            }
            setTimeout(function(){

	exec('/usr/bin/sudo /bin/systemctl start nanosound_lirc', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error restarting NanoSound Infrared: '+error);
                if (message){
                    self.commandRouter.pushToastMessage('error', 'Nanosound One', "NanoSound One Infrared cannot start");
                }
            } else {
                self.logger.info('NanoSound lirc correctly started');
                if (message){
                    self.commandRouter.pushToastMessage('success', 'Nanosound One', "NanoSound One Infrared started");
                }
            }
        });
            },1000)
    });
}


