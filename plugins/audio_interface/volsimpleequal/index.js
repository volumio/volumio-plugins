 'use strict';

 //var io = require('socket.io-client');
 var fs = require('fs-extra');
 var libFsExtra = require('fs-extra');
 var exec = require('child_process').exec;
 var execSync = require('child_process').execSync;
 var libQ = require('kew');
var config = new (require('v-conf'))();
 // var libNet = require('net');
 // var net = require('net');



 // Define the ControllerVolsimpleequal class
 module.exports = ControllerVolsimpleequal;

 function ControllerVolsimpleequal(context) {
  var self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;

  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
 };

 ControllerVolsimpleequal.prototype.onVolumioStart = function() {
  var self = this;
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
 this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.outputDeviceCallback.bind(this));
  this.config = new(require('v-conf'))();
  this.config.loadFile(configFile);
  return libQ.resolve();
 };

 ControllerVolsimpleequal.prototype.getConfigurationFiles = function() {
  return ['config.json'];
 };

 // Plugin methods -----------------------------------------------------------------------------
 //here we load snd_aloop module to provide a Loopback device 
 ControllerVolsimpleequal.prototype.modprobeLoopBackDevice = function() {
  var self = this;
  var defer = libQ.defer();

  exec("/usr/bin/sudo /sbin/modprobe snd_aloop index=7 pcm_substreams=2", {
   uid: 1000,
   gid: 1000
  }, function(error, stdout, stderr) {
   if (error) {
    self.logger.info('failed to load snd_aloop' + error);
   } else {
    self.commandRouter.pushConsoleMessage('snd_aloop loaded');
    defer.resolve();
   }
  });
  setTimeout(function() {

   return defer.promise;
  }, 2500)
 };

 // here we make the bridge between Loopback and equal
 ControllerVolsimpleequal.prototype.bridgeLoopBackequal = function() {
  var self = this;
  var defer = libQ.defer();
  setTimeout(function() {
  exec("/usr/bin/sudo /bin/systemctl start volsimpleequal.service", {
   uid: 1000,
   gid: 1000
  }, function(error, stdout, stderr) {
   if (error) {
    self.logger.info('failed to bridge ' + error);
   } else {
    self.commandRouter.pushConsoleMessage('Alsaloop bridge ok');
    defer.resolve();
   }
  });

   return defer.promise;
  }, 6500)
 };

 //here we save the volumio config for the next plugin start
 ControllerVolsimpleequal.prototype.saveVolumioconfig = function() {
  var self = this;

  return new Promise(function(resolve, reject) {

   var cp = execSync('/bin/cp /data/configuration/audio_interface/alsa_controller/config.json /tmp/vconfig.json');
   var cp2 = execSync('/bin/cp /data/configuration/system_controller/i2s_dacs/config.json /tmp/i2sconfig.json');
   try {
    var cp3 = execSync('/bin/cp /boot/config.txt /tmp/config.txt');


   } catch (err) {
    self.logger.info('config.txt does not exist');
   }
   resolve();
  });
 };

 //here we define the volumio restore config
 ControllerVolsimpleequal.prototype.restoreVolumioconfig = function() {
  var self = this;
  var defer = libQ.defer();
  //return new Promise(function(resolve, reject) {
   setTimeout(function() {

    var cp = execSync('/bin/cp /tmp/vconfig.json /data/configuration/audio_interface/alsa_controller/config.json');
    var cp2 = execSync('/bin/cp /tmp/i2sconfig.json /data/configuration/system_controller/i2s_dacs/config.json');
    try {
     var cp3 = execSync('/bin/cp /tmp/config.txt /boot/config.txt');
    } catch (err) {
     self.logger.info('config.txt does not exist');
    }

   }, 8000)
 defer.resolve()
  return defer.promise;
//   resolve();
//  });
 };

 //here we send equalizer settings
 ControllerVolsimpleequal.prototype.sendequal = function(defer) {
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
   console.log("/bin/echo /usr/bin/amixer -D equal cset numid=" + [i] + " " + x )
   exec("/usr/bin/amixer -D equal cset numid=" + [i] + " " + x , {
    uid: 1000,
    gid: 1000
   }, function(error, stdout, stderr) {})
  }
 };

 ControllerVolsimpleequal.prototype.onStop = function() {
  var self = this;
  var defer = libQ.defer();
  self.restoresettingwhendisabling()
 exec("/usr/bin/sudo /bin/systemctl stop volsimleequal.service", {
   uid: 1000,
   gid: 1000
  }, function(error, stdout, stderr) {
   if (error) {
    self.logger.info('failed to stop alsaloop' + error);
   } else {
    self.commandRouter.pushConsoleMessage('alsaloop stopped');
   }
  });
  defer.resolve();
  return libQ.resolve();
 };

 //here we define functions used when autoconf is called
 ControllerVolsimpleequal.prototype.autoconfig = function() {
  var self = this;
  var defer = libQ.defer();
  self.saveVolumioconfig()
   .then(self.modprobeLoopBackDevice())
   .then(self.createASOUNDFile())
   .then(self.saveHardwareAudioParameters())
   .then(self.setalsaequaloutput())
 //  .then(self.setVolumeParameters())
 //  .then(self.restoreVolumioconfig())
 //  .then(self.bridgeLoopBackequal())
  .catch(function(err) {
   console.log(err);
  });
  defer.resolve()
  return defer.promise;
 };


 ControllerVolsimpleequal.prototype.onStart = function() {
  var self = this;

  var defer = libQ.defer();
  self.autoconfig()
//  self.createASOUNDFile()
   .then(function(e) {
    self.logger.info('Volsimpleequal Started');
    defer.resolve();
   })
   .fail(function(e) {
    defer.reject(new Error());
   });
   return defer.promise;
 };

 ControllerVolsimpleequal.prototype.onRestart = function() {
  var self = this;
 };

 ControllerVolsimpleequal.prototype.onInstall = function() {
  var self = this;
  //	//Perform your installation tasks here
 };

 ControllerVolsimpleequal.prototype.onUninstall = function() {
  var self = this;
  //Perform your installation tasks here
 };

 ControllerVolsimpleequal.prototype.getUIConfig = function() {
  var self = this;
  var defer = libQ.defer();
  var lang_code = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
    __dirname + '/i18n/strings_en.json',
    __dirname + '/UIConfig.json')
   .then(function(uiconf) {
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
    var cmypreset3= self.config.get('mypreset3');
    // it is a string, so to get single values we split them by , and create an array from that
    var coefarrayp3 = cmypreset3.split(',');
    //console.log(coefarrayp3)
    // for every value that we put in array, we set the according bar value
    for (var i in coefarrayp3) {
     uiconf.sections[1].content[3].config.bars[i].value = coefarrayp3[i]
    }

    defer.resolve(uiconf);
   })
   .fail(function() {
    defer.reject(new Error());
   })
  return defer.promise


 };


 ControllerVolsimpleequal.prototype.getLabelForSelect = function(options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
   if (options[i].value == key)
    return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
 };

 ControllerVolsimpleequal.prototype.setUIConfig = function(data) {
  var self = this;

 };

 ControllerVolsimpleequal.prototype.getConf = function(varName) {
  var self = this;
  //Perform your installation tasks here
 };


 ControllerVolsimpleequal.prototype.setConf = function(varName, varValue) {
  var self = this;
  //Perform your installation tasks here
 };

 //here we save the asound.conf file config
 ControllerVolsimpleequal.prototype.createASOUNDFile = function() {
  var self = this;

  var defer = libQ.defer();

  try {

   fs.readFile(__dirname + "/asound.tmpl", 'utf8', function(err, data) {
    if (err) {
     defer.reject(new Error(err));
     return console.log(err);
    }
    var conf1 = data.replace("${hwout}", self.config.get('alsa_device'));


    fs.writeFile("/home/volumio/asoundrc", conf1, 'utf8', function(err) {
     if (err) {
      defer.reject(new Error(err));
      //self.logger.info('Cannot write /etc/asound.conf: '+err)
     } else {
      self.logger.info('asound.conf file written');

      var mv = execSync('/usr/bin/sudo /bin/mv /home/volumio/asoundrc /etc/asound.conf', {
       uid: 1000,
       gid: 1000,
       encoding: 'utf8'
      });
      var apply = execSync('/usr/sbin/alsactl -L -R nrestore', {
       uid: 1000,
       gid: 1000,
       encoding: 'utf8'
      });
      defer.resolve();
     }
    });

   });
  } catch (err) {}
setTimeout(function() {
  return defer.promise;
  }, 2000);
 };

 //here we save the equalizer settings
 ControllerVolsimpleequal.prototype.savealsaequal = function(data) {
  var self = this;
  var defer = libQ.defer();
  self.config.set('enablemyeq', data['enablemyeq']);
  self.config.set('eqprofile', data['eqprofile'].value);
  self.config.set('coef', data['coef']);
  self.logger.info('Equalizer Configurations have been set');
  self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString("COMMON.CONFIGURATION_UPDATE"));
  self.sendequal(defer);
  return defer.promise;
 };

//here we save the equalizer preset
 ControllerVolsimpleequal.prototype.saveequalizerpreset = function(data) {
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
  self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_DESCRIPTION'));
  //self.sendequal(defer);
  return defer.promise;
 };

 ControllerVolsimpleequal.prototype.setVolumeParameters = function() {
  var self = this;
  // here we set the volume controller in /volumio/app/volumecontrol.js
  // we need to do it since it will be automatically set to the loopback device by alsa controller
  // to retrieve those values we need to save the configuration of the system, found in /data/configuration/audio_interface/alsa_controller/config.json
  // before enabling the loopback device. We do this in saveHardwareAudioParameters(), which needs to be invoked just before equalizer is enabled
  setTimeout(function() {
   //  return new Promise(function(resolve, reject) { 
   //var defer = libQ.defer();
   var settings = {
    // need to set the device that equalizer wants to control volume to
    device: self.config.get('alsa_device'),
    // need to set the device name of the original device equalizer is controlling
    name: self.config.get('alsa_outputdevicename'),
    // Mixer name
    mixer: self.config.get('alsa_mixer'),
    // hardware, software, none
    mixertype: self.config.get('alsa_mixer_type'),
    // max volume setting
    maxvolume: self.config.get('alsa_volumemax'),
    // log or linear
    volumecurve: self.config.get('alsa_volumecurvemode'),
    //
    volumestart: self.config.get('alsa_volumestart'),
    //
    volumesteps: self.config.get('alsa_volumesteps')
   }
   console.log(settings)

   return self.commandRouter.volumioUpdateVolumeSettings(settings)

  }, 5000);
  //});
  // return defer.promise;
 };

 ControllerVolsimpleequal.prototype.saveHardwareAudioParameters = function() {
  var self = this;
  var defer = libQ.defer();

  var conf;
  // we save the alsa configuration for future needs here, note we prepend alsa_ to avoid confusion with other equalizer settings
  //volumestart
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'volumestart');
  self.config.set('alsa_volumestart', conf);
  //maxvolume
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'volumemax');
  self.config.set('alsa_volumemax', conf);
  //volumecurve
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'volumecurvemode');
  self.config.set('alsa_volumecurvemode', conf);
  //device
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevice');
  self.config.set('alsa_device', conf);
  //mixer_type
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'mixer_type');
  self.config.set('alsa_mixer_type', conf);
  //mixer
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'mixer');
  self.config.set('alsa_mixer', conf);
  //volumesteps
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'volumesteps');
  self.config.set('alsa_volumesteps', conf);
  //name
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevicename');
  self.config.set('alsa_outputdevicename', conf);

  return defer.promise;

 };

 ControllerVolsimpleequal.prototype.setAdditionalConf = function(type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'setConfigParam', data);
 };

 ControllerVolsimpleequal.prototype.outputDeviceCallback = function() {
  var self = this;
  var defer = libQ.defer();
    self.context.coreCommand.pushConsoleMessage('wwwwwwwwwwwwwwwwWWWWWWWWWWWWWWWWwwwwwwwwwwwWWWWWWWWWwwwwwwwwwwWWWWWwwOutput device has changed, continuing config');
	self.setVolumeParameters()
 
self.restoreVolumioconfig()
   .then(self.bridgeLoopBackequal())
 defer.resolve()
  return defer.promise;
 };

 //here we set the Loopback output
 ControllerVolsimpleequal.prototype.setalsaequaloutput = function() {
  var self = this;
  var defer = libQ.defer();
var outputp
outputp = self.config.get('alsa_outputdevicename')
     setTimeout(function() {
  var stri = {
   "output_device": {
    "value": "Loopback",
    "label": (outputp + " through equalizer plugin")
  //  "label": (outputp)
   }
  }
  self.commandRouter.executeOnPlugin('system_controller', 'i2s_dacs', 'disableI2SDAC', '');
  return self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'saveAlsaOptions', stri);
  }, 4500);

 // return defer.promise;
 };

 //here we restore config of volumio when the plugin is disabled
 ControllerVolsimpleequal.prototype.restoresettingwhendisabling = function() {

  var self = this;
  var output_restored = self.config.get('alsa_device')
  var output_label = self.config.get('alsa_outputdevicename')
  var mixert = self.config.get('alsa_mixer')
  var mixerty = self.config.get('mixer_type')
  var str = {
   "output_device": {
    "value": output_restored,
    "label": output_label
   },
   "mixer": {
    "value": mixert,
    "value": mixerty
   }
  }
  self.commandRouter.executeOnPlugin('system_controller', 'i2s_dacs', 'enableI2SDAC', '');
  return self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'saveAlsaOptions', str);

 };

 ControllerVolsimpleequal.prototype.getAdditionalConf = function(type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
 }
