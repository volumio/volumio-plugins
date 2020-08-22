'use strict';

//var io = require('socket.io-client');
var fs = require('fs-extra');
var libFsExtra = require('fs-extra');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var libQ = require('kew');
// var libNet = require('net');
// var net = require('net');
var config = new (require('v-conf'))();


// Define the ControllerVolbinauralfilter class
module.exports = ControllerVolbinauralfilter;

function ControllerVolbinauralfilter(context) {
  var self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;

  self.configManager = self.context.configManager;
};

ControllerVolbinauralfilter.prototype.onVolumioStart = function () {
  var self = this;
  var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
  return libQ.resolve();
};

ControllerVolbinauralfilter.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

// Plugin methods -----------------------------------------------------------------------------


ControllerVolbinauralfilter.prototype.onStop = function () {
  var self = this;
  var defer = libQ.defer();

  return libQ.resolve();
};

ControllerVolbinauralfilter.prototype.onStart = function () {
  var self = this;

  var defer = libQ.defer();
  self.rebuildvolbinauralfilter()
    .then(function (e) {
      self.logger.info('Volbinauralfilter Started');
      defer.resolve();
    })
    .fail(function (e) {
      defer.reject(new Error());
    });
  return defer.promise;
};

ControllerVolbinauralfilter.prototype.onRestart = function () {
  var self = this;
};

ControllerVolbinauralfilter.prototype.onInstall = function () {
  var self = this;
  //Perform your installation tasks here
};

ControllerVolbinauralfilter.prototype.onUninstall = function () {
  var self = this;
  //Perform your installation tasks here
};

ControllerVolbinauralfilter.prototype.getUIConfig = function () {
  var self = this;
  var defer = libQ.defer();
  var lang_code = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
    __dirname + '/i18n/strings_en.json',
    __dirname + '/UIConfig.json')
    .then(function (uiconf) {
      uiconf.sections[0].content[0].value = self.config.get('enablefilter');
      uiconf.sections[0].content[1].value = self.config.get('mysetting');
      value = self.config.get('filterprofile');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[2].options'), value));
      var value;
      var myprofileset = self.config.get('myprofile');
      // it is a string, so to get single values we split them by , and create an array from that
      var coefarraymyprofile = myprofileset.split(',');
      // for every value that we put in array, we set the according bar value
      for (var i in coefarraymyprofile) {
        uiconf.sections[0].content[3].config.bars[i].value = coefarraymyprofile[i]
      }

      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    });
  return defer.promise;
};

ControllerVolbinauralfilter.prototype.getLabelForSelect = function (options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

ControllerVolbinauralfilter.prototype.setUIConfig = function (data) {
  var self = this;

};

ControllerVolbinauralfilter.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};


ControllerVolbinauralfilter.prototype.setConf = function (varName, varValue) {
  var self = this;
  //Perform your installation tasks here
};

//here we save the asound.conf file config
ControllerVolbinauralfilter.prototype.createASOUNDFile = function () {
  var self = this;

  var defer = libQ.defer();


  var folder = self.commandRouter.pluginManager.findPluginFolder('audio_interface', 'volbinauralfilter');

  var alsaFile = folder + '/asound/volumioBauer.postBauer.10.conf';

  try {
    if (self.config.get('enablefilter') == true) {

      var data = fs.readFileSync(__dirname + "/asound.tmpl", 'utf8');

      var myprofile
      var enablemyeq = self.config.get('enablemyeq')
      if (self.config.get('mysetting') == false) {
        if (self.config.get('filterprofile') === 'bauer')
          myprofile = self.config.get('bauer')
        //console.log(myprofile + 'bauer');
        else if (self.config.get('filterprofile') === 'chumoy')
          myprofile = self.config.get('chumoy')
        //console.log(myprofile + 'chumoy');
        else if (self.config.get('filterprofile') === 'janmeier')
          myprofile = self.config.get('janmeier')
        //console.log(myprofile + 'janmeier');
      } else myprofile = self.config.get('myprofile')
      //console.log(myprofile + 'myprofile')
      var myprofiler
      //var myprofiler = self.config.get('myprofile');
      var myprofiler = myprofile
      myprofiler = myprofile.replace(/,/g, " ");



      var conf1 = data.replace("${myprofile}", myprofiler);

      fs.writeFileSync(alsaFile, conf1, 'utf8');
    } else {
      if (fs.existsSync(alsaFile)) {
        self.logger.info('Success by writing asound.conf !!')
        fs.unlinkSync(alsaFile);
     //   var aplayDefer = libQ.defer();

        // Play a short sample of silence to initialise the config file
        exec("dd if=/dev/zero iflag=count_bytes count=128 | aplay -f cd -D volumioBauer", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
          if (error) {
            self.logger.warn("An error occurred when trying to initialize Bauer", error);
          }
        //  aplayDefer.resolve();
        });
      }
    }
    defer.resolve();
  } catch (err) {
    self.logger.info('Error while writing asound.conf !!' + err)

    defer.reject(err);

  }
  return defer.promise;
};

ControllerVolbinauralfilter.prototype.saveBauerfilter = function (data) {
  var self = this;

  var defer = libQ.defer();
  self.config.set('enablefilter', data['enablefilter']);
  self.config.set('mysetting', data['mysetting']);
  self.config.set('filterprofile', data['filterprofile'].value);
  self.config.set('myprofile', data['myprofile']);
  self.logger.info('Configurations of filter have been set');

  self.rebuildvolbinauralfilter()
    .then(function (e) {
      //  self.commandRouter.pushToastMessage('success', "Bauer Configuration updated");
      defer.resolve({});
    })
    .fail(function (e) {
      defer.reject(new Error('error'));
      //  self.commandRouter.pushToastMessage('error', "failed to start. Check your config !");
    })


  return defer.promise;

};

ControllerVolbinauralfilter.prototype.rebuildvolbinauralfilter = function () {
  var self = this;
  var defer = libQ.defer();
  self.createASOUNDFile()
    .then(function () {
      return self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'updateALSAConfigFile');
    }).then(function () {
      self.commandRouter.pushToastMessage('success', 'Filter applied');
      defer.resolve();
    }).fail(function () {
      self.commandRouter.pushToastMessage('error', 'a problem occurred');
      defer.reject();
    });
  return defer.promise
};

ControllerVolbinauralfilter.prototype.setAdditionalConf = function (type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'setConfigParam', data);
};

ControllerVolbinauralfilter.prototype.getAdditionalConf = function (type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
}