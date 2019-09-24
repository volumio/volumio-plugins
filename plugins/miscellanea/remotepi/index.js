'use strict';

const libQ = require('kew');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const Gpio = require('onoff').Gpio;
const sleep = require('sleep');
const configTxtBanner = '#### RemotePi lirc setting below: do not alter ####' + os.EOL;
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
    self.logger.info('Shutdown initiated by UI');
    // Execute shutdown signal sequence on GPIO15
    initShutdown.write(1);
    sleep.msleep(125);
    initShutdown.write(0);
    sleep.msleep(200);
    initShutdown.write(1);
    sleep.msleep(400);
    initShutdown.write(0);
  } else {
    self.logger.info('Shutdown initiated by hardware knob or IR remote control');
  }
  // Reconfigure GPIO14 as output. Then set it to "high" to allow the RemotePi
  // to recognize when the shutdown process on the RasPi has been finished
  shutdownCtrl.unwatchAll();
  shutdownCtrl.unexport();
  shutdownCtrl = new Gpio(14, 'out');
  shutdownCtrl.write(1);
  sleep.sleep(4);
  return libQ.resolve();
};

remotepi.prototype.onStart = function () {
  const self = this;
  const defer = libQ.defer();

  self.commandRouter.loadI18nStrings();
  self.dtctHwShutdown();
  initShutdown = new Gpio(15, 'out');
  self.writeBootStr();
  defer.resolve();
  return defer.promise;
};

remotepi.prototype.onStop = function () {
  const self = this;

  self.rmBootStr();
  shutdownCtrl.unwatchAll();
  shutdownCtrl.unexport();
  initShutdown.unexport();
  return libQ.resolve();
};

// Configuration Methods -----------------------------------------------------------------------------

remotepi.prototype.getUIConfig = function () {
  const defer = libQ.defer();
  const self = this;
  const langCode = self.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(path.join(__dirname, 'i18n', 'strings_' + langCode + '.json'),
    path.join(__dirname, 'i18n', 'strings_en.json'),
    path.join(__dirname, 'UIConfig.json'))
    .then(function (uiconf) {
      uiconf.sections[0].content[0].value = self.config.get('enable_gpio17');
      defer.resolve(uiconf);
    })
    .fail(function () {
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
        emit: 'callMethod',
        payload: { 'endpoint': 'miscellanea/remotepi', 'method': 'closeModals' }
      }
    ]
  };

  if (self.config.get('enable_gpio17') !== data.gpio17) {
    self.config.set('enable_gpio17', data.gpio17);
    self.writeBootStr();
    self.commandRouter.broadcastMessage('openModal', responseData);
  } else {
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('REMOTEPI.PLUGIN_NAME'), self.commandRouter.getI18nString('REMOTEPI.NO_CHANGES'));
  }
};

remotepi.prototype.closeModals = function () {
  const self = this;

  self.commandRouter.closeModals();
};

// Plugin Methods ------------------------------------------------------------------------------------

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

// The functions "writeBootStr" and "rmBootStr" are derived from "writeI2SDAC" and "disableI2SDAC" of
// Volumio's i2s_dacs plugin; many thanks to its coders for the inspiration

remotepi.prototype.writeBootStr = function () {
  const self = this;
  const searchexp = new RegExp(configTxtBanner + 'dtoverlay=.*' + os.EOL);
  const kernelMajor = os.release().slice(0, os.release().indexOf('.'));
  const kernelMinor = os.release().slice(os.release().indexOf('.') + 1, os.release().indexOf('.', os.release().indexOf('.') + 1));
  let bootstring = 'dtoverlay=gpio-ir,gpio_pin=18' + os.EOL;

  if (self.config.get('enable_gpio17')) {
    bootstring = 'dtoverlay=gpio-ir,gpio_pin=17' + os.EOL;
  }
  if (kernelMajor < '4' || (kernelMajor === '4' && kernelMinor < '19')) {
    bootstring = bootstring.replace('gpio-ir,gpio_pin', 'lirc-rpi,gpio_in_pin');
  }
  fs.readFile('/boot/config.txt', 'utf8', function (err, configTxt) {
    if (err) {
      self.logger.error('Error reading /boot/config.txt: ' + err);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('REMOTEPI.PLUGIN_NAME'), self.commandRouter.getI18nString('REMOTEPI.ERR_READ') + '/boot/config.txt: ' + err);
    } else if (configTxt.search(configTxtBanner + bootstring) === -1) {
      let newConfigTxt = configTxt.replace(searchexp, configTxtBanner + bootstring);
      if (configTxt === newConfigTxt) {
        newConfigTxt = configTxt + os.EOL + configTxtBanner + bootstring + os.EOL;
      }
      fs.writeFile('/boot/config.txt', newConfigTxt, 'utf8', function (err) {
        if (err) {
          self.logger.error('Error writing /boot/config.txt: ' + err);
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('REMOTEPI.PLUGIN_NAME'), self.commandRouter.getI18nString('REMOTEPI.ERR_WRITE') + '/boot/config.txt: ' + err);
        }
      });
    }
  });
};

remotepi.prototype.rmBootStr = function () {
  const self = this;
  const searchexp = new RegExp(os.EOL + os.EOL + '*' + configTxtBanner + 'dtoverlay=.*' + os.EOL + '*');

  fs.readFile('/boot/config.txt', 'utf8', function (err, configTxt) {
    if (err) {
      self.logger.error('Error reading /boot/config.txt: ' + err);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('REMOTEPI.PLUGIN_NAME'), self.commandRouter.getI18nString('REMOTEPI.ERR_READ') + '/boot/config.txt: ' + err);
    } else {
      configTxt = configTxt.replace(searchexp, os.EOL);
      fs.writeFile('/boot/config.txt', configTxt, 'utf8', function (err) {
        if (err) {
          self.logger.error('Error writing /boot/config.txt: ' + err);
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('REMOTEPI.PLUGIN_NAME'), self.commandRouter.getI18nString('REMOTEPI.ERR_WRITE') + '/boot/config.txt: ' + err);
        }
      });
    }
  });
};
