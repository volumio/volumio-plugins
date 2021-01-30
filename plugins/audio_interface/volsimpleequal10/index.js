'use strict';

var fs = require('fs-extra');
var exec = require('child_process').exec;
var libQ = require('kew');
var config = new (require('v-conf'))();

// Define the ControllerVolsimpleequal10 class
module.exports = ControllerVolsimpleequal10;

function ControllerVolsimpleequal10(context) {
  var self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;
  self.configManager = self.context.configManager;
}

ControllerVolsimpleequal10.prototype.onVolumioStart = function () {
  var self = this;
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);

  self.logger.info('Volsimpleequal Started');

  return libQ.resolve();
};

ControllerVolsimpleequal10.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

// Plugin methods -----------------------------------------------------------------------------

//here we send equalizer settings
ControllerVolsimpleequal10.prototype.composeequal = function () {
  var self = this;
  var defer = libQ.defer();

  var eqprofile = self.config.get('eqprofile')
  var enablemyeq = self.config.get('enablemyeq')
  var scoef
  console.log('myeq or preset =' + enablemyeq)

  if (self.config.get('enablemyeq') == false) {
    if (eqprofile === 'flat')
      scoef = self.config.get('flat')
    else if (eqprofile === 'loudness')
      scoef = self.config.get('loudness')
    else if (eqprofile === 'rock')
      scoef = self.config.get('rock')
    else if (eqprofile === 'classic')
      scoef = self.config.get('classic')
    else if (eqprofile === 'bass')
      scoef = self.config.get('bass')
    else if (eqprofile === 'voice')
      scoef = self.config.get('voice')
    else if (eqprofile === 'soundtrack')
      scoef = self.config.get('soundtrack')
    else if (eqprofile === 'mypreset1')
      scoef = self.config.get('mypreset1')
    else if (eqprofile === 'mypreset2')
      scoef = self.config.get('mypreset2')
    else if (eqprofile === 'mypreset3')
      scoef = self.config.get('mypreset3')
  } else scoef = self.config.get('coef')

  self.sendequal(scoef);
};

//here we send equalizer settings
ControllerVolsimpleequal10.prototype.sendequal = function (scoef) {
  var self = this;
  var defer = libQ.defer();

  var i
  var j
  var x
  var k
  //equalizer offset
  var z = 50;
  var coefarray = scoef.split(',');

  // for every value that we put in array, we set the according bar value
  var pending = [];
  for (var i in coefarray) {
    let forDefer = libQ.defer();
    pending.push(forDefer.promise);

    j = i
    i = ++i
    k = parseInt(coefarray[j], 10);
    x = k + z;

    var cmd = ("/usr/bin/amixer -D volSimpleEqual cset numid=" + [i] + " " + x)

    console.log(cmd)
    exec(cmd, {
      uid: 1000,
      gid: 1000
    }, function (error, stdout, stderr) {
      if (!error) {
        forDefer.resolve();
      } else {
        forDefer.reject(error);
      }
    });
  }
  self.config.set('coef', scoef);

  var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'volsimpleequal10', {});
  respconfig.then(function (config) {
    self.commandRouter.broadcastMessage('pushUiConfig', config);
  });
  return libQ.all(pending);

};

ControllerVolsimpleequal10.prototype.onStop = function () {
  var self = this;

  var scoef = self.config.get('flat')
  self.sendequal(scoef);

  return libQ.resolve();
};


ControllerVolsimpleequal10.prototype.onStart = function () {
  var self = this;

  var defer = libQ.defer();
  self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'updateALSAConfigFile')
    .then(function (e) {
      var aplayDefer = libQ.defer();
      // Play a short sample of silence to initialise the config file
      exec("dd if=/dev/zero iflag=count_bytes count=128 | aplay -f cd -D volumioSimpleEqual", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
        if (error) {
          self.logger.warn("An error occurred when trying to initialize Volsimpleequal", error);
        }
        aplayDefer.resolve();
      });
      return aplayDefer.promise;
    })
    .then(function (e) {

      var configFile = "/data/configuration/audio_interface/volsimpleequal10/.alsaequal.bin"
      var configDefer = libQ.defer();

      if (fs.existsSync(configFile)) {
        exec("/bin/chown volumio:audio " + configFile + "; /bin/chmod 664 " + configFile,
          { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
            if (error) {
              self.logger.warn("An error occurred when trying to initialize Volsimpleequal", error);
            }
            configDefer.resolve();
          });
      } else {
        self.logger.warn("No equaliser config file exists - unable to initialize Volsimpleequal");
        configDefer.reject("No equaliser config file exists")
      }
    })
    .then(function (e) {
      self.logger.info('Volsimpleequal Started');
      defer.resolve();
    })
    .fail(function (e) {
      defer.reject(new Error());
    });
  self.composeequal();
  return defer.promise;
};

ControllerVolsimpleequal10.prototype.onRestart = function () {
  var self = this;
};

ControllerVolsimpleequal10.prototype.onInstall = function () {
  var self = this;
  //Perform your installation tasks here
};

ControllerVolsimpleequal10.prototype.onUninstall = function () {
  var self = this;
  //Perform your installation tasks here
};

ControllerVolsimpleequal10.prototype.getUIConfig = function () {
  var self = this;
  var defer = libQ.defer();
  var lang_code = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
    __dirname + '/i18n/strings_en.json',
    __dirname + '/UIConfig.json')
    .then(function (uiconf) {
      //equalizer section
      uiconf.sections[0].content[0].value = self.config.get('enablemyeq');
      //  uiconf.sections[0].content[1].value = self.config.get('eqprofile');
      var value;
      value = self.config.get('eqprofile');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[1].options'), value));

      //for coef in equalizer
      // we retrieve the coefficient configuration
      var coefconf = self.config.get('coef');
      // it is a string, so to get single values we split them by , and create an array from that
      var coefarray = coefconf.split(',');
      //console.log(coefarray)
      // for every value that we put in array, we set the according bar value
      for (var i in coefarray) {
        uiconf.sections[0].content[2].config.bars[i].value = coefarray[i]
      }

      //preset
      value = self.config.get('eqpresetsaved');
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[0].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[1].content[0].options'), value));



      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    })
  return defer.promise


};


ControllerVolsimpleequal10.prototype.getLabelForSelect = function (options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

ControllerVolsimpleequal10.prototype.setUIConfig = function (data) {
  var self = this;

};

ControllerVolsimpleequal10.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};


ControllerVolsimpleequal10.prototype.setConf = function (varName, varValue) {
  var self = this;
  //Perform your installation tasks here
};

//here we save the equalizer settings
ControllerVolsimpleequal10.prototype.savealsaequal = function (data) {
  var self = this;
  self.config.set('enablemyeq', data['enablemyeq']);
  self.config.set('eqprofile', data['eqprofile'].value);
  self.config.set('coef', data['coef']);
  self.logger.info('Equalizer Configurations have been set');
  self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString("COMMON.CONFIGURATION_UPDATE"));
  self.composeequal();
};

//here we save the equalizer preset
ControllerVolsimpleequal10.prototype.saveequalizerpreset = function (data) {
  var self = this;
  var defer = libQ.defer();
  var savedeq = self.config.get('coef')

  self.config.set('eqpresetsaved', data['eqpresetsaved'].value);


  var eqprofile = self.config.get('eqpresetsaved')

  self.config.set(eqprofile, savedeq);

  self.logger.info('Equalizer preset saved');
  self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_DESCRIPTION'));

  return defer.promise;
};

ControllerVolsimpleequal10.prototype.setAdditionalConf = function (type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'setConfigParam', data);
};

ControllerVolsimpleequal10.prototype.getAdditionalConf = function (type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
}
