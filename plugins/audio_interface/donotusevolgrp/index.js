 'use strict';

 //var io = require('socket.io-client');
 var fs = require('fs-extra');
 var libFsExtra = require('fs-extra');
 var exec = require('child_process').exec;
 var execSync = require('child_process').execSync;
 var libQ = require('kew');
 // var libNet = require('net');
 // var net = require('net');
 var config = new(require('v-conf'))();


 // Define the ControllerVolgrp class
 module.exports = ControllerVolgrp;

 function ControllerVolgrp(context) {
  var self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;

 // this.context = context;
 // this.commandRouter = this.context.coreCommand;
 // this.logger = this.context.logger;
  this.configManager = this.context.configManager;
 };

 ControllerVolgrp.prototype.onVolumioStart = function() {
  var self = this;
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.outputDeviceCallback.bind(this)); 
  this.config = new(require('v-conf'))();
  this.config.loadFile(configFile);
  return libQ.resolve();
 };

 ControllerVolgrp.prototype.getConfigurationFiles = function() {
  return ['config.json'];
 };

 // Plugin methods -----------------------------------------------------------------------------
 //here we load snd_aloop module to provide a Loopback device 
 ControllerVolgrp.prototype.modprobeLoopBackDevice = function() {
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

 // here we make the bridge between Loopback and asound
 ControllerVolgrp.prototype.bridgeLoopBack = function() {
  var self = this;
  var defer = libQ.defer();
  setTimeout(function() {
  exec("/usr/bin/sudo /bin/systemctl start volgrp.service", {
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
 ControllerVolgrp.prototype.saveVolumioconfig = function() {
  var self = this;

  return new Promise(function(resolve, reject) {

   var cp = execSync('/bin/cp /data/configuration/audio_interface/alsa_controller/config.json /tmp/vconfig.json');
   var cp2 = execSync('/bin/cp /data/configuration/system_controller/i2s_dacs/config.json /tmp/i2sconfig.json');
   try {
    var cp3 = execSync('/bin/cp /boot/config.txt /tmp/config.txt');

    // console.log('mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm')

   } catch (err) {
    self.logger.info('config.txt does not exist');
   }
   resolve();
  });
 };

 //here we define the volumio restore config
 ControllerVolgrp.prototype.restoreVolumioconfig = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
   setTimeout(function() {

    var cp = execSync('/bin/cp /tmp/vconfig.json /data/configuration/audio_interface/alsa_controller/config.json');
    var cp2 = execSync('/bin/cp /tmp/i2sconfig.json /data/configuration/system_controller/i2s_dacs/config.json');
    try {
     var cp3 = execSync('/bin/cp /tmp/config.txt /boot/config.txt');
    } catch (err) {
     self.logger.info('config.txt does not exist');
    }

   }, 8000)
   resolve();
  });
 };


 ControllerVolgrp.prototype.onStop = function() {
  var self = this;
  var defer = libQ.defer();
  self.restoresettingwhendisabling()
 exec("/usr/bin/sudo /bin/systemctl stop volgrp.service", {
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
 ControllerVolgrp.prototype.autoconfig = function() {
  var self = this;
  var defer = libQ.defer();
  self.saveVolumioconfig()
   .then(self.modprobeLoopBackDevice())
   .then(self.createASOUNDFile())
   .then(self.saveHardwareAudioParameters())
   .then(self.setvolgrpoutput())
 //  .then(self.setVolumeParameters())
 //  .then(self.restoreVolumioconfig())
 //  .then(self.bridgeLoopBack())
  .catch(function(err) {
   console.log(err);
  });
  defer.resolve()
  return defer.promise;
 };

ControllerVolgrp.prototype.outputDeviceCallback = function() {
  var self = this;
  var defer = libQ.defer();
	self.setVolumeParameters()
 
self.restoreVolumioconfig()
   .then(self.bridgeLoopBack())
 defer.resolve()
 return defer.promise;
 };



 ControllerVolgrp.prototype.onStart = function() {
  var self = this;

  var defer = libQ.defer();
  self.autoconfig()
//  self.createASOUNDFile()
   .then(function(e) {
    self.logger.info('Volgrp Started');
    defer.resolve();
   })
   .fail(function(e) {
    defer.reject(new Error());
   });
   return defer.promise;
 };

 ControllerVolgrp.prototype.onRestart = function() {
  var self = this;
 };

 ControllerVolgrp.prototype.onInstall = function() {
  var self = this;
  //	//Perform your installation tasks here
 };

 ControllerVolgrp.prototype.onUninstall = function() {
  var self = this;
  //Perform your installation tasks here
 };

 ControllerVolgrp.prototype.getUIConfig = function() {
  var self = this;
  var defer = libQ.defer();
  var lang_code = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
    __dirname + '/i18n/strings_en.json',
    __dirname + '/UIConfig.json')
   .then(function(uiconf) {
    value = self.config.get('rate');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[0].options'), value));
value = self.config.get('bitdepth');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[1].options'), value));
value = self.config.get('quality');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[2].options'), value));
	var value;
   
    	
            defer.resolve(uiconf);
            })
                .fail(function()
            {
                defer.reject(new Error());
        });
        return defer.promise;
};
 
 ControllerVolgrp.prototype.getLabelForSelect = function(options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
   if (options[i].value == key)
    return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
 };

 ControllerVolgrp.prototype.setUIConfig = function(data) {
  var self = this;

 };

 ControllerVolgrp.prototype.getConf = function(varName) {
  var self = this;
  //Perform your installation tasks here
 };


 ControllerVolgrp.prototype.setConf = function(varName, varValue) {
  var self = this;
  //Perform your installation tasks here
 };

 //here we save the asound.conf file config
 ControllerVolgrp.prototype.createASOUNDFile = function() {
  var self = this;

  var defer = libQ.defer();

  try {

   fs.readFile(__dirname + "/asound.tmpl", 'utf8', function(err, data) {
    if (err) {
     defer.reject(new Error(err));
     return console.log(err);
    }

	
var hwouts

	//else  hwouts = 'plughw:' + (self.config.get('alsa_device'));
	
	var conf1 = data.replace("${hwout}", self.config.get('alsa_device'));
	var conf2 = conf1.replace("${rate}", self.config.get('rate'));
	var conf3 = conf2.replace("${bitdepth}", self.config.get('bitdepth'));
	var conf4 = conf3.replace("${quality}", self.config.get('quality'));
	var conf5 = conf4.replace("${hwouts}", hwouts);
		

    fs.writeFile("/home/volumio/asoundrc", conf5, 'utf8', function(err) {
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

ControllerVolgrp.prototype.savevolgrp = function(data) {
  var self = this;

  var defer = libQ.defer();
	self.config.set('rate', data['rate'].value);
	self.config.set('bitdepth', data['bitdepth'].value);
	self.config.set('quality', data['quality'].value);
	self.logger.info('Configurations of filter have been set');

  self.rebuildvolgrp()
   .then(function(e) {
    //  self.commandRouter.pushToastMessage('success', "volgrp Configuration updated");
    defer.resolve({});
   })
   .fail(function(e) {
       defer.reject(new Error('error'));
  //  self.commandRouter.pushToastMessage('error', "failed to start. Check your config !");
   })


  return defer.promise;

 };

ControllerVolgrp.prototype.rebuildvolgrp = function() {
  var defer = libQ.defer();
  var self= this ;
  self.createASOUNDFile()
 //  .then(function(e) {
{
    var edefer = libQ.defer();
    exec("/usr/bin/sudo /bin/systemctl restart volgrp.service", {
     uid: 1000,
     gid: 1000
    }, function(error, stdout, stderr) {
     if (error) {
      self.commandRouter.pushToastMessage('error', 'a problem occurs');

     } else {

      self.commandRouter.pushToastMessage('success', 'filter applied');
     }
     edefer.resolve();
    });

    return edefer.promise;
   }
//)
 };

 ControllerVolgrp.prototype.setVolumeParameters = function() {
  var self = this;
  // here we set the volume controller in /volumio/app/volumecontrol.js
  // we need to do it since it will be automatically set to the loopback device by alsa controller
  // to retrieve those values we need to save the configuration of the system, found in /data/configuration/audio_interface/alsa_controller/config.json
  // before enabling the loopback device. We do this in saveHardwareAudioParameters(), which needs to be invoked just before volgrp is enabled
  setTimeout(function() {
   //  return new Promise(function(resolve, reject) { 
   //var defer = libQ.defer();
   var settings = {
    // need to set the device that volgrp wants to control volume to
    device: self.config.get('alsa_device'),
    // need to set the device name of the original device volgrp is controlling
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
    // once completed, uncomment

   return self.commandRouter.volumioUpdateVolumeSettings(settings)
    //setTimeout(function() {      
    //resolve();
  }, 5000);
  //});
  // return defer.promise;
 };

 ControllerVolgrp.prototype.saveHardwareAudioParameters = function() {
  var self = this;
  var defer = libQ.defer();

  var conf;
  // we save the alsa configuration for future needs here, note we prepend alsa_ to avoid confusion with other volgrp settings
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

 ControllerVolgrp.prototype.setAdditionalConf = function(type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'setConfigParam', data);
 };

 //here we set the Loopback output
 ControllerVolgrp.prototype.setvolgrpoutput = function() {
  var self = this;
  var defer = libQ.defer();
var outputp
outputp = self.config.get('alsa_outputdevicename')
     setTimeout(function() {
  var stri = {
   "output_device": {
    "value": "Loopback",
    "label": (outputp + " through volgrp plugin")
  //  "label": (outputp)
   }
  }
  self.commandRouter.executeOnPlugin('system_controller', 'i2s_dacs', 'disableI2SDAC', '');
  return self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'saveAlsaOptions', stri);
  }, 7500);

//  return defer.promise;
 };

 //here we restore config of volumio when the plugin is disabled
 ControllerVolgrp.prototype.restoresettingwhendisabling = function() {

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

 ControllerVolgrp.prototype.getAdditionalConf = function(type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
 }
