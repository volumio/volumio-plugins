'use strict';

const libQ = require('kew');
const fs = require('fs-extra');
const exec = require('child_process').exec;
const path = require('path');
const os = require('os');
const io = require('socket.io-client');
const socket = io.connect('http://localhost:3000');
const blInterface = '/sys/devices/platform/rpi_backlight/backlight/rpi_backlight';
const als = '/etc/als'; // The plugin awaits the current value of an optional ambient light sensor (ALS) as a single number in /etc/als.
const configTxtGpuMemBanner = '#### Touch Display gpu_mem setting below: do not alter ####' + os.EOL;
const configTxtRotationBanner = '#### Touch Display rotation setting below: do not alter ####' + os.EOL;
var rpiScreen = false;
var rpiBacklight = false;
var maxBrightness = 255;
var alsProgression = [];
var timeoutCleared = false;
var currentlyAdjusting = false;
var uiNeedsUpdate = false;
var device, displayNumber, autoBrTimer, setScrToTimer1, setScrToTimer2, setScrToTimer3;

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
  let t = 0;

  self.commandRouter.loadI18nStrings();
  clearTimeout(setScrToTimer1);
  self.systemctl('daemon-reload')
    .then(self.systemctl.bind(self, 'start volumio-kiosk.service'))
    .then(function () {
      self.logger.info('Volumio Kiosk started');
      device = self.commandRouter.executeOnPlugin('system_controller', 'system', 'getConfigParam', 'device');
      if (device === 'Raspberry PI') {
        // detect Raspberry Pi Foundation original touch screen
        exec('/bin/grep "^rpi_ft5406\\>" /proc/modules', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
          if (error !== null) {
            self.logger.info('No Raspberry Pi Foundation touch screen detected.');
          } else {
            rpiScreen = true;
            self.logger.info('Raspberry Pi Foundation touch screen detected.');
            // check for backlight module of Raspberry Pi Foundation original touch screen
            exec('/bin/grep "^rpi_backlight\\>" /proc/modules', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
              if (error !== null) {
                self.logger.info('No backlight module of a Raspberry Pi Foundation touch screen detected.');
              } else {
                rpiBacklight = true;
                self.logger.info('Backlight module of a Raspberry Pi Foundation touch screen detected.');
                // screen brightness
                fs.readFile(blInterface + '/max_brightness', 'utf8', function (err, data) {
                  if (err) {
                    self.logger.error('Error reading ' + blInterface + '/max_brightness: ' + err);
                    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + blInterface + '/max_brightness: ' + err);
                  } else {
                    maxBrightness = parseInt(data, 10);
                    if (!self.config.get('autoMode')) {
                      self.setBrightness(self.config.get('manualBr'));
                    } else {
                      self.autoBrightness();
                    }
                  }
                });
              }
            });
          }
          // screen orientation
          self.setOrientation(self.config.get('angle'));
          // GPU memory size
          self.modBootConfig(configTxtGpuMemBanner + 'gpu_mem=.*', configTxtGpuMemBanner + 'gpu_mem=' + self.config.get('gpuMem'))
            .then(self.modBootConfig.bind(self, '^gpu_mem', '#GPU_MEM'))
            .fail(function () {
              self.logger.info('Writing the touch display plugin\'s gpu_mem setting failed. Previous gpu_mem settings in /boot/config.txt have not been commented.');
            });
        });
      }
      // screensaver
      if (self.commandRouter.volumioGetState().status === 'play') {
        lastStateIsPlaying = true;
      }
      exec('/bin/systemctl status volumio-kiosk.service', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
        if (error !== null) {
          displayNumber = '';
          self.logger.error('Xorg socket cannot be determined.');
        } else {
          stdout = stdout.slice(stdout.indexOf('/usr/bin/X :') + 12);
          displayNumber = stdout.slice(0, stdout.indexOf(' '));
          self.logger.info('Using Xorg socket /tmp/.X11-unix/X' + displayNumber);
          // check presence of unix domain socket for Xorg to test if the xserver has finished starting up
          fs.stat('/tmp/.X11-unix/X' + displayNumber, function (err, stats) {
            if (err !== null || !stats.isSocket()) {
              t = 2000;
              self.logger.info('xserver is not ready: Delay setting screensaver timeout by 2 seconds.');
            }
            setScrToTimer1 = setTimeout(function () {
              if (lastStateIsPlaying && self.config.get('afterPlay')) {
                self.setScreenTimeout(0);
              } else {
                self.setScreenTimeout(self.config.get('timeout'));
              }
            }, t);
          });
          // catch state related events and react to changes of the playing status
          socket.emit('getState', '');
          socket.on('pushState', function (state) {
            if (state.status === 'play' && !lastStateIsPlaying) {
              if (self.config.get('afterPlay')) {
                exec('/usr/bin/xset -display :' + displayNumber + ' s reset dpms force on', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
                  if (error !== null) {
                    self.logger.error('Error waking up the screen: ' + error);
                  }
                });
                self.setScreenTimeout(0);
              }
              lastStateIsPlaying = true;
            } else if (state.status !== 'play' && lastStateIsPlaying) {
              self.setScreenTimeout(self.config.get('timeout'));
              lastStateIsPlaying = false;
            }
          });
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

  socket.off('pushState');
  clearTimeout(setScrToTimer1);
  clearTimeout(setScrToTimer2);
  clearTimeout(setScrToTimer3);
  if (device === 'Raspberry PI') {
    self.setOrientation('0');
    self.modBootConfig('^#GPU_MEM', 'gpu_mem')
      .then(self.modBootConfig.bind(self, configTxtGpuMemBanner + 'gpu_mem=.*', ''))
      .fail(function () {
        self.logger.info('Restoring gpu_mem settings in /boot/config.txt failed. The touch display plugin\'s gpu_mem settings have been preserved.');
      });
    clearTimeout(autoBrTimer);
    if (rpiBacklight) {
      self.setBrightness(maxBrightness);
    }
  }
  self.systemctl('stop volumio-kiosk.service')
    .then(function () {
      self.logger.info('Volumio Kiosk stopped');
      defer.resolve();
    })
    .fail(function () {
      defer.reject(new Error());
    });
  return libQ.resolve();
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
      if (displayNumber !== '') {
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
      }
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
      }
      if (device === 'Raspberry PI') {
        uiconf.sections[2].hidden = false;
        uiconf.sections[2].content[0].value.value = self.config.get('angle');
        uiconf.sections[2].content[0].value.label = self.commandRouter.getI18nString('TOUCH_DISPLAY.' + self.config.get('angle'));
        uiconf.sections[3].hidden = false;
        uiconf.sections[3].content[0].value = self.config.get('gpuMem');
        uiconf.sections[3].content[0].attributes = [
          {
            placeholder: 32,
            maxlength: 3,
            min: 32,
            max: 128
          }
        ];
      }
      if (displayNumber !== '') {
        uiconf.sections[4].hidden = false;
        uiconf.sections[4].content[0].value = self.config.get('showPointer');
      }
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });
  return defer.promise;
};

TouchDisplay.prototype.updateUIConfig = function () {
  const self = this;
  const defer = libQ.defer();

  self.commandRouter.getUIConfigOnPlugin('miscellanea', 'touch_display', {})
    .then(function (uiconf) {
      self.commandRouter.broadcastMessage('pushUiConfig', uiconf);
    });
  self.commandRouter.broadcastMessage('pushUiConfig');
  uiNeedsUpdate = false;
  return defer.promise;
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
  const defer = libQ.defer();
  let t = 0;

  if (Number.isNaN(parseInt(confData.timeout, 10)) || !isFinite(confData.timeout)) {
    uiNeedsUpdate = true;
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_SET_TIMEOUT') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
  } else {
    confData.timeout = self.checkLimits('timeout', confData.timeout, 0, Number.MAX_SAFE_INTEGER);
    self.config.set('timeout', confData.timeout);
    self.config.set('afterPlay', confData.afterPlay);
    fs.stat('/tmp/.X11-unix/X' + displayNumber, function (err, stats) {
      if (err !== null || !stats.isSocket()) {
        t = 2000;
        self.logger.info('xserver is not ready: Delay applying screensaver config by 2 seconds.');
      }
      clearTimeout(setScrToTimer2);
      setScrToTimer2 = setTimeout(function () {
        fs.stat('/tmp/.X11-unix/X' + displayNumber, function (err, stats) {
          if (err !== null || !stats.isSocket()) {
            self.logger.error('xserver is not ready: Screensaver config cannot be applied.'); // this can happen if the user applies a pointer setting which invokes a restart of the volumio-kiosk.service and then fastly (before the xserver has completed its start) tries to apply a new screensaver config
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_SET_SCREENSAVER'));
          } else {
            if ((confData.afterPlay && self.commandRouter.volumioGetState().status === 'play') || confData.timeout === 0) {
              exec('/usr/bin/xset -display :' + displayNumber + ' s reset dpms force on', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
                if (error !== null) {
                  self.logger.error('Error waking up the screen: ' + error);
                }
              });
              self.setScreenTimeout(0);
            } else {
              self.setScreenTimeout(confData.timeout);
            }
          }
        });
      }, t);
    });
  }
  if (uiNeedsUpdate) {
    self.updateUIConfig();
  }
  defer.resolve();
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
        payload: { endpoint: 'miscellanea/touch_display', method: 'testBrightness', data: confData }
      },
      {
        name: self.commandRouter.getI18nString('COMMON.CONTINUE'),
        class: 'btn btn-info',
        emit: 'callMethod',
        payload: { endpoint: 'miscellanea/touch_display', method: 'saveBrightnessConf', data: { autoMode: confData.autoMode, minBr: confData.minBr, maxBr: confData.maxBr, brightnessCurve: confData.brightnessCurve, midBr: confData.midBr, manualBr: confData.manualBr, modalResult: true } }
      },
      {
        name: self.commandRouter.getI18nString('COMMON.CANCEL'),
        class: 'btn btn-info',
        emit: 'callMethod',
        payload: { endpoint: 'miscellanea/touch_display', method: 'saveBrightnessConf', data: { autoMode: confData.autoMode, minBr: self.config.get('minBr'), maxBr: confData.maxBr, brightnessCurve: confData.brightnessCurve, midBr: confData.midBr, manualBr: self.config.get('manualBr'), modalResult: false } }
      }
    ]
  };

  self.commandRouter.broadcastMessage('closeAllModals', '');
  if (confData.autoMode) {
    if (Number.isNaN(parseInt(confData.minBr, 10)) || !isFinite(confData.minBr)) {
      confData.minBr = self.config.get('minBr');
      uiNeedsUpdate = true;
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.MINBR') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
    }
    confData.minBr = self.checkLimits('minBr', confData.minBr, 0, maxBrightness);
    if (confData.modalResult === undefined && confData.minBr < 15 && confData.minBr < self.config.get('minBr')) {
      self.commandRouter.broadcastMessage('openModal', responseData);
    } else {
      if (confData.modalResult === false) {
        uiNeedsUpdate = true;
      } else {
        self.config.set('minBr', confData.minBr);
      }
      if (Number.isNaN(parseInt(confData.maxBr, 10)) || !isFinite(confData.maxBr)) {
        confData.maxBr = self.config.get('maxBr');
        uiNeedsUpdate = true;
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.MAXBR') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
      }
      confData.maxBr = self.checkLimits('maxBr', confData.maxBr, confData.minBr, maxBrightness);
      self.config.set('maxBr', confData.maxBr);
      if (confData.brightnessCurve) {
        if (Number.isNaN(parseInt(confData.midBr, 10)) || !isFinite(confData.midBr)) {
          confData.midBr = self.config.get('midBr');
          uiNeedsUpdate = true;
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.MIDBR') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
        }
        confData.midBr = self.checkLimits('midBr', confData.midBr, confData.minBr, confData.maxBr);
        self.config.set('midBr', confData.midBr);
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
        self.config.set('brightnessCurve', confData.brightnessCurve);
        self.config.set('autoMode', confData.autoMode);
        clearTimeout(autoBrTimer);
        timeoutCleared = true;
        self.autoBrightness();
      }
    }
  } else {
    if (Number.isNaN(parseInt(confData.manualBr, 10)) || !isFinite(confData.manualBr)) {
      confData.manualBr = self.config.get('manualBr');
      uiNeedsUpdate = true;
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.MANUALBR') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
    }
    confData.manualBr = self.checkLimits('manualBr', confData.manualBr, 0, maxBrightness);
    if (confData.modalResult === undefined && confData.manualBr < 15 && confData.manualBr < self.config.get('manualBr')) {
      self.commandRouter.broadcastMessage('openModal', responseData);
    } else {
      if (confData.modalResult === false) {
        uiNeedsUpdate = true;
      } else {
        self.config.set('manualBr', confData.manualBr);
      }
      self.config.set('autoMode', confData.autoMode);
      clearTimeout(autoBrTimer);
      timeoutCleared = true;
      self.setBrightness(confData.manualBr);
    }
  }
  if (uiNeedsUpdate) {
    self.updateUIConfig();
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

  if (Number.isNaN(parseInt(confData.gpuMem, 10)) || !isFinite(confData.gpuMem)) {
    uiNeedsUpdate = true;
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.GPUMEM') + self.commandRouter.getI18nString('TOUCH_DISPLAY.NAN'));
  } else {
    confData.gpuMem = self.checkLimits('gpuMem', confData.gpuMem, 32, 128);
    if (self.config.get('gpuMem') !== confData.gpuMem) {
      self.config.set('gpuMem', confData.gpuMem);
      self.modBootConfig(configTxtGpuMemBanner + 'gpu_mem=.*', configTxtGpuMemBanner + 'gpu_mem=' + confData.gpuMem)
        .then(function () {
          self.commandRouter.broadcastMessage('openModal', responseData);
        });
    }
  }
  if (uiNeedsUpdate) {
    self.updateUIConfig();
  }
};

TouchDisplay.prototype.savePointerConf = function (confData) {
  const self = this;
  const defer = libQ.defer();
  const execStartLine = 'ExecStart=\\/usr\\/bin\\/startx \\/etc\\/X11\\/Xsession \\/opt\\/volumiokiosk.sh';
  let pointerOpt = " -- -nocursor'";
  let t = 0;

  if (self.config.get('showPointer') !== confData.showPointer) {
    fs.stat('/tmp/.X11-unix/X' + displayNumber, function (err, stats) {
      if (err !== null || !stats.isSocket()) {
        self.updateUIConfig();
        self.logger.error('xserver is not ready: Pointer setting cannot be applied.'); // this can happen if the user applies a pointer setting which invokes a restart of the volumio-kiosk.service and then fastly (before the xserver has completed its start) tries to apply a new pointer config
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_SET_POINTER'));
        defer.reject(err);
      } else {
        self.config.set('showPointer', confData.showPointer);
        if (confData.showPointer) {
          pointerOpt = "'";
        }
        exec("/bin/echo volumio | /usr/bin/sudo -S /bin/sed -i -e '/" + execStartLine + '/c\\' + execStartLine + pointerOpt + ' /lib/systemd/system/volumio-kiosk.service', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
          if (error !== null) {
            self.logger.error('Error modifying /lib/systemd/system/volumio-kiosk.service: ' + error);
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_MOD') + '/lib/systemd/system/volumio-kiosk.service: ' + error);
            defer.reject(error);
          } else {
            clearTimeout(setScrToTimer3);
            self.systemctl('daemon-reload')
              .then(self.systemctl.bind(self, 'restart volumio-kiosk.service'))
              .then(function () {
                self.logger.info('Restarting volumio-kiosk.service succeeded.');
                exec('/bin/systemctl status volumio-kiosk.service', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
                  if (error !== null) {
                    displayNumber = '';
                    self.logger.error('Xorg socket cannot be determined.');
                  } else {
                    stdout = stdout.slice(stdout.indexOf('/usr/bin/X :') + 12);
                    displayNumber = stdout.slice(0, stdout.indexOf(' '));
                    fs.stat('/tmp/.X11-unix/X' + displayNumber, function (err, stats) {
                      if (err !== null || !stats.isSocket()) {
                        t = 2000;
                        self.logger.info('xserver is not ready: Delay setting screensaver timeout by 2 seconds.');
                      }
                      setScrToTimer3 = setTimeout(function () {
                        if (self.config.get('afterPlay') && self.commandRouter.volumioGetState().status === 'play') {
                          self.setScreenTimeout(0);
                        } else {
                          self.setScreenTimeout(self.config.get('timeout'));
                        }
                      }, t);
                    });
                  }
                  defer.resolve();
                });
              })
              .fail(function () {
                defer.reject(new Error());
              });
          }
        });
      }
    });
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

TouchDisplay.prototype.setScreenTimeout = function (timeout) {
  const self = this;
  const defer = libQ.defer();

  fs.stat('/tmp/.X11-unix/X' + displayNumber, function (err, stats) {
    if (err !== null || !stats.isSocket()) {
      self.logger.error('xserver is not ready: Screensaver timeout cannot be set.');
    } else {
      exec('/bin/bash -c "/usr/bin/xset -display :' + displayNumber + ' s off +dpms dpms 0 0 ' + timeout + '"', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
        if (error !== null) {
          self.logger.error('Error setting screensaver timeout: ' + error);
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_SET_TIMEOUT') + error);
          defer.reject(error);
        } else {
          self.logger.info('Setting screensaver timeout to ' + timeout + ' seconds.');
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

  fs.writeFile(blInterface + '/brightness', brightness, 'utf8', function (err) {
    if (err !== null) {
      self.logger.error('Error setting display brightness: ' + err);
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
        payload: { endpoint: 'miscellanea/touch_display', method: 'saveBrightnessConf', data: { autoMode: confData.autoMode, minBr: confData.minBr, maxBr: confData.maxBr, brightnessCurve: confData.brightnessCurve, midBr: confData.midBr, manualBr: confData.manualBr, modalResult: true } }
      },
      {
        name: self.commandRouter.getI18nString('TOUCH_DISPLAY.NO'),
        class: 'btn btn-default',
        emit: 'callMethod',
        payload: { endpoint: 'miscellanea/touch_display', method: 'saveBrightnessConf', data: { autoMode: confData.autoMode, minBr: self.config.get('minBr'), maxBr: confData.maxBr, brightnessCurve: confData.brightnessCurve, midBr: confData.midBr, manualBr: self.config.get('manualBr'), modalResult: false } }
      }
    ]
  };

  self.commandRouter.broadcastMessage('closeAllModals', '');
  fs.readFile(blInterface + '/brightness', 'utf8', function (err, data) {
    if (err !== null) {
      self.logger.error('Error reading ' + blInterface + '/brightness: ' + err);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + blInterface + '/brightness: ' + err);
    } else {
      if (confData.autoMode) {
        self.setBrightness(confData.minBr);
      } else {
        self.setBrightness(confData.manualBr);
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
      self.logger.error('Error reading ' + als + ': ' + err);
    } else {
      if (lastAls === undefined) {
        timeoutCleared = false;
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
                self.logger.error('Error reading ' + blInterface + '/brightness: ' + err);
                self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + blInterface + '/brightness: ' + err);
              } else {
                let currentBrightness = parseInt(data, 10);
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
                const startBrightness = currentBrightness;
                let newBrightness = startBrightness;
                (function loop () {
                  if (newBrightness !== targetBrightness && !timeoutCleared) {
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

TouchDisplay.prototype.assignCurrentAls = function (data) {
  const self = this;

  self.commandRouter.broadcastMessage('closeAllModals', '');
  fs.readFile(als, 'utf8', function (err, currentAls) {
    if (err) {
      self.logger.error('Error reading ' + als + ': ' + err);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + als + ': ' + err);
    } else {
      clearTimeout(autoBrTimer);
      timeoutCleared = true;
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
      self.logger.error('Error modifying /etc/X11/xorg.conf.d/95-touch_display-plugin.conf: ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_MOD') + '/etc/X11/xorg.conf.d/95-touch_display-plugin.conf: ' + error);
    } else {
      self.logger.info('Touchscreen transformation matrix removed.');
      if (!(rpiScreen && angle === '180')) {
        exec("/bin/echo volumio | /usr/bin/sudo -S /bin/sed -i -e '/Identifier \"Touch rotation\"/a\\        Option \"TransformationMatrix\" \"" + transformationMatrix + "\"' /etc/X11/xorg.conf.d/95-touch_display-plugin.conf", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
          if (error !== null) {
            self.logger.error('Error modifying /etc/X11/xorg.conf.d/95-touch_display-plugin.conf: ' + error);
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_MOD') + '/etc/X11/xorg.conf.d/95-touch_display-plugin.conf: ' + error);
          } else {
            self.logger.info('Touchscreen transformation matrix written.');
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
      self.logger.info('Un-/commenting gpu_mem settings in /boot/config.txt.');
      throw new Error();
    }
    if (fs.statSync(configFile).isFile()) {
      // if /boot/userconfig.txt exists remove touch display related entry from /boot/config.txt
      try {
        const configTxt = fs.readFileSync('/boot/config.txt', 'utf8');
        const newConfigTxt = configTxt.replace(new RegExp(os.EOL + '*' + searchexp + os.EOL + '*'), '');
        if (newConfigTxt !== configTxt) {
          try {
            fs.writeFileSync('/boot/config.txt', newConfigTxt, 'utf8');
          } catch (e) {
            self.logger.error('Error writing /boot/config.txt: ' + e);
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_WRITE') + '/boot/config.txt: ' + e);
          }
        }
      } catch (e) {
        self.logger.error('Error reading /boot/config.txt: ' + e);
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + ' /boot/config.txt: ' + e);
      }
    } else {
      self.logger.info('Using /boot/config.txt instead of /boot/userconfig.txt. Reason: /boot/userconfig.txt is not a file.');
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
          self.logger.error('Error writing ' + configFile + ': ' + e);
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_WRITE') + configFile + ': ' + e);
          defer.reject(new Error());
        }
      } else {
        defer.resolve();
      }
    } catch (e) {
      self.logger.error('Error reading ' + configFile + ': ' + e);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.ERR_READ') + configFile + ': ' + e);
      defer.reject(new Error());
    }
  }
  return defer.promise;
};

TouchDisplay.prototype.systemctl = function (systemctlCmd) {
  const self = this;
  const defer = libQ.defer();

  exec('/usr/bin/sudo /bin/systemctl ' + systemctlCmd, { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error('Failed to ' + systemctlCmd + ': ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('TOUCH_DISPLAY.PLUGIN_NAME'), self.commandRouter.getI18nString('TOUCH_DISPLAY.GENERIC_FAILED') + systemctlCmd + ': ' + error);
      defer.reject(error);
    } else {
      self.logger.info('systemctl ' + systemctlCmd + ' succeeded.');
      defer.resolve();
    }
  });
  return defer.promise;
};
