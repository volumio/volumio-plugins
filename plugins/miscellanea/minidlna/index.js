'use strict';

const libQ = require('kew');
const fs = require('fs-extra');
const exec = require('child_process').exec;
const path = require('path');
const configItems = ['show_more', 'media_dir_a', 'media_dir_p', 'media_dir_v', 'db_dir', 'log_dir',
  'root_container', 'network_interface', 'port', 'presentation_url', 'friendly_name',
  'serial', 'model_name', 'model_number', 'inotify', 'album_art_names', 'strict_dlna',
  'enable_tivo', 'notify_interval', 'minissdpdsocket', 'force_sort_criteria', 'max_connections',
  'loglevel_general', 'loglevel_artwork', 'loglevel_database', 'loglevel_inotify',
  'loglevel_scanner', 'loglevel_metadata', 'loglevel_http', 'loglevel_ssdp', 'loglevel_tivo'];

module.exports = minidlna;

function minidlna (context) {
  const self = this;

  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;
  self.configManager = self.context.configManager;
}

minidlna.prototype.onVolumioStart = function () {
  const self = this;
  const configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');

  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);

  return libQ.resolve();
};

minidlna.prototype.onStart = function () {
  const self = this;
  const defer = libQ.defer();

  self.commandRouter.loadI18nStrings();
  self.initialConf()
    .then(function (e) {
      self.logger.info('Starting minidlna.service');
      self.systemctl('start', 'minidlna.service')
        .then(function (e) {
          defer.resolve();
        });
    })
    .fail(function (e) {
      defer.reject(new Error('on starting miniDLNA plugin'));
    });

  return defer.promise;
};

minidlna.prototype.onStop = function () {
  const self = this;
  const defer = libQ.defer();

  self.logger.info('Stopping minidlna.service');
  self.systemctl('stop', 'minidlna.service')
    .then(function (e) {
      defer.resolve();
    })
    .fail(function (e) {
      defer.reject(new Error('on stopping miniDLNA plugin'));
    });

  return defer.promise;
};

// Configuration Methods -----------------------------------------------------------------------------

minidlna.prototype.getLabelForSelect = function (options, key) {
  for (let i = 0, n = options.length; i < n; i++) {
    if (options[i].value === key) {
      return options[i].label;
    }
  }

  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

minidlna.prototype.getUIConfig = function () {
  const defer = libQ.defer();
  const self = this;
  const langCode = self.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(path.join(__dirname, 'i18n', 'strings_' + langCode + '.json'),
    path.join(__dirname, 'i18n', 'strings_en.json'),
    path.join(__dirname, 'UIConfig.json'))
    .then(function (uiconf) {
      configItems.forEach(function (configItem, i) {
        let value = self.config.get(configItem);
        switch (configItem) {
          case 'root_container':
          case 'loglevel_general':
          case 'loglevel_artwork':
          case 'loglevel_database':
          case 'loglevel_inotify':
          case 'loglevel_scanner':
          case 'loglevel_metadata':
          case 'loglevel_http':
          case 'loglevel_ssdp':
          case 'loglevel_tivo':
            self.configManager.setUIConfigParam(uiconf, 'sections[0].content[' + i + '].value.value', value);
            self.configManager.setUIConfigParam(uiconf, 'sections[0].content[' + i + '].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[' + i + '].options'), value));
            break;
          default:
            uiconf.sections[0].content[i].value = value;
        }
      });
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });

  return defer.promise;
};

minidlna.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

minidlna.prototype.getI18nFile = function (langCode) {
  const i18nFiles = fs.readdirSync(path.join(__dirname, 'i18n'));
  const langFile = 'strings_' + langCode + '.json';

  // check for i18n file fitting the system language
  if (i18nFiles.some(function (i18nFile) { return i18nFile === langFile; })) {
    return path.join(__dirname, 'i18n', langFile);
  }

  // return default i18n file
  return path.join(__dirname, 'i18n', 'strings_en.json');
};

minidlna.prototype.saveConf = function (data) {
  const self = this;
  const defer = libQ.defer();

  configItems.forEach(function (configItem) {
    switch (configItem) {
      case 'root_container':
      case 'loglevel_general':
      case 'loglevel_artwork':
      case 'loglevel_database':
      case 'loglevel_inotify':
      case 'loglevel_scanner':
      case 'loglevel_metadata':
      case 'loglevel_http':
      case 'loglevel_ssdp':
      case 'loglevel_tivo':
        self.config.set(configItem, data[configItem].value);
        break;
      case 'port':
        self.checkVal(configItem, data[configItem], 0, 65535);
        break;
      case 'notify_interval':
        self.checkVal(configItem, data[configItem], 0, Number.MAX_SAFE_INTEGER);
        break;
      case 'max_connections':
        self.checkVal(configItem, data[configItem], 0, Number.MAX_SAFE_INTEGER);
        break;
      case 'media_dir_a':
      case 'media_dir_p':
      case 'media_dir_v':
        if (!fs.existsSync(data[configItem])) {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), data[configItem] + self.commandRouter.getI18nString('MINIDLNA.MISSING'));
        }
        // fall through to default
      default:
        self.config.set(configItem, data[configItem]);
    }
  });
  self.createMinidlnaConf()
    .then(function (e) {
      self.logger.info('Restarting minidlna.service');
      self.systemctl('restart', 'minidlna.service')
        .then(function (e) {
          self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.CONF_UPDATED'));
          self.logger.success('The miniDLNA configuration has been updated.');
          defer.resolve();
        });
    })
    .fail(function (e) {
      defer.reject();
    });

  return defer.promise;
};

minidlna.prototype.checkVal = function (item, data, min, max) {
  const self = this;

  if (!Number.isNaN(parseInt(data, 10)) && isFinite(data)) {
    if (data < min || data > max) {
      self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.' + item.toUpperCase()) + self.commandRouter.getI18nString('MINIDLNA.INFO_RANGE') + '(' + min + '-' + max + ').');
    } else {
      self.config.set(item, parseInt(data, 10));
    }
  } else {
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.' + item.toUpperCase()) + self.commandRouter.getI18nString('MINIDLNA.NAN'));
  }
};

// Plugin Methods ------------------------------------------------------------------------------------

minidlna.prototype.initialConf = function () {
  const self = this;
  const defer = libQ.defer();

  if (!fs.existsSync('/etc/minidlna.conf')) {
    self.createMinidlnaConf()
      .then(function (e) {
        defer.resolve();
      })
      .fail(function (e) {
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.ERR_CREATE') + '/etc/minidlna.conf.');
        defer.reject(new Error('on creating /etc/minidlna.conf.'));
      });
  } else {
    return libQ.resolve();
  }

  return defer.promise;
};

minidlna.prototype.createMinidlnaConf = function () {
// derived from balbuze's "createVolumiominidlnaFile" function of his volumiominidlna plugin - many thanks to balbuze
  const self = this;
  const defer = libQ.defer();

  fs.readFile(path.join(__dirname, 'minidlna.conf.tmpl'), 'utf8', function (err, data) {
    if (err) {
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.ERR_READ') + path.join(__dirname, 'minidlna.conf.tmpl: ') + err);
      defer.reject();
      return console.log('error: Error reading ' + path.join(__dirname, 'minidlna.conf.tmpl: ') + err);
    } else {
      configItems.forEach(function (configItem) {
        let value;
        switch (self.config.get(configItem)) {
          case false:
            value = 'no';
            break;
          case true:
            value = 'yes';
            break;
          default:
            value = self.config.get(configItem);
        }
        data = data.replace('${' + configItem + '}', value);
      });
      fs.writeFile('/etc/minidlna.conf', data, 'utf8', function (err) {
        if (err) {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.ERR_WRITE') + '/etc/minidlna.conf: ' + err);
          defer.reject();
          return console.log('error: Error writing /etc/minidlna.conf: ' + err);
        } else {
          self.logger.info('/etc/minidlna.conf written');
          defer.resolve();
        }
      });
    }
  });

  return defer.promise;
};

minidlna.prototype.systemctl = function (systemctlCmd, arg) {
  const self = this;
  const defer = libQ.defer();
  const cmd = '/usr/bin/sudo /bin/systemctl ' + systemctlCmd + ' ' + arg;

  exec(cmd, {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error('Failed to ' + systemctlCmd + ' ' + arg + ': ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.GENERIC_FAILED') + systemctlCmd + ' ' + arg + ': ' + error);
      defer.reject();
    } else {
      self.logger.info(systemctlCmd + ' of ' + arg + ' succeeded.');
      defer.resolve();
    }
  });

  return defer.promise;
};

minidlna.prototype.forceRescan = function () {
  const self = this;
  const defer = libQ.defer();

  exec('/usr/bin/minidlnad -R', {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error('Failed to rescan the media directories: ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.RESCAN_FAILED') + error);
      defer.reject();
    } else {
      self.logger.info('Rescanning the media directories.');
      self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.RESCANNING'));
      defer.resolve();
    }
  });

  return defer.promise;
};
