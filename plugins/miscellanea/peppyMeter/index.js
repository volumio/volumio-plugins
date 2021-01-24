'use strict';

var fs = require('fs-extra');
var libFsExtra = require('fs-extra');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var libQ = require('kew');
const { setFlagsFromString } = require('v8');
var config = new (require('v-conf'))();


// Define the peppyMeter class
module.exports = peppyMeter;

function peppyMeter(context) {
  var self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;

  self.configManager = self.context.configManager;
};

peppyMeter.prototype.onVolumioStart = function () {
  var self = this;
  var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
  return libQ.resolve();
};

peppyMeter.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

// Plugin methods -----------------------------------------------------------------------------

peppyMeter.prototype.onStop = function () {
  const self = this;
  let defer = libQ.defer();
  self.logger.info("Stopping PeppyMeter service");
  self.commandRouter.stateMachine.stop().then(function () {
    exec("/usr/bin/sudo /bin/systemctl stop peppy.service", {
      uid: 1000,
      gid: 1000
    }, function (error, stdout, stderr) { })
    socket.off();
  });
  defer.resolve();
  return libQ.resolve();
};

peppyMeter.prototype.onStart = function () {
  var self = this;
  var defer = libQ.defer();
  self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'updateALSAConfigFile')

    .then(function (e) {
      var pipeDefer = libQ.defer();
      exec("/usr/bin/mkfifo /tmp/myfifopeppy" + "; /bin/chmod 777 /tmp/myfifopeppy", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
        if (error) {
          self.logger.warn("An error occurred when creating fifo", error);
        }
        pipeDefer.resolve();
      });
      return pipeDefer.promise;
    });
  defer.resolve();
  setTimeout(function () {
  self.startpeppyservice()
}, 10000);
      self.commandRouter.pushToastMessage('success', 'Starting PeppyMeter');

  return defer.promise;
};

peppyMeter.prototype.startpeppyservice = function () {
  const self = this;
  let defer = libQ.defer();
  exec("/usr/bin/sudo /bin/systemctl start peppy.service", {
    uid: 1000,
    gid: 1000
  }, function (error, stdout, stderr) {
    if (error) {
      self.logger.info('peppyMeter failed to start. Check your configuration ' + error);
    } else {
      self.commandRouter.pushConsoleMessage('PeppyMeter Daemon Started');
      //self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('START_BRUTEFIR'));

      defer.resolve();
    }
  });
};

peppyMeter.prototype.restartpeppyservice = function () {
  const self = this;
  let defer = libQ.defer();
  exec("/usr/bin/sudo /bin/systemctl restart peppy.service", {
    uid: 1000,
    gid: 1000
  }, function (error, stdout, stderr) {
    if (error) {
      self.logger.info('peppyMeter failed to start. Check your configuration ' + error);
    } else {
      self.commandRouter.pushConsoleMessage('PeppyMeter Daemon Started');
      //self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('START_BRUTEFIR'));

      defer.resolve();
    }
  });
};

peppyMeter.prototype.onRestart = function () {
  var self = this;
};

peppyMeter.prototype.onInstall = function () {
  var self = this;
  //	//Perform your installation tasks here
};

peppyMeter.prototype.onUninstall = function () {
  var self = this;
  //Perform your installation tasks here
};


peppyMeter.prototype.getUIConfig = function () {
  var self = this;
  var defer = libQ.defer();
  var lang_code = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
    __dirname + '/i18n/strings_en.json',
    __dirname + '/UIConfig.json')
    .then(function (uiconf) {
      uiconf.sections[0].content[0].value = self.config.get('localdisplay');

      value = self.config.get('meter');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[1].options'), value));
      var value;
      value = self.config.get('screensize');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[2].options'), value));
      var value;

      uiconf.sections[1].content[0].value = self.config.get('serial');
      uiconf.sections[1].content[1].value = self.config.get('device');
      var value;
      value = self.config.get('baud');
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[2].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[2].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[1].content[2].options'), value));
      uiconf.sections[1].content[3].value = self.config.get('stime');
      uiconf.sections[1].content[4].value = self.config.get('speriod');

      var value;

      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });
  return defer.promise;
};



peppyMeter.prototype.getLabelForSelect = function (options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

peppyMeter.prototype.savepeppy = function (data) {
  var self = this;

  var defer = libQ.defer();

  self.config.set('localdisplay', data['localdisplay']);
  self.config.set('meter', data['meter'].value);
  self.config.set('screensize', data['screensize'].value);


  self.savepeppyconfig();
  self.restartpeppyservice()
    .then(function (e) {
      self.commandRouter.pushToastMessage('success', "PeppyMeter Configuration updated");
      defer.resolve({});
    })
    .fail(function (e) {
      defer.reject(new Error('error'));
      self.commandRouter.pushToastMessage('error', "failed to start. Check your config !");
    })
  return defer.promise;

};


peppyMeter.prototype.savepeppy2 = function (data) {
  var self = this;

  var defer = libQ.defer();

  self.config.set('serial', data['serial']);
  self.config.set('device', data['device']);
  self.config.set('baud', data['baud'].value);
  self.config.set('stime', data['stime']);
  self.config.set('speriod', data['speriod']);

  self.savepeppyconfig();
  self.restartpeppyservice()
    .then(function (e) {
      self.commandRouter.pushToastMessage('success', "PeppyMeter Configuration updated");
      defer.resolve({});
    })
    .fail(function (e) {
      defer.reject(new Error('error'));
      self.commandRouter.pushToastMessage('error', "failed to start. Check your config !");
    })
  return defer.promise;

};

//here we save the asound.conf file config
peppyMeter.prototype.savepeppyconfig = function () {
  var self = this;

  var defer = libQ.defer();
  try {

    fs.readFile(__dirname + "/config.txt.tmpl", 'utf8', function (err, data) {
      if (err) {
        defer.reject(new Error(err));
        return console.log(err);
      }
      var localdisplay = self.config.get('localdisplay')
      if (localdisplay) {
        var localdisplayd = 'True'
      }
      else if (localdisplayd = 'False');

      var serial = self.config.get('serial')
      if (serial) {
        var seriald = 'True'
      }
      else if (seriald = 'False');

      var stime = self.config.get('stime')
      if (stime) {
        var stimed = 'True'
      }
      else if (stimed = 'False');

      const conf1 = data.replace("${meter}", self.config.get("meter"))
        .replace("${screensize}", self.config.get("screensize"))
        .replace("${localdisplay}", localdisplayd)
        .replace("${serial}", seriald)
        .replace("${device}", self.config.get("device"))
        .replace("${baud}", self.config.get("baud"))
        .replace("${stime}", stimed)
        .replace("${speriod}", self.config.get("speriod"))
      fs.writeFile("/data/plugins/miscellanea/peppyMeter/peppymeter/config.txt", conf1, 'utf8', function (err) {
        if (err)
          defer.reject(new Error(err));
        else defer.resolve();
      });

    });

  } catch (err) {

  }
  return defer.promise;
};


peppyMeter.prototype.setUIConfig = function (data) {
  var self = this;

};

peppyMeter.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};


peppyMeter.prototype.setConf = function (varName, varValue) {
  var self = this;
};