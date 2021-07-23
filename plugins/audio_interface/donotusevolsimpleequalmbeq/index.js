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


// Define the ControllerVol15Equal class
module.exports = ControllerVol15Equal;

function ControllerVol15Equal(context) {
  var self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;
  self.configManager = self.context.configManager;
 };

ControllerVol15Equal.prototype.onVolumioStart = function () {
  var self = this;
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  this.config = new (require('v-conf'))();
  this.config.loadFile(configFile);
  self.logger.info('Vol15Equal Started');
  return libQ.resolve();
};

ControllerVol15Equal.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

// Plugin methods -----------------------------------------------------------------------------


//here we send equalizer settings
ControllerVol15Equal.prototype.sendequal = function (defer) {
  var self = this;
  var eqprofile = self.config.get('eqprofile')
  var coef = self.config.get('coef')
  var enablemyeq = self.config.get('enablemyeq')
  var scoef
  console.log('myeq or preset =' + enablemyeq)

  if (self.config.get('enablemyeq') == false) {
    if (self.config.get('eqprofile') === 'flat')
      scoef = self.config.get('flat')
    else if (self.config.get('eqprofile') === 'loudness')
      scoef = self.config.get('loudness')
    else if (self.config.get('eqprofile') === 'rock')
      scoef = self.config.get('rock')
    else if (self.config.get('eqprofile') === 'classic')
      scoef = self.config.get('classic')
    else if (self.config.get('eqprofile') === 'bass')
      scoef = self.config.get('bass')
    else if (self.config.get('eqprofile') === 'voice')
      scoef = self.config.get('voice')
    else if (self.config.get('eqprofile') === 'soundtrack')
      scoef = self.config.get('soundtrack')
    else if (self.config.get('eqprofile') === 'mypreset1')
      scoef = self.config.get('mypreset1')
    else if (self.config.get('eqprofile') === 'mypreset2')
      scoef = self.config.get('mypreset2')
    else if (self.config.get('eqprofile') === 'mypreset3')
      scoef = self.config.get('mypreset3')
  } else scoef = self.config.get('coef')

  //   console.log(' raw values are %j', scoef);
  var values = scoef.split(',');

  //   console.log('splitted coef values are %j', values);
  var alsaequalcmd
  var i
  var j
  var x
  var k
  //equalizer offset
  var z = 60;
  var coefarray = scoef.split(',');
  //console.log(coefarray)
  // for every value that we put in array, we set the according bar value
  for (var i in coefarray) {
    j = i
    i = ++i
    k = parseInt(coefarray[j], 10);
    x = k + z;
    //console.log("aaaaaaaaa----"+ x ) 
    console.log("/bin/echo /usr/bin/amixer -D volumio15Equal cset numid=" + [i] + " " + x )
    exec("/usr/bin/amixer -D volumio15Equal cset numid=" + [i] + " " + x , {
    uid: 1000,
    gid: 1000
   }, function(error, stdout, stderr) {
     if(!error) {
       forDefer.resolve();
       } else {
       forDefer.reject(error);
     }
   });
  }
  
  return libQ.all(pending);
 };



ControllerVol15Equal.prototype.onStop = function () {

  return libQ.resolve();
};

ControllerVol15Equal.prototype.onStart = function () {
  var self = this;

  var defer = libQ.defer();
  self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'updateALSAConfigFile')
    .then(function(e) {
      var aplayDefer = libQ.defer();
      // Play a short sample of silence to initialise the config file
      exec("dd if=/dev/zero iflag=count_bytes count=128 | aplay -f cd -D volumio15Equal", {uid: 1000,gid: 1000}, function(error, stdout, stderr) {
        if(error) {
          self.logger.warn("An error occurred when trying to initialize Vol15equal", error);
        }
        aplayDefer.resolve();
      });
      return aplayDefer.promise;
    })
    .then(function(e) {
      
      var configFile = "/data/configuration/audio_interface/vol15equal/.alsaequal.bin"
      var configDefer = libQ.defer();
        
      if(fs.existsSync(configFile)) {
        exec("/bin/chown volumio:audio " + configFile + "; /bin/chmod 664 " + configFile, 
            {uid: 1000,gid: 1000}, function(error, stdout, stderr) {
              if(error) {
                self.logger.warn("An error occurred when trying to initialize Vol15equal", error);
              }
              configDefer.resolve();
            });
      } else {
        self.logger.warn("No equaliser config file exists - unable to initialize Vol15equal");
        configDefer.reject("No equaliser config file exists")
      }
    })
    .then(function(e) {
      self.logger.info('Vol15equal Started');
      defer.resolve();
    })
    .fail(function(e) {
      defer.reject(new Error());
    });
   return defer.promise;
 };


ControllerVol15Equal.prototype.onRestart = function () {
  var self = this;
};

ControllerVol15Equal.prototype.onInstall = function () {
  var self = this;
  //	//Perform your installation tasks here
};

ControllerVol15Equal.prototype.onUninstall = function () {
  var self = this;
  //Perform your installation tasks here
};

ControllerVol15Equal.prototype.getUIConfig = function () {
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

      //for equalizer custom mypreset1
      // we retrieve the coefficient configuration
      var cmypreset1 = self.config.get('mypreset1');
      // it is a string, so to get single values we split them by , and create an array from that
      var coefarrayp1 = cmypreset1.split(',');
      //console.log(coefarrayp1)
      // for every value that we put in array, we set the according bar value
      for (var i in coefarrayp1) {
        uiconf.sections[1].content[1].config.bars[i].value = coefarrayp1[i]
      }
      //for equalizer custom mypreset2
      // we retrieve the coefficient configuration
      var cmypreset2 = self.config.get('mypreset2');
      // it is a string, so to get single values we split them by , and create an array from that
      var coefarrayp2 = cmypreset2.split(',');
      //console.log(coefarrayp2)
      // for every value that we put in array, we set the according bar value
      for (var i in coefarrayp2) {
        uiconf.sections[1].content[2].config.bars[i].value = coefarrayp2[i]
      }
      //for equalizer custom mypreset3
      // we retrieve the coefficient configuration
      var cmypreset3 = self.config.get('mypreset3');
      // it is a string, so to get single values we split them by , and create an array from that
      var coefarrayp3 = cmypreset3.split(',');
      //console.log(coefarrayp3)
      // for every value that we put in array, we set the according bar value
      for (var i in coefarrayp3) {
        uiconf.sections[1].content[3].config.bars[i].value = coefarrayp3[i]
      }
      //here we get values for preset
      // uiconf.sections[1].content[0].value = self.config.get('enablepreset');
      //   uiconf.sections[1].content[1].value = self.config.get('mypreset1');
      //  uiconf.sections[1].content[2].value = self.config.get('mypreset2');
      //  uiconf.sections[1].content[3].value = self.config.get('mypreset3');
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    })
  return defer.promise


};


ControllerVol15Equal.prototype.getLabelForSelect = function (options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

ControllerVol15Equal.prototype.setUIConfig = function (data) {
  var self = this;

};

ControllerVol15Equal.prototype.getConf = function (varName) {
  var self = this;
  //Perform your installation tasks here
};


ControllerVol15Equal.prototype.setConf = function (varName, varValue) {
  var self = this;
  //Perform your installation tasks here
};

//here we save the equalizer settings
ControllerVol15Equal.prototype.savealsaequal = function (data) {
  var self = this;
  var defer = libQ.defer();
  self.config.set('enablemyeq', data['enablemyeq']);
  self.config.set('eqprofile', data['eqprofile'].value);
  self.config.set('coef', data['coef']);
  self.logger.info('Equalizer Configurations have been set');
  self.commandRouter.pushToastMessage('success', "Configuration update", 'Alsaequal new equalizer successfully applied');
  // self.sendequal(defer);
  self.creatASOUNDFile();
  return defer.promise;
};

//here we save the equalizer preset
ControllerVol15Equal.prototype.saveequalizerpreset = function (data) {
  var self = this;
  var defer = libQ.defer();
  //self.config.set('enablepreset', data['enablepreset']);
  self.config.set('mypreset1', data['mypreset1']);
  self.config.set('mypreset2', data['mypreset2']);
  self.config.set('mypreset3', data['mypreset3']);
  /* self.config.set('flat', data['flat']);
   self.config.set('loudness', data['loudness']);
   self.config.set('rock', data['rock']);
   self.config.set('classic', data['classic']);
   self.config.set('bass', data['bass']);
   self.config.set('voice', data['voice']);
   self.config.set('soundtrack', data['soundtrack']);
 */
  self.logger.info('Equalizer preset saved');
  self.commandRouter.pushToastMessage('success', "Configuration update", 'Preset successfully saved');
  //self.sendequal(defer);
  return defer.promise;
};

ControllerVol15Equal.prototype.setAdditionalConf = function (type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'setConfigParam', data);
};

ControllerVol15Equal.prototype.getAdditionalConf = function (type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
}
