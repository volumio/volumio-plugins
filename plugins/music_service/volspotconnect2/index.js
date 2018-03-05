'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new(require('v-conf'))();
var exec = require('child_process').exec;
const SpotifyWebApi = require('spotify-web-api-node'),
	AuthenticationRequest = require('./node_modules/spotify-web-api-node/src/authentication-request'),
	WebApiRequest = require('./node_modules/spotify-web-api-node/src/webapi-request'),
	HttpManager = require('./node_modules/spotify-web-api-node/src/http-manager');
const SpotConnCtrl = require('./SpotConnController');

//  Workaround for seek until
// https://github.com/thelinmichael/spotify-web-api-node/pull/156 is merged
SpotifyWebApi.prototype["seek"] = function(position, callback) {
    const request = WebApiRequest.builder()
        .withPath('/v1/me/player/seek')
        .withHeaders({ 'Content-Type' : 'application/json' })
        .withQueryParameters({
            'position_ms': Math.floor(position)
        })
        .build();

    this._addAccessToken(request, this.getAccessToken());

    const promise = this._performRequest(HttpManager.put, request);

    if (callback) {
        return promise.then((data) => {
            callback(null, data);
        }, (err) => {
            callback(err);
        });
    }

    return promise;
};

// Define the ControllerVolspotconnect class
module.exports = ControllerVolspotconnect;

function ControllerVolspotconnect(context) {

 var self = this;
 // Save a reference to the parent commandRouter
 self.context = context;
 self.commandRouter = self.context.coreCommand;
 self.logger = self.commandRouter.logger;

 // Setup Debugger
 self.logger.SpConDebug = function(data) {
  self.logger.info('[SpConDebug] ' + data);
 };

 // Volatile for metadata
 self.unsetVol = function() {
  //TODO This function should be refactored: it should stop volspotconnect
  var self = this;
  // Release the sink
  // self.spotifyApi.pause();
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
  //		exec("/bin/systemctl start volspotconnect2.service volspotconnect22.service volspotconnect2purgecache.timer", function (error, stdout, stderr) {
  if (error !== null) {
   self.logger.info('The following error occurred while starting VOLSPOTCONNECT2: ' + error);
   defer.reject();
  } else {
   self.logger.info('Volspotconnect2 Daemon Started');
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
 self.token = '';
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
  //samplerate: 'Volspotconnect2',
  //bitdepth: 'HQ',
  channels: 2,
  Streaming: true,
 };

 const nHost = ''; // blank = localhost
 const nPort = 5030;

 self.SpotConn = new SpotConnCtrl({
  address: nHost,
  port: nPort
 })

 // Register callbacks from the daemon
 self.SpotConn.on('error', function(err) {
  self.logger.SpConDebug('Error connecting to metadata daemon')
  self.logger.info(err);
  // Is this still needed?
  try {
   defer.reject();
  } catch (ecc) {}
 });

 self.SpotConn.on('SActive', function(data) {
  self.logger.SpConDebug('Session is active!')
 });

 self.SpotConn.on('DActive', function(data) {
  // SpotConn is active playback device
  self.state.status = 'play';

  self.ActivedState();
 });

 self.SpotConn.on('DInactive', function(data) {
  self.DeactivatedState();
});

 self.SpotConn.on('SInactive', function(data) {
  self.DeactivatedState();
});

 // Update metadata
 self.SpotConn.on('metadata', function(meta) {
  self.state.uri 	  = "spotify:track:" + meta.track_id;
  self.state.title  = meta.track_name;
  self.state.artist = meta.artist_name;
  self.state.album  = meta.album_name;
  self.state.duration = Math.ceil(meta.duration / 1000);
	self.state.seek    = meta.pos;
  // self.state.volume    = meta.volume;
  self.state.albumart = "https://i.scdn.co/image/" + meta.albumartId_LARGE;

  self.pushState();
 });

 // Grab a token
 self.SpotConn.on('token', function(token) {
  self.logger.SpConDebug('Token: ' + token.accessToken);
  self.accessToken = token.accessToken;
  self.initWebApi();
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
ControllerVolspotconnect.prototype.ActivedState = function() {
 var self = this;
 // Session is active, lets tell Volumio!
 self.logger.SpConDebug('SpotConn is playing')
 self.context.coreCommand.volumioStop();
 self.context.coreCommand.stateMachine.setConsumeUpdateService(undefined);

 self.context.coreCommand.stateMachine.setVolatile({
  service: self.servicename,
  callback: self.unsetVol.bind(self)
 });

 // Push state with metadata
 self.commandRouter.servicePushState(self.state, self.servicename);

}

ControllerVolspotconnect.prototype.DeactivatedState = function() {
 var self = this;
 self.device === undefined ? self.logger.SpConDebug("Killing Volumio State") : self.logger.SpConDebug("Killing Volumio state, Spotify session: " + self.device.is_active);
 // TODO Distinguish b/s session and device being active - this needs some
 // proper even hooks from librespot

 // Session is done, update state
 self.logger.SpConDebug('SpotConn is done!')
 self.context.coreCommand.stateMachine.unSetVolatile();
 self.context.coreCommand.stateMachine.resetVolumioState().then(
  self.context.coreCommand.volumioStop.bind(self.commandRouter));
}

ControllerVolspotconnect.prototype.pushState = function() {
 var self = this;

 // Push state
 self.commandRouter.servicePushState(self.state, self.servicename);
}


ControllerVolspotconnect.prototype.onStop = function() {
 var self = this;

 self.DeactivatedState();
 self.logger.info("Killing daemon")
 exec("/usr/bin/sudo /bin/systemctl stop volspotconnect2.service", function(error, stdout, stderr) {
  if (error) {
   self.logger.info('Error in killing Voslpotconnect2')
  }
 });

 return libQ.resolve();
};

ControllerVolspotconnect.prototype.onStart = function() {

 var self = this;

 var defer = libQ.defer();

 self.startVolspotconnectDaemon()
  .then(function(e) {
   self.logger.SpConDebug('Volspotconnect2 Started');
   self.logger.SpConDebug('Starting metadata listener');
   self.volspotconnectDaemonConnect(defer)
   defer.resolve();
  })
  .fail(function(e) {
   defer.reject(new Error());
  });

 return defer.promise;


};

ControllerVolspotconnect.prototype.onUninstall = function() {
 var self = this;
 self.logger.info("Killing daemon");
 exec("/usr/bin/sudo /bin/systemctl stop volspotconnect2.service", {
  uid: 1000,
  gid: 1000
 }, function(error, stdout, stderr) {
  if (error) {
   self.logger.info('Error in killing Voslpotconnect2')
  }
 });

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

 try {

  fs.readFile(__dirname + "/volspotconnect2.tmpl", 'utf8', function(err, data) {
   if (err) {
    defer.reject(new Error(err));
    return console.log(err);
   }
   var shared;
   var username = (self.config.get('username'));
   var password = (self.config.get('password'));
   if (self.config.get('shareddevice') === false) {
    shared = " --disable-discovery " + "-u " + username + " -p " + "'" + password + "'" ;
   } else shared = "";

   var normalvolume
   if (self.config.get('normalvolume') === false) {
    normalvolume = "";
   } else normalvolume = " --enable-volume-normalization";


   var outdev = self.commandRouter.sharedVars.get('alsa.outputdevice');
   var devicename = self.commandRouter.sharedVars.get('system.name');
   var hwdev = 'plughw:' + outdev;
   if (outdev == "softvolume") {
    hwdev = "softvolume"
   }
   var conf1 = data.replace("${shared}", shared);
   var conf2 = conf1.replace("${normalvolume}", normalvolume);
   var conf3 = conf2.replace("${devicename}", devicename);
   var conf4 = conf3.replace("${outdev}", hwdev);
   var conf5 = conf4.replace("${initvol}", self.config.get("initvol"));

   fs.writeFile("/data/plugins/music_service/volspotconnect2/startconnect.sh", conf5, 'utf8', function(err) {

    if (err)
     defer.reject(new Error(err));
    else defer.resolve();
   });

  });


 } catch (err) {

 }

 return defer.promise;

};



ControllerVolspotconnect.prototype.saveVolspotconnectAccount = function(data) {
 var self = this;

 var defer = libQ.defer();

 //	self.config.set('bitrate', data['bitrate']);
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
 self.DeactivatedState();
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
    // TODO differentiate b/w pasue and stop
    return self.spotifyApi.pause();
}

ControllerVolspotconnect.prototype.pause = function() {
    var self = this;
    self.logger.SpConDebug('Received pause');

    return self.spotifyApi.pause();
}

ControllerVolspotconnect.prototype.next = function() {
    var self = this;
    self.logger.SpConDebug('Received next');
    return self.spotifyApi.skipToNext();
}

ControllerVolspotconnect.prototype.previous = function() {
    var self = this;
    self.logger.SpConDebug('Received previous');
    return self.spotifyApi.skipToPrevious();
}

ControllerVolspotconnect.prototype.seek = function(position) {
    var self = this;
    self.logger.SpConDebug('Received seek to: ' + position);
    return self.spotifyApi.seek(position);
}
