'use strict';

const libQ = require('kew');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { Gpio } = require('onoff');
const id = 'remotepi: ';
var hwShutdown = false;
var shutdownCtrl, initShutdown;

module.exports = remotepi;

function remotepi (context) {
  const self = this;

  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.context.logger;
  self.configManager = self.context.configManager;
}

remotepi.prototype.onVolumioStart = function () {
  const self = this;
  const configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');

  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
  return libQ.resolve();
};

remotepi.prototype.onVolumioShutdown = function () {
  const self = this;

  if (!hwShutdown) {
    self.logger.info(id + 'Shutdown initiated by UI');
    // Execute shutdown signal sequence on GPIO15
    initShutdown.write(1);
    self.msleep(125);
    initShutdown.write(0);
    self.msleep(200);
    initShutdown.write(1);
    self.msleep(400);
    initShutdown.write(0);
  } else {
    self.logger.info(id + 'Shutdown initiated by hardware knob or IR remote control');
  }
  // Reconfigure GPIO14 as output. Then set it to "high" to allow the RemotePi
  // to recognize when the shutdown process on the RasPi has been finished
  shutdownCtrl.unwatchAll();
  shutdownCtrl.unexport();
  shutdownCtrl = new Gpio(14, 'out');
  shutdownCtrl.write(1);
  self.msleep(4000);
  return libQ.resolve();
};

remotepi.prototype.onStart = function () {
  const self = this;
  const defer = libQ.defer();

  self.commandRouter.loadI18nStrings();
  self.dtctHwShutdown();
  initShutdown = new Gpio(15, 'out');
  self.modBootConfig(self.config.get('enable_gpio17'));
  defer.resolve();
  return defer.promise;
};

remotepi.prototype.onStop = function () {
  const self = this;

  self.modBootConfig('');
  shutdownCtrl.unwatchAll();
  shutdownCtrl.unexport();
  initShutdown.unexport();
  return libQ.resolve();
};

// Configuration Methods -----------------------------------------------------------------------------

remotepi.prototype.getUIConfig = function () {
  const self = this;
  const defer = libQ.defer();
  const langCode = self.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(path.join(__dirname, 'i18n', 'strings_' + langCode + '.json'),
    path.join(__dirname, 'i18n', 'strings_en.json'),
    path.join(__dirname, 'UIConfig.json'))
    .then(function (uiconf) {
      uiconf.sections[0].content[0].value = self.config.get('enable_gpio17');
      defer.resolve(uiconf);
    })
    .fail(function (e) {
      self.logger.error(id + 'Could not fetch UI configuration: ' + e);
      defer.reject(new Error());
    });
  return defer.promise;
};

remotepi.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

remotepi.prototype.getI18nFile = function (langCode) {
  const i18nFiles = fs.readdirSync(path.join(__dirname, 'i18n'));
  const langFile = 'strings_' + langCode + '.json';

  // check for i18n file fitting the system language
  if (i18nFiles.some(function (i18nFile) { return i18nFile === langFile; })) {
    return path.join(__dirname, 'i18n', langFile);
  }
  // return default i18n file
  return path.join(__dirname, 'i18n', 'strings_en.json');
};

remotepi.prototype.saveConf = function (data) {
  const self = this;
  const responseData = {
    title: self.commandRouter.getI18nString('REMOTEPI.PLUGIN_NAME'),
    message: self.commandRouter.getI18nString('REMOTEPI.REBOOT_MSG'),
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

  if (self.config.get('enable_gpio17') !== data.gpio17) {
    self.config.set('enable_gpio17', data.gpio17);
    self.modBootConfig(data.gpio17);
    self.commandRouter.broadcastMessage('openModal', responseData);
  } else {
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('REMOTEPI.PLUGIN_NAME'), self.commandRouter.getI18nString('REMOTEPI.NO_CHANGES'));
  }
};

// Plugin Methods ------------------------------------------------------------------------------------

remotepi.prototype.msleep = function (n) {
  /* global Atomics, SharedArrayBuffer */
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, n);
};

remotepi.prototype.dtctHwShutdown = function () {
  const self = this;

  // As the RemotePi signals a shutdown event (hardware knob or IR receiver) to the RasPi by
  // setting the level on the pin of GPIO14 to "high" configure GPIO14 as input and watch it
  shutdownCtrl = new Gpio(14, 'in', 'rising');
  shutdownCtrl.watch(function (err, value) {
    if (err) {
      throw err;
    }
    if (value === 1) {
      hwShutdown = true;
      return self.commandRouter.shutdown();
    }
  });
};

remotepi.prototype.modBootConfig = function (gpio17) {
  const self = this;
  const kernelVersion = os.release().match(/[0-9]+/g);
  const configTxtBanner = '#### RemotePi lirc setting below: do not alter ####' + os.EOL;
  const searchexp = configTxtBanner + 'dtoverlay=.*';
  let bootstring = gpio17 ? 'dtoverlay=gpio-ir,gpio_pin=17' : 'dtoverlay=gpio-ir,gpio_pin=18';
  let configFile = '/boot/userconfig.txt';

  if (Number(kernelVersion[0]) < 4 || (Number(kernelVersion[0]) === 4 && Number(kernelVersion[1]) < 19)) {
    bootstring = bootstring.replace('gpio-ir,gpio_pin', 'lirc-rpi,gpio_in_pin');
  }
  try {
    if (fs.statSync(configFile).isFile()) {
      // if /boot/userconfig.txt exists, remove rempotepi related banner and bootstring from /boot/config.txt
      try {
        const configTxt = fs.readFileSync('/boot/config.txt', 'utf8');
        const newConfigTxt = configTxt.replace(new RegExp(os.EOL + searchexp + os.EOL + '*'), '');
        if (newConfigTxt !== configTxt) {
          try {
            fs.writeFileSync('/boot/config.txt', newConfigTxt, 'utf8');
          } catch (e) {
            self.logger.error(id + 'Error writing ' + configFile + ': ' + e);
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('REMOTEPI.PLUGIN_NAME'), self.commandRouter.getI18nString('REMOTEPI.ERR_WRITE') + configFile + ': ' + e);
          }
        }
      } catch (e) {
        self.logger.error(id + 'Error reading ' + configFile + ': ' + e);
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('REMOTEPI.PLUGIN_NAME'), self.commandRouter.getI18nString('REMOTEPI.ERR_READ') + configFile + ': ' + e);
      }
    } else {
      self.logger.info(id + 'Using /boot/config.txt instead of /boot/userconfig.txt. Reason: /boot/userconfig.txt is not a file.');
      throw new Error();
    }
  } catch (e) {
    configFile = '/boot/config.txt';
  } finally {
    try {
      const configTxt = fs.readFileSync(configFile, 'utf8');
      let newConfigTxt = configTxt;
      if (gpio17 === '') {
        newConfigTxt = configTxt.replace(new RegExp(os.EOL + '*' + searchexp), '');
      } else if (configTxt.search(bootstring) === -1) {
        newConfigTxt = configTxt.replace(new RegExp(searchexp), configTxtBanner + bootstring);
        if (newConfigTxt === configTxt) {
          newConfigTxt = configTxt + os.EOL + os.EOL + configTxtBanner + bootstring;
        }
      }
      if (newConfigTxt !== configTxt) {
        try {
          fs.writeFileSync(configFile, newConfigTxt, 'utf8');
        } catch (e) {
          self.logger.error(id + 'Error writing ' + configFile + ': ' + e);
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('REMOTEPI.PLUGIN_NAME'), self.commandRouter.getI18nString('REMOTEPI.ERR_WRITE') + configFile + ': ' + e);
        }
      }
    } catch (e) {
      self.logger.error(id + 'Error reading ' + configFile + ': ' + e);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('REMOTEPI.PLUGIN_NAME'), self.commandRouter.getI18nString('REMOTEPI.ERR_READ') + configFile + ': ' + e);
    }
  }
};
