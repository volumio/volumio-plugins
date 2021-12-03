'use strict';

const libQ = require('kew');
const fs = require('fs-extra');
const cp = require('child_process');
const path = require('path');
const os = require('os');
const id = 'virtual_keyboard: ';
var stoppedOnStart = false;
var mbkbd;

module.exports = VirtualKeyboard;

function VirtualKeyboard (context) {
  const self = this;

  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;
  self.configManager = self.context.configManager;
}

VirtualKeyboard.prototype.onVolumioStart = function () {
  const self = this;
  const configFile = self.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');

  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
  return libQ.resolve();
};

VirtualKeyboard.prototype.onVolumioShutdown = function () {
  if (mbkbd !== undefined) {
    mbkbd.removeAllListeners();
  }
  return libQ.resolve();
};

VirtualKeyboard.prototype.onVolumioReboot = function () {
  if (mbkbd !== undefined) {
    mbkbd.removeAllListeners();
  }
  return libQ.resolve();
};

VirtualKeyboard.prototype.onStart = function () {
  const self = this;

  self.commandRouter.loadI18nStrings();
  if (self.hasTouchDisplay()) {
    if (self.config.get('layout') === undefined) {
      self.saveConf({ layout: { value: self.getDefaultLayout() } });
    } else {
      self.reconfigure('onStart');
    }
  } else {
    stoppedOnStart = true;
    self.logger.error(id + 'Activating the Virtual Keyboard plugin failed because the required Touch Display plugin is missing.');
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('VKBD.PLUGIN_NAME'), self.commandRouter.getI18nString('VKBD.TOUCHDISPLAY_MISSING'));
    self.commandRouter.pluginManager.disablePlugin('miscellanea', 'virtual_keyboard')
      .then(function () {
        self.commandRouter.pluginManager.stopPlugin('miscellanea', 'virtual_keyboard');
      });
  }
  return libQ.resolve();
};

VirtualKeyboard.prototype.onStop = function () {
  const self = this;

  if (!stoppedOnStart) {
    self.reconfigure('onStop');
  }
  return libQ.resolve();
};

// Configuration Methods -----------------------------------------------------------------------------

VirtualKeyboard.prototype.getUIConfig = function () {
  const self = this;
  const defer = libQ.defer();
  const langCode = self.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(path.join(__dirname, 'i18n', 'strings_' + langCode + '.json'),
    path.join(__dirname, 'i18n', 'strings_en.json'),
    path.join(__dirname, 'UIConfig.json'))
    .then(function (uiconf) {
      const dirs = fs.readdirSync(path.join(__dirname, 'layouts'));
      const activeLayout = self.config.get('layout');
      uiconf.sections[0].content[0].value.value = activeLayout;
      uiconf.sections[0].content[0].value.label = activeLayout;
      for (let i = 0, n = dirs.length; i < n; i++) {
        self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[0].options', {
          value: dirs[i],
          label: dirs[i]
        });
      }
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });
  return defer.promise;
};

VirtualKeyboard.prototype.updateUIConfig = function () {
  const self = this;
  const defer = libQ.defer();

  self.commandRouter.getUIConfigOnPlugin('miscellanea', 'virtual_keyboard', {})
    .then(function (uiconf) {
      self.commandRouter.broadcastMessage('pushUiConfig', uiconf);
    });
  self.commandRouter.broadcastMessage('pushUiConfig');
  return defer.promise;
};

VirtualKeyboard.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

VirtualKeyboard.prototype.getI18nFile = function (langCode) {
  const i18nFiles = fs.readdirSync(path.join(__dirname, 'i18n'));
  const langFile = 'strings_' + langCode + '.json';

  // check for i18n file fitting the system language
  if (i18nFiles.some(function (i18nFile) { return i18nFile === langFile; })) {
    return path.join(__dirname, 'i18n', langFile);
  }
  // return default i18n file
  return path.join(__dirname, 'i18n', 'strings_en.json');
};

VirtualKeyboard.prototype.saveConf = function (data) {
  const self = this;
  const layoutFolder = data.layout.value.replace(/ /g, '\\ ');

  if (data.layout.value !== self.config.get('layout')) {
    cp.exec('/bin/cp -r ' + path.join(__dirname, 'layouts', layoutFolder, 'keyboard.xml') + ' /data/configuration/miscellanea/virtual_keyboard', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
      if (error !== null) {
        self.updateUIConfig();
        self.logger.error(id + 'Error copying virtual keyboard layout file: ' + error);
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('VKBD.PLUGIN_NAME'), self.commandRouter.getI18nString('VKBD.ERR_COPY') + path.join(__dirname, 'layouts', layoutFolder, 'keyboard.xml: ') + error);
      } else {
        self.config.set('layout', data.layout.value);
        self.logger.info(id + 'Virtual keyboard layout correctly updated.');
        self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('VKBD.PLUGIN_NAME'), self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
        self.reconfigure('onSave');
      }
    });
  } else {
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('VKBD.PLUGIN_NAME'), self.commandRouter.getI18nString('VKBD.NO_CHANGES'));
    if (mbkbd === undefined) {
      self.reconfigure('onSave');
    }
  }
};

// Plugin Methods ------------------------------------------------------------------------------------

VirtualKeyboard.prototype.getDefaultLayout = function () {
  const self = this;
  let defaultLayout;
  switch (self.commandRouter.sharedVars.get('language_code')) {
    case 'de':
      defaultLayout = 'Deutsch';
      break;
    case 'en':
      defaultLayout = 'English - US';
      break;
    case 'fi':
      defaultLayout = 'Suomi';
      break;
    case 'ru':
      defaultLayout = 'Русский';
      break;
    case 'fr':
      defaultLayout = 'Français';
      break;
    case 'ca':
    case 'cs':
    case 'da':
    case 'es':
    case 'gr':
    case 'hr':
    case 'hu':
    case 'it':
    case 'ja':
    case 'ko':
    case 'nl':
    case 'no':
    case 'pl':
    case 'pt':
    case 'sk':
    case 'sv':
    case 'tr':
    case 'ua':
    case 'vi':
    case 'zh':
    case 'zh_TW':
    default:
      defaultLayout = 'English - US';
  }
  return defaultLayout;
};

VirtualKeyboard.prototype.reconfigure = function (action) {
  const self = this;
  const defer = libQ.defer();
  let sedString = '';

  if (action === 'onStop') {
    sedString = "/^MB_KBD_CONFIG=\"\\/data\\/configuration\\/miscellanea\\/virtual_keyboard\\/keyboard.xml\" matchbox-keyboard -d &/d' -e '/^matchbox-window-manager -use_titlebar no &/d' -e 's/^#OPENBOX-SESSION &/openbox-session \\&/";
    if (mbkbd !== undefined) {
      mbkbd.removeAllListeners();
    }
  } else if (new RegExp('^openbox-session &', 'm').test(fs.readFileSync('/opt/volumiokiosk.sh', 'utf8'))) {
    sedString = 's/^openbox-session \\&/#OPENBOX-SESSION \\&\\nMB_KBD_CONFIG=\\"\\/data\\/configuration\\/miscellanea\\/virtual_keyboard\\/keyboard.xml\\" matchbox-keyboard -d \\&\\nmatchbox-window-manager -use_titlebar no \\&/';
  }
  if (sedString !== '') {
    cp.exec("/bin/echo volumio | /usr/bin/sudo -S /bin/sed -i -e '" + sedString + "' /opt/volumiokiosk.sh", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
      if (error !== null) {
        self.logger.error(id + 'Error modifying /opt/volumiokiosk.sh: ' + error);
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('VKBD.PLUGIN_NAME'), self.commandRouter.getI18nString('VKBD.ERR_MOD') + '/opt/volumiokiosk.sh: ' + error);
        defer.reject(error);
      } else {
        self.logger.info(id + 'Successfully modified /opt/volumiokiosk.sh.');
        if (self.hasTouchDisplay(true)) {
          self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('VKBD.PLUGIN_NAME'), self.commandRouter.getI18nString('VKBD.RESTART_VOLUMIOKIOSK_MSG'));
          setTimeout(function () {
            self.commandRouter.executeOnPlugin('miscellanea', 'touch_display', 'onStop', '')
              .then(function () {
                self.commandRouter.executeOnPlugin('miscellanea', 'touch_display', 'onStart', '');
              });
          }, 3000);
        }
        defer.resolve();
      }
    });
  } else if (action === 'onSave' && self.hasTouchDisplay(true)) {
    cp.exec('/usr/bin/killall matchbox-keyboard', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
      if (error !== null && stderr.search('matchbox-keyboard: no process found') === -1) {
        self.logger.error(id + 'Error stopping Matchbox keyboard: ' + error);
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('VKBD.PLUGIN_NAME'), self.commandRouter.getI18nString('VKBD.ERR_RESTART') + 'Matchbox keyboard: ' + error);
        defer.reject(error);
      } else {
        self.logger.info(id + 'Matchbox keyboard stopped.');
        if (mbkbd !== undefined) {
          mbkbd.removeAllListeners();
        }
        cp.exec('/bin/systemctl status volumio-kiosk.service', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
          if (error !== null) {
            self.logger.error(id + 'Xserver unix domain socket cannot be determined.');
            self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('VKBD.PLUGIN_NAME'), self.commandRouter.getI18nString('VKBD.ERR_RESTART') + 'Matchbox keyboard: ' + error);
            defer.reject(error);
          } else {
            stdout = stdout.slice(stdout.indexOf(' xinit '));
            stdout = stdout.slice(stdout.search(/:[0-9]+ |:[0-9]+\.[0-9]+ /) + 1, stdout.search(os.EOL));
            const displayNumber = stdout.slice(0, stdout.search(/ |\.[0-9]+ /)).toString();
            try {
              mbkbd = cp.spawn('matchbox-keyboard', ['-d'], { env: { ...process.env, DISPLAY: ':' + displayNumber, MB_KBD_CONFIG: '/data/configuration/miscellanea/virtual_keyboard/keyboard.xml' }, uid: 1000, gid: 1000 })
                .on('error', function (error) {
                  mbkbd = undefined;
                  self.logger.error(id + 'Error starting Matchbox keyboard: ' + error);
                  self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('VKBD.PLUGIN_NAME'), self.commandRouter.getI18nString('VKBD.ERR_RESTART') + 'Matchbox keyboard: ' + error);
                })
                .stderr.on('data', function (data) {
                  mbkbd = undefined;
                  self.logger.error(id + 'Error starting Matchbox keyboard: ' + data);
                  self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('VKBD.PLUGIN_NAME'), self.commandRouter.getI18nString('VKBD.ERR_RESTART') + 'Matchbox keyboard: ' + data);
                });
              self.logger.info(id + 'Restarting Matchbox keyboard.');
              defer.resolve();
            } catch (error) {
              self.logger.error(id + 'Error starting Matchbox keyboard: ' + error);
              self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('VKBD.PLUGIN_NAME'), self.commandRouter.getI18nString('VKBD.ERR_RESTART') + 'Matchbox keyboard: ' + error);
              defer.reject(error);
            }
          }
        });
      }
    });
  }
  return defer.promise;
};

VirtualKeyboard.prototype.hasTouchDisplay = function (statusRequest) {
  const self = this;
  const pluginsMatrix = self.commandRouter.pluginManager.getPluginsMatrix();

  for (let i = 0, n = pluginsMatrix.length; i < n; i++) {
    for (let j = 0, o = pluginsMatrix[i].catPlugin.length; j < o; j++) {
      if (pluginsMatrix[i].catPlugin[j].name === 'touch_display') {
        if (statusRequest) {
          return pluginsMatrix[i].catPlugin[j].enabled;
        } else {
          return true;
        }
      }
    }
  }
  return false;
};
