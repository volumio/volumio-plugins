'use strict';

const libQ = require('kew');
const fs = require('fs-extra');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const net = require('net');
const io = require('socket.io-client');
const unixDomSocket = new net.Socket();
const socket = io.connect('http://localhost:3000');
const blInterface = '/sys/devices/platform/rpi_backlight/backlight/rpi_backlight';
const als = '/etc/als'; // The plugin awaits the current value of an optional ambient light sensor (ALS) as a single number in /etc/als.
const configTxtGpuMemBanner = '#### Touch Display gpu_mem setting below: do not alter ####' + os.EOL;
const configTxtRotationBanner = '#### Touch Display rotation setting below: do not alter ####' + os.EOL;
const id = 'touch_display: ';
var rpiScreen = false;
var rpiBacklight = false;
var maxBrightness = 255;
const alsProgression = [];
var autoBrTimeoutCleared = false;
var currentlyAdjusting = false;
var uiNeedsUpdate = false;
var device, displayNumber, autoBrTimer, toggleBrTimer;

module.exports = TouchDisplay;

function TouchDisplay (context) {
  const self = this;

  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.context.logger;
  self.configManager = self.context.configManager;
}

TouchDisplay.prototype.onVolumioStart = function () {
  const self = this;
  const configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');

  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
  return libQ.resolve();
};

TouchDisplay.prototype.onVolumioShutdown = function () {
  const self = this;

  if (rpiBacklight) {
    // in order to have full brightness during the next boot up
    self.setBrightness(maxBrightness);
  }
  return libQ.resolve();
};

TouchDisplay.prototype.onVolumioReboot = function () {
  const self = this;

  if (rpiBacklight) {
    // in order to have full brightness during the next boot up
    self.setBrightness(maxBrightness);
  }
  return libQ.resolve();
};

TouchDisplay.prototype.onStart = function () {
  const self = this;
  const defer = libQ.defer();
  let lastStateIsPlaying = false;
  let attempts = 0;

  self.commandRouter.loadI18nStrings();
  self.systemctl('daemon-reload')
    .then(self.systemctl.bind(self, 'start volumio-kiosk.service'))
    .then(function () {
      self.logger.info(id + 'Volumio Kiosk started');
      device = self.commandRouter.executeOnPlugin('system_controller', 'system', 'getConfigParam', 'device');
      if (device === 'Raspberry PI') {
        fs.readFile('/proc/modules', 'utf8', function (err, data) {
          if (err) {
            self.logger.error(id + 'Error reading /proc/modules: ' + err);
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + '/proc/modules: ' + err);
          } else {
            // detect Raspberry Pi Foundation original touch screen
            if (data.match(/^rpi_ft5406\b/gm) === null && data.match(/^raspberrypi_ts\b/gm) === null) {
              self.logger.info(id + 'No Raspberry Pi Foundation touch screen detected.');
            } else {
              rpiScreen = true;
              self.logger.info(id + 'Raspberry Pi Foundation touch screen detected.');
              // check for backlight module of Raspberry Pi Foundation original touch screen
              if (data.match(/^rpi_backlight\b/gm) === null) {
                self.logger.info(id + 'No backlight module of a Raspberry Pi Foundation touch screen detected.');
              } else {
                rpiBacklight = true;
                self.logger.info(id + 'Backlight module of a Raspberry Pi Foundation touch screen detected.');
                // screen brightness
                fs.readFile(blInterface + '/max_brightness', 'utf8', function (err, data) {
                  if (err) {
                    self.logger.error(id + 'Error reading ' + blInterface + '/max_brightness: ' + err);
                    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + blInterface + '/max_brightness: ' + err);
                  } else {
                    maxBrightness = parseInt(data, 10);
                    exec('/usr/bin/sudo /bin/chmod a+w ' + blInterface + '/brightness', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
                      if (error !== null) {
                        self.logger.error(id + 'Error setting file permissions for backlight brightness control: ' + error);
                      } else {
                        self.logger.info(id + 'File permissions for backlight brightness control set.');
                        if (!self.config.get('autoMode')) {
                          if (self.config.get('br2StartTime') !== self.config.get('br1StartTime')) {
                            self.toggleBrightness();
                          } else {
                            self.setBrightness(self.config.get('manualBr'));
                          }
                        } else {
                          self.autoBrightness();
                        }
                      }
                    });
                  }
                });
              }
            }
          }
          // screen orientation
          self.setOrientation(self.config.get('angle'));
          // GPU memory size
          if (self.config.get('controlGpuMem')) {
            self.modBootConfig(configTxtGpuMemBanner + 'gpu_mem=.*', configTxtGpuMemBanner + 'gpu_mem=' + self.config.get('gpuMem'))
              .then(self.modBootConfig.bind(self, '^gpu_mem', '#GPU_MEM'))
              .fail(function () {
                self.logger.info(id + 'Writing the touch display plugin\'s gpu_mem setting failed. Previous gpu_mem settings in /boot/config.txt have not been commented.');
              });
          }
        });
      }
      // screensaver
      if (self.commandRouter.volumioGetState().status === 'play') {
        lastStateIsPlaying = true;
      }
      unixDomSocket.connect('/tmp/.X11-unix/X' + self.getDisplaynumber());
      unixDomSocket.on('connect', function () {
        if ((self.config.get('afterPlay') && self.commandRouter.volumioGetState().status === 'play') || self.config.get('timeout') === 0) {
          exec('/usr/bin/xset -display :' + displayNumber + ' s reset dpms force on', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
            if (error !== null) {
              self.logger.error(id + 'Error waking up the screen: ' + error);
            }
          });
          self.setScreenTimeout(0, false);
        } else {
          self.setScreenTimeout(self.config.get('timeout'), false);
        }
        attempts = 0;
      });
      unixDomSocket.on('error', function (data) {
      });
      unixDomSocket.on('close', function () {
        if (attempts < 100) {
          setTimeout(function () {
            unixDomSocket.connect('/tmp/.X11-unix/X' + self.getDisplaynumber());
          }, 100);
          attempts++;
        } else {
          self.logger.error(id + 'Connecting to the Xserver failed.');
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_CON_XSERVER'));
        }
      });
      // catch state related events and react to changes of the playing status
      socket.emit('getState', '');
      socket.on('pushState', function (state) {
        if (state.status === 'play' && !lastStateIsPlaying) {
          if (self.config.get('afterPlay')) {
            exec('/usr/bin/xset -display :' + displayNumber + ' s reset dpms force on', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
              if (error !== null) {
                self.logger.error(id + 'Error waking up the screen: ' + error);
              }
            });
            self.setScreenTimeout(0, true);
          }
          lastStateIsPlaying = true;
        } else if (state.status !== 'play' && lastStateIsPlaying) {
          self.setScreenTimeout(self.config.get('timeout'), true);
          lastStateIsPlaying = false;
        }
      });
      defer.resolve();
    })
    .fail(function () {
      defer.reject(new Error());
    });
  return defer.promise;
};

TouchDisplay.prototype.onStop = function () {
  const self = this;
  const defer = libQ.defer();

  unixDomSocket.removeAllListeners();
  unixDomSocket.destroy();
  socket.off('pushState');
  if (device === 'Raspberry PI') {
    self.setOrientation('0');
    if (self.config.get('controlGpuMem')) {
      self.modBootConfig('^#GPU_MEM', 'gpu_mem')
        .then(self.modBootConfig.bind(self, configTxtGpuMemBanner + 'gpu_mem=.*', ''))
        .fail(function () {
          self.logger.info(id + 'Restoring gpu_mem settings in /boot/config.txt failed. The touch display plugin\'s gpu_mem settings have been preserved.');
        });
    }
    clearTimeout(autoBrTimer);
    clearTimeout(toggleBrTimer);
    if (rpiBacklight) {
      self.setBrightness(maxBrightness);
    }
  }
  self.systemctl('stop volumio-kiosk.service')
    .fin(function () {
      defer.resolve();
    });
  return defer.promise;
};

// Configuration Methods -----------------------------------------------------------------------------

TouchDisplay.prototype.getUIConfig = function () {
  const self = this;
  const defer = libQ.defer();
  const langCode = self.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(path.join(__dirname, 'i18n', 'strings_' + langCode + '.json'),
    path.join(__dirname, 'i18n', 'strings_en.json'),
    path.join(__dirname, 'UIConfig.json'))
    .then(function (uiconf) {
      uiconf.sections[0].hidden = false;
      uiconf.sections[0].content[0].value = self.config.get('timeout');
      uiconf.sections[0].content[0].attributes = [
        {
          placeholder: 120,
          maxlength: Number.MAX_SAFE_INTEGER.toString().length,
          min: 0,
          max: Number.MAX_SAFE_INTEGER
        }
      ];
      uiconf.sections[0].content[1].value = self.config.get('afterPlay');
      if (rpiBacklight) {
        uiconf.sections[1].hidden = false;
        if (fs.existsSync(als)) {
          uiconf.sections[1].content[0].hidden = false;
          uiconf.sections[1].content[0].value = self.config.get('autoMode');
          uiconf.sections[1].content[1].value = self.config.get('minBr');
          uiconf.sections[1].content[1].attributes = [
            {
              placeholder: 15,
              maxlength: maxBrightness.toString().length,
              min: 0,
              max: maxBrightness
            }
          ];
          uiconf.sections[1].content[2].value = self.config.get('maxBr');
          uiconf.sections[1].content[2].attributes = [
            {
              placeholder: maxBrightness,
              maxlength: maxBrightness.toString().length,
              min: 0,
              max: maxBrightness
            }
          ];
          uiconf.sections[1].content[4].value = self.config.get('brightnessCurve');
          uiconf.sections[1].content[5].value = self.config.get('midBr');
          uiconf.sections[1].content[5].attributes = [
            {
              placeholder: maxBrightness,
              maxlength: maxBrightness.toString().length,
              min: 0,
              max: maxBrightness
            }
          ];
        }
        uiconf.sections[1].content[7].value = self.config.get('manualBr');
        uiconf.sections[1].content[7].attributes = [
          {
            placeholder: maxBrightness,
            maxlength: maxBrightness.toString().length,
            min: 0,
            max: maxBrightness
          }
        ];
        uiconf.sections[1].content[8].value = self.config.get('br1StartTime');
        uiconf.sections[1].content[8].attributes = [
          {
            placeholder: 'hh:mm',
            maxlength: 5
          }
        ];
        uiconf.sections[1].content[9].value = self.config.get('manualBr2');
        uiconf.sections[1].content[9].attributes = [
          {
            placeholder: maxBrightness,
            maxlength: maxBrightness.toString().length,
            min: 0,
            max: maxBrightness
          }
        ];
        uiconf.sections[1].content[10].value = self.config.get('br2StartTime');
        uiconf.sections[1].content[10].attributes = [
          {
            placeholder: 'hh:mm',
            maxlength: 5
          }
        ];
      }
      if (device === 'Raspberry PI') {
        uiconf.sections[2].hidden = false;
        uiconf.sections[2].content[0].value.value = self.config.get('angle');
        uiconf.sections[2].content[0].value.label = self.commandRouter.getI18nString('TOUCH_DISPLAY.' + self.config.get('angle'));
        uiconf.sections[3].hidden = false;
        uiconf.sections[3].content[0].value = self.config.get('controlGpuMem');
        uiconf.sections[3].content[1].value = self.config.get('gpuMem');
        uiconf.sections[3].content[1].attributes = [
          {
            placeholder: 32,
            maxlength: 3,
            min: 32,
            max: 128
          }
        ];
      }
      uiconf.sections[4].hidden = false;
      uiconf.sections[4].content[0].value = self.config.get('showPointer');
      uiconf.sections[5].hidden = false;
      uiconf.sections[5].content[0].value = self.config.get('scale');
      uiconf.sections[5].content[0].attributes = [
        {
          placeholder: 100,
          maxlength: 3,
          min: 10,
          max: 200
        }
      ];
      defer.resolve(uiconf);
    })
    .fail(function (e) {
      self.logger.error(id + 'Could not fetch UI configuration: ' + e);
      defer.reject(new Error());
    });
  return defer.promise;
};

TouchDisplay.prototype.updateUIConfig = function () {
  const self = this;

  self.commandRouter.getUIConfigOnPlugin('miscellanea', 'touch_display', {})
    .then(function (uiconf) {
      self.commandRouter.broadcastMessage('pushUiConfig', uiconf);
    });
  self.commandRouter.broadcastMessage('pushUiConfig');
  uiNeedsUpdate = false;
};

TouchDisplay.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

TouchDisplay.prototype.getI18nFile = function (langCode) {
  const i18nFiles = fs.readdirSync(path.join(__dirname, 'i18n'));
  const langFile = 'strings_' + langCode + '.json';

  // check for i18n file fitting the system language
  if (i18nFiles.some(function (i18nFile) { return i18nFile === langFile; })) {
    return path.join(__dirname, 'i18n', langFile);
  }
  // return default i18n file
  return path.join(__dirname, 'i18n', 'strings_en.json');
};

TouchDisplay.prototype.saveScreensaverConf = function (confData) {
  const self = this;
  let noChanges = true;

  if (Number.isNaN(parseInt(confData.timeout, 10)) || !isFinite(confData.timeout)) {
    uiNeedsUpdate = true;
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.TIMEOUT') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
  } else {
    confData.timeout = self.checkLimits('timeout', confData.timeout, 0, Number.MAX_SAFE_INTEGER);
    if (self.config.get('timeout') !== confData.timeout || self.config.get('afterPlay') !== confData.afterPlay) {
      self.config.set('timeout', confData.timeout);
      self.config.set('afterPlay', confData.afterPlay);
      if ((confData.afterPlay && self.commandRouter.volumioGetState().status === 'play') || confData.timeout === 0) {
        exec('/usr/bin/xset -display :' + displayNumber + ' s reset dpms force on', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
          if (error !== null) {
            self.logger.error(id + 'Error waking up the screen: ' + error);
          }
        });
        self.setScreenTimeout(0, true);
      } else {
        self.setScreenTimeout(confData.timeout, true);
      }
      noChanges = false;
    }
  }
  if (uiNeedsUpdate) {
    self.updateUIConfig();
  } else if (noChanges) {
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.NO_CHANGES'));
  } else {
    self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
  }
};

TouchDisplay.prototype.saveBrightnessConf = function (confData) {
  const self = this;
  const responseData = {
    title: self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'),
    message: self.commandRouter.getI18nString('TOUCH_DISPLAY.TEST_MSG'),
    size: 'lg',
    buttons: [
      {
        name: self.commandRouter.getI18nString('TOUCH_DISPLAY.TESTBRIGHTNESS'),
        class: 'btn btn-default',
        emit: 'callMethod',
        payload: { endpoint: 'miscellanea/touch_display', method: 'testBrightness', data: Object.assign({}, confData) }
      },
      {
        name: self.commandRouter.getI18nString('COMMON.CONTINUE'),
        class: 'btn btn-info',
        emit: 'callMethod',
        payload: { endpoint: 'miscellanea/touch_display', method: 'saveBrightnessConf', data: (function () { const data = Object.assign({}, confData); data.modalResult = true; return data; })() }
      },
      {
        name: self.commandRouter.getI18nString('COMMON.CANCEL'),
        class: 'btn btn-info',
        emit: 'callMethod',
        payload: { endpoint: 'miscellanea/touch_display', method: 'saveBrightnessConf', data: (function () { const data = Object.assign({}, confData); data.modalResult = false; return data; })() }
      }
    ]
  };
  const timeValidator = /^([0-9]|0[0-9]|1[0-9]|2[0-3]):([0-5][0-9])$/;
  let noChanges = true;

  self.commandRouter.broadcastMessage('closeAllModals', '');
  if (self.config.get('autoMode') !== confData.autoMode) {
    noChanges = false;
  }
  if (confData.autoMode) {
    if (Number.isNaN(parseInt(confData.minBr, 10)) || !isFinite(confData.minBr)) {
      confData.minBr = self.config.get('minBr');
      uiNeedsUpdate = true;
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.MINBR') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
    }
    confData.minBr = self.checkLimits('minBr', confData.minBr, 0, maxBrightness);
    if (confData.modalResult === undefined && confData.minBr < 15 && confData.minBr < self.config.get('minBr')) {
      responseData.message = responseData.message.replace('${}', confData.minBr);
      responseData.buttons[2].payload.data.minBr = self.config.get('minBr');
      self.commandRouter.broadcastMessage('openModal', responseData);
      return;
    } else {
      if (confData.modalResult === false) {
        uiNeedsUpdate = true;
      } else {
        if (self.config.get('minBr') !== confData.minBr) {
          self.config.set('minBr', confData.minBr);
          noChanges = false;
        }
      }
      if (Number.isNaN(parseInt(confData.maxBr, 10)) || !isFinite(confData.maxBr)) {
        confData.maxBr = self.config.get('maxBr');
        uiNeedsUpdate = true;
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.MAXBR') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
      }
      confData.maxBr = self.checkLimits('maxBr', confData.maxBr, confData.minBr, maxBrightness);
      if (self.config.get('maxBr') !== confData.maxBr) {
        self.config.set('maxBr', confData.maxBr);
        noChanges = false;
      }
      if (confData.brightnessCurve) {
        if (Number.isNaN(parseInt(confData.midBr, 10)) || !isFinite(confData.midBr)) {
          confData.midBr = self.config.get('midBr');
          uiNeedsUpdate = true;
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.MIDBR') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
        }
        confData.midBr = self.checkLimits('midBr', confData.midBr, confData.minBr, confData.maxBr);
        if (self.config.get('midBr') !== confData.midBr) {
          self.config.set('midBr', confData.midBr);
          noChanges = false;
        }
      }
      // minAls and maxAls can only be the same value if the ALS range has not been determined before
      if (self.config.get('maxAls') <= self.config.get('minAls')) {
        if (confData.brightnessCurve) {
          self.getAlsValue({ confData: confData, action: 'minmaxmid' });
        } else {
          self.getAlsValue({ confData: confData, action: 'minmax' });
        }
      } else if (confData.brightnessCurve && (!self.config.has('midAls') || self.config.get('midAls') <= self.config.get('minAls') || self.config.get('midAls') >= self.config.get('maxAls'))) {
        self.getAlsValue({ confData: confData, action: 'mid' });
      } else {
        if (self.config.get('brightnessCurve') !== confData.brightnessCurve) {
          self.config.set('brightnessCurve', confData.brightnessCurve);
          noChanges = false;
        }
        self.config.set('autoMode', confData.autoMode);
        clearTimeout(toggleBrTimer);
        clearTimeout(autoBrTimer);
        autoBrTimeoutCleared = true;
        self.autoBrightness();
      }
    }
  } else {
    self.config.set('autoMode', confData.autoMode);
    clearTimeout(autoBrTimer);
    autoBrTimeoutCleared = true;
    if (Number.isNaN(parseInt(confData.manualBr, 10)) || !isFinite(confData.manualBr)) {
      confData.manualBr = self.config.get('manualBr');
      uiNeedsUpdate = true;
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.MANUALBR') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
    }
    confData.manualBr = self.checkLimits('manualBr', confData.manualBr, 0, maxBrightness);
    if (Number.isNaN(parseInt(confData.manualBr2, 10)) || !isFinite(confData.manualBr2)) {
      confData.manualBr2 = self.config.get('manualBr2');
      uiNeedsUpdate = true;
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.MANUALBR2') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
    }
    confData.manualBr2 = self.checkLimits('manualBr2', confData.manualBr2, 0, maxBrightness);
    if (confData.modalResult === undefined && ((confData.manualBr < 15 && confData.manualBr < self.config.get('manualBr') && confData.manualBr < self.config.get('manualBr2')) || (confData.manualBr2 < 15 && confData.manualBr2 < self.config.get('manualBr2') && confData.manualBr2 < self.config.get('manualBr')))) {
      if (confData.manualBr <= confData.manualBr2) {
        responseData.message = responseData.message.replace('${}', confData.manualBr);
        responseData.buttons[2].payload.data.manualBr = self.config.get('manualBr');
        if (confData.manualBr === confData.manualBr2) {
          responseData.buttons[2].payload.data.manualBr2 = self.config.get('manualBr2');
        }
      } else {
        responseData.message = responseData.message.replace('${}', confData.manualBr2);
        responseData.buttons[2].payload.data.manualBr2 = self.config.get('manualBr2');
      }
      self.commandRouter.broadcastMessage('openModal', responseData);
      return;
    } else {
      if (confData.modalResult === false) {
        uiNeedsUpdate = true;
        if (confData.manualBr !== confData.manualBr2) {
          if (confData.manualBr < 15 && confData.manualBr < self.config.get('manualBr')) {
            responseData.message = responseData.message.replace('${}', confData.manualBr);
            responseData.buttons[2].payload.data.manualBr = self.config.get('manualBr');
            self.commandRouter.broadcastMessage('openModal', responseData);
            return;
          } else if (confData.manualBr2 < 15 && confData.manualBr2 < self.config.get('manualBr2')) {
            responseData.message = responseData.message.replace('${}', confData.manualBr2);
            responseData.buttons[2].payload.data.manualBr2 = self.config.get('manualBr2');
            self.commandRouter.broadcastMessage('openModal', responseData);
            return;
          }
        } else {
          self.config.set('manualBr', confData.manualBr);
          self.config.set('manualBr2', confData.manualBr2);
          noChanges = false;
        }
      } else {
        self.config.set('manualBr', confData.manualBr);
        self.config.set('manualBr2', confData.manualBr2);
        noChanges = false;
      }
      if (confData.br1StartTime.match(timeValidator) === null) {
        uiNeedsUpdate = true;
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.BR1STARTTIME') + self.commandRouter.getI18nString('TOUCH_DISPLAY.INVALID'));
      } else if (self.config.get('br1StartTime') !== confData.br1StartTime) {
        self.config.set('br1StartTime', confData.br1StartTime);
        noChanges = false;
      }
      if (confData.br2StartTime.match(timeValidator) === null) {
        uiNeedsUpdate = true;
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.BR2STARTTIME') + self.commandRouter.getI18nString('TOUCH_DISPLAY.INVALID'));
      } else if (self.config.get('br2StartTime') !== confData.br2StartTime) {
        self.config.set('br2StartTime', confData.br2StartTime);
        noChanges = false;
      }
      if (self.config.get('br2StartTime') !== self.config.get('br1StartTime') && self.config.get('manualBr') !== self.config.get('manualBr2')) {
        self.toggleBrightness();
      } else {
        self.setBrightness(confData.manualBr);
        clearTimeout(toggleBrTimer);
      }
    }
  }
  if (uiNeedsUpdate) {
    self.updateUIConfig();
  } else if (noChanges) {
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.NO_CHANGES'));
  } else {
    self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
  }
};

TouchDisplay.prototype.saveOrientationConf = function (confData) {
  const self = this;
  const responseData = {
    title: self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'),
    message: self.commandRouter.getI18nString('TOUCH_DISPLAY.REBOOT_MSG'),
    size: 'lg',
    buttons: [
      {
        name: self.commandRouter.getI18nString('COMMON.RESTART'),
        class: 'btn btn-default',
        emit: 'reboot',
        payload: ''
      },
      {
        name: self.commandRouter.getI18nString('COMMON.CONTINUE'),
        class: 'btn btn-info',
        emit: 'closeModals',
        payload: ''
      }
    ]
  };

  if (self.config.get('angle') !== confData.angle.value) {
    self.config.set('angle', confData.angle.value);
    self.setOrientation(confData.angle.value)
      .then(function () {
        self.commandRouter.broadcastMessage('openModal', responseData);
      });
  } else {
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.NO_CHANGES'));
  }
};

TouchDisplay.prototype.saveGpuMemConf = function (confData) {
  const self = this;
  const responseData = {
    title: self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'),
    message: self.commandRouter.getI18nString('TOUCH_DISPLAY.REBOOT_MSG'),
    size: 'lg',
    buttons: [
      {
        name: self.commandRouter.getI18nString('COMMON.RESTART'),
        class: 'btn btn-default',
        emit: 'reboot',
        payload: ''
      },
      {
        name: self.commandRouter.getI18nString('COMMON.CONTINUE'),
        class: 'btn btn-info',
        emit: 'closeModals',
        payload: ''
      }
    ]
  };

  if (confData.controlGpuMem) {
    if (Number.isNaN(parseInt(confData.gpuMem, 10)) || !isFinite(confData.gpuMem)) {
      confData.gpuMem = self.config.get('gpuMem');
      uiNeedsUpdate = true;
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.GPUMEM') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
    } else {
      confData.gpuMem = self.checkLimits('gpuMem', confData.gpuMem, 32, 128);
    }
    if (self.config.get('gpuMem') !== confData.gpuMem || self.config.get('controlGpuMem') !== confData.controlGpuMem) {
      self.modBootConfig(configTxtGpuMemBanner + 'gpu_mem=.*', configTxtGpuMemBanner + 'gpu_mem=' + confData.gpuMem)
        .then(function () {
          self.config.set('gpuMem', confData.gpuMem);
          if (self.config.get('controlGpuMem') !== confData.controlGpuMem) {
            self.modBootConfig('^gpu_mem', '#GPU_MEM');
          }
        })
        .then(function () {
          self.config.set('controlGpuMem', confData.controlGpuMem);
          self.commandRouter.broadcastMessage('openModal', responseData);
        })
        .fail(function () {
          uiNeedsUpdate = true;
          self.logger.error(id + 'Changing gpu_mem settings failed.');
        })
        .done(function () {
          if (uiNeedsUpdate) {
            self.updateUIConfig();
          }
        });
    } else if (uiNeedsUpdate) {
      self.updateUIConfig();
    } else {
      self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.NO_CHANGES'));
    }
  } else if (self.config.get('controlGpuMem') !== confData.controlGpuMem) {
    self.modBootConfig('^#GPU_MEM', 'gpu_mem')
      .then(function () {
        self.modBootConfig(configTxtGpuMemBanner + 'gpu_mem=.*', '');
      })
      .then(function () {
        self.config.set('controlGpuMem', confData.controlGpuMem);
        self.commandRouter.broadcastMessage('openModal', responseData);
      })
      .fail(function () {
        self.updateUIConfig();
        self.logger.error(id + 'Uncommenting gpu_mem settings in /boot/config.txt failed.');
      });
  } else {
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.NO_CHANGES'));
  }
};

TouchDisplay.prototype.savePointerConf = function (confData) {
  const self = this;
  const defer = libQ.defer();
  const execStartLine = 'ExecStart=\\/usr\\/bin\\/startx \\/etc\\/X11\\/Xsession \\/opt\\/volumiokiosk.sh';
  const pointerOpt = confData.showPointer ? "'" : " -- -nocursor'";

  if (self.config.get('showPointer') !== confData.showPointer) {
    fs.stat('/tmp/.X11-unix/X' + displayNumber, function (err, stats) {
      if (err !== null || !stats.isSocket()) {
        self.updateUIConfig();
        self.logger.error(id + 'Pointer config cannot be applied: ' + err); // this can happen if the user applies a pointer setting which leads to a restart of the Xserver and then fastly (before the Xserver has completed its start) tries to apply a new pointer config
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_SET_POINTER') + err);
        defer.reject(err);
      } else {
        self.config.set('showPointer', confData.showPointer);
        exec("/bin/echo volumio | /usr/bin/sudo -S /bin/sed -i -e '/" + execStartLine + '/c\\' + execStartLine + pointerOpt + ' /lib/systemd/system/volumio-kiosk.service', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
          if (error !== null) {
            self.logger.error(id + 'Error modifying /lib/systemd/system/volumio-kiosk.service: ' + error);
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_MOD') + '/lib/systemd/system/volumio-kiosk.service: ' + error);
            defer.reject(error);
          } else {
            self.systemctl('daemon-reload')
              .then(self.onStop.bind(self))
              .then(self.onStart.bind(self))
              .then(function () {
                self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
                defer.resolve();
              })
              .fail(function () {
                defer.reject(new Error());
              });
          }
        });
      }
    });
  } else {
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.NO_CHANGES'));
  }
  return defer.promise;
};

TouchDisplay.prototype.saveScaleConf = function (confData) {
  const self = this;
  const defer = libQ.defer();

  if (Number.isNaN(parseInt(confData.scale, 10)) || !isFinite(confData.scale)) {
    uiNeedsUpdate = true;
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.SCALE') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
  } else {
    confData.scale = self.checkLimits('scale', confData.scale, 10, 200);
    if (self.config.get('scale') !== confData.scale) {
      fs.stat('/tmp/.X11-unix/X' + displayNumber, function (err, stats) {
        if (err !== null || !stats.isSocket()) {
          self.updateUIConfig();
          self.logger.error(id + 'Scale config cannot be applied: ' + err); // this can happen if the user applies a scale setting which leads to a restart of the Xserver and then fastly (before the Xserver has completed its start) tries to apply a new scale config
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_SET_SCALE') + err);
          defer.reject(err);
        } else {
          self.config.set('scale', confData.scale);
          exec('/usr/bin/chromium-browser -version', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
            if (error !== null) {
              self.logger.error(id + 'Error requesting browser version.');
            } else {
              if (confData.scale < 100 && stdout.match(/\d*\./).toString().slice(0, -1) < 57) {
                self.commandRouter.pushToastMessage('warning', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.SCALE_WARN'));
              }
              exec("/bin/echo volumio | /usr/bin/sudo -S /bin/sed -i -e 's/factor=.* /factor=" + confData.scale / 100 + " /' /opt/volumiokiosk.sh", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
                if (error !== null) {
                  self.logger.error(id + 'Error modifying /opt/volumiokiosk.sh: ' + error);
                  self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_MOD') + '/opt/volumiokiosk.sh: ' + error);
                  defer.reject(error);
                } else {
                  self.systemctl('daemon-reload')
                    .then(self.onStop.bind(self))
                    .then(self.onStart.bind(self))
                    .then(function () {
                      self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
                      defer.resolve();
                    })
                    .fail(function () {
                      defer.reject(new Error());
                    });
                }
              });
            }
          });
        }
      });
    } else {
      self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.NO_CHANGES'));
    }
  }
  if (uiNeedsUpdate) {
    self.updateUIConfig();
  }
  return defer.promise;
};

// Plugin Methods ------------------------------------------------------------------------------------

TouchDisplay.prototype.checkLimits = function (item, value, min, max) {
  const self = this;

  if (value < min) {
    if (item !== '') {
      uiNeedsUpdate = true;
      self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.' + item.toUpperCase()) + ': ' + self.commandRouter.getI18nString('TOUCH_DISPLAY.INFO_MIN'));
    }
    return min;
  }
  if (value > max) {
    if (item !== '') {
      uiNeedsUpdate = true;
      self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.' + item.toUpperCase()) + ': ' + self.commandRouter.getI18nString('TOUCH_DISPLAY.INFO_MAX'));
    }
    return max;
  }
  return parseInt(value, 10);
};

TouchDisplay.prototype.setScreenTimeout = function (timeout, showErr) {
  const self = this;
  const defer = libQ.defer();

  fs.stat('/tmp/.X11-unix/X' + displayNumber, function (err, stats) {
    if (err !== null || !stats.isSocket()) {
      self.logger.error(id + 'Error setting screensaver timeout: ' + err);
      if (showErr) {
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_SET_TIMEOUT') + err);
      }
      defer.reject(err);
    } else {
      exec('/usr/bin/xset -display :' + displayNumber + ' s off +dpms dpms 0 0 ' + timeout, { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
        if (error !== null) {
          self.logger.error(id + 'Error setting screensaver timeout: ' + error);
          if (showErr) {
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_SET_TIMEOUT') + error);
          }
          defer.reject(error);
        } else {
          self.logger.info(id + 'Setting screensaver timeout to ' + timeout + ' seconds.');
          defer.resolve();
        }
      });
    }
  });
  return defer.promise;
};

TouchDisplay.prototype.setBrightness = function (brightness) {
  const self = this;
  const defer = libQ.defer();

  fs.writeFile(blInterface + '/brightness', brightness.toString(), 'utf8', function (err) {
    if (err !== null) {
      self.logger.error(id + 'Error setting display brightness: ' + err);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_SET_BRIGHTNESS') + err);
      defer.reject(err);
    } else {
      self.logger.debug('Setting display brightness to ' + brightness + '.');
      defer.resolve();
    }
  });
  return defer.promise;
};

TouchDisplay.prototype.testBrightness = function (confData) {
  const self = this;
  const responseData = {
    title: self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'),
    message: self.commandRouter.getI18nString('TOUCH_DISPLAY.KEEP_MSG'),
    size: 'lg',
    buttons: [
      {
        name: self.commandRouter.getI18nString('TOUCH_DISPLAY.YES'),
        class: 'btn btn-info',
        emit: 'callMethod',
        payload: { endpoint: 'miscellanea/touch_display', method: 'saveBrightnessConf', data: (function () { const data = Object.assign({}, confData); data.modalResult = true; return data; })() }
      },
      {
        name: self.commandRouter.getI18nString('TOUCH_DISPLAY.NO'),
        class: 'btn btn-default',
        emit: 'callMethod',
        payload: { endpoint: 'miscellanea/touch_display', method: 'saveBrightnessConf', data: (function () { const data = Object.assign({}, confData); data.modalResult = false; return data; })() }
      }
    ]
  };

  self.commandRouter.broadcastMessage('closeAllModals', '');
  fs.readFile(blInterface + '/brightness', 'utf8', function (err, data) {
    if (err !== null) {
      self.logger.error(id + 'Error reading ' + blInterface + '/brightness: ' + err);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + blInterface + '/brightness: ' + err);
    } else {
      if (confData.autoMode) {
        responseData.buttons[1].payload.data.minBr = self.config.get('minBr');
        self.setBrightness(confData.minBr);
      } else {
        if (confData.manualBr < confData.manualBr2) {
          responseData.buttons[1].payload.data.manualBr = self.config.get('manualBr');
          self.setBrightness(confData.manualBr);
        } else {
          responseData.buttons[1].payload.data.manualBr2 = self.config.get('manualBr2');
          self.setBrightness(confData.manualBr2);
        }
      }
      setTimeout(function () {
        self.setBrightness(parseInt(data, 10));
        self.commandRouter.broadcastMessage('openModal', responseData);
      }, 5000);
    }
  });
};

TouchDisplay.prototype.autoBrightness = function (lastAls) {
  const self = this;
  let targetBrightness;
  let startFlag = false;

  fs.readFile(als, 'utf8', function (err, data) {
    if (err) {
      self.logger.error(id + 'Error reading ' + als + ': ' + err);
    } else {
      if (lastAls === undefined) {
        autoBrTimeoutCleared = false;
        // look ahead to immediately adjust screen brightness according to the ambient brightness if automatic brightness has just been activated
        lastAls = parseFloat(data);
        alsProgression.push(lastAls);
        startFlag = true;
      }
      if (alsProgression.length === 5 || startFlag) {
        if (!currentlyAdjusting) {
          if (!startFlag) {
            if (alsProgression.filter(function (val) { return val === Math.max(...alsProgression); }).length === 1) {
              // remove max value if it occurs only once
              alsProgression.splice(alsProgression.indexOf(Math.max(...alsProgression)), 1);
            }
            if (alsProgression.filter(function (val) { return val === Math.min(...alsProgression); }).length === 1) {
              // remove min value if it occurs only once
              alsProgression.splice(alsProgression.indexOf(Math.min(...alsProgression)), 1);
            }
          }
          // averaging the collected ALS values
          let newAls = Math.round(alsProgression.reduce(function (a, b) { return a + b; }) / alsProgression.length);
          if (newAls !== lastAls || startFlag) {
            if (newAls < self.config.get('minAls')) {
              newAls = self.config.get('minAls');
            }
            if (newAls > self.config.get('maxAls')) {
              newAls = self.config.get('maxAls');
            }
            lastAls = newAls;
            fs.readFile(blInterface + '/brightness', 'utf8', function (err, data) {
              if (err) {
                self.logger.error(id + 'Error reading ' + blInterface + '/brightness: ' + err);
                self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + blInterface + '/brightness: ' + err);
              } else {
                if (!self.config.get('brightnessCurve')) {
                  targetBrightness = self.checkLimits('', Math.round((newAls - self.config.get('minAls')) / (self.config.get('maxAls') - self.config.get('minAls')) * ((self.config.get('maxBr') - self.config.get('minBr'))), 10) + self.config.get('minBr'), 0, maxBrightness);
                } else {
                  const minAls = self.config.get('minAls');
                  const minBr = self.config.get('minBr');
                  const maxAls = self.config.get('maxAls');
                  const maxBr = self.config.get('maxBr');
                  let midAls = self.config.get('midAls');
                  const midBr = self.config.get('midBr');
                  if (midAls === maxAls / 2) {
                    midAls++;
                  }
                  // use a quadratic Bezier curve for calculating the target brightness of the screen in accordance to the ambient brightness;
                  // by default use t = 0.5 for calculating the control point (cPoint) coordinates from the user defined reference point
                  let t = 0.5;
                  let cPointAls = (1 / (2 * (1 - t) * t)) * midAls - ((1 - t) / (2 * t)) * minAls - (t / (2 * (1 - t))) * maxAls;
                  // should cPointAls be lower than minAls or higher than maxAls the minimum respectively maximum screen brightness set by the user would not be reachable; to avoid this limit cPointAls:
                  if (cPointAls < minAls || cPointAls > maxAls) {
                    if (cPointAls < minAls) {
                      cPointAls = minAls;
                    } else {
                      cPointAls = maxAls;
                    }
                    // with the limited cPointAls calculate an appropriate value for t before caluclating the second control point coordinate cPointBr
                    t = Math.sqrt((-Math.pow(minAls, 2) * maxAls + Math.pow(minAls, 2) * midAls + minAls * Math.pow(cPointAls, 2) + 2 * minAls * cPointAls * maxAls - 4 * minAls * cPointAls * midAls - minAls * Math.pow(maxAls, 2) + 2 * minAls * maxAls * midAls - 2 * Math.pow(cPointAls, 3) + Math.pow(cPointAls, 2) * maxAls + 4 * Math.pow(cPointAls, 2) * midAls - 4 * cPointAls * maxAls * midAls + Math.pow(maxAls, 2) * midAls) / (Math.pow(minAls, 3) - 6 * Math.pow(minAls, 2) * cPointAls + 3 * Math.pow(minAls, 2) * maxAls + 12 * minAls * Math.pow(cPointAls, 2) - 12 * minAls * cPointAls * maxAls + 3 * minAls * Math.pow(maxAls, 2) - 8 * Math.pow(cPointAls, 3) + 12 * Math.pow(cPointAls, 2) * maxAls - 6 * cPointAls * Math.pow(maxAls, 2) + Math.pow(maxAls, 3))) + (minAls - cPointAls) / (minAls - 2 * cPointAls + maxAls);
                  }
                  const cPointBr = (1 / (2 * (1 - t) * t)) * midBr - ((1 - t) / (2 * t)) * minBr - (t / (2 * (1 - t))) * maxBr;
                  // calculate t according to the newAls value and find the corresponding targetBrightness value on the Bezier curve defined by the cPoint above
                  t = Math.sqrt((-Math.pow(minAls, 2) * maxAls + Math.pow(minAls, 2) * newAls + minAls * Math.pow(cPointAls, 2) + 2 * minAls * cPointAls * maxAls - 4 * minAls * cPointAls * newAls - minAls * Math.pow(maxAls, 2) + 2 * minAls * maxAls * newAls - 2 * Math.pow(cPointAls, 3) + Math.pow(cPointAls, 2) * maxAls + 4 * Math.pow(cPointAls, 2) * newAls - 4 * cPointAls * maxAls * newAls + Math.pow(maxAls, 2) * newAls) / (Math.pow(minAls, 3) - 6 * Math.pow(minAls, 2) * cPointAls + 3 * Math.pow(minAls, 2) * maxAls + 12 * minAls * Math.pow(cPointAls, 2) - 12 * minAls * cPointAls * maxAls + 3 * minAls * Math.pow(maxAls, 2) - 8 * Math.pow(cPointAls, 3) + 12 * Math.pow(cPointAls, 2) * maxAls - 6 * cPointAls * Math.pow(maxAls, 2) + Math.pow(maxAls, 3))) + (minAls - cPointAls) / (minAls - 2 * cPointAls + maxAls);
                  targetBrightness = self.checkLimits('', Math.round((1 - t) * ((1 - t) * minBr + t * cPointBr) + t * ((1 - t) * cPointBr + t * maxBr), 10), minBr, maxBr);
                }
                self.brightnessTransition(parseInt(data, 10), targetBrightness);
              }
            });
          }
        }
        alsProgression.length = 0;
      } else if (!currentlyAdjusting) {
        // collect 5 values from the ALS for later averaging
        alsProgression.push(parseFloat(data));
      }
    }
  });
  autoBrTimer = setTimeout(function () {
    self.autoBrightness(lastAls);
  }, 1000);
};

TouchDisplay.prototype.toggleBrightness = function (br2Active) {
  const self = this;
  const d = new Date();
  let br1StartDelta = new Date(d.getFullYear(), d.getMonth(), d.getDate(), self.config.get('br1StartTime').split(':')[0], self.config.get('br1StartTime').split(':')[1]) - d.getTime();
  let br2StartDelta = new Date(d.getFullYear(), d.getMonth(), d.getDate(), self.config.get('br2StartTime').split(':')[0], self.config.get('br2StartTime').split(':')[1]) - d.getTime();
  let toggleBrTimeout;

  if (br1StartDelta < 0) {
    br1StartDelta += 86400000;
  }
  if (br2StartDelta < 0) {
    br2StartDelta += 86400000;
  }
  if (br2Active === undefined) {
    br2Active = br1StartDelta > br2StartDelta;
  }
  fs.readFile(blInterface + '/brightness', 'utf8', function (err, data) {
    if (err) {
      self.logger.error(id + 'Error reading ' + blInterface + '/brightness: ' + err);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + blInterface + '/brightness: ' + err);
    } else {
      if (br2Active) {
        self.brightnessTransition(parseInt(data, 10), self.config.get('manualBr'));
        br2Active = false;
        toggleBrTimeout = br2StartDelta;
      } else {
        self.brightnessTransition(parseInt(data, 10), self.config.get('manualBr2'));
        br2Active = true;
        toggleBrTimeout = br1StartDelta;
      }
      toggleBrTimer = setTimeout(function () {
        self.toggleBrightness(br2Active);
      }, toggleBrTimeout);
    }
  });
};

TouchDisplay.prototype.brightnessTransition = function (currentBrightness, targetBrightness) {
  const self = this;
  const startBrightness = currentBrightness;
  let newBrightness = startBrightness;

  (function loop () {
    if (newBrightness !== targetBrightness && (!autoBrTimeoutCleared || !self.config.get('autoMode'))) {
      currentlyAdjusting = true;
      if (targetBrightness > startBrightness) {
        newBrightness++;
      } else {
        newBrightness--;
      }
      new Promise(function (resolve, reject) {
        setTimeout(function () {
          if (!Number.isNaN(parseInt(newBrightness, 10)) && isFinite(newBrightness) && newBrightness !== currentBrightness) {
            self.setBrightness(newBrightness);
            currentBrightness = newBrightness;
          }
          resolve();
        }, 25);
      }).then(loop.bind(null));
    } else {
      currentlyAdjusting = false;
    }
  })(0);
};

TouchDisplay.prototype.assignCurrentAls = function (data) {
  const self = this;

  self.commandRouter.broadcastMessage('closeAllModals', '');
  fs.readFile(als, 'utf8', function (err, currentAls) {
    if (err) {
      self.logger.error(id + 'Error reading ' + als + ': ' + err);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + als + ': ' + err);
    } else {
      clearTimeout(autoBrTimer);
      autoBrTimeoutCleared = true;
      if (data.action.substr(0, 3) === 'min') {
        self.config.set('minAls', parseFloat(currentAls));
        data.action = data.action.slice(3);
        self.getAlsValue({ confData: data.confData, action: data.action });
      } else {
        if (data.action !== 'cancel') {
          self.config.set(data.action.slice(0, 3) + 'Als', parseFloat(currentAls));
        }
        if (self.config.get('maxAls') <= self.config.get('minAls')) {
          self.setBrightness(self.config.get('manualBr'));
          self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.GETALSRANGE_FAILED'));
          self.config.set('minAls', 0);
          self.config.set('maxAls', 0);
          self.config.set('brightnessCurve', false);
          self.config.set('autoMode', false);
          uiNeedsUpdate = true;
        } else {
          if (data.confData.autoMode) {
            self.config.set('autoMode', true);
          }
          if (data.action !== 'cancel') {
            if (!self.config.has('midAls') || self.config.get('midAls') <= self.config.get('minAls') || (self.config.get('midAls') >= self.config.get('maxAls'))) {
              if (data.action === 'maxmid') {
                self.getAlsValue({ confData: data.confData, action: 'mid' });
              } else if (self.config.has('midAls')) {
                if (self.config.get('midAls') <= self.config.get('minAls')) {
                  self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.MIDALS_TOO_LOW'));
                } else if (self.config.get('midAls') >= self.config.get('maxAls')) {
                  self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.MIDALS_TOO_HIGH'));
                }
                if (data.action === 'mid') {
                  self.config.delete('midAls');
                }
                self.config.set('brightnessCurve', false);
                uiNeedsUpdate = true;
              }
            } else if (data.confData !== '') {
              self.config.set('brightnessCurve', data.confData.brightnessCurve);
              uiNeedsUpdate = true;
            }
          }
          if (data.action === 'cancel' && (!self.config.has('midAls') || ((self.config.get('midAls') <= self.config.get('minAls') || (self.config.get('midAls') >= self.config.get('maxAls')))))) {
            self.config.set('brightnessCurve', false);
            uiNeedsUpdate = true;
          }
          if (self.config.get('autoMode')) {
            self.autoBrightness();
          }
        }
        if (uiNeedsUpdate) {
          self.updateUIConfig();
        }
      }
    }
  });
};

TouchDisplay.prototype.getAlsValue = function (data) {
  const self = this;
  let btnCfg = [
    {
      name: self.commandRouter.getI18nString('TOUCH_DISPLAY.OK'),
      class: 'btn btn-default',
      emit: 'callMethod',
      payload: { endpoint: 'miscellanea/touch_display', method: 'assignCurrentAls', data: { confData: data.confData, action: data.action } }
    },
    {
      name: self.commandRouter.getI18nString('TOUCH_DISPLAY.SKIP'),
      class: 'btn btn-info',
      emit: 'callMethod',
      payload: { endpoint: 'miscellanea/touch_display', method: 'getAlsValue', data: { confData: data.confData, action: data.action.slice(3) } }
    },
    {
      name: self.commandRouter.getI18nString('COMMON.CANCEL'),
      class: 'btn btn-info',
      emit: 'callMethod',
      payload: { endpoint: 'miscellanea/touch_display', method: 'assignCurrentAls', data: { confData: data.confData, action: 'cancel' } }
    }
  ];

  if (data.action === 'max' || data.action === 'mid') {
    btnCfg = [
      {
        name: self.commandRouter.getI18nString('TOUCH_DISPLAY.OK'),
        class: 'btn btn-default',
        emit: 'callMethod',
        payload: { endpoint: 'miscellanea/touch_display', method: 'assignCurrentAls', data: { confData: data.confData, action: data.action } }
      },
      {
        name: self.commandRouter.getI18nString('COMMON.CANCEL'),
        class: 'btn btn-info',
        emit: 'callMethod',
        payload: { endpoint: 'miscellanea/touch_display', method: 'assignCurrentAls', data: { confData: data.confData, action: 'cancel' } }
      }
    ];
  }
  const responseData = {
    title: self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'),
    message: self.commandRouter.getI18nString('TOUCH_DISPLAY.GET' + data.action.slice(0, 3).toUpperCase() + 'ALS_MSG'),
    size: 'lg',
    buttons: btnCfg
  };

  if (data.action === 'mid' && data.confData === '' && self.config.get('maxAls') <= self.config.get('minAls')) {
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.CALIBRATION_NEEDED'));
  } else {
    self.commandRouter.broadcastMessage('openModal', responseData);
  }
};

TouchDisplay.prototype.setOrientation = function (angle) {
  const self = this;
  const defer = libQ.defer();
  let newEntry = '';
  let transformationMatrix;

  switch (angle) {
    case '90':
      newEntry = configTxtRotationBanner + 'display_lcd_rotate=1' + os.EOL + 'display_hdmi_rotate=1';
      transformationMatrix = '0 1 0 -1 0 1 0 0 1';
      break;
    case '180':
      if (rpiScreen) {
        newEntry = configTxtRotationBanner + 'lcd_rotate=2' + os.EOL + 'display_hdmi_rotate=2';
      } else {
        newEntry = configTxtRotationBanner + 'display_lcd_rotate=2' + os.EOL + 'display_hdmi_rotate=2';
        transformationMatrix = '-1 0 1 0 -1 1 0 0 1';
      }
      break;
    case '270':
      newEntry = configTxtRotationBanner + 'display_lcd_rotate=3' + os.EOL + 'display_hdmi_rotate=3';
      transformationMatrix = '0 -1 1 1 0 0 0 0 1';
      break;
  }
  exec("/bin/echo volumio | /usr/bin/sudo -S /bin/sed -i -e '/Option \"TransformationMatrix\"/d' /etc/X11/xorg.conf.d/95-touch_display-plugin.conf", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error(id + 'Error modifying /etc/X11/xorg.conf.d/95-touch_display-plugin.conf: ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_MOD') + '/etc/X11/xorg.conf.d/95-touch_display-plugin.conf: ' + error);
    } else {
      self.logger.info(id + 'Touchscreen transformation matrix removed.');
      if (angle !== '0' && !(rpiScreen && angle === '180')) {
        exec("/bin/echo volumio | /usr/bin/sudo -S /bin/sed -i -e '/Identifier \"Touch rotation\"/a\\        Option \"TransformationMatrix\" \"" + transformationMatrix + "\"' /etc/X11/xorg.conf.d/95-touch_display-plugin.conf", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
          if (error !== null) {
            self.logger.error(id + 'Error modifying /etc/X11/xorg.conf.d/95-touch_display-plugin.conf: ' + error);
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_MOD') + '/etc/X11/xorg.conf.d/95-touch_display-plugin.conf: ' + error);
          } else {
            self.logger.info(id + 'Touchscreen transformation matrix written.');
          }
        });
      }
    }
  });
  self.modBootConfig(configTxtRotationBanner + '.*lcd_rotate=.*' + os.EOL + 'display_hdmi_rotate=.*', newEntry)
    .then(function () {
      defer.resolve();
    })
    .fail(function () {
      defer.reject(new Error());
    });
  return defer.promise;
};

TouchDisplay.prototype.modBootConfig = function (searchexp, newEntry) {
  const self = this;
  const defer = libQ.defer();
  let configFile = '/boot/userconfig.txt';

  try {
    if (/^#?gpu_mem/i.test(newEntry)) {
      self.logger.info(id + 'Un-/commenting gpu_mem settings in /boot/config.txt.');
      throw new Error();
    }
    if (fs.statSync(configFile).isFile() && new RegExp('^' + configTxtRotationBanner).test(searchexp)) {
      // if /boot/userconfig.txt exists remove plugin related screen rotation entries from /boot/config.txt
      try {
        const configTxt = fs.readFileSync('/boot/config.txt', 'utf8');
        const newConfigTxt = configTxt.replace(new RegExp(os.EOL + '*' + searchexp + os.EOL + '*'), '');
        if (newConfigTxt !== configTxt) {
          try {
            fs.writeFileSync('/boot/config.txt', newConfigTxt, 'utf8');
          } catch (e) {
            self.logger.error(id + 'Error writing /boot/config.txt: ' + e);
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_WRITE') + '/boot/config.txt: ' + e);
          }
        }
      } catch (e) {
        self.logger.error(id + 'Error reading /boot/config.txt: ' + e);
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + ' /boot/config.txt: ' + e);
      }
    } else {
      self.logger.info(id + 'Using /boot/config.txt instead of /boot/userconfig.txt.');
      throw new Error();
    }
  } catch (e) {
    configFile = '/boot/config.txt';
  } finally {
    try {
      const configTxt = fs.readFileSync(configFile, 'utf8');
      let newConfigTxt = configTxt;
      switch (newEntry) {
        case 'gpu_mem':
        case '#GPU_MEM':
          var i = configTxt.lastIndexOf(configTxtGpuMemBanner);
          if (i === -1) {
            newConfigTxt = configTxt.replace(new RegExp(searchexp, 'gm'), newEntry);
          } else {
            newConfigTxt = configTxt.substring(0, i).replace(new RegExp(searchexp, 'gm'), newEntry) + configTxt.substring(i, i + configTxtGpuMemBanner.length + 7) + configTxt.substring(i + configTxtGpuMemBanner.length + 7).replace(new RegExp(searchexp, 'gm'), newEntry);
          }
          break;
        case '':
          newConfigTxt = configTxt.replace(new RegExp(os.EOL + '*' + searchexp), newEntry);
          break;
        default:
          if (configTxt.search(newEntry) === -1) {
            newConfigTxt = configTxt.replace(new RegExp(searchexp), newEntry);
            if (newConfigTxt === configTxt) {
              newConfigTxt = configTxt + os.EOL + os.EOL + newEntry;
            }
          }
      }
      if (newConfigTxt !== configTxt) {
        try {
          fs.writeFileSync(configFile, newConfigTxt, 'utf8');
          defer.resolve();
        } catch (e) {
          self.logger.error(id + 'Error writing ' + configFile + ': ' + e);
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_WRITE') + configFile + ': ' + e);
          defer.reject(new Error());
        }
      } else {
        defer.resolve();
      }
    } catch (e) {
      self.logger.error(id + 'Error reading ' + configFile + ': ' + e);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + configFile + ': ' + e);
      defer.reject(new Error());
    }
  }
  return defer.promise;
};

TouchDisplay.prototype.getDisplaynumber = function () {
  const self = this;

  exec('/bin/systemctl status volumio-kiosk.service', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      displayNumber = '';
      self.logger.error(id + 'Xserver unix domain socket cannot be determined.');
    } else {
      stdout = stdout.slice(stdout.indexOf(' xinit '));
      stdout = stdout.slice(stdout.search(/:[0-9]+ |:[0-9]+\.[0-9]+ /) + 1, stdout.search(os.EOL));
      displayNumber = stdout.slice(0, stdout.search(/ |\.[0-9]+ /)).toString();
      self.logger.info(id + 'Using Xserver unix domain socket /tmp/.X11-unix/X' + displayNumber);
    }
  });
  return displayNumber;
};

TouchDisplay.prototype.systemctl = function (systemctlCmd) {
  const self = this;
  const defer = libQ.defer();

  exec('/usr/bin/sudo /bin/systemctl ' + systemctlCmd, { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error(id + 'Failed to ' + systemctlCmd + ': ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.GENERIC_FAILED') + systemctlCmd + ': ' + error);
      defer.reject(error);
    } else {
      self.logger.info(id + 'systemctl ' + systemctlCmd + ' succeeded.');
      defer.resolve();
    }
  });
  return defer.promise;
};
