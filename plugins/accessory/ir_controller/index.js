'use strict';

const libQ = require('kew');
const fs = require('fs-extra');
const { exec } = require('child_process');
const path = require('path');
const os = require('os');
const id = 'ir_controller: ';
const kernelMajor = os.release().slice(0, os.release().indexOf('.'));
const kernelMinor = os.release().slice(os.release().indexOf('.') + 1, os.release().indexOf('.', os.release().indexOf('.') + 1));
const overlay = (kernelMajor < '4' || (kernelMajor === '4' && kernelMinor < '19')) ? 'lirc-rpi' : 'gpio-ir';
var gpioConfigurable = false;
var device, header;

module.exports = IrController;

function IrController (context) {
  const self = this;

  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;
  self.configManager = self.context.configManager;
}

IrController.prototype.onVolumioStart = function () {
  const self = this;
  const configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');

  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
  return libQ.resolve();
};

IrController.prototype.onStart = function () {
  const self = this;
  const defer = libQ.defer();

  self.commandRouter.loadI18nStrings();
  device = self.getAdditionalConf('system_controller', 'system', 'device');
  self.saveIROptions({ ir_profile: { value: self.config.get('ir_profile', 'JustBoom IR Remote') }, notify: false });
  if (device === 'Raspberry PI') {
    if (!fs.existsSync('/sys/firmware/devicetree/base/lirc_rpi') && fs.readdirSync('/sys/firmware/devicetree/base').find(function (fn) { return fn.startsWith('ir-receiver'); }) === undefined) {
      if (overlay === 'gpio-ir') {
        self.logger.info(id + 'HAT did not load /proc/device-tree/ir_receiver!');
      } else {
        self.logger.info(id + 'HAT did not load /proc/device-tree/lirc_rpi!');
      }
      // determine header pincount by Raspberry Pi revision code (https://www.raspberrypi.org/documentation/hardware/raspberrypi/revision-codes/README.md)
      exec('awk \'/^Revision/ {sub("^1000", "", $3); print $3}\' /proc/cpuinfo', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
        if (error !== null) {
          self.logger.info(id + 'Raspberry Pi model cannot be determined: ' + error);
        } else {
          gpioConfigurable = true;
          self.logger.info(id + 'Raspberry Pi revision code: ' + stdout);
          if (stdout === 'beta' || parseInt(stdout, 16) < 4) {
            // Model B beta, model B PCB rev. 1.0: original 26pin header (P1)
            header = '26';
          } else if (parseInt(stdout, 16) < 16) {
            // Model B PCB rev. 2.0 and model A PCB rev. 2.0: altered 26pin header (P1) + 8pin header (P5)
            header = '34';
          } else {
            const modelId = (stdout.length === 4) ? stdout.toString() : stdout.substr(-3, 2);
            switch (modelId) {
              // sort out the Compute Modules
              case '0011': // CM1
              case '0014': // CM1
              case '06': // CM
              case '0a': // CM3
              case '10': // CM3+
              case '14': // CM4
                gpioConfigurable = false;
                break;
              default:
                // Models B+, A+, 2B, 3B, 3B+, 3A+, 4B, Zero, Zero W, Pi 400: 40pin header (P1)
                header = '40';
            }
          }
          if (gpioConfigurable) {
            self.saveGpioOptions({ header40_gpio_in_pin: { value: self.config.get('gpio_in_pin', 25) }, header34_gpio_in_pin: { value: self.config.get('gpio_in_pin', 25) }, header26_gpio_in_pin: { value: self.config.get('gpio_in_pin', 25) }, gpio_pull: { value: self.config.get('gpio_pull', 'up') }, forceActiveState: self.config.get('forceActiveState', false), activeState: { value: self.config.get('activeState', 1) }, notify: false });
          }
        }
      });
    } else {
      if (overlay === 'gpio-ir') {
        self.logger.info(id + 'HAT already loaded /proc/device-tree/ir_receiver!');
      } else {
        self.logger.info(id + 'HAT already loaded /proc/device-tree/lirc_rpi!');
      }
    }
  }
  defer.resolve();
  return defer.promise;
};

IrController.prototype.onStop = function () {
  const self = this;
  const defer = libQ.defer();

  exec('usr/bin/sudo /bin/systemctl stop lirc.service', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error(id + 'Error stopping LIRC: ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('IRCONTROLLER.GENERIC_FAILED') + error);
    } else {
      self.logger.info(id + 'LIRC correctly stopped.');
      defer.resolve();
    }
  });
  if (device === 'Raspberry PI') {
    let gpioPin = ' gpio_pin=' + self.config.get('gpio_in_pin');
    let activeState = (self.config.get('forceActiveState')) ? ' invert=' + self.config.get('activeState') : '';
    if (overlay === 'lirc-rpi') {
      gpioPin = ' gpio_in_pin=' + self.config.get('gpio_in_pin');
      activeState = (self.config.get('forceActiveState')) ? ' sense=' + self.config.get('activeState') : '';
    }
    const params = gpioPin + ' gpio_pull=' + self.config.get('gpio_pull') + activeState;
    self.dtoverlayIndex(params + '$')
      .then(function (i) {
        if (i !== -1) {
          self.dtoverlay('-r ' + i)
            .then(function () {
              self.logger.info(id + overlay + ' overlay removed.');
            })
            .fail(function (e) {
              self.logger.error(id + 'Error removing ' + overlay + ' overlay: ' + e);
            });
        }
      });
  }
  return defer.promise;
};

// Configuration Methods -----------------------------------------------------------------------------

IrController.prototype.getLabelForSelect = function (options, key) {
  for (let i = 0, n = options.length; i < n; i++) {
    if (options[i].value === key) {
      return options[i].label;
    }
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

IrController.prototype.getUIConfig = function () {
  const self = this;
  const defer = libQ.defer();
  const langCode = this.commandRouter.sharedVars.get('language_code');
  const dirs = fs.readdirSync(path.join(__dirname, 'configurations'));

  self.commandRouter.i18nJson(path.join(__dirname, 'i18n', 'strings_' + langCode + '.json'),
    path.join(__dirname, 'i18n', 'strings_en.json'),
    path.join(__dirname, 'UIConfig.json'))
    .then(function (uiconf) {
      const activeProfile = self.config.get('ir_profile', 'JustBoom IR Remote');
      uiconf.sections[0].content[0].value.value = activeProfile;
      uiconf.sections[0].content[0].value.label = activeProfile;
      for (let i = 0, n = dirs.length; i < n; i++) {
        self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[0].options', { value: dirs[i], label: dirs[i] });
      }
      if (gpioConfigurable) {
        uiconf.sections[1].hidden = false;
        switch (header) {
          case '40':
            uiconf.sections[1].content[0].hidden = false;
            uiconf.sections[1].content[0].value.value = self.config.get('gpio_in_pin', 25);
            uiconf.sections[1].content[0].value.label = self.config.get('gpio_in_pin', 25);
            uiconf.sections[1].content[1].hidden = true;
            uiconf.sections[1].content[2].hidden = true;
            break;
          case '34':
            uiconf.sections[1].content[0].hidden = true;
            uiconf.sections[1].content[1].hidden = false;
            uiconf.sections[1].content[1].value.value = self.config.get('gpio_in_pin', 25);
            uiconf.sections[1].content[1].value.label = self.config.get('gpio_in_pin', 25);
            uiconf.sections[1].content[2].hidden = true;
            break;
          case '26':
            uiconf.sections[1].content[0].hidden = true;
            uiconf.sections[1].content[1].hidden = true;
            uiconf.sections[1].content[2].hidden = false;
            uiconf.sections[1].content[2].value.value = self.config.get('gpio_in_pin', 25);
            uiconf.sections[1].content[2].value.label = self.config.get('gpio_in_pin', 25);
            break;
        }
        uiconf.sections[1].content[3].value.value = self.config.get('gpio_pull', 'up');
        uiconf.sections[1].content[3].value.label = self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[1].content[3].options'), self.config.get('gpio_pull', 'up'));
        uiconf.sections[1].content[4].value = self.config.get('forceActiveState', false);
        uiconf.sections[1].content[5].value.value = self.config.get('activeState', 1);
        uiconf.sections[1].content[5].value.label = self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[1].content[5].options'), self.config.get('activeState', 1));
      } else {
        uiconf.sections[1].hidden = true;
      }
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });
  return defer.promise;
};

IrController.prototype.updateUIConfig = function () {
  const self = this;
  const defer = libQ.defer();

  self.commandRouter.getUIConfigOnPlugin('accessory', 'ir_controller', {})
    .then(function (uiconf) {
      self.commandRouter.broadcastMessage('pushUiConfig', uiconf);
    });
  self.commandRouter.broadcastMessage('pushUiConfig');
  return defer.promise;
};

IrController.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

IrController.prototype.getI18nFile = function (langCode) {
  const i18nFiles = fs.readdirSync(path.join(__dirname, 'i18n'));
  const langFile = 'strings_' + langCode + '.json';

  // check for i18n file fitting the system language
  if (i18nFiles.some(function (i18nFile) { return i18nFile === langFile; })) {
    return path.join(__dirname, 'i18n', langFile);
  }
  // return default i18n file
  return path.join(__dirname, 'i18n', 'strings_en.json');
};

IrController.prototype.getAdditionalConf = function (type, controller, data) {
  const self = this;
  const confs = self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);

  return confs;
};

IrController.prototype.saveIROptions = function (data) {
  const self = this;
  const profileFolder = data.ir_profile.value.replace(/ /g, '\\ ');

  self.config.set('ir_profile', data.ir_profile.value);
  self.createHardwareConf();
  exec('/usr/bin/sudo /bin/chmod -R 777 /etc/lirc/*', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error(id + 'Error setting file permissions on /etc/lirc/: ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('IRCONTROLLER.GENERIC_FAILED') + error);
    } else {
      self.logger.info(id + 'File permissions successfully set on /etc/lirc/.');
      exec('/bin/cp -r ' + path.join(__dirname, 'configurations', profileFolder, '*') + ' /etc/lirc/', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
        if (error !== null) {
          self.logger.error(id + 'Error copying configurations: ' + error);
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('COMMON.SETTINGS_SAVE_ERROR'));
        } else {
          self.logger.info(id + 'LIRC correctly updated.');
          if (data.notify !== false) {
            self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
          }
          setTimeout(function () {
            self.restartLirc(data.notify);
          }, 1000);
        }
      });
    }
  });
};

IrController.prototype.saveGpioOptions = function (data) {
  const self = this;
  let gpioInPin;

  switch (header) {
    case '40':
      gpioInPin = data.header40_gpio_in_pin.value;
      break;
    case '34':
      gpioInPin = data.header34_gpio_in_pin.value;
      break;
    case '26':
      gpioInPin = data.header26_gpio_in_pin.value;
      break;
  }
  if (self.config.get('gpio_in_pin') !== gpioInPin || self.config.get('gpio_pull') !== data.gpio_pull.value || self.config.get('forceActiveState') !== data.forceActiveState || self.config.get('activeState') !== data.activeState.value || data.notify === false) {
    self.manageIrOverlays(gpioInPin, data)
      .then(function () {
        self.config.set('gpio_in_pin', gpioInPin);
        self.config.set('gpio_pull', data.gpio_pull.value);
        self.config.set('forceActiveState', data.forceActiveState);
        self.config.set('activeState', data.activeState.value);
        if (data.notify !== false) {
          self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
        }
      })
      .fail(function (uiNeedsUpdate) {
        if (uiNeedsUpdate) {
          self.updateUIConfig();
        }
      });
  } else if (data.notify !== false) {
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('IRCONTROLLER.NO_CHANGES'));
  }
};

// Plugin Methods ------------------------------------------------------------------------------------

IrController.prototype.createHardwareConf = function (callback) {
  const self = this;
  let conf;

  exec('/usr/bin/sudo /bin/chmod 777 /etc/lirc/hardware.conf', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error(id + 'Error setting file permissions on /etc/hardware.conf: ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('IRCONTROLLER.GENERIC_FAILED') + error);
    } else {
      self.logger.info(id + 'File permissions successfully set on /etc/hardware.conf.');
      try {
        fs.readFile(path.join(__dirname, 'hardware.conf.tmpl'), 'utf8', function (err, data) {
          if (err) {
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('IRCONTROLLER.ERR_READ' + '/etc/lirc/hardware.conf: ') + err);
            return self.logger.error(id + 'Error reading /etc/lirc/hardware.conf: ' + err);
          }
          if (device === 'Odroid-C') {
            conf = data.replace(/\${module}/g, 'meson-ir');
          } else {
            conf = (overlay === 'gpio-ir') ? data.replace(/\${module}/g, 'gpio_ir_recv') : data.replace(/\${module}/g, 'lirc_rpi');
          }
          fs.writeFile('/etc/lirc/hardware.conf', conf, 'utf8', function (err) {
            if (err) {
              self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('IRCONTROLLER.ERR_WRITE' + '/etc/lirc/hardware.conf: ') + err);
              return self.logger.error(id + 'Error writing /etc/lirc/hardware.conf: ' + err);
            }
          });
        });
      } catch (err) {
        callback(err);
      }
    }
  });
};

IrController.prototype.restartLirc = function (notify) {
  const self = this;

  exec('usr/bin/sudo /bin/systemctl stop lirc.service', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error(id + 'Failed to stop lirc.service: ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_ERROR'));
    }
    setTimeout(function () {
      exec('usr/bin/sudo /bin/systemctl start lirc.service', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
        if (error !== null) {
          self.logger.error(id + 'Error restarting lirc.service: ' + error);
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_ERROR'));
        } else {
          self.logger.info(id + 'lirc.service correctly started.');
          if (notify !== false) {
            self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_DESCRIPTION'));
          }
        }
      });
    }, 1000);
  });
};

IrController.prototype.dtoverlay = function (options) {
  const defer = libQ.defer();

  exec('/usr/bin/sudo /usr/bin/dtoverlay ' + options, { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null || stderr !== '') {
      defer.reject(error);
    } else {
      defer.resolve();
    }
  });
  return defer.promise;
};

IrController.prototype.dtoverlayIndex = function (params) {
  const defer = libQ.defer();
  const self = this;
  var i = -1;

  exec('/usr/bin/dtoverlay -l', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error(id + error);
      defer.reject();
    } else {
      i = stdout.search(new RegExp('[0-9]+:  ' + overlay + ' ' + params, 'gm'));
      if (i !== -1) {
        i = stdout.slice(i, stdout.indexOf(':', i));
      }
      defer.resolve(i);
    }
  });
  return defer.promise;
};

IrController.prototype.manageIrOverlays = function (gpioInPin, data) {
  const defer = libQ.defer();
  const self = this;
  let gpioPinOld = ' gpio_pin=' + self.config.get('gpio_in_pin', '25');
  let gpioPinNew = ' gpio_pin=' + gpioInPin;
  let activeStateOld = (self.config.get('forceActiveState', false)) ? ' invert=' + self.config.get('activeState', 1) : '';
  let activeStateNew = (data.forceActiveState) ? ' invert=' + data.activeState.value : '';
  let paramsOld = gpioPinOld + ' gpio_pull=' + self.config.get('gpio_pull', 'up') + activeStateOld;
  let paramsNew = gpioPinNew + ' gpio_pull=' + data.gpio_pull.value + activeStateNew;

  if (overlay === 'lirc-rpi') {
    gpioPinOld = ' gpio_in_pin=' + self.config.get('gpio_in_pin', '25');
    gpioPinNew = ' gpio_in_pin=' + gpioInPin;
    activeStateOld = (self.config.get('forceActiveState', false)) ? ' sense=' + self.config.get('activeState', 1) : '';
    activeStateNew = (data.forceActiveState) ? ' sense=' + data.activeState.value : '';
    paramsOld = gpioPinOld + ' gpio_in_pull=' + self.config.get('gpio_pull', 'up') + activeStateOld;
    paramsNew = gpioPinNew + ' gpio_in_pull=' + data.gpio_pull.value + activeStateNew;
  }
  self.dtoverlayIndex(paramsOld + '$')
    .then(function (i) {
      self.dtoverlay('-r ' + i)
        .then(function () {
          self.logger.info(id + 'Overlay ' + overlay + paramsOld + ' removed.');
        })
        .fail(function (e) {
          if (i !== -1) {
            self.logger.error(id + 'Error removing overlay: ' + e);
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('IRCONTROLLER.ERR_REMOVE_OVERLAY') + e);
          }
        })
        .done(function () {
          self.dtoverlayIndex(paramsNew + '$')
            .then(function (i) {
              if (i === -1) {
                self.dtoverlayIndex(gpioPinNew)
                  .then(function (i) {
                    if (i === -1) {
                      self.dtoverlay(overlay + paramsNew)
                        .then(function () {
                          self.logger.info(id + 'Overlay ' + overlay + paramsNew + ' loaded.');
                          defer.resolve();
                        })
                        .fail(function (e) {
                          self.logger.error(id + 'Error loading overlay: ' + e);
                          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('IRCONTROLLER.ERR_LOAD_OVERLAY') + e);
                          if (data.notify === false) {
                            defer.reject(false);
                          } else {
                            self.dtoverlay(overlay + paramsOld);
                            defer.reject(true);
                          }
                        });
                    } else {
                      self.logger.error(id + 'GPIO ' + gpioInPin + ' is already occupied.');
                      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IRCONTROLLER.PLUGIN_NAME'), self.commandRouter.getI18nString('IRCONTROLLER.ERR_GPIO_OCCUPIED'));
                      if (data.notify === false) {
                        defer.reject(false);
                      } else {
                        self.dtoverlay(overlay + paramsOld);
                        defer.reject(true);
                      }
                    }
                  });
              } else {
                self.logger.info(id + 'Overlay ' + overlay + paramsNew + ' is already loaded.');
                defer.resolve();
              }
            });
        });
    });
  return defer.promise;
};
