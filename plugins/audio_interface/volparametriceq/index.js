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


 // Define the Controllervolparametriceq class
 module.exports = Controllervolparametriceq;

 function Controllervolparametriceq(context) {
  var self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;

  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
 };

 Controllervolparametriceq.prototype.onVolumioStart = function() {
  var self = this;
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.outputDeviceCallback.bind(this)); 
  this.config = new(require('v-conf'))();
  this.config.loadFile(configFile);
  return libQ.resolve();
 };

 Controllervolparametriceq.prototype.getConfigurationFiles = function() {
  return ['config.json'];
 };

 // Plugin methods -----------------------------------------------------------------------------
 //here we load snd_aloop module to provide a Loopback device 
 Controllervolparametriceq.prototype.modprobeLoopBackDevice = function() {
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
 Controllervolparametriceq.prototype.bridgeLoopBack = function() {
  var self = this;
  var defer = libQ.defer();
  setTimeout(function() {
  exec("/usr/bin/sudo /bin/systemctl start volparametriceq.service", {
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
 Controllervolparametriceq.prototype.saveVolumioconfig = function() {
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
 Controllervolparametriceq.prototype.restoreVolumioconfig = function() {
  var self = this;
  var defer = libQ.defer();
 // return new Promise(function(resolve, reject) {
   setTimeout(function() {

    var cp = execSync('/bin/cp /tmp/vconfig.json /data/configuration/audio_interface/alsa_controller/config.json');
    var cp2 = execSync('/bin/cp /tmp/i2sconfig.json /data/configuration/system_controller/i2s_dacs/config.json');
    try {
     var cp3 = execSync('/bin/cp /tmp/config.txt /boot/config.txt');
    } catch (err) {
     self.logger.info('config.txt does not exist');
    }

   }, 8000)
 //  defer.resolve()
 return defer.promise;resolve();
 // });

 };


 Controllervolparametriceq.prototype.onStop = function() {
  var self = this;
  var defer = libQ.defer();
  self.restoresettingwhendisabling()
 exec("/usr/bin/sudo /bin/systemctl stop volparametriceq.service", {
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
 Controllervolparametriceq.prototype.autoconfig = function() {
  var self = this;
  var defer = libQ.defer();
  self.saveVolumioconfig()
   .then(self.modprobeLoopBackDevice())
   .then(self.createASOUNDFile())
   .then(self.saveHardwareAudioParameters())
   .then(self.volparametricoutput())
 //  .then(self.setVolumeParameters())
 //  .then(self.restoreVolumioconfig())
 //  .then(self.bridgeLoopBack())
  .catch(function(err) {
   console.log(err);
  });
  defer.resolve()
  return defer.promise;
 };

Controllervolparametriceq.prototype.outputDeviceCallback = function() {
  var self = this;
  var defer = libQ.defer();
	self.setVolumeParameters()
 
self.restoreVolumioconfig()
   .then(self.bridgeLoopBack())
 defer.resolve()
 return defer.promise;
 };

 Controllervolparametriceq.prototype.onStart = function() {
  var self = this;

  var defer = libQ.defer();
  self.autoconfig()
//  self.createASOUNDFile()
   .then(function(e) {
    self.logger.info('volparametriceq Started');
    defer.resolve();
   })
   .fail(function(e) {
    defer.reject(new Error());
   });
   return defer.promise;
 };

 Controllervolparametriceq.prototype.onRestart = function() {
  var self = this;
 };

 Controllervolparametriceq.prototype.onInstall = function() {
  var self = this;
  //	//Perform your installation tasks here
 };

 Controllervolparametriceq.prototype.onUninstall = function() {
  var self = this;
  //Perform your installation tasks here
 };

 Controllervolparametriceq.prototype.getUIConfig = function() {
  var self = this;
  var defer = libQ.defer();
  var lang_code = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
    __dirname + '/i18n/strings_en.json',
    __dirname + '/UIConfig.json')
   .then(function(uiconf) {

 	uiconf.sections[0].content[0].config.bars[0].value = self.config.get('mg');

 var coefconfp1 = self.config.get('p11');
    // it is a string, so to get single values we split them by , and create an array from that
    var coefarrayp1 = coefconfp1.split(',');
    //console.log(coefarray)
    // for every value that we put in array, we set the according bar value
    for (var i in coefarrayp1) {
     uiconf.sections[0].content[1].config.bars[i].value = coefarrayp1[i]
    }
var coefconfp2 = self.config.get('p21');
    // it is a string, so to get single values we split them by , and create an array from that
    var coefarrayp2 = coefconfp2.split(',');
    //console.log(coefarray)
    // for every value that we put in array, we set the according bar value
    for (var i in coefarrayp2) {
     uiconf.sections[0].content[2].config.bars[i].value = coefarrayp2[i]
    }
var coefconfp3 = self.config.get('p31');
    // it is a string, so to get single values we split them by , and create an array from that
    var coefarrayp3 = coefconfp3.split(',');
    //console.log(coefarray)
    // for every value that we put in array, we set the according bar value
    for (var i in coefarrayp3) {
     uiconf.sections[0].content[3].config.bars[i].value = coefarrayp3[i]
    }
var coefconfp4 = self.config.get('p41');
    // it is a string, so to get single values we split them by , and create an array from that
    var coefarrayp4 = coefconfp4.split(',');
    //console.log(coefarray)
    // for every value that we put in array, we set the according bar value
    for (var i in coefarrayp4) {
     uiconf.sections[0].content[4].config.bars[i].value = coefarrayp4[i]

    }
    	uiconf.sections[0].content[5].value = self.config.get('enableeq');

	var value;
            defer.resolve(uiconf);
            })
                .fail(function()
            {
                defer.reject(new Error());
        });
        return defer.promise;
};
 
 Controllervolparametriceq.prototype.getLabelForSelect = function(options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
   if (options[i].value == key)
    return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
 };

 Controllervolparametriceq.prototype.setUIConfig = function(data) {
  var self = this;

 };

 Controllervolparametriceq.prototype.getConf = function(varName) {
  var self = this;
  //Perform your installation tasks here
 };


 Controllervolparametriceq.prototype.setConf = function(varName, varValue) {
  var self = this;
  //Perform your installation tasks here
 };

 //here we save the asound.conf file config
 Controllervolparametriceq.prototype.createASOUNDFile = function() {
  var self = this;

  var defer = libQ.defer();

  try {

   fs.readFile(__dirname + "/asound.tmpl", 'utf8', function(err, data) {
    if (err) {
     defer.reject(new Error(err));
     return console.log(err);
    }
	var p11r	
	var p11 = self.config.get('p11');
	p11r = p11.replace(/,/g, " ");
console.log(p11r);
	var p21r	
	var p21 = self.config.get('p21');
	p21r = p21.replace(/,/g, " ");
console.log(p21r);
	var p31r	
	var p31 = self.config.get('p31');
	p31r = p31.replace(/,/g, " ");
console.log(p31r);
	var p41r	
	var p41 = self.config.get('p41');
	p41r = p41.replace(/,/g, " ");
console.log(p41r);
var  hwouts;
		if (self.config.get('enableeq') == true)
{
			hwouts = "pcm.outparameq"
	}
		else  hwouts = 'plughw:' + (self.config.get('alsa_device'));
	
	var conf1 = data.replace("${hwout}", self.config.get('alsa_device'));
	var conf2 = conf1.replace("${p11}", p11r);
	var conf3 = conf2.replace("${p21}", p21r);
	var conf4 = conf3.replace("${p31}", p31r);
	var conf5 = conf4.replace("${p41}", p41r);
	var conf6 = conf5.replace("${mg}", self.config.get('mg'));
	var conf7 = conf6.replace("${hwouts}", hwouts);
		

    fs.writeFile("/home/volumio/asoundrc", conf7, 'utf8', function(err) {
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

Controllervolparametriceq.prototype.savevolparametriceq = function(data) {
  var self = this;

  var defer = libQ.defer();

	self.config.set('mg', data['mg']);
	self.config.set('p11', data['p11']);
	self.config.set('p21', data['p21']);
	self.config.set('p31', data['p31']);
	self.config.set('p41', data['p41']);
	self.config.set('enableeq', data['enableeq']);
	self.logger.info('Configurations of equalizer have been set');

  self.rebuildvolparametriceq()
   .then(function(e) {
    //  self.commandRouter.pushToastMessage('success', "Bauer Configuration updated");
    defer.resolve({});
   })
   .fail(function(e) {
       defer.reject(new Error('error'));
  //  self.commandRouter.pushToastMessage('error', "failed to start. Check your config !");
   })


  return defer.promise;

 };

Controllervolparametriceq.prototype.rebuildvolparametriceq = function() {
  var self = this;
  var defer = libQ.defer();
  self.createASOUNDFile()
 //  .then(function(e) {
{
    var edefer = libQ.defer();
    exec("/usr/bin/sudo /bin/systemctl restart volparametriceq.service", {
     uid: 1000,
     gid: 1000
    }, function(error, stdout, stderr) {
     if (error) {
      self.commandRouter.pushToastMessage('error', 'a problem occurs');

     } else {

      self.commandRouter.pushToastMessage('success', 'Equalizer applied');
     }
     edefer.resolve();
    });

    return edefer.promise;
   }
//)
 };

 Controllervolparametriceq.prototype.setVolumeParameters = function() {
  var self = this;
  // here we set the volume controller in /volumio/app/volumecontrol.js
  // we need to do it since it will be automatically set to the loopback device by alsa controller
  // to retrieve those values we need to save the configuration of the system, found in /data/configuration/audio_interface/alsa_controller/config.json
  // before enabling the loopback device. We do this in saveHardwareAudioParameters(), which needs to be invoked just before stereo2mono is enabled
  setTimeout(function() {
   //  return new Promise(function(resolve, reject) { 
   //var defer = libQ.defer();
   var settings = {
    // need to set the device that stereo2mono wants to control volume to
    device: self.config.get('alsa_device'),
    // need to set the device name of the original device stereo2mono is controlling
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

 Controllervolparametriceq.prototype.saveHardwareAudioParameters = function() {
  var self = this;
  var defer = libQ.defer();

  var conf;
  // we save the alsa configuration for future needs here, note we prepend alsa_ to avoid confusion with other stereo2mono settings
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

 Controllervolparametriceq.prototype.setAdditionalConf = function(type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'setConfigParam', data);
 };

 //here we set the Loopback output
 Controllervolparametriceq.prototype.volparametricoutput = function() {
  var self = this;
  var defer = libQ.defer();
var outputp
outputp = self.config.get('alsa_outputdevicename')
     setTimeout(function() {
  var stri = {
   "output_device": {
    "value": "Loopback",
    "label": (outputp + " through volparametriceq plugin")
  //  "label": (outputp)
   }
  }
  self.commandRouter.executeOnPlugin('system_controller', 'i2s_dacs', 'disableI2SDAC', '');
  return self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'saveAlsaOptions', stri);
  }, 4500);

 // return defer.promise;
 };

 //here we restore config of volumio when the plugin is disabled
 Controllervolparametriceq.prototype.restoresettingwhendisabling = function() {

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

 Controllervolparametriceq.prototype.getAdditionalConf = function(type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
 }
