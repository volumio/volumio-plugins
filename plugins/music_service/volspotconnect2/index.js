'use strict';
/* global metrics */
// Core Volumio stuff
const libQ = require('kew');
const Config = require('v-conf');

// NodeJS helpers
const fs = require('fs-extra');
// Or https://nodejs.org/api/fs.html#fs_fs_promises_api
// const { promises: fs } = require("fs");
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const readFile = (fileName) => fs.readFile(fileName, 'utf8');
const writeFile = (fileName, data) => fs.writeFile(fileName, data, 'utf8');
const path = require('path');

// Plugin modules and helpers
const SpotifyWebApi = require('spotify-web-api-node');
const SpotConnCtrl = require('./SpotConnController').SpotConnEvents;
const msgMap = require('./SpotConnController').msgMap;
const logger = require('./logger');
// Global
var seekTimer;

// Define the ControllerVolspotconnect class
module.exports = ControllerVolspotconnect;

function ControllerVolspotconnect(context) {
  // Save a reference to the parent commandRouter
  this.context = context;
  this.commandRouter = this.context.coreCommand;

  // Volatile for metadata
  this.unsetVol = () => {
    logger.info('unSetVolatile called');
    return this.spotConnUnsetVolatile();
  };

  // SpotifyWebApi
  this.spotifyApi = new SpotifyWebApi();
  this.device = undefined;
}

ControllerVolspotconnect.prototype.onVolumioStart = function () {
  const configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  this.config = new Config();
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

// Plugin methods -----------------------------------------------------------------------------

ControllerVolspotconnect.prototype.VolspotconnectServiceCmds = async function (cmd) {
  if (!['start', 'stop', 'restart'].includes(cmd)) {
    throw TypeError('Unknown systemmd command: ', cmd);
  }
  const { stdout, stderr } = await exec(`/usr/bin/sudo /bin/systemctl ${cmd} volspotconnect2.service`, { uid: 1000, gid: 1000 });
  if (stderr) {
    logger.error(`Unable to ${cmd} Daemon: `, stderr);
  } else if (stdout) { }
  logger.info(`Vollibrespot Daemon service ${cmd}ed!`);
};

// For metadata
ControllerVolspotconnect.prototype.volspotconnectDaemonConnect = function (defer) {
  this.servicename = 'volspotconnect2';
  this.displayname = 'volspotconnect2';
  this.accessToken = '';
  this.active = false;
  this.isStopping = false;
  this.DeviceActive = false;
  this.SinkActive = false;
  this.VLSStatus = '';
  this.SPDevice = undefined; // WebAPI Device
  this.state = {
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
    bitrate: '',
    channels: 2
  };

  const nHost = ''; // blank = localhost
  const nPort = 5030;
  logger.info('Starting metadata listener');
  this.SpotConn = new SpotConnCtrl({
    address: nHost,
    port: nPort
  });
  this.Events = this.SpotConn.Events;
  this.SpotConn.sendmsg(msgMap.get('Hello'));

  // Register callbacks from the daemon
  this.SpotConn.on('error', (err) => {
    logger.error('Error connecting to metadata daemon', err);
    throw Error('Unable to connect to Spotify metadata daemon: ', err);
  });

  this.SpotConn.on(this.Events.DeviceActive, (data) => {
    // A Spotify Connect session has been initiated
    logger.evnt('<DeviceActive> A connect session has begun');
    this.commandRouter.pushToastMessage('info', 'Spotify Connect', 'Session is active!');
    // Do not stop Volumio playback, just notify

    // self.volumioStop().then(() => {
    //   self.state.status = 'pause';
    //   self.ActiveState();
    // });
  });

  this.SpotConn.on(this.Events.PlaybackActive, (data) => {
    // SpotConn is active playback device
    // This is different from SinkActive, it will be triggered at the beginning
    // of a playback session (e.g. Playlist) while the track loads
    logger.evnt('<PlaybackActive> Device palyback is active!');
    this.commandRouter.pushToastMessage('info', 'Spotify Connect', 'Connect is active');
    this.volumioStop().then(() => {
      this.DeviceActive = true;
      // this.state.status = 'play';
      this.ActiveState();
      this.pushState();
    });
  });

  this.SpotConn.on(this.Events.SinkActive, (data) => {
    // Sink is active when actual playback starts
    logger.evnt('<SinkActive> Sink acquired');
    this.SinkActive = true;
    this.checkWebApi();
    this.state.status = 'play';
    if (!this.active) this.ActiveState();
    this.pushState();
  });

  this.SpotConn.on(this.Events.PlaybackInactive, (data) => {
    logger.evnt('<PlaybackInactive> Device palyback is inactive');
    // Device has finished playing current queue or received a pause command
    //  overkill async, who are we waiting for?
    if (this.VLSStatus === 'pause') {
      logger.warn('Device is paused');
    } else if (!this.active) {
      logger.warn('Device is not active. Cleaning up!');
      this.DeactivateState();
    } else {
      logger.warn(`Device Session is_active: ${this.active}`);
    }
  });

  this.SpotConn.on(this.Events.SinkInactive, (data) => {
    // Alsa sink has been closed
    logger.evnt('<SinkInactive> Sink released');
    this.SinkActive = false;
    clearInterval(seekTimer);
    seekTimer = undefined;
    this.state.status = 'pause';
    if (this.active && !this.isStopping) {
      this.commandRouter.servicePushState(this.state, this.servicename);
    } else {
      logger.debug(`Not pushing Pause { active: ${this.active}, isStopping: ${this.isStopping}}`);
    }
  });

  this.SpotConn.on(this.Events.DeviceInactive, (data) => {
    // Connect session has been exited
    logger.evnt('<DeviceInactive> Connect Session has ended');
    this.DeactivateState();
  });

  this.SpotConn.on(this.Events.Seek, (position) => {
    logger.evnt(`<Seek> ${position}`);
    this.state.seek = position;
    this.pushState();
  });

  this.SpotConn.on(this.Events.Metadata, (meta) => {
    logger.evnt(`<Metadata> ${meta.track_name}`);
    // Update metadata
    const albumartId = meta.albumartId[2] === undefined ? meta.albumartId[0] : meta.albumartId[2];
    this.state.uri = `spotify:track:${meta.track_id}`;
    this.state.title = meta.track_name;
    this.state.artist = meta.artist_name.join(', ');
    this.state.album = meta.album_name;
    this.state.duration = Math.ceil(meta.duration_ms / 1000);
    this.state.seek = meta.position_ms;
    this.state.albumart = `https://i.scdn.co/image/${albumartId}`;
    if (!this.isStopping) {
      logger.debug('Pushing metadata');
      // This will not succeed if volspotconnect2 isn't the current active service
      this.pushState();
    } else {
      logger.debug(`Not pushing metadata: { active: ${this.active}, isStopping: ${this.isStopping} }`);
    }
  });

  this.SpotConn.on(this.Events.Token, (token) => {
    // Init WebAPI with token
    logger.evnt(`<Token> ${token.accessToken}`);
    this.accessToken = token.accessToken;
    this.initWebApi();
  });

  this.SpotConn.on(this.Events.Volume, (spvol) => {
    // Listen to volume changes
    logger.evnt(`<Volume> ${spvol}`);
    const vol = Math.round(spvol);
    logger.evnt(`Volume: Spotify:${spvol} Volumio: ${vol}`);
    this.commandRouter.volumioupdatevolume({
      vol: vol,
      mute: false
    });
  });

  this.SpotConn.on(this.Events.Status, (status) => {
    logger.evnt(`<State> ${status}`);
    this.VLSStatus = status;
  });

  this.SpotConn.on(this.Events.Pong, (type) => {
    logger.evnt(`<Pong> ${type}`);
  });

  this.SpotConn.on(this.Events.Unknown, (msg, err) => {
    // logger.evnt('<Unknown>', msg, err);
  });
};

ControllerVolspotconnect.prototype.checkActive = async function () {
  const res = await this.spotifyApi.getMyDevices();
  if (res.statusCode !== 200) {
    logger.debug('getMyDevices: ');
    logger.debug(res);
    return false;
  }
  const activeDevice = res.body.devices.find((el) => el.is_active === true);
  if (activeDevice !== undefined) {
    // This will fail if someone sets a custom name in the template..
    if (this.commandRouter.sharedVars.get('system.name') === activeDevice.name) {
      this.SPDevice = activeDevice;
      logger.info(`Setting VLS device_id: ${activeDevice.id}`);
      this.deviceID = activeDevice.id;
      return true;
    } else {
      this.SPDevice = undefined;
      return false;
    }
  } else {
    logger.warn('No active spotify devices found');
    logger.debug('Devices: ', res.body);
    return false;
  }
};

ControllerVolspotconnect.prototype.initWebApi = function () {
  this.spotifyApi.setAccessToken(this.accessToken);
  if (!this.checkActive()) {
    this.DeactivateState();
  }
};

ControllerVolspotconnect.prototype.checkWebApi = function () {
  if (!this.accessToken || this.accessToken.length === 0) {
    logger.warn('Invalid webAPI token, requesting a new one...');
    this.SpotConn.sendmsg(msgMap.get('ReqToken'));
  }
};

// State updates
ControllerVolspotconnect.prototype.ActiveState = function () {
  this.active = true;
  // Vollibrespot is currently Active (Session|device)!
  logger.info('Vollibrespot Active');
  if (!this.iscurrService()) {
    logger.info('Setting Volatile state to Volspotconnect2');
    this.context.coreCommand.stateMachine.setConsumeUpdateService(undefined);
    this.context.coreCommand.stateMachine.setVolatile({
      service: this.servicename,
      callback: this.unsetVol
    });
  }
  // Push state with metadata
  this.commandRouter.servicePushState(this.state, this.servicename);
};

ControllerVolspotconnect.prototype.DeactivateState = async function () {
  this.active = false;

  // FIXME: use a differnt check
  // Giving up Volumio State
  return new Promise(resolve => {
    // Some silly race contions again. This should really be refactored!
    // logger.debug(`self.SinkActive  ${self.SinkActive} || self.DeviceActive ${self.DeviceActive}`);
    if (this.SinkActive || this.DeviceActive) {
      this.device === undefined ? logger.info('Relinquishing Volumio State')
        : logger.warn(`Relinquishing Volumio state, Spotify session: ${this.device.is_active}`);
      this.context.coreCommand.stateMachine.unSetVolatile();
      this.context.coreCommand.stateMachine.resetVolumioState().then(() => {
        this.context.coreCommand.volumioStop.bind(this.commandRouter);
        this.DeviceActive = false;
      }
      );
    }
  });
};

ControllerVolspotconnect.prototype.spotConnUnsetVolatile = function () {
  // FIXME: use a differnt check
  this.device === undefined ? logger.info('Relinquishing Volumio State to another service')
    : logger.warn(`Relinquishing Volumio state to another service, Spotify session: ${this.device.is_active}`);

  return this.stop();
};

ControllerVolspotconnect.prototype.pushState = function () {
  logger.state(`Pushing new state :: ${this.iscurrService()}`);
  this.seekTimerAction();
  // Push state
  this.commandRouter.servicePushState(this.state, this.servicename);
};

ControllerVolspotconnect.prototype.volumioStop = function () {
  if (!this.iscurrService()) {
    logger.warn('Stopping currently active service');
    return this.commandRouter.volumioStop();
  } else {
    logger.warn('Not requsting volumioStop on our own service');
  }
  return Promise.resolve(true);
};

ControllerVolspotconnect.prototype.iscurrService = function () {
  // Check what is the current Volumio service
  const currentstate = this.commandRouter.volumioGetState();
  logger.info(`Currently active: ${currentstate.service}`);
  if (currentstate !== undefined && currentstate.service !== undefined && currentstate.service !== this.servicename) {
    return false;
  }
  return true;
};

ControllerVolspotconnect.prototype.onStop = function () {
  try {
    this.DeactivateState();
    logger.warn('Stopping Vollibrespot daemon');
    this.VolspotconnectServiceCmds('stop');
    // Close the metadata pipe:
    logger.info('Closing metadata listener');
    this.SpotConn.close();
  } catch (e) {
    logger.error('Error stopping Vollibrespot daemon: ', e);
  }

  //  Again, are these even resolved?
  return libQ.resolve();
};

ControllerVolspotconnect.prototype.onStart = function () {
  const defer = libQ.defer();
  this.init().then(() => defer.resolve());
  return defer.promise;
};

// Workaround for non Promise aware pluginmanger
ControllerVolspotconnect.prototype.init = async function () {
  if (typeof metrics === 'undefined') {
    console.time('SpotifyConnect');
  } else {
    metrics.time('SpotifyConnect');
  }
  try {
    // await creation?
    this.createConfigFile();
    this.volspotconnectDaemonConnect();
    await this.VolspotconnectServiceCmds('start');

    // Hook into Playback config
    // TODO: These are called multiple times, and there is no way to deregister them
    // So be warned...
    this.commandRouter.sharedVars.registerCallback('alsa.outputdevice',
      this.rebuildRestartDaemon.bind(this));
    this.commandRouter.sharedVars.registerCallback('alsa.outputdevicemixer',
      this.rebuildRestartDaemon.bind(this));
    this.commandRouter.sharedVars.registerCallback('alsa.device',
      this.rebuildRestartDaemon.bind(this));
    this.commandRouter.sharedVars.registerCallback('system.name',
      this.rebuildRestartDaemon.bind(this));
  } catch (e) {
    const err = 'Error starting SpotifyConnect';
    logger.error(err, e);
  }
  if (typeof metrics === 'undefined') {
    console.timeEnd('SpotifyConnect');
  } else {
    metrics.log('SpotifyConnect');
  }
};

ControllerVolspotconnect.prototype.onUninstall = function () {
  return this.onStop();
};

ControllerVolspotconnect.prototype.getUIConfig = function () {
  var defer = libQ.defer();
  const langCode = this.commandRouter.sharedVars.get('language_code');
  this.commandRouter.i18nJson(path.join(__dirname, `/i18n/strings_${langCode}.json`),
    path.join(__dirname, '/i18n/strings_en.json'),
    path.join(__dirname, '/UIConfig.json'))
    .then((uiconf) => {
      // Do we still need the initial volume setting?
      const mixname = this.commandRouter.sharedVars.get('alsa.outputdevicemixer');
      logger.debug(`config <${mixname}>: toggling initvol/volume_ctrl`);
      if ((mixname === '') || (mixname === 'None')) {
        uiconf.sections[0].content[0].hidden = false;
        uiconf.sections[0].content[6].hidden = false;
      } else {
        uiconf.sections[0].content[0].hidden = true;
        uiconf.sections[0].content[6].hidden = true;
      }

      // Asking for trouble, map index to id?
      uiconf.sections[0].content[0].config.bars[0].value = this.config.get('initvol');
      uiconf.sections[0].content[1].value = this.config.get('normalvolume');
      uiconf.sections[0].content[2].value.value = this.config.get('bitrate');
      uiconf.sections[0].content[2].value.label = this.config.get('bitrate').toString();
      uiconf.sections[0].content[3].value = this.config.get('shareddevice');
      uiconf.sections[0].content[4].value = this.config.get('username');
      uiconf.sections[0].content[5].value = this.config.get('password');
      uiconf.sections[0].content[6].value.label = this.config.get('volume_ctrl');
      uiconf.sections[0].content[6].value.value = this.config.get('volume_ctrl');
      uiconf.sections[0].content[7].value = this.config.get('gapless');
      uiconf.sections[0].content[8].value = this.config.get('autoplay');
      uiconf.sections[0].content[9].value = this.config.get('debug');

      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });

  return defer.promise;
};

ControllerVolspotconnect.prototype.getLabelForSelect = function (options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
    if (options[i].value === key) { return options[i].label; }
  }

  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

/* eslint-disable no-unused-vars */
ControllerVolspotconnect.prototype.setUIConfig = function (data) {
  // Perform your installation tasks here
};

ControllerVolspotconnect.prototype.getConf = function (varName) {
  // Perform your installation tasks here
};

ControllerVolspotconnect.prototype.setConf = function (varName, varValue) {
  // Perform your installation tasks here
};
/* eslint-enable no-unused-vars */

ControllerVolspotconnect.prototype.getAdditionalConf = function (type, controller, data) {
  return this.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
};

// Public Methods ---------------------------------------------------------------------------------------

ControllerVolspotconnect.prototype.createConfigFile = async function () {
  logger.info('Creating VLS config file');
  try {
    let template = readFile(path.join(__dirname, 'volspotify.tmpl'));
    // Authentication
    const shared = (this.config.get('shareddevice'));
    const username = (this.config.get('username'));
    const password = (this.config.get('password'));
    // Playback
    const normalvolume = this.config.get('normalvolume');
    let initvol = '0';
    const volumestart = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumestart');
    if (volumestart !== 'disabled') {
      initvol = volumestart;
    } else {
      // This will fail now - as stateMachine might not (yet) be up and running
      // TODO: Make these calls awaitable.
      // const state = this.commandRouter.volumioGetState();
      // if (state) {
      //   initvol = (`${state.volume}`);
      // }
    }
    const devicename = this.commandRouter.sharedVars.get('system.name');
    //  const outdev = this.commandRouter.sharedVars.get('alsa.outputdevice');
    const outdev = 'volumio';
    const volcuve = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumecurvemode');
    let mixname = this.commandRouter.sharedVars.get('alsa.outputdevicemixer');
    var mixt = this.getAdditionalConf('audio_interface', 'alsa_controller', 'mixer_type');

    /* eslint-disable one-var */
    // Default values will be parsed as neccesary by the backend for these
    let idxcard = '',
      hwdev = '',
      mixer = '',
      mixdev = '',
      mixeropts = '',
      initvolstr = '',
      mixidx = 0;
    /* eslint-enable one-var */
    let mixlin = false;
    if ((mixt === '') || (mixt === 'None')) {
      logger.debug('<> or <None> Mixer found, using softvol');
      // No mixer - default to (linear) Spotify volume
      mixer = 'softvol';
      mixeropts = this.config.get('volume_ctrl');
      hwdev = `${outdev}`;
      initvolstr = this.config.get('initvol');
    } else {
      // Some mixer is defined, set inital volume to startup volume or current volume
      mixer = 'alsa';
      initvolstr = initvol;
      if (volcuve !== 'logarithmic') {
        mixlin = true;
        var outdevv = this.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevice');
        mixdev = 'hw:' + outdevv;
      }
      // to be fixed with soft volume set in volumio
      if (mixt === 'Software') {
        hwdev = 'volumio';
        var outdevv = this.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevice');
        mixdev = 'hw:' + outdevv;
        mixlin = true;
        mixidx = 0// this.getAdditionalConf('audio_interface', 'alsa_controller', 'softvolumenumber');
        mixeropts = 'linear';

      } else {

        // We have an actual Hardware mixer
        var mixv = this.getAdditionalConf('audio_interface', 'alsa_controller', 'mixer');
        hwdev = `${outdev}`;
        // outputdevice = card,device..
        // ¯\_(ツ)_/¯
        idxcard = outdev.split(',')[0];
        // Similar storey with mixer,index
        mixname = mixv.split(',')[0];
        mixidx = mixv.split(',')[1] || 0;
        var outdevv = this.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevice');
        mixdev = 'hw:' + outdevv;
        mixeropts = 'linear';

      }
    }
    if (this.config.get('debug')) {
      // TODO:
      logger.debug('Unimplemented debug mode!!');
    }
    template = await template;
    /* eslint-disable no-template-curly-in-string */
    const conf = template.replace('${shared}', shared)
      .replace('${username}', username)
      .replace('${password}', password)
      .replace('${devicename}', devicename)
      .replace('${normalvolume}', normalvolume)
      .replace('${outdev}', hwdev)
      .replace('${mixer}', mixer)
      .replace('${mixname}', mixname)
      .replace('${mixdev}', mixdev)
      .replace('${mixidx}', mixidx)
      .replace('${mixlin}', mixlin)
      .replace('${mixeropts}', mixeropts)
      .replace('${initvol}', initvolstr)
      .replace('${autoplay}', this.config.get('autoplay'))
      .replace('${gapless}', this.config.get('gapless'))
      .replace('${bitrate}', this.config.get('bitrate'));
    /* eslint-enable no-template-curly-in-string */

    // Sanity check
    if (conf.indexOf('undefined') > 1) {
      logger.error('SpotifyConnect Daemon config issues!');
      // get some hints as to what when wrong
      const trouble = conf.match(/^.*\b(undefined)\b.*$/gm);
      logger.error('volspotify config error: ', trouble);
      this.commandRouter.pushToastMessage('stickyerror', 'Spotify Connect', `Error reading config: ${trouble}`);
      throw Error('Undefined found found in conf');
    }
    return writeFile('/data/plugins/music_service/volspotconnect2/volspotify.toml', conf);
  } catch (e) {
    logger.error('Error creating SpotifyConnect Daemon config', e);
    this.commandRouter.pushToastMessage('error', 'Spotify Connect', `SpotifyConnect config failed: ${e}`);
  }
};

ControllerVolspotconnect.prototype.saveVolspotconnectAccount = function (data) {
  // TODO: is this still requred?
  // Does UIConfig - onSave() actually resolve this promise?
  var defer = libQ.defer();

  this.config.set('initvol', data.initvol);
  this.config.set('bitrate', data.bitrate.value);
  this.config.set('normalvolume', data.normalvolume);
  this.config.set('shareddevice', data.shareddevice);
  this.config.set('username', data.username);
  this.config.set('password', data.password);
  this.config.set('volume_ctrl', data.volume_ctrl.value);
  this.config.set('gapless', data.gapless);
  this.config.set('autoplay', data.autoplay);
  this.config.set('debug', data.debug);
  this.state.bitrate = data.bitrate;
  this.rebuildRestartDaemon()
    .then(() => defer.resolve({}))
    .catch((e) => defer.reject(new Error('saveVolspotconnectAccountError')));

  return defer.promise;
};

ControllerVolspotconnect.prototype.rebuildRestartDaemon = async function () {
  // Deactive state
  this.DeactivateState();
  try {
    await this.createConfigFile();
    logger.info('Restarting Vollibrespot Daemon');
    await this.VolspotconnectServiceCmds('restart');
    this.commandRouter.pushToastMessage('success', 'Spotify Connect', 'Configuration has been successfully updated');
  } catch (e) {
    this.commandRouter.pushToastMessage('error', 'Spotify Connect', `Unable to update config: ${e}`);
  }
};

ControllerVolspotconnect.prototype.awawitSpocon = function (type) {
  return new Promise((resolve, reject) => {
    this.SpotConn.once(type, resolve);
    // If it takes more than 3 seconds, something is wrong..
    setTimeout(() => { return reject; }, 3 * 1000);
  });
};

// Plugin methods for the Volumio state machine
ControllerVolspotconnect.prototype.stop = function () {
  const volStop = process.hrtime();
  logger.cmd('Received stop');
  this.isStopping = true;
  this.SpotConn.sendmsg(msgMap.get('Pause'));
  // Statemachine doesn't seem Promise aware..¯\_(ツ)_/¯
  // return this.awawitSpocon(this.Events.PongPause).then(() => {
  // TODO: Is this sufficient, or should we wait for SinkInactive event..
  return this.awawitSpocon(this.Events.SinkInactive).then(() => {
    this.active = false;
    this.isStopping = false;
    const end = process.hrtime(volStop);
    logger.debug(`ResolvedStop in \u001b[31m ${end[0]}s ${(end[1] / 1000000).toFixed(2)}ms \u001b[39m`);
  }).catch(error => {
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.pause = function () {
  logger.cmd('Received pause');

  return this.spotifyApi.pause().catch(error => {
    this.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.play = function () {
  logger.cmd(`Received play: <${this.active}>`);
  if (this.active) {
    return this.spotifyApi.play().then(e => {
      if (this.state.status !== 'play') {
        this.state.staus = 'play';
        this.pushState();
      }
    }).catch(error => {
      this.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
      logger.error(error);
      this.checkActive();
    });
  } else {
    logger.debug('Playing on:', this.deviceID);
    return this.spotifyApi.transferMyPlayback({ deviceIds: [this.deviceID], play: true }).catch(error => {
      this.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
      logger.error(error);
    });
  }
};

ControllerVolspotconnect.prototype.next = function () {
  logger.cmd('Received next');
  return this.spotifyApi.skipToNext().catch(error => {
    this.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.previous = function () {
  logger.cmd('Received previous');
  return this.spotifyApi.skipToPrevious().catch(error => {
    this.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.seek = function (position) {
  logger.cmd(`Received seek to: ${position}`);
  return this.spotifyApi.seek(position).catch(error => {
    this.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.random = function (value) {
  logger.cmd(`Received Random: ${value}`);
  return this.spotifyApi.setShuffle({ state: value }).then(() => {
    this.state.random = value;
    this.pushState();
  }).catch(error => {
    this.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.repeat = function (value, repeatSingle) {
  let state = value ? 'context' : 'off';
  state = repeatSingle ? 'track' : state;
  logger.cmd(`Received Repeat: ${value}-${repeatSingle} => ${state}`);
  // track, context or off.
  return this.spotifyApi.setRepeat({ state: state }).then(() => {
    this.state.repeat = value;
    this.state.repeatSingle = repeatSingle;
    this.pushState();
  }).catch(error => {
    this.commandRouter.pushToastMessage('error', 'Spotify Connect API Error', error.message);
    logger.error(error);
  });
};

ControllerVolspotconnect.prototype.seekTimerAction = function () {
  if (this.state.status === 'play') {
    if (seekTimer === undefined) {
      seekTimer = setInterval(() => {
        this.state.seek = this.state.seek + 1000;
      }, 1000);
    }
  } else {
    clearInterval(seekTimer);
    seekTimer = undefined;
  }
};
