'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var Gpio = require('onoff').Gpio;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var actions = ["playPause", "volumeUp", "volumeDown", "previous", "next", "shutdown"];
var pins = [13,10,9,11,12,4]

module.exports = nanosound;
function nanosound(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
	this.logger.info("Starting NanoSound Plug-in");
	self.triggers = [];
}

nanosound.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
    var confs = self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
    return confs;
};

nanosound.prototype.onVolumioStart = function()
{
	var self = this;
	this.logger.info("1");

	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.logger.info("2");

	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
	this.logger.info("Starting NanoSound Start");
    	return libQ.resolve();
}

nanosound.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

 	var device = self.getAdditionalConf("system_controller", "system", "device");
 	if (device == "Raspberry PI") {
 	    self.enablePIOverlay();
	}

	//-------------- START OF LIRC SETUP --------------------
	//setup LIRC hardware.conf
	self.createHardwareConf(device);

	//setup lirc config files
	self.commandRouter.pushToastMessage('info', "NanoSound", "Plug in starting");	
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

	self.restartLirc(true);

	//---------------- End of LIRC setup -------------------


	//---------------- Start of GPIO setup -----------------


	self.createTriggers();


	//-----------------------------------------------------




	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

nanosound.prototype.createTriggers = function() {
	var self = this;

	self.logger.info('NanoSound - Creating button triggers');

	actions.forEach(function(action, index, array) {
		
		var pin = pins[index];		
		
		self.logger.info(action + ' on pin ' + pin);
		var j = new Gpio(pin,'in','both');
		j.watch(self.listener.bind(self,action));
		self.triggers.push(j);
		
	});
		
	return libQ.resolve();
};

nanosound.prototype.listener = function(action,err,value){
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


//Play / Pause
nanosound.prototype.playPause = function() {
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
nanosound.prototype.next = function() {
  //this.logger.info('GPIO-Buttons: next-button pressed');
  socket.emit('next')
};

//previous on playlist
nanosound.prototype.previous = function() {
  //this.logger.info('GPIO-Buttons: previous-button pressed');
  socket.emit('prev')
};

//Volume up
nanosound.prototype.volumeUp = function() {
  //this.logger.info('GPIO-Buttons: Vol+ button pressed');
  socket.emit('volume','+');
};

//Volume down
nanosound.prototype.volumeDown = function() {
  //this.logger.info('GPIO-Buttons: Vol- button pressed\n');
  socket.emit('volume','-');
};

//shutdown
nanosound.prototype.shutdown = function() {
  // this.logger.info('GPIO-Buttons: shutdown button pressed\n');
  this.commandRouter.shutdown();
};


nanosound.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    exec('usr/bin/sudo /bin/systemctl stop lirc.service', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error stopping LIRC: '+error);
            } else {
                self.logger.info('lirc correctly stopped');
                defer.resolve();
            }
        });

    return defer.promise;
};

nanosound.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

nanosound.prototype.getUIConfig = function() {
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


nanosound.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

nanosound.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

nanosound.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


nanosound.prototype.addToBrowseSources = function () {

	// Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

nanosound.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;


    return response;
};



// Define a method to clear, add, and play an array of tracks
nanosound.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

nanosound.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
nanosound.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::stop');


};

// Spop pause
nanosound.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::pause');


};

// Get state
nanosound.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::getState');


};

//Parse state
nanosound.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
nanosound.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'nanosound::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


nanosound.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI

	return defer.promise;
};

nanosound.prototype.getAlbumArt = function (data, path) {

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





nanosound.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

nanosound.prototype._searchArtists = function (results) {

};

nanosound.prototype._searchAlbums = function (results) {

};

nanosound.prototype._searchPlaylists = function (results) {


};

nanosound.prototype._searchTracks = function (results) {

};

nanosound.prototype.createHardwareConf = function(device){
	var self = this;

    exec('/usr/bin/sudo /bin/chmod 777 /etc/lirc/hardware.conf', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error setting hardware conf file perms: '+error);
            } else {
                self.logger.info('Hardware permissions set');
            }
        });

	try{
        fs.readFile(__dirname + "/hardware.conf.tmpl", 'utf8', function (err, data) {
            if (err) {
                return self.logger.error(err);
            }

            var conf;
            conf = data;

            fs.writeFile("/etc/lirc/hardware.conf", conf, 'utf8', function (err) {
                if (err) return self.logger.error(err);
            });
        });
	}
	catch (err){
		callback(err);
	}
}

nanosound.prototype.restartLirc = function (message) {
	var self = this;

    exec('usr/bin/sudo /bin/systemctl stop lirc.service', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Cannot kill irexec: '+error);
            }
            setTimeout(function(){

	exec('usr/bin/sudo /bin/systemctl start lirc.service', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error restarting LIRC: '+error);
                if (message){
                    self.commandRouter.pushToastMessage('error', 'NanoSound', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_ERROR'));
                }
            } else {
                self.logger.info('lirc correctly started');
                if (message){
                    self.commandRouter.pushToastMessage('success', 'NanoSound', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_DESCRIPTION'));
                }
            }
        });
            },1000)
    });
}



nanosound.prototype.enablePIOverlay = function() {
    var defer = libQ.defer();
    var self = this;

    exec('/usr/bin/sudo /usr/bin/dtoverlay lirc-rpi gpio_in_pin=17', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error enabling lirc-rpi overlay: '+error);
                defer.reject();
            } else {
                self.logger.info('lirc-rpi overlay enabled');
                defer.resolve();
            }
        });

    return defer.promise;
};
