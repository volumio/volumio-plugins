'use strict';

const libQ = require('kew');
const fs = require('fs-extra');
const { exec } = require('child_process');
const path = require('path');
const id = 'minidlna: ';
const configItems = ['show_more', 'media_dir_a', 'media_dir_p', 'media_dir_v', 'merge_media_dirs',
  'db_dir', 'log_dir', 'root_container', 'network_interface', 'port', 'presentation_url',
  'friendly_name', 'serial', 'model_name', 'model_number', 'inotify', 'album_art_names', 'strict_dlna',
  'enable_tivo', 'tivo_discovery', 'notify_interval', 'minissdpdsocket', 'force_sort_criteria',
  'max_connections', 'loglevel_general', 'loglevel_artwork', 'loglevel_database', 'loglevel_inotify',
  'loglevel_scanner', 'loglevel_metadata', 'loglevel_http', 'loglevel_ssdp', 'loglevel_tivo', 'wide_links',
  'enable_subtitles'];
var minidlnad = '/usr/sbin/minidlnad';
var minidlnaVersion;

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
  const defaultConfig = fs.readJsonSync(path.join(__dirname, 'config.json'));

  self.commandRouter.loadI18nStrings();
  for (const configItem in defaultConfig) {
    if (!self.config.has(configItem)) {
      self.config.set(configItem, defaultConfig[configItem].value);
    }
  }
  try {
    if (!fs.statSync('/usr/sbin/minidlnad').isFile()) {
      throw new Error();
    }
  } catch (e) {
    minidlnad = '/usr/bin/minidlnad';
  }
  exec(minidlnad + ' -V', { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error(id + 'Failed to query miniDLNA version: ' + error);
      minidlnaVersion = '0';
    } else {
      minidlnaVersion = stdout.slice(8);
      self.logger.info(id + 'Found miniDLNA version ' + minidlnaVersion);
    }
    self.initialConf()
      .then(function () {
        self.logger.info(id + 'Starting minidlna.service');
        self.systemctl('start minidlna.service')
          .then(function () {
            defer.resolve();
          });
      })
      .fail(function (e) {
        defer.reject(e);
      });
  });
  return defer.promise;
};

minidlna.prototype.onStop = function () {
  const self = this;
  const defer = libQ.defer();

  self.logger.info(id + 'Stopping minidlna.service');
  self.systemctl('stop minidlna.service')
    .fin(function () {
      defer.resolve();
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
  const self = this;
  const defer = libQ.defer();
  const langCode = self.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(path.join(__dirname, 'i18n', 'strings_' + langCode + '.json'),
    path.join(__dirname, 'i18n', 'strings_en.json'),
    path.join(__dirname, 'UIConfig.json'))
    .then(function (uiconf) {
      configItems.forEach(function (configItem, i) {
        const value = self.config.get(configItem);
        switch (configItem) {
          case 'root_container':
          case 'tivo_discovery':
          case 'loglevel_general':
          case 'loglevel_artwork':
          case 'loglevel_database':
          case 'loglevel_inotify':
          case 'loglevel_scanner':
          case 'loglevel_metadata':
          case 'loglevel_http':
          case 'loglevel_ssdp':
          case 'loglevel_tivo':
            uiconf.sections[0].content[i].value.value = value;
            uiconf.sections[0].content[i].value.label = self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[' + i + '].options'), value);
            break;
          default:
            uiconf.sections[0].content[i].value = value;
        }
        switch (configItem) {
          case 'merge_media_dirs':
          case 'tivo_discovery':
          case 'wide_links':
            if (minidlnaVersion.localeCompare('1.2.1', 'en-u-kn-true') < 0) {
              uiconf.sections[0].content[i].hidden = true;
            }
            break;
          case 'enable_subtitles':
            if (minidlnaVersion.localeCompare('1.3.0', 'en-u-kn-true') < 0) {
              uiconf.sections[0].content[i].hidden = true;
            }
        }
      });
      if (minidlnaVersion.localeCompare('1.2.0', 'en-u-kn-true') < 0) {
        uiconf.sections[1].content[1].hidden = true;
      }
      defer.resolve(uiconf);
    })
    .fail(function (e) {
      self.logger.error(id + 'Could not fetch UI configuration: ' + e);
      defer.reject(new Error());
    });
  return defer.promise;
};

minidlna.prototype.updateUIConfig = function () {
  const self = this;

  self.commandRouter.getUIConfigOnPlugin('miscellanea', 'minidlna', {})
    .then(function (uiconf) {
      self.commandRouter.broadcastMessage('pushUiConfig', uiconf);
    });
  self.commandRouter.broadcastMessage('pushUiConfig');
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
  const changes = [];

  configItems.forEach(function (configItem) {
    switch (configItem) {
      case 'media_dir_a':
        changes.push(self.handlePath(configItem, data[configItem], 'AUDIO_FOLDER'));
        break;
      case 'media_dir_p':
        changes.push(self.handlePath(configItem, data[configItem], 'PICTURE_FOLDER'));
        break;
      case 'media_dir_v':
        changes.push(self.handlePath(configItem, data[configItem], 'VIDEO_FOLDER'));
        break;
      case 'db_dir':
        changes.push(self.handlePath(configItem, data[configItem], 'DB_DIR'));
        break;
      case 'log_dir':
        changes.push(self.handlePath(configItem, data[configItem], 'LOG_DIR'));
        break;
      case 'root_container':
      case 'tivo_discovery':
      case 'loglevel_general':
      case 'loglevel_artwork':
      case 'loglevel_database':
      case 'loglevel_inotify':
      case 'loglevel_scanner':
      case 'loglevel_metadata':
      case 'loglevel_http':
      case 'loglevel_ssdp':
      case 'loglevel_tivo':
        if (self.config.get(configItem) !== data[configItem].value) {
          self.config.set(configItem, data[configItem].value);
          changes.push(true);
        }
        break;
      case 'port':
        changes.push(self.handleNum(configItem, 0, 8, data[configItem], 0, 65535));
        break;
      case 'notify_interval':
        changes.push(self.handleNum(configItem, 0, 18, data[configItem], 0, Number.MAX_SAFE_INTEGER));
        break;
      case 'max_connections':
        changes.push(self.handleNum(configItem, 0, 21, data[configItem], 0, Number.MAX_SAFE_INTEGER));
        break;
      default:
        if (self.config.get(configItem) !== data[configItem]) {
          self.config.set(configItem, data[configItem]);
          changes.push(true);
        }
    }
  });
  if (!changes.includes(true) && !changes.includes('err')) {
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.NO_CHANGES'));
    defer.resolve();
  } else if (changes.includes(true)) {
    self.createMinidlnaConf()
      .then(function () {
        self.logger.info(id + 'Restarting minidlna.service');
        self.systemctl('restart minidlna.service')
          .then(function () {
            if (!changes.includes('err')) {
              self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.CONF_UPDATED'));
            }
            self.logger.success('The miniDLNA configuration has been updated.');
            defer.resolve();
          });
      })
      .fail(function () {
        defer.reject();
      });
  }
  return defer.promise;
};

// Plugin Methods ------------------------------------------------------------------------------------

minidlna.prototype.handleNum = function (item, sectionId, contentId, value, min, max) {
  const self = this;

  if (!Number.isNaN(parseInt(value, 10)) && isFinite(value)) {
    if (value < min || value > max) {
      self.updateUIConfig();
      self.commandRouter.pushToastMessage('stickyerror', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.' + item.toUpperCase()) + self.commandRouter.getI18nString('MINIDLNA.INFO_RANGE') + '(' + min + '-' + max + ').');
      return 'err';
    }
    if (self.config.get(item) !== parseInt(value, 10)) {
      self.config.set(item, parseInt(value, 10));
      return true;
    }
  } else {
    self.updateUIConfig();
    self.commandRouter.pushToastMessage('stickyerror', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.' + item.toUpperCase()) + self.commandRouter.getI18nString('MINIDLNA.NAN'));
    return 'err';
  }
};

minidlna.prototype.handlePath = function (item, value, UIkeyname) {
  const self = this;
  const separator = item.startsWith('media_dir_') ? ' // ' : undefined;
  let changes;

  value.split(separator).forEach(function (p) {
    try {
      if (!path.isAbsolute(p.trim()) || !fs.statSync(p.trim()).isDirectory()) {
        throw new Error();
      }
    } catch (e) {
      self.updateUIConfig();
      if (e.toString().includes('ENOENT')) {
        self.logger.error(id + item + ' "' + p.trim() + '" does not exist');
        self.commandRouter.pushToastMessage('stickyerror', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.' + UIkeyname) + ' "' + p.trim() + '" ' + self.commandRouter.getI18nString('MINIDLNA.DIR_MISSING'));
      } else {
        self.logger.error(id + item + ' "' + p.trim() + '" is not an absolute path specification');
        self.commandRouter.pushToastMessage('stickyerror', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.' + UIkeyname) + ' "' + p.trim() + '" ' + self.commandRouter.getI18nString('MINIDLNA.ERR_ABSOLUTE_PATH'));
      }
      changes = 'err';
    }
  });
  if (self.config.get(item) !== value && changes !== 'err') {
    self.config.set(item, value);
    changes = true;
  }
  return changes;
};

minidlna.prototype.initialConf = function () {
  const self = this;
  const defer = libQ.defer();

  try {
    if (!fs.statSync('/data/minidlna.conf').isFile()) {
      throw new Error();
    }
    defer.resolve();
  } catch (e) {
    self.createMinidlnaConf()
      .then(function () {
        defer.resolve();
      })
      .fail(function () {
        self.commandRouter.pushToastMessage('stickyerror', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.ERR_CREATE') + '/data/minidlna.conf');
        defer.reject('Creating /data/minidlna.conf failed');
      });
  }
  return defer.promise;
};

minidlna.prototype.createMinidlnaConf = function () {
// derived from balbuze's "createVolumiominidlnaFile" function of his volumiominidlna plugin - many thanks to balbuze
  const self = this;
  const defer = libQ.defer();

  fs.readFile(path.join(__dirname, 'minidlna.conf.tmpl'), 'utf8', function (err, data) {
    if (err) {
      self.logger.error(id + 'Error reading ' + path.join(__dirname, 'minidlna.conf.tmpl: ') + err);
      self.commandRouter.pushToastMessage('stickyerror', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.ERR_READ') + path.join(__dirname, 'minidlna.conf.tmpl: ') + err);
      defer.reject();
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
        switch (configItem) {
          case 'media_dir_a':
          case 'media_dir_p':
          case 'media_dir_v':
            value.split('//').forEach(function (p, i) {
              if (i === 0) {
                value = p.trim();
              } else {
                value = value + '\nmedia_dir=' + configItem.substr(-1, 1).toUpperCase() + ',' + p.trim();
              }
            });
            data = data.replace('${' + configItem + '}', value);
            break;
          case 'merge_media_dirs':
          case 'tivo_discovery':
          case 'wide_links':
            if (minidlnaVersion.localeCompare('1.2.1', 'en-u-kn-true') < 0) {
              data = data.replace(new RegExp('^' + configItem + '\\=\\${', 'gm'), '#' + configItem + '=${');
            } else {
              data = data.replace('${' + configItem + '}', value);
            }
            break;
          case 'enable_subtitles':
            if (minidlnaVersion.localeCompare('1.3.0', 'en-u-kn-true') < 0) {
              data = data.replace(new RegExp('^' + configItem + '\\=\\${', 'gm'), '#' + configItem + '=${');
              break;
            }
            // fall through to default
          default:
            data = data.replace('${' + configItem + '}', value);
        }
      });
      fs.writeFile('/data/minidlna.conf', data, 'utf8', function (err) {
        if (err) {
          self.logger.error(id + 'Error writing /data/minidlna.conf: ' + err);
          self.commandRouter.pushToastMessage('stickyerror', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.ERR_WRITE') + '/data/minidlna.conf: ' + err);
          defer.reject();
        } else {
          self.logger.info(id + '/data/minidlna.conf written');
          defer.resolve();
        }
      });
    }
  });
  return defer.promise;
};

minidlna.prototype.forceRescan = function (option) {
  const self = this;
  const defer = libQ.defer();

  exec("/bin/echo volumio | /usr/bin/sudo -S /bin/sed -i -e 's/^Environment=DAEMON_OPTS=$/Environment=DAEMON_OPTS=-" + option + "/' /etc/systemd/system/minidlna.service", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error(id + 'Failed to write daemon option "-' + option + '" to /etc/systemd/system/minidlna.service: ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.RESCAN_FAILED') + error);
      defer.reject(error);
    } else {
      self.systemctl('daemon-reload')
        .then(function () {
          self.systemctl('restart minidlna.service')
            .then(function () {
              self.logger.info(id + 'Rescanning the media directories.');
              self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.RESCANNING'));
              defer.resolve();
            })
            .fail(function (e) {
              self.logger.error(id + 'Failed to rescan the media directories: ' + e);
              self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.RESCAN_FAILED') + e);
              defer.reject();
            })
            .fin(function () {
              exec("/bin/echo volumio | /usr/bin/sudo -S /bin/sed -i -e 's/^Environment=DAEMON_OPTS=-" + option + "$/Environment=DAEMON_OPTS=/' /etc/systemd/system/minidlna.service", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
                if (error !== null) {
                  self.logger.error(id + 'Failed to remove daemon option "-' + option + '" from /etc/systemd/system/minidlna.service: ' + error);
                  self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.ERR_WRITE') + 'etc/systemd/system/minidlna.service: ' + error);
                } else {
                  self.systemctl('daemon-reload');
                }
              });
            });
        });
    }
  });
  return defer.promise;
};

minidlna.prototype.systemctl = function (systemctlCmd) {
  const self = this;
  const defer = libQ.defer();

  exec('/usr/bin/sudo /bin/systemctl ' + systemctlCmd, { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
    if (error !== null) {
      self.logger.error(id + 'Failed to ' + systemctlCmd + ': ' + error);
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MINIDLNA.PLUGIN_NAME'), self.commandRouter.getI18nString('MINIDLNA.GENERIC_FAILED') + systemctlCmd + ' ' + ': ' + error);
      defer.reject(error);
    } else {
      self.logger.info(id + 'systemctl ' + systemctlCmd + ' succeeded.');
      defer.resolve();
    }
  });
  return defer.promise;
};
