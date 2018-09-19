'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new(require('v-conf'))();
var exec = require('child_process').exec;
const SpotifyWebApi = require('spotify-web-api-node');
const SpotConnCtrl = require('./SpotConnController');



// Define the ControllerVolspotconnect class
module.exports = ControllerVolspotconnect;

function ControllerVolspotconnect(context) {

 var self = this;
 // Save a reference to the parent commandRouter
 self.context = context;
 self.commandRouter = self.context.coreCommand;
 // Save a reference fo the parent stateMachine
 // This should normally be a no no. But hey!
 self.stateMachine  = self.context.stateMachine;
 self.logger = self.commandRouter.logger;

 // Setup Debugger
 self.logger.SpConDebug = function(data) {
  self.logger.info('[SpConDebug] ' + data);
 };

 // Volatile for metadata
 self.unsetVol = function() {
  var self = this;
  this.logger.SpConDebug('unSetVolatile called');

	return self.spotConnUnsetVolatile();
 };

 // SpotifyWebApi
 self.spotifyApi = new SpotifyWebApi();
 self.device = undefined;
}

ControllerVolspotconnect.prototype.onVolumioStart = function() {
 var self = this;
 var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
 this.config = new(require('v-conf'))();
 this.config.loadFile(configFile);
self.createVOLSPOTCONNECTFile()
  .then(function(e) {
   defer.resolve({});
  })
  .fail(function(e) {
   defer.reject(new Error());
  })

 return libQ.resolve();
}

ControllerVolspotconnect.prototype.getConfigurationFiles = function() {
 return ['config.json'];
};


ControllerVolspotconnect.prototype.onPlayerNameChanged = function(playerName) {
 var self = this;

 self.onRestart();
};


// Plugin methods -----------------------------------------------------------------------------

ControllerVolspotconnect.prototype.startVolspotconnectDaemon = function() {
 var self = this;
 var defer = libQ.defer();

 exec("/usr/bin/sudo /bin/systemctl start volspotconnect2.service", {
  uid: 1000,
  gid: 1000
 }, function(error, stdout, stderr) {
    if (error !== null) {
   self.logger.SpConDebug('The following error occurred while starting VOLSPOTCONNECT2: ' + error);
   defer.reject();
  } else {
   self.logger.SpConDebug('Volspotconnect2 Daemon Started');
   defer.resolve();
  }
 });

 return defer.promise;

};

//For metadata
ControllerVolspotconnect.prototype.volspotconnectDaemonConnect = function(defer) {
 var self = this;
 self.servicename = 'volspotconnect2';
 self.displayname = 'volspotconnect2';
 self.accessToken = '';
 self.active = false;
 self.deviceActive = false;
 self.SinkActive = false;
 self.state = {
  status: 'stop',
  service: self.servicename,
  title: '',
  artist: '',
  album: '',
  albumart: '/albumart',
  uri: '',
  //icon: 'fa fa-spotify',
  trackType: 'spotify',
  seek: 0,
  duration: 0,
  volume: 0,
  samplerate: '44.1 KHz',
  //samplerate: 'Volspotconnect2',
  bitdepth: '16 bit',
  channels: 2,
  streaming: true,
  //disableUiControls: true
 };

 const nHost = ''; // blank = localhost
 const nPort = 5030;
 self.logger.SpConDebug('Starting metadata listener');
 self.SpotConn = new SpotConnCtrl({
  address: nHost,
  port: nPort
 })

 // Register callbacks from the daemon
 self.SpotConn.on('error', function(err) {
  self.logger.SpConDebug('Error connecting to metadata daemon')
  self.logger.SpConDebug(err);
  // Is this still needed?
  try {
   defer.reject();
  } catch (ecc) {}
 });

 self.SpotConn.on('SessionActive', function(data) {
  // A Spotify Connect session has been initiated
  self.logger.SpConDebug('Connect Session is active!');
  self.volumioStop().then( () => {
    self.state.status = 'pause';
    self.ActiveState();
  });
 });

 self.SpotConn.on('DeviceActive', function(data) {
  // SpotConn is active playback device
  // This is different from SinkActive, it will be triggered at the beginning
  // of a playback session (e.g. Playlist)
  self.logger.SpConDebug('Device is active!');
  self.volumioStop().then( () => {
    self.deviceActive = true;
    self.state.status = 'play';
    self.ActiveState();
    // Don't push state - the SinkActive hook will do that.
  });
 });

 self.SpotConn.on('DeviceInactive', function(data) {
  // Device has finished playing current queue or received a pause command
  self.logger.SpConDebug('Device is inactive!');
  self.DeactivateState();
  self.deviceActive = false;
});

self.SpotConn.on('SinkActive', function(data) {
  // Alsa sink is active
  self.logger.SpConDebug('Sink acquired');
  self.SinkActive = true;
  self.ActiveState();
  self.state.status = 'play';
  self.pushState();
});

self.SpotConn.on('SinkInactive', function(data) {
  // Alsa sink has been closed
  self.logger.SpConDebug('Sink released');
  self.SinkActive = false;
  self.state.status = 'pause';
  //TODO this will reset the seek position :-(
  self.pushState();
});

 self.SpotConn.on('SessionInactive', function(data) {
  // Connect session has been exited
  self.DeactivateState();
	self.logger.SpConDebug('Connect Session is done');
});

self.SpotConn.on('seek', function(position_ms) {
 self.state.seek = position_ms;
 self.pushState();
});

 self.SpotConn.on('metadata', function(meta) {
  // Update metadata
  const albumartId = meta.albumartId[2] === undefined ? meta.albumartId[0] : meta.albumartId[2];
  self.state.uri 	    = "spotify:track:" + meta.track_id;
  self.state.title    = meta.track_name;
  self.state.artist   = meta.artist_name.join(', ');
  self.state.album    = meta.album_name;
  self.state.duration = Math.ceil(meta.duration_ms / 1000);
	self.state.seek     = meta.position_ms;
  self.state.albumart = `https://i.scdn.co/image/${albumartId}`;
	self.logger.SpConDebug(`Pushing metadata::Vollibrespot: ${self.active}`);
  // This will not succeed if volspotconnect2 isn't the current active service
  self.pushState();
 });

 self.SpotConn.on('token', function(token) {
  // Init WebAPI with token
  self.logger.SpConDebug('Token: ' + token.accessToken);
  self.accessToken = token.accessToken;
  self.initWebApi();
 });

 self.SpotConn.on('volume', function(SPvolume) {
  // Listen to volume changes
  const vol = Math.round(SPvolume);
  self.logger.SpConDebug(`Volume: Sp:${SPvolume} Volumio: ${vol}`);
  self.commandRouter.volumioupdatevolume({
    vol: vol,
    mute:false,
  });
 });

 self.SpotConn.on('unknown', function(unknown) {
  self.logger.SpConDebug('Vollibrespot:: ' + unknown);
 });

};

ControllerVolspotconnect.prototype.initWebApi = function() {
  var self = this;
  self.spotifyApi.setAccessToken(self.accessToken);
  self.spotifyApi.getMyDevices()
    .then(function(res){
      const device = res.body.devices.find(function(el) {return el.is_active === true});
      self.commandRouter.sharedVars.get('system.name') == device.name ? self.device = device : self.deviceID = undefined;
    });
}

// State updates
ControllerVolspotconnect.prototype.ActiveState = function() {
 var self = this;
 self.active = true;

 // Vollibrespot is currently Active (Session|device)!
 self.logger.SpConDebug('Vollibrespot Active');
 if (!self.iscurrService()) {
   self.logger.SpConDebug('Setting Volatile state to Volspotconnect2');
   self.context.coreCommand.stateMachine.setConsumeUpdateService(undefined);
   self.context.coreCommand.stateMachine.setVolatile({
     service: self.servicename,
     callback: self.unsetVol.bind(self)
    });
 }
 // Push state with metadata
 self.commandRouter.servicePushState(self.state, self.servicename);

}

ControllerVolspotconnect.prototype.DeactivateState = function() {
 var self = this;
 self.active = false;

 self.device === undefined ? self.logger.SpConDebug("Relinquishing Volumio State") : self.logger.SpConDebug("Relinquishing Volumio state, Spotify session: " + self.device.is_active);
 // Giving up Volumio State
if (self.SinkActive || self.DeviceActive) {
 self.context.coreCommand.stateMachine.unSetVolatile();
 self.context.coreCommand.stateMachine.resetVolumioState().then(
   self.context.coreCommand.volumioStop.bind(self.commandRouter));
 }
}

ControllerVolspotconnect.prototype.spotConnUnsetVolatile = function() {
    var self = this;

    self.device === undefined ? self.logger.SpConDebug("Relinquishing Volumio State to another service") : self.logger.SpConDebug("Relinquishing Volumio state to another service, Spotify session: " + self.device.is_active);
    // TODO: wait for confirmation from the SinkInactive event?
    return self.stop();
}

ControllerVolspotconnect.prototype.pushState = function() {
 var self = this;
 this.logger.SpConDebug(`Pushing new state :: ${self.iscurrService()}`)
 // Push state
 self.commandRouter.servicePushState(self.state, self.servicename);
}

ControllerVolspotconnect.prototype.volumioStop = function() {
    var self = this;
    if (!self.iscurrService()) {
      self.logger.SpConDebug('Stopping currently active service');
      return self.commandRouter.volumioStop();
    }
    return Promise.resolve(true);
}

ControllerVolspotconnect.prototype.iscurrService = function() {
  // Check what is the current Volumio service
  var self = this;
  const currentstate = self.commandRouter.volumioGetState();
  self.logger.SpConDebug(`Currently active:${currentstate.service}`);
  if (currentstate != undefined && currentstate.service != undefined && currentstate.service != self.servicename) {
    return false;
  }
  return true
}

ControllerVolspotconnect.prototype.onStop = function() {
 var self = this;

 self.DeactivateState();
 self.logger.SpConDebug("Killing daemon")
 exec("/usr/bin/sudo /bin/systemctl stop volspotconnect2.service", function(error, stdout, stderr) {
  if (error) {
   self.logger.SpConDebug('Error in killing Voslpotconnect2')
  }
 });
 // Close the metadata pipe:
 self.logger.SpConDebug("Closing metadata listener")
 self.SpotConn.close();

 return libQ.resolve();
};

ControllerVolspotconnect.prototype.onStart = function() {

 var self = this;

 var defer = libQ.defer();

 self.startVolspotconnectDaemon()
  .then(function(e) {
   self.logger.SpConDebug('Volspotconnect2 Started');
   self.volspotconnectDaemonConnect(defer)
   defer.resolve();
  })


/*

 self.createVOLSPOTCONNECTFile()
  .then(function(e) {
   defer.resolve({});
*/

  .fail(function(e) {
   defer.reject(new Error());
  })


 return defer.promise;


};

ControllerVolspotconnect.prototype.onUninstall = function() {
 var self = this;
 self.logger.SpConDebug("Killing daemon");
 exec("/usr/bin/sudo /bin/systemctl stop volspotconnect2.service", {
  uid: 1000,
  gid: 1000
 }, function(error, stdout, stderr) {
  if (error) {
   self.logger.SpConDebug('Error in killing Voslpotconnect2')
  }
 });

 self.SpotConn.close();

 return libQ.resolve();
};

ControllerVolspotconnect.prototype.getUIConfig = function() {
 var defer = libQ.defer();
 var self = this;
 var lang_code = this.commandRouter.sharedVars.get('language_code');

 self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
   __dirname + '/i18n/strings_en.json',
   __dirname + '/UIConfig.json')
  .then(function(uiconf) {
   uiconf.sections[0].content[0].config.bars[0].value = self.config.get('initvol');
   uiconf.sections[0].content[1].value = self.config.get('normalvolume');
   uiconf.sections[0].content[2].value = self.config.get('shareddevice');
   uiconf.sections[0].content[3].value = self.config.get('username');
   uiconf.sections[0].content[4].value = self.config.get('password');

   defer.resolve(uiconf);
  })
  .fail(function() {
   defer.reject(new Error());
  });

 return defer.promise
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


ControllerVolspotconnect.prototype.getAdditionalConf = function(type, controller, data) {
 var self = this;
 return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
};

// Public Methods ---------------------------------------------------------------------------------------

ControllerVolspotconnect.prototype.createVOLSPOTCONNECTFile = function() {
 var self = this;

 var defer = libQ.defer();
setTimeout(function() {
  //FIXME Using a timeout to give any equalizer plugins enough time to change
  //FIXME alsa config - ideally, this should be attached to some event
   try {

  fs.readFile(__dirname + "/volspotconnect2.tmpl", 'utf8', function(err, data) {
   if (err) {
    defer.reject(new Error(err));
    return console.log(err);
   }
   let shared;
   const username = (self.config.get('username'));
   const password = (self.config.get('password'));
   if (self.config.get('shareddevice') === false) {
     shared = `--disable-discovery --username '${username}' --password '${password}'`
   } else shared = "";

   let normalvolume
   if (self.config.get('normalvolume') === false) {
    normalvolume = "";
	} else {
    normalvolume = " --enable-volume-normalisation";
  }

   const devicename = self.commandRouter.sharedVars.get('system.name');
   const outdev   = self.commandRouter.sharedVars.get('alsa.outputdevice');
   const mixname  = self.commandRouter.sharedVars.get('alsa.outputdevicemixer')
   const volcuve  = self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumecurvemode');
   let idxcard,hwdev,mixlin
   if (volcuve === 'logarithmic' ) {
     mixlin = ""
   } else {
     mixlin = "--mixer-linear-volume";
   }

   if (outdev == "softvolume") {
     hwdev = outdev
     mixlin = "--mixer-linear-volume";
   } else {
     hwdev = `plughw:${outdev}`
   }

   if (outdev === 'softvolume' || outdev === 'Loopback') {
     idxcard = self.getAdditionalConf('audio_interface', 'alsa_controller', 'softvolumenumber');
   } else {
     idxcard = outdev
   }

   const mixdev = `hw:${idxcard}`

   let conf = data.replace("${shared}", shared)
                .replace("${normalvolume}", normalvolume)
                .replace("${devicename}", devicename)
                .replace("${outdev}", hwdev)
                .replace("${mixname}",mixname)
                .replace("${mixdev}", mixdev)
                .replace("${mixlin}", mixlin)
                .replace("${initvol}", self.config.get("initvol"));

   fs.writeFile("/data/plugins/music_service/volspotconnect2/startconnect.sh", conf, 'utf8', function(err) {

    if (err)
     defer.reject(new Error(err));
    else defer.resolve();
   });

  });


 } catch (err) {

 }
  }, 10000)
 return defer.promise;

};



ControllerVolspotconnect.prototype.saveVolspotconnectAccount = function(data) {
 var self = this;

 var defer = libQ.defer();

 self.config.set('initvol', data['initvol']);
 self.config.set('normalvolume', data['normalvolume']);
 self.config.set('shareddevice', data['shareddevice']);
 self.config.set('username', data['username']);
 self.config.set('password', data['password']);


 self.rebuildVOLSPOTCONNECTAndRestartDaemon()
  .then(function(e) {
   defer.resolve({});
  })
  .fail(function(e) {
   defer.reject(new Error());
  })


 return defer.promise;

};

ControllerVolspotconnect.prototype.rebuildVOLSPOTCONNECTAndRestartDaemon = function() {
 var self = this;
 var defer = libQ.defer();
// Deactive state
 self.DeactivateState();
 self.createVOLSPOTCONNECTFile()
  .then(function(e) {
   var edefer = libQ.defer();
   exec("/usr/bin/sudo /bin/systemctl restart volspotconnect2.service ", {
    uid: 1000,
    gid: 1000
   }, function(error, stdout, stderr) {
    //              exec("/bin/systemctl restart volspotconnect2.service volspotconnect22.service", function (error, stdout, stderr) {
    edefer.resolve();
   });
   return edefer.promise;
  })
  .then(self.startVolspotconnectDaemon.bind(self))
  .then(function(e) {
   self.commandRouter.pushToastMessage('success', "Configuration update", 'Volumio Spotify Connect has been successfully updated');
   defer.resolve({});
  });

 return defer.promise;
}

// Plugin methods for the Volumio state machine
ControllerVolspotconnect.prototype.stop = function() {
    var self = this;
    self.logger.SpConDebug('Received stop');
    // TODO differentiate b/w pause and stop
    // Try and resolve the promise, else bluntly kill the daemon?
    return self.spotifyApi.pause()
      .then((res) => {
        console.log("spotifyApi::Pause complete", res)
        })
      .catch((error) => {
        self.commandRouter.pushToastMessage('error', "Spotify API Error", error.message);
        self.logger.SpConDebug(error)
    });
}

ControllerVolspotconnect.prototype.pause = function() {
    var self = this;
    self.logger.SpConDebug('Received pause');

    return self.spotifyApi.pause().catch((error) => {
      self.commandRouter.pushToastMessage('error', "Spotify API Error", error.message);
      self.logger.SpConDebug(error)
    });
}

ControllerVolspotconnect.prototype.play = function() {
    var self = this;
    self.logger.SpConDebug('Received play');
    return self.spotifyApi.play().catch((error) => {
      self.commandRouter.pushToastMessage('error', "Spotify API Error", error.message);
      self.logger.SpConDebug(error)
    });
}

ControllerVolspotconnect.prototype.next = function() {
    var self = this;
    self.logger.SpConDebug('Received next');
    return self.spotifyApi.skipToNext().catch((error) => {
      self.commandRouter.pushToastMessage('error', "Spotify API Error", error.message);
      self.logger.SpConDebug(error)
    });
}

ControllerVolspotconnect.prototype.previous = function() {
    var self = this;
    self.logger.SpConDebug('Received previous');
    return self.spotifyApi.skipToPrevious().catch((error) => {
      self.commandRouter.pushToastMessage('error', "Spotify API Error", error.message);
      self.logger.SpConDebug(error)
    });
}

ControllerVolspotconnect.prototype.seek = function(position) {
    var self = this;
    self.logger.SpConDebug('Received seek to: ' + position);
    return self.spotifyApi.seek(position).catch((error) => {
      self.commandRouter.pushToastMessage('error', "Spotify API Error", error.message);
      self.logger.SpConDebug(error)
    });
}
