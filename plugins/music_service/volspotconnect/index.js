'use strict';

var libQ = require('kew');
var libNet = require('net');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
 var execSync = require('child_process').execSync;

const SpotConnCtrl = require('./SpotConnController');
var routn = {};
// Define the ControllerVolspotconnect class
module.exports = ControllerVolspotconnect;

function ControllerVolspotconnect(context) {

	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

	// Setup Debugger
	self.logger.VolSpotCon = function(data) {
		self.logger.info('[Volspotconnect] ' + data);
	};

	//
	self.unsetVol = function () {
	    var self = this;
	};

}



ControllerVolspotconnect.prototype.onVolumioStart = function()
{
	var self= this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile)
//self.getoutputdevicenumberfromfile();
	    		self.createVOLSPOTCONNECTFile();
	return libQ.resolve();
}

ControllerVolspotconnect.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};
ControllerVolspotconnect.prototype.onPlayerNameChanged = function (playerName) {
	var self = this;

	self.onRestart();
};



// Plugin methods -----------------------------------------------------------------------------

ControllerVolspotconnect.prototype.startVolspotconnectDaemon = function() {
	var self = this;
	var defer=libQ.defer();

		exec("/usr/bin/sudo /bin/systemctl start volspotconnect.service", {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while starting VOLSPOTCONNECT: ' + error);
            defer.reject();
		}
		else {
			self.commandRouter.pushConsoleMessage('Volspotconnect Daemon Started');
            defer.resolve();
		}
	});

		return defer.promise;
};


ControllerVolspotconnect.prototype.onStop = function() {
	var self = this;

	self.logger.info("Killing Spotify-connect-web daemon");
		exec("/usr/bin/sudo /bin/systemctl stop volspotconnect.service", {uid:1000,gid:1000}, function (error, stdout, stderr) {
	if(error){
	self.logger.info('Error in killing Voslpotconnect')
	}
	});

   return libQ.resolve();
};

ControllerVolspotconnect.prototype.onStart = function() {
    var self = this;

    var defer=libQ.defer();

  self.startVolspotconnectDaemon()
        .then(function(e)
        {
					self.volspotconnectDaemonConnect(defer)
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        });

	this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.rebuildVOLSPOTCONNECTAndRestartDaemon.bind(this));
	this.commandRouter.sharedVars.registerCallback('alsa.outputdevicemixer', this.rebuildVOLSPOTCONNECTAndRestartDaemon.bind(this));
	this.commandRouter.sharedVars.registerCallback('system.name', this.rebuildVOLSPOTCONNECTAndRestartDaemon.bind(this));
	this.commandRouter.sharedVars.registerCallback('alsa.device', this.rebuildVOLSPOTCONNECTAndRestartDaemon.bind(this));


    return defer.promise;
};

//For metadata
ControllerVolspotconnect.prototype.volspotconnectDaemonConnect = function(defer) {
 	var self = this;
 	var rate
 	self.servicename = 'Volspotconnect';
 	self.displayname = 'Volspotconnect';
		if(self.config.get('bitrate')===true)
                    rate="HQ";
		else rate="SQ";
	self.state = {
        status: 'stop',
        service: self.servicename,
        title: '',
        artist: '',
        album: '',
        albumart: '/albumart',
        uri: '',
        trackType: self.servicename,
        seek: 0,
        duration: 0,
        samplerate: "Spotify",
        bitdepth: rate,
        channels: 2
	};
	const nHost = ''; // blank = localhost
	const nPort = 5000;

	self.SpotConn = new SpotConnCtrl({ address: nHost, port: nPort })

	// Register callbacks from the daemon
	self.SpotConn.on('error', function(err) {
		self.logger.VolSpotCon('Error connecting to daemon')
		self.logger.info(err);
		// Is this still needed?
		try {
			defer.reject();
		} catch (ecc) {}
	});

	self.SpotConn.on('SActive',function(data){
		self.logger.VolSpotCon('Session is active!')
	});

	self.SpotConn.on('DActive',function(data){
		// SpotConn is active playback device
		self.state.status = 'play';

		self.ActivedState();
	});

	self.SpotConn.on('DInactive',function(data){
		self.DeactivatedState();
	})

	self.SpotConn.on('SInactive',function(data){
		self.DeactivatedState();
	})

	// Update metadata
	self.SpotConn.on('metadata',function(meta){
		self.state.uri       = meta.track_uri;
		self.state.title  	 = meta.track_name;
		self.state.artist 	 = meta.artist_name;
		self.state.album  	 = meta.album_name;
		self.state.duration  = ((meta.duration)/1000).toFixed(0);
		self.state.volume    = meta.volume;
		self.state.albumart  = meta.albumart;

		self.pushState();
	});

};

// State updates
ControllerVolspotconnect.prototype.ActivedState = function() {
	var self = this;
	// Session is active, lets tell Volumio!
	self.logger.VolSpotCon('SpotConn is playing')
	self.context.coreCommand.volumioStop();
	self.context.coreCommand.stateMachine.setConsumeUpdateService(undefined);

	// Push state with metadata
	self.commandRouter.servicePushState(self.state, self.servicename);

	self.context.coreCommand.stateMachine.setVolatile({
					 service:  self.servicename,
					 callback: self.unsetVol.bind(self)
				 });

}

ControllerVolspotconnect.prototype.DeactivatedState = function(){
	var self = this;
	// Session is done, update state
	self.logger.VolSpotCon('SpotConn is done!')
	self.context.coreCommand.stateMachine.unSetVolatile();
	self.context.coreCommand.stateMachine.resetVolumioState().then(
	self.context.coreCommand.volumioStop.bind(self.commandRouter));
}

ControllerVolspotconnect.prototype.pushState = function() {
	var self = this;

	// Push state
	self.commandRouter.servicePushState(self.state, self.servicename);
}


// Volspotconnect stop
ControllerVolspotconnect.prototype.stop = function() {
	var self = this;


    self.logger.info("Killing Spotify-connect-web daemon");
	exec("/usr/bin/sudo /bin/systemctl stop volspotconnect.service", {uid:1000,gid:1000}, function (error, stdout, stderr) {
	if(error){
self.logger.info('Error in killing Voslpotconnect')
	}
	});

   return libQ.resolve();
};


ControllerVolspotconnect.prototype.onRestart = function() {
	var self = this;
	//
};

ControllerVolspotconnect.prototype.onInstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolspotconnect.prototype.onUninstall = function() {
	var self = this;
   self.logger.info("Killing Spotify-connect-web daemon");
	exec("/usr/bin/sudo /bin/systemctl stop volspotconnect.service", {uid:1000,gid:1000}, function (error, stdout, stderr) {
	if(error){
self.logger.info('Error in killing Voslpotconnect')
	}
	});

   return libQ.resolve();
};

ControllerVolspotconnect.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;
	var lang_code = this.commandRouter.sharedVars.get('language_code');

        self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
                __dirname+'/i18n/strings_en.json',
                __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {

uiconf.sections[0].content[0].value = self.config.get('username');
uiconf.sections[0].content[1].value = self.config.get('password');
uiconf.sections[0].content[2].value = self.config.get('bitrate');
uiconf.sections[0].content[3].value = self.config.get('familyshare');
            defer.resolve(uiconf);
            })
                .fail(function()
            {
                defer.reject(new Error());
        });

        return defer.promise;
};

ControllerVolspotconnect.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolspotconnect.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolspotconnect.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolspotconnect.prototype.getAdditionalConf = function (type, controller, data) {
	var self = this;
	return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
};

// Public Methods ---------------------------------------------------------------------------------------
/*
ControllerVolspotconnect.prototype.getoutputdevicenumberfromfile = function(file, data, err,mindex) {
  var self = this;
  var defer = libQ.defer();
	var outputdevicen
 fs.readFile('/tmp/vconfig.json', 'utf8', function(err, data) {
    if (!err) {

		var obj = JSON.parse(data);
		var outputdevicen = obj.outputdevice;

		var outn = JSON.stringify(outputdevicen);
		var outdn = outn.split('"')

		var routn = (outdn[7])
   console.log(routn +'wwwwwwwwwwwwwwwwwwwwwwwwwww'); 

    } else {
        console.log(err)
    }
 
}
 );
};
*/

ControllerVolspotconnect.prototype.createVOLSPOTCONNECTFile = function () {
    var self = this;

    var defer=libQ.defer();


    try {

        fs.readFile(__dirname + "/volspotconnect.tmpl", 'utf8', function (err, data) {
            if (err) {
                defer.reject(new Error(err));
                return console.log(err);
            }
			var rate;
                if(self.config.get('bitrate')===true)
                    rate="320";
		else rate="90"
			var family;
		if(self.config.get('familyshare')===true)
		    family=""
		else family="#"

			var outdev = self.commandRouter.sharedVars.get('alsa.outputdevice');
			//var mixloop = self.commandRouter.sharedVars.get('device');
			var smixer;
			var mixer;
			var slindex;
			var mindex;
			routn ='';
			var OutputDeviceNumber;
			var smixer = self.commandRouter.sharedVars.get('alsa.outputdevicemixer')
				if (smixer == "None") {
					mixer = ""
				}else if (smixer =="undefined") {
					mixer = ""
				}else if (smixer =="") {
					mixer = ""
				}else { mixer = "--mixer " + "'"+ smixer +"'";
				}
			var smindex = self.commandRouter.sharedVars.get('alsa.outputdevice');
				if (smixer == "SoftMaster") {
					var smindex = self.getAdditionalConf('audio_interface', 'alsa_controller', 'softvolumenumber');
					mindex = "--mixer_device_index " + smindex ;
				}else if (outdev == "Loopback") {
					var datan = fs.readFileSync('/tmp/vconfig.json', 'utf8', function(err, data) {
    						if (!err) {
						 } else {
      						  console.log(err)
   						 }
 						 	console.log(routn +' <---aaaaaaaaaaaaaaaaaaaazzz') 
						})
							var obj = JSON.parse(datan);
							var outputdevicen = obj.outputdevice;
							var outn = JSON.stringify(outputdevicen);		
							var outdn = outn.split('"')
							routn = (outdn[7])
					mindex = ("--mixer_device_index " + routn)
 				}else if (smixer == "None") {
					mindex = ""
				}else if (smixer == "undefined") {
					mindex = ""
				}else if (smixer == "") {
					mindex = ""
				}else { mindex = "--mixer_device_index " + smindex;
				}
			var devicename = self.commandRouter.sharedVars.get('system.name');
			var hwdev ='plughw:' + outdev;
				if (outdev == "softvolume") {
					hwdev = "softvolume"
					}
		//	var hwdev = outdev;
			var  bitrate = self.config.get('bitrate');
			var bitratevalue = 'true';
			if (bitrate == false ) {
				bitratevalue = 'false';
			}

		var conf1 = data.replace("${username}", self.config.get('username'));
		var conf2 = conf1.replace("${password}", self.config.get('password'));
		var conf3 = conf2.replace("${rate}", rate);
		var conf4 = conf3.replace("${devicename}",devicename);
		var conf5 = conf4.replace("${outdev}", 'spotout');
		var conf6 = conf5.replace("${mixer}", mixer);
		var conf7 = conf6.replace("${mixind}", mindex);
		var conf8 = conf7.replace("${familyshare}", family);
		var conf9 = conf8.replace("${devicename}",devicename);

	            fs.writeFile("/data/plugins/music_service/volspotconnect/spotify-connect-web/startconnect.sh", conf9, 'utf8', function (err) {
                if (err)
                    defer.reject(new Error(err));
                else defer.resolve();
            });

        });


    }
    catch (err) {


    }

    return defer.promise;

};

 ControllerVolspotconnect.prototype.createASOUNDrcFile = function() {
  var self = this;

  var defer = libQ.defer();

  try {

   fs.readFile(__dirname + "/asound.tmpl", 'utf8', function(err, data) {
    if (err) {
     defer.reject(new Error(err));
     return console.log(err);
    }
    var outdev = self.commandRouter.sharedVars.get('alsa.outputdevice');
    var conf1 = data.replace("${hwout}", ("hw:"+outdev));
console.log("zzzzzzzzzzzzzzzzzzz---"+ ("hw:"+outdev));

    fs.writeFile("/home/volumio/asoundrc", conf1, 'utf8', function(err) {
     if (err) {
      defer.reject(new Error(err));
      self.logger.info('Cannot write /etc/asound.conf: '+err)
     } else {
//try {
      self.logger.info('asound.conf file written');
/*      var mv = execSync('/usr/bin/sudo /bin/mv /home/volumio/asoundrc /etc/asound.conf', {

       uid: 1000,
       gid: 1000,
       encoding: 'utf8'
      });
*/
 fs.copy('/home/volumio/asoundrc', '/etc/asound.conf', 'utf8', function (err) {
            if (err) return console.error(err);
            console.log("copied with success")
               })
      var apply = execSync('/usr/sbin/alsactl -L -R nrestore', {
       uid: 1000,
       gid: 1000,
       encoding: 'utf8'
      });
      defer.resolve();
     
//} catch (err) {}
  
}  });

   });
  } catch (err) {}
setTimeout(function() {
  return defer.promise;
  }, 2000);
 };

ControllerVolspotconnect.prototype.createASOUNDFile = function () {
    var self = this;
    var outdev = self.commandRouter.sharedVars.get('alsa.outputdevice');
    var defer = libQ.defer();
    if (outdev = 'softvolume') {
    console.log(outdev)
        fs.copy('/etc/asound.conf', '/data/plugins/music_service/volspotconnect/spotify-connect-web/etc/asound.conf', 'utf8', function (err) {
            if (err) return console.error(err);
            console.log("copied with success")
               })
           };

};


ControllerVolspotconnect.prototype.saveVolspotconnectAccount = function (data) {
    var self = this;

    var defer = libQ.defer();

	self.config.set('username', data['username']);
	self.config.set('password', data['password']);
	self.config.set('bitrate', data['bitrate']);
	self.config.set('familyshare', data['familyshare']);
	self.rebuildVOLSPOTCONNECTAndRestartDaemon()
        .then(function(e){
        //    self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration of Volspotconnect has been successfully updated');
            defer.resolve({});
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        })


    return defer.promise;

};

ControllerVolspotconnect.prototype.rebuildVOLSPOTCONNECTAndRestartDaemon = function () {
    var self=this;
    var defer=libQ.defer();
self.createASOUNDrcFile()
   self.createASOUNDFile()
//console.log('toto')
    self.createVOLSPOTCONNECTFile()
        .then(function(e)
        {
            var edefer=libQ.defer();
            exec("/usr/bin/sudo /bin/systemctl restart volspotconnect.service",{uid:1000,gid:1000}, function (error, stdout, stderr) {
                edefer.resolve();
            });
            return edefer.promise;
        })
        .then(self.startVolspotconnectDaemon.bind(self))
        .then(function(e)
        {
        self.commandRouter.pushToastMessage('success','config Ok');

   defer.resolve({});
        });

    return defer.promise;
}
/*
ControllerVolspotconnect.prototype.getAdditionalConf = function(type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
 }
*/
