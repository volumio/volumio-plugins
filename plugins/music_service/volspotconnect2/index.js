'use strict';

var libQ = require('kew');
 var config = new(require('v-conf'))();
const fs = require('fs-extra');
const exec = require('child_process').exec;
const path = require('path');
const SpotifyWebApi = require('spotify-web-api-node');
const SpotConnCtrl = require('./SpotConnController').SpotConnEvents;
const msgMap = require('./SpotConnController').msgMap;
const logger = require('./logger');
var seekTimer;

// Define the ControllerVolspotconnect class
module.exports = ControllerVolspotconnect;

function ControllerVolspotconnect (context) {
  var self = this;
  // Save a reference to the parent commandRouter
  self.context = context;
  self.commandRouter = self.context.coreCommand;

  // Volatile for metadata
  self.unsetVol = function () {
    var self = this;
    logger.info('unSetVolatile called');

    return self.spotConnUnsetVolatile();
  };

  // SpotifyWebApi
  self.spotifyApi = new SpotifyWebApi();
  self.device = undefined;
}

ControllerVolspotconnect.prototype.onVolumioStart = function () {
  var self = this;
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  this.config = new (require('v-conf'))();
  this.config.loadFile(configFile);
/*
  // is this defer still needed?
  var defer = libQ.defer();
  self.createConfigFile()
    .then(function (e) {
      defer.resolve({});
    })
    .fail(function (e) {
      defer.reject(new Error());
    });
*/

  return libQ.resolve();
};

ControllerVolspotconnect.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

ControllerVolspotconnect.prototype.onPlayerNameChanged = function (playerName) {
  var self = this;

  self.onRestart();
};

// Plugin methods -----------------------------------------------------------------------------

ControllerVolspotconnect.prototype.startVolspotconnectDaemon = function () {
  var defer = libQ.defer();

  exec('/usr/bin/sudo /bin/systemctl start volspotconnect2.service', {
    uid: 1000,
    gid: 1000
  }, function (error, stdout, stderr) {
    if (error !== null) {
      logger.error('Unable to start Daemon: ', error);
      defer.reject();
    } else {
      logger.info('Vollibrespot Daemon Started');
      defer.resolve();
    }
  });

  return defer.promise;
};

// For metadata
ControllerVolspotconnect.prototype.volspotconnectDaemonConnect = function (defer) {
  var self = this;
  self.servicename = 'volspotconnect2';
  self.displayname = 'volspotconnect2';
  self.accessToken = '';
  self.active = false;
  self.deviceActive = false;
  self.SinkActive = false;
  self.state = {
    status: 'stop',
    service: 'volspotconnect2',
    title: '',
    artist: '',
    album: '',
    albumart: '/albumart',
    uri: '',
    // icon: 'fa fa-spotify',
    trackType: 'spotify',
    seek: 0,
    duration: 0,
    samplerate: '44.1 KHz',
    bitdepth: '16 bit',
    channels: 2
  };

  const nHost = ''; // blank = localhost
  const nPort = 5030;
  logger.info('Starting metadata listener');
  self.SpotConn = new SpotConnCtrl({
    address: nHost,
    port: nPort
  });

  self.SpotConn.sendmsg(msgMap.get('HELLO'));

  // Register callbacks from the daemon
  self.SpotConn.on('error', function (err) {
    logger.error('Error connecting to metadata daemon', err);
    // Is this still needed?
    try {
      defer.reject();
    } catch (ecc) {}
  });

  self.SpotConn.on('SessionActive', function (data) {
  // A Spotify Connect session has been initiated
    logger.evnt('Connect Session is active!');
    self.commandRouter.pushToastMessage('info', 'Spotify Connect', 'Session is active!');
    // Do not stop Volumio playback, just notify

    // self.volumioStop().then(() => {
    //   self.state.status = 'pause';
    //   self.ActiveState();
    // });
  });

  self.SpotConn.on('DeviceActive', function (data) {
  // SpotConn is active playback device
  // This is different from SinkActive, it will be triggered at the beginning
  // of a playback session (e.g. Playlist)
    logger.evnt('Device is active!');
    self.commandRouter.pushToastMessage('info', 'Spotify Connect', 'Starting playback');
    self.volumioStop().then(() => {
      self.DeviceActive = true;
      self.state.status = 'play';
      self.ActiveState();
      self.pushState();
    });
  });

  self.SpotConn.on('SinkActive', function (data) {
    // Alsa sink is active
    logger.evnt('Sink acquired');
    self.SinkActive = true;
    self.checkWebApi();
    self.state.status = 'play';
    if (!self.active) self.ActiveState();
    self.pushState();
  });

  self.SpotConn.on('DeviceInactive', function (data) {
  // Device has finished playing current queue or received a pause command
    logger.evnt('Device is inactive!');
    // NOTE:Switch to promise?
    self.DeactivateState();
    self.DeviceActive = false;
  });

  self.SpotConn.on('SinkInactive', function (data) {
  // Alsa sink has been closed
    logger.evnt('Sink released');
    self.SinkActive = false;
    self.state.status = 'pause';
  // TODO this will reset the seek position :-(
  // self.pushState();
  });

  self.SpotConn.on('SessionInactive', function (data) {
  // Connect session has been exited
    self.DeactivateState();
    logger.evnt('Connect Session is done');
  });

  self.SpotConn.on('seek', function (position) {
    self.state.seek = position;
    self.pushState();
  });

  self.SpotConn.on('metadata', function (meta) {
    // Update metadata
    const albumartId = meta.albumartId[2] === undefined ? meta.albumartId[0] : meta.albumartId[2];
    self.state.uri = `spotify:track:${meta.track_id}`;
    self.state.title = meta.track_name;
    self.state.artist = meta.artist_name.join(', ');
    self.state.album = meta.album_name;
    self.state.duration = Math.ceil(meta.duration_ms / 1000);
    self.state.seek = meta.position_ms;
    self.state.albumart = `https://i.scdn.co/image/${albumartId}`;
    logger.evnt(`Pushing metadata Vollibrespot: ${self.active}`);
    // This will not succeed if volspotconnect2 isn't the current active service
    self.pushState();
  });

  self.SpotConn.on('token', function (token) {
  // Init WebAPI with token
    logger.var(`Token: <${token.accessToken}>`);
    self.accessToken = token.accessToken;
    self.initWebApi();
  });

  self.SpotConn.on('volume', function (SPvolume) {
  // Listen to volume changes
    const vol = Math.round(SPvolume);
    logger.evnt(`Volume: Sp:${SPvolume} Volumio: ${vol}`);
    self.commandRouter.volumioupdatevolume({
      vol: vol,
      mute: false
    });
  });

  self.SpotConn.on('state', function (state) {
    logger.debug(state);
    self.state.status = state.status;
    self.state.seek = state.position;
    logger.evnt(`Vollibrespot::status <${state.status}>`);
    self.pushState();
  });

  self.SpotConn.on('unknown', function (unknown) {
    // logger.info('Vollibrespot:: ', unknown);
  });
};

ControllerVolspotconnect.prototype.initWebApi = function () {
  var self = this;
  self.spotifyApi.setAccessToken(self.accessToken);
  self.spotifyApi.getMyDevices()
    .then(function (res) {
      const device = res.body.devices.find(function (el) { return el.is_active === true; });
      self.commandRouter.sharedVars.get('system.name') === device.name ? self.device = device : self.deviceID = undefined;
    });
};

ControllerVolspotconnect.prototype.checkWebApi = function () {
  var self = this;
  if (!self.accessToken || self.accessToken.length === 0) {
    logger.warn('Invalid webAPI token, requesting a new one...');
    self.SpotConn.sendmsg(msgMap.get('GET_TOKEN'));
  }
};

// State updates
ControllerVolspotconnect.prototype.ActiveState = function () {
  var self = this;
  self.active = true;
  // Vollibrespot is currently Active (Session|device)!
  logger.info('Vollibrespot Active');
  if (!self.iscurrService()) {
    logger.info('Setting Volatile state to Volspotconnect2');
    self.context.coreCommand.stateMachine.setConsumeUpdateService(undefined);
    self.context.coreCommand.stateMachine.setVolatile({
      service: self.servicename,
      callback: self.unsetVol.bind(self)
    });
  }
  // Push state with metadata
  self.commandRouter.servicePushState(self.state, self.servicename);
};

ControllerVolspotconnect.prototype.DeactivateState = function () {
  var self = this;
  self.active = false;

  // FIXME: use a differnt check
  // Giving up Volumio State
  if (self.SinkActive || self.DeviceActive) {
    self.device === undefined ? logger.info('Relinquishing Volumio State')
      : logger.warn(`Relinquishing Volumio state, Spotify session: ${self.device.is_active}`);
    self.context.coreCommand.stateMachine.unSetVolatile();
    self.context.coreCommand.stateMachine.resetVolumioState().then(
      self.context.coreCommand.volumioStop.bind(self.commandRouter));
  }
};

ControllerVolspotconnect.prototype.spotConnUnsetVolatile = function () {
  var self = this;

  // FIXME: use a differnt check
  self.device === undefined ? logger.info('Relinquishing Volumio State to another service')
    : logger.warn(`Relinquishing Volumio state to another service, Spotify session: ${self.device.is_active}`);

  // TODO: wait for confirmation from the SinkInactive event?
  return self.stop();
};

ControllerVolspotconnect.prototype.pushState = function () {
  var self = this;
  logger.state(`Pushing new state :: ${self.iscurrService()}`);
  self.seekTimerAction();
  // Push state
  self.commandRouter.servicePushState(self.state, self.servicename);
};

ControllerVolspotconnect.prototype.volumioStop = function () {
  var self = this;
  if (!self.iscurrService()) {
    logger.warn('Stopping currently active service');
    return self.commandRouter.volumioStop();
  }
  return Promise.resolve(true);
};

ControllerVolspotconnect.prototype.iscurrService = function () {
  // Check what is the current Volumio service
  var self = this;
  const currentstate = self.commandRouter.volumioGetState();
  logger.info(`Currently active: ${currentstate.service}`);
  if (currentstate !== undefined && currentstate.service !== undefined && currentstate.service !== self.servicename) {
    return false;
  }
  return true;
};

ControllerVolspotconnect.prototype.onStop = function () {
  var self = this;

  self.DeactivateState();
  logger.warn('Killing vollibrespot daemon');
  exec('/usr/bin/sudo /bin/systemctl stop volspotconnect2.service', function (error, stdout, stderr) {
    if (error) {
      logger.error('Error in killing vollibrespot');
    }
  });
  // Close the metadata pipe:
  logger.info('Closing metadata listener');
  self.SpotConn.close();

  return libQ.resolve();
};

ControllerVolspotconnect.prototype.onStart = function () {
  var self = this;

  var defer = libQ.defer();
  self.createConfigFile();
  self.startVolspotconnectDaemon()
    .then(function (e) {
      self.volspotconnectDaemonConnect(defer);
      defer.resolve();
    })
    .fail(function (e) {
      defer.reject(new Error());
    });

  // Hook into Playback config
  this.commandRouter.sharedVars.registerCallback('alsa.outputdevice',
    this.rebuildRestartDaemon.bind(this));
  this.commandRouter.sharedVars.registerCallback('alsa.outputdevicemixer',
    this.rebuildRestartDaemon.bind(this));
  this.commandRouter.sharedVars.registerCallback('system.name',
    this.rebuildRestartDaemon.bind(this));
  this.commandRouter.sharedVars.registerCallback('alsa.device',
    this.rebuildRestartDaemon.bind(this));

  return defer.promise;
};

ControllerVolspotconnect.prototype.onUninstall = function () {
  var self = this;
  logger.warn('Killing vollibrespot daemon');
  exec('/usr/bin/sudo /bin/systemctl stop volspotconnect2.service', {
    uid: 1000,
    gid: 1000
  }, function (error, stdout, stderr) {
    if (error) {
      logger.error('Error in killing Voslpotconnect2');
    }
  });

  self.SpotConn.close();

  return libQ.resolve();
};

ControllerVolspotconnect.prototype.getUIConfig = function () {
  var defer = libQ.defer();
  var self = this;
 const langCode = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(path.join(__dirname, `/i18n/strings_${langCode}.json`),
    path.join(__dirname, '/i18n/strings_en.json'),
    path.join(__dirname, '/UIConfig.json'))
    .then(function (uiconf) {

      // Do we still need the initial volume setting?
      const mixname = self.commandRouter.sharedVars.get('alsa.outputdevicemixer');
      if ((mixname === '') || (mixname === 'None')) {
        uiconf.sections[0].content[0].hidden = false;
        uiconf.sections[0].content[6].hidden = false;
      } else {
        uiconf.sections[0].content[0].hidden = true;
        uiconf.sections[0].content[6].hidden = true;
      }

      // Asking for trouble, map index to id?
      uiconf.sections[0].content[0].config.bars[0].value = self.config.get('initvol');
      uiconf.sections[0].content[1].value = self.config.get('normalvolume');
      uiconf.sections[0].content[2].value.value = self.config.get('bitrate');
      uiconf.sections[0].content[2].value.label = self.config.get('bitrate').toString();
      uiconf.sections[0].content[3].value = self.config.get('shareddevice');
      uiconf.sections[0].content[4].value = self.config.get('username');
      uiconf.sections[0].content[5].value = self.config.get('password');
     uiconf.sections[0].content[6].value.label = self.config.get('volume_ctrl');
      uiconf.sections[0].content[6].value.value = self.config.get('volume_ctrl');
      uiconf.sections[0].content[7].value = self.config.get('debug');

	
     defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });

  return defer.promise;
};


ControllerVolspotconnect.prototype.getLabelForSelect = function(options, key) {
 var n = options.length;
 for (var i = 0; i < n; i++) {
  if (options[i].value == key)
   return options[i].label;
 }

 return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';

};


/* eslint-disable no-unused-vars */
ControllerVolspotconnect.prototype.setUIConfig = function (data) {
  var self = this;
  // Perform your installation tasks here
};

ControllerVolspotconnect.prototype.getConf = function (varName) {
  var self = this;
  // Perform your installation tasks here
};

ControllerVolspotconnect.prototype.setConf = function (varName, varValue) {
  var self = this;
  // Perform your installation tasks here
};
/* eslint-enable no-unused-vars */

ControllerVolspotconnect.prototype.getAdditionalConf = function (type, controller, data) {
  var self = this;	
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
};

// Public Methods ---------------------------------------------------------------------------------------

ControllerVolspotconnect.prototype.createConfigFile = function () {
  var self = this;

  var defer = libQ.defer();
  try {
    fs.readFile(path.join(__dirname, 'volspotconnect2.tmpl'), 'utf8', function (err, data) {
      if (err) {
        defer.reject(new Error(err));
        return logger.error(err);
      }
      let shared;
      const username = (self.config.get('username'));
      const password = (self.config.get('password'));
      if (self.config.get('shareddevice') === false) {
        shared = `--disable-discovery --username '${username}' --password '${password}'`;
      } else shared = '';

      let normalvolume;
      if (self.config.get('normalvolume') === false) {
        normalvolume = '';
      } else {
        normalvolume = ' --enable-volume-normalisation';
      }

      let initvol = '0';
      const volumestart = self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumestart');
      if (volumestart !== 'disabled') {
        initvol = volumestart;
      } else {
        const state = self.commandRouter.volumioGetState();
        initvol = (`${state.volume}`);
      }
      const devicename = self.commandRouter.sharedVars.get('system.name');
      const outdev = self.commandRouter.sharedVars.get('alsa.outputdevice');
      const mixname = self.commandRouter.sharedVars.get('alsa.outputdevicemixer');

      const volcuve = self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumecurvemode');
      let idxcard, hwdev, mixlin, mixer, mixeropts, initvolstr;
      if ((mixname === '') || (mixname === 'None')) {
        // No mixer - default to (linear) Spotify volume
        mixer = '';
        mixeropts = `--volume-ctrl ${self.config.get('volume_ctrl')}`;
        hwdev = `plughw:${outdev}`;
        initvolstr = `--initial-volume ${self.config.get('initvol')}`;
      } else {
        // Some mixer is defined, set inital volume to startup volume or current volume
        initvolstr = ('--initial-volume ' + initvol);
        mixer = '--mixer alsa';
        if (volcuve === 'logarithmic') {
          mixlin = '';
        } else {
          mixlin = '--mixer-linear-volume';
        }
        if (outdev === 'softvolume') {
          hwdev = outdev;
          mixlin = '--mixer-linear-volume';
        } else {
          hwdev = `plughw:${outdev}`;
        }

        if (outdev === 'softvolume') {
          idxcard = self.getAdditionalConf('audio_interface', 'alsa_controller', 'softvolumenumber');
        } else if (outdev === 'Loopback') {
          const vconfig = fs.readFileSync('/tmp/vconfig.json', 'utf8', function (err, data) {
            if (err) {
              logger.error('Error reading Loopback config', err);
            }
          });
          const vconfigJSON = JSON.parse(vconfig);
          idxcard = vconfigJSON.outputdevice.value;
        } else {
          idxcard = outdev;
        }

        const mixdev = `hw:${idxcard}`;
        mixeropts = `--mixer-name '${mixname}' --mixer-card '${mixdev}' ${mixlin}`;
      }

      /* eslint-disable no-template-curly-in-string */
      let conf = data.replace('${shared}', shared)
        .replace('${normalvolume}', normalvolume)
        .replace('${devicename}', devicename)
        .replace('${outdev}', hwdev)
        .replace('${mixer}', mixer)
        .replace('${mixeropts}', mixeropts)
        .replace('${initvol}', initvolstr)
        .replace('${bitrate}', self.config.get('bitrate'))
        .replace('${debug}', self.config.get('debug') ? '--verbose' : '');
        // .replace('${initvol}', self.config.get('initvol'));
        /* eslint-enable no-template-curly-in-string */
      fs.writeFile('/data/plugins/music_service/volspotconnect2/startconnect.sh', conf, 'utf8', function (err) {
        if (err) { defer.reject(new Error(err)); } else defer.resolve();
      });
    });
  } catch (err) {
    logger.error(err);
  }
  return defer.promise;
};

ControllerVolspotconnect.prototype.saveVolspotconnectAccount = function (data) {
  var self = this;

  var defer = libQ.defer();

  self.config.set('initvol', data['initvol']);
  self.config.set('bitrate', data['bitrate'].value);
  self.config.set('normalvolume', data['normalvolume']);
  self.config.set('shareddevice', data['shareddevice']);
  self.config.set('username', data['username']);
  self.config.set('password', data['password']);
  self.config.set('volume_ctrl', data['volume_ctrl'].value);
  self.config.set('debug', data['debug']);


  self.rebuildRestartDaemon()
    .then(function (e) {
      defer.resolve({});
    })
    .fail(function (e) {
      defer.reject(new Error());
    });

  return defer.promise;
};

ControllerVolspotconnect.prototype.rebuildRestartDaemon = function () {
  var self = this;
  var defer = libQ.defer();
  // Deactive state
  self.DeactivateState();
  self.createConfigFile()
    .then(function (e) {
      var edefer = libQ.defer();
      logger.info('Restarting Vollibrespot Daemon');
      exec('/usr/bin/sudo /bin/systemctl restart volspotconnect2.service ', {
        uid: 1000,
        gid: 1000
      }, function (error, stdout, stderr) {
        logger.error(error);
        edefer.resolve();
      });
      return edefer.promise;
    })
    .then(self.startVolspotconnectDaemon.bind(self))
    .then(function (e) {
      // TODO: Use i18n strings
      self.commandRouter.pushToastMessage('success', 'Spotify Connect', 'Configuration has been successfully updated');
      defer.resolve({});
    });

  return defer.promise;
};

// Plugin methods for the Volumio state machine
ControllerVolspotconnect.prototype.stop = function () {
  var self = this;
  logger.cmd('Received stop');
  // TODO differentiate b/w pause and stop
  // Try and resolve the promise, else bluntly kill the daemon?
  self.SpotConn.sendmsg(msgMap.get('STOP'));
  return self.spotifyApi.pause()
    .then((res) => {
      logger.debug('spotifyApi::Pause complete', res);
    })
    .catch((error) => {
      self.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
      logger.error(error);
    });
};

ControllerVolspotconnect.prototype.pause = function () {
  var self = this;
  logger.cmd('Received pause');

  return self.spotifyApi.pause().catch((error) => {
    self.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.play = function () {
  var self = this;
  logger.cmd('Received play');
  return self.spotifyApi.play().catch((error) => {
    self.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.next = function () {
  var self = this;
  logger.cmd('Received next');
  return self.spotifyApi.skipToNext().catch((error) => {
    self.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.previous = function () {
  var self = this;
  logger.cmd('Received previous');
  return self.spotifyApi.skipToPrevious().catch((error) => {
    self.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.seek = function (position) {
  var self = this;
  logger.cmd(`Received seek to: ${position}`);
  return self.spotifyApi.seek(position).catch((error) => {
    self.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.seekTimerAction = function () {
  var self = this;

  if (self.state.status === 'play') {
    if (seekTimer === undefined) {
      seekTimer = setInterval(() => {
        self.state.seek = self.state.seek + 1000;
      }, 1000);
    }
  } else {
    clearInterval(seekTimer);
    seekTimer = undefined;
  }
};

