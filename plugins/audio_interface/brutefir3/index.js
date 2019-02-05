/*brutefir plugin for volumio3. By balbuze 2019*/
'use strict';

//var io = require('socket.io-client');
var fs = require('fs-extra');
var libFsExtra = require('fs-extra');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var libQ = require('kew');
//var libNet = require('net');
var net = require('net');
var config = new(require('v-conf'))();
//var Telnet = require('telnet-client')
//var connection = new Telnet()


// Define the ControllerBrutefir class
module.exports = ControllerBrutefir;

function ControllerBrutefir(context) {
 var self = this;
 self.context = context;
 self.commandRouter = self.context.coreCommand;
 self.logger = self.commandRouter.logger;

 this.context = context;
 this.commandRouter = this.context.coreCommand;
 this.logger = this.context.logger;
 this.configManager = this.context.configManager;
//self.brutefirDaemonConnect
};

ControllerBrutefir.prototype.onVolumioStart = function() {
 var self = this;
 var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
 this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.outputDeviceCallback.bind(this));
 this.config = new(require('v-conf'))();
 this.config.loadFile(configFile);
 self.autoconfig
 
 return libQ.resolve();
};

ControllerBrutefir.prototype.getConfigurationFiles = function() {
 return ['config.json'];
};

// Plugin methods -----------------------------------------------------------------------------
//here we load snd_aloop module to provide a Loopback device
ControllerBrutefir.prototype.modprobeLoopBackDevice = function() {
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
 }, 500)
};

//here we save the volumio config for the next plugin start
ControllerBrutefir.prototype.saveVolumioconfig = function() {
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
ControllerBrutefir.prototype.restoreVolumioconfig = function() {
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


ControllerBrutefir.prototype.startBrutefirDaemon = function() {
 var self = this;

 var defer = libQ.defer();

 exec("/usr/bin/sudo /bin/systemctl start brutefir.service", {
  uid: 1000,
  gid: 1000
 }, function(error, stdout, stderr) {
  if (error) {
   self.logger.info('brutefir failed to start. Check your configuration ' + error);
  } else {
   self.commandRouter.pushConsoleMessage('Brutefir Daemon Started');
   defer.resolve();
  }
 });

 return defer.promise;

};
/*
 //here we connect to brutefir to read peak errors
 ControllerBrutefir.prototype.brutefirDaemonConnect = function(defer) {
  var self = this;
var params = {
  host: '127.0.0.1',
  port: 3002,
 // shellPrompt: '/ # ',
  timeout: 1500,
  // removeEcho: 4
}
connection.connect(params)

connection.on('ready', function(prompt) {
  connection.exec(cmd, function(err, response) {
    console.log('brutefir connection' + response)
  })
})
/*
connection.on('timeout', function() {
  console.log('socket timeout!')
  connection.end()
})

connection.on('data', function() {
  console.log('from cli '+ data)
//  connection.end()
})
connection.on('close', function() {
  console.log('connection closed')
})

*/

/*  var client = new net.Socket();
  client.connect(3002, '127.0.0.1', function(err) {
   defer.resolve();
//setTimeout(function() {
   var brutefircmd

  brutefircmd = ('upk;lf');
   //here we send the command to brutefir
    
   client.write(brutefircmd);
//client.write('lf');
   console.log('cmd sent to brutefir = ' + brutefircmd);

  });
  //error handling section
  client.on('error', function(e) {

   if (e.code == 'ECONNREFUSED') {
    console.log('Huumm, is brutefir running ?');
    self.commandRouter.pushToastMessage('error', "Brutefir failed to start. Check your config !");

   }
  });

  //   setTimeout(function() {
  client.on('data', function(data) {
   console.log('Received from brutefir cli: ' + data);

 // client.destroy(); // kill client after server's response
  });
//}, 5000);

 };
*/

ControllerBrutefir.prototype.onStop = function() {
 var self = this;
 var defer = libQ.defer();
 self.logger.info("Stopping Brutefir service");

 exec("/usr/bin/sudo /bin/systemctl stop brutefir.service", {
  uid: 1000,
  gid: 1000
 }, function(error, stdout, stderr) {})

 self.restoresettingwhendisabling()
 defer.resolve();
 return libQ.resolve();
};

ControllerBrutefir.prototype.autoconfig = function() {
 var self = this;
 var defer = libQ.defer();
 self.saveVolumioconfig()
  .then(self.modprobeLoopBackDevice())
  .then(self.saveHardwareAudioParameters())
  .then(self.setLoopbackoutput())

  .catch(function(err) {
   console.log(err);
  });
 defer.resolve()
 return defer.promise;

};


ControllerBrutefir.prototype.onStart = function() {
 var self = this;
 self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
 var defer = libQ.defer();
 self.autoconfig()

 self.rebuildBRUTEFIRAndRestartDaemon()
  // .then( self.startBrutefirDaemon() )

  .then(function(e) {
   setTimeout(function() {
    self.logger.info("Starting brutefir");

    //self.getFilterList();

 //     self.brutefirDaemonConnect(defer);
   }, 1000);
  })
  .fail(function(e) {
   defer.reject(new Error());
  });
 return defer.promise;
};

ControllerBrutefir.prototype.onRestart = function() {
 // self.enableLoopBackDevice();

 var self = this;

};

ControllerBrutefir.prototype.onInstall = function() {
 var self = this;

 //	//Perform your installation tasks here
};

ControllerBrutefir.prototype.onUninstall = function() {
 var self = this;
 //Perform your installation tasks here
};

ControllerBrutefir.prototype.getUIConfig = function() {
 var self = this;
 var defer = libQ.defer();
 var output_device;

 output_device = self.config.get('output_device');

 var lang_code = this.commandRouter.sharedVars.get('language_code');
 self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
   __dirname + '/i18n/strings_en.json',
   __dirname + '/UIConfig.json')
  .then(function(uiconf)

   {
    var value;
    var valuestoredl;
    var valuestoredr;
    var filterfolder = "/data/INTERNAL/brutefirfilters";
    var items;
    var allfilter;

uiconf.sections[1].content[0].value = self.config.get('ldistance');
uiconf.sections[1].content[1].value = self.config.get('rdistance');


    valuestoredl = self.config.get('leftfilter');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', valuestoredl);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label', valuestoredl);

    valuestoredr = self.config.get('rightfilter');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value.value', valuestoredr);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value.label', valuestoredr);

    fs.readdir(filterfolder, function(err, item) {

     allfilter = 'None,' + item
     items = allfilter.split(',');
     self.logger.info('list of available filters ' + items);

     for (var i in items) {
      self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[1].options', {
       value: items[i],
       label: items[i]
      });

      self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[2].options', {
       value: items[i],
       label: items[i]
      });
     }
    });

    value = self.config.get('attenuation');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[0].options'), value));

    value = self.config.get('filter_size');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[3].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[3].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[3].options'), value));

    value = self.config.get('smpl_rate');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[4].options'), value));
    value = self.config.get('output_format');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[5].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[5].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[5].options'), value))
    var value;
 


    defer.resolve(uiconf);
   })
  .fail(function() {
   defer.reject(new Error());
  })
 return defer.promise

};

ControllerBrutefir.prototype.getFilterList = function() {
 var results
 var filterfolder = "/data/INTERNAL/brutefirfilters"
 //var filterl = [];
 fs.readdirSync(filterfolder).forEach(file => {
  results
  //  console.log(file);
  self.logger.info(results);
 });


};

ControllerBrutefir.prototype.getLabelForSelect = function(options, key) {
 var n = options.length;
 for (var i = 0; i < n; i++) {
  if (options[i].value == key)
   return options[i].label;
 }

 return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';

};

ControllerBrutefir.prototype.setUIConfig = function(data) {
 var self = this;

};

ControllerBrutefir.prototype.getConf = function(varName) {
 var self = this;
 //Perform your installation tasks here
};


ControllerBrutefir.prototype.setConf = function(varName, varValue) {
 var self = this;
 //Perform your installation tasks here
};

ControllerBrutefir.prototype.createBRUTEFIRFile = function() {
 var self = this;

 var defer = libQ.defer();


 try {

  fs.readFile(__dirname + "/brutefir.conf.tmpl", 'utf8', function(err, data) {
   if (err) {
    defer.reject(new Error(err));
    return console.log(err);
   }

   var value;
   var devicevalue;
   var sbauer;
   var input_device = 'Loopback,1';
   var filter_path = "/data/INTERNAL/brutefirfilters/";
   var leftfilter;
   var rightfilter;
   var composeleftfilter = filter_path + self.config.get('leftfilter');
   var composerightfilter = filter_path + self.config.get('rightfilter');
   var lattenuation;
   var rattenuation;

// delay calculation section
   var delay
   var sldistance = self.config.get('ldistance');
   var srdistance = self.config.get('rdistance');
   var diff
   var cdelay
   var sample_rate = self.config.get('smpl_rate');
   var sv = 34000 // sound velocity cm/s
	
	if (sldistance > srdistance) {
  		diff = sldistance - srdistance
		cdelay = (diff/sv*sample_rate)
		delay = ('0,' + Math.round(cdelay))
		self.logger.info('l>r ' + delay)
	}
	if (sldistance < srdistance) {
		diff = srdistance - sldistance
		cdelay = (diff/sv*sample_rate)
		delay = (Math.round(cdelay)+ ',0')
		self.logger.info('l<r ' + delay)

	} if (sldistance == srdistance) {
		self.logger.info('no delay needed');
		delay = ('0,0')
	}


   var n_part = self.config.get('numb_part');
   var num_part = parseInt(n_part);
   var f_size = self.config.get('filter_size');
   var filter_size = parseInt(f_size);
   var filtersizedivided = filter_size / num_part;
   var output_device
   output_device = 'hw:' + self.config.get('alsa_device');

   if (self.config.get('leftfilter') == "None") {
    composeleftfilter = "dirac pulse";
    //filterattenuation = "0"
   } else leftfilter = filter_path + self.config.get('leftfilter');
   //lattenuation = "6";
   if (self.config.get('rightfilter') == "None")
    composerightfilter = "dirac pulse";
   // filterattenuation = "0"
   else rightfilter = filter_path + self.config.get('rightfilter');
   // rattenuation = "6";
   //output_device = output_device;
   console.log(output_device);
   var conf1 = data.replace("${smpl_rate}", self.config.get('smpl_rate'));
   var conf2 = conf1.replace("${filter_size}", filtersizedivided);
   var conf3 = conf2.replace("${numb_part}", num_part);
   var conf4 = conf3.replace("${input_device}", input_device);
   var conf5 = conf4.replace("${delay}", delay);
   var conf6 = conf5.replace("${leftfilter}", composeleftfilter);
   var conf7 = conf6.replace("${filter_format1}", self.config.get('filter_format'));
   var conf8 = conf7.replace("${lattenuation}", self.config.get('attenuation'));
   var conf9 = conf8.replace("${rightfilter}", composerightfilter);
   var conf10 = conf9.replace("${filter_format2}", self.config.get('filter_format'));
   var conf11 = conf10.replace("${rattenuation}", self.config.get('attenuation'));
   var conf12 = conf11.replace("${output_device}", output_device);
   var conf13 = conf12.replace("${output_format}", self.config.get('output_format'));

   fs.writeFile("/data/configuration/audio_interface/brutefir/volumio-brutefir-config", conf13, 'utf8', function(err) {
    if (err)
     defer.reject(new Error(err));
    else defer.resolve();
   });
  });


 } catch (err) {


 }

 return defer.promise;

};


//here we save the brutefir config.json
ControllerBrutefir.prototype.saveBrutefirconfigAccount2 = function(data) {
 var self = this;
 var output_device
 var input_device = "Loopback,1";

 output_device = self.config.get('alsa_device');
 var defer = libQ.defer();
 self.config.set('attenuation', data['attenuation'].value);
 self.config.set('leftfilter', data['leftfilter'].value);
 self.config.set('rightfilter', data['rightfilter'].value);
 self.config.set('filter_size', data['filter_size'].value);
 self.config.set('smpl_rate', data['smpl_rate'].value);
 //  self.config.set('numb_part', data['numb_part']);
 self.config.set('input_device', data['input_device']);
 self.config.set('output_device', data['output_device']);
 self.config.set('output_format', data['output_format'].value);
 

 self.rebuildBRUTEFIRAndRestartDaemon()
  .then(function(e) {
   self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
   defer.resolve({});
  })
  .fail(function(e) {

   defer.reject(new Error('Brutefir failed to start. Check your config !'));
   self.commandRouter.pushToastMessage('error', 'Brutefir failed to start. Check your config !');
  })
 return defer.promise;
};

//here we save the brutefir delay calculation
ControllerBrutefir.prototype.saveBrutefirconfigroom = function(data) {
 var self = this;
 

 var defer = libQ.defer();
 
 self.config.set('ldistance', data['ldistance']);
 self.config.set('rdistance', data['rdistance']);

 self.rebuildBRUTEFIRAndRestartDaemon()
  .then(function(e) {
   self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
   defer.resolve({});
  })
  .fail(function(e) {

   defer.reject(new Error('Brutefir failed to start. Check your config !'));
   self.commandRouter.pushToastMessage('error', 'Brutefir failed to start. Check your config !');
  })
 return defer.promise;
};

//here we download and install tools
ControllerBrutefir.prototype.installtools = function(data) {
 var self = this;
 var modalData = {
  title: 'Tools installation',
  message: 'Your are going to download about 17Mo. Please WAIT until this page is refreshed (about 15 sec).',
  size: 'lg'
 };
 self.commandRouter.broadcastMessage("openModal", modalData);
 return new Promise(function(resolve, reject) {
  try {
   var cp3 = execSync('/usr/bin/wget -P /tmp https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/brutefir3/tools/tools.tar.xz');
   var cp4 = execSync('/bin/mkdir /data/plugins/audio_interface/brutefir/tools');
   var cp5 = execSync('tar -xvf /tmp/tools.tar.xz -C /data/plugins/audio_interface/brutefir/tools');
   var cp6 = execSync('/bin/rm /tmp/tools.tar.xz*');
   var cp7 = execSync('/bin/rm /data/plugins/audio_interface/brutefir/UIConfig.json');

   var cp8 = execSync('/bin/cp /data/plugins/audio_interface/brutefir/UIConfig.json.tools /data/plugins/audio_interface/brutefir/UIConfig.json');
  } catch (err) {
   self.logger.info('An error occurs while downloading or installing tools');
   self.commandRouter.pushToastMessage('error', 'An error occurs while downloading or installing tools');
  }
  resolve();
  self.commandRouter.pushToastMessage('success', 'Files succesfully Installed !', 'Refresh the page to see them');
  return self.commandRouter.reloadUi();
 });
};

//here we remove tools
ControllerBrutefir.prototype.removetools = function(data) {
 var self = this;
 self.commandRouter.pushToastMessage('info', 'Remove progress, please wait!');
 return new Promise(function(resolve, reject) {
  try {

   var cp6 = execSync('/bin/rm -Rf /data/plugins/audio_interface/brutefir/tools');
   var cp7 = execSync('/bin/rm /data/plugins/audio_interface/brutefir/UIConfig.json');

   var cp8 = execSync('/bin/cp /data/plugins/audio_interface/brutefir/UIConfig.json.base /data/plugins/audio_interface/brutefir/UIConfig.json')
  } catch (err) {
   self.logger.info('An error occurs while removing tools');
   self.commandRouter.pushToastMessage('error', 'An error occurs while removing tools');
  }
  resolve();
  self.commandRouter.pushToastMessage('success', 'Tools succesfully Removed !', 'Refresh the page to see them');
  return self.commandRouter.reloadUi();
 });
};

//here we play left sweep when button is pressed
ControllerBrutefir.prototype.playleftsweepfile = function(track) {
 var self = this;
 self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefir::clearAddPlayTrack');
 var track = '/data/plugins/audio_interface/brutefir/tools/512kMeasSweep_48k_20_to_20000_L_refR.WAV';
 var safeUri = track.replace(/"/g, '\\"');

 return self.mpdPlugin.sendMpdCommand('stop', [])
  .then(function() {
   try {
    exec('/usr/bin/killall aplay');
    exec('/usr/bin/aplay --device=plughw:Loopback ' + track);
   } catch (e) {
    console.log('/usr/bin/aplay --device=plughw:Loopback ' + track)
   };
  });
 
};


//here we play right sweep when button is pressed
ControllerBrutefir.prototype.playrightsweepfile = function(track) {
 var self = this;
 self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefir::clearAddPlayTrack');
 var track = '/data/plugins/audio_interface/brutefir/tools/512kMeasSweep_48k_20_to_20000_R_refR.WAV';
 var safeUri = track.replace(/"/g, '\\"');

 return self.mpdPlugin.sendMpdCommand('stop', [])
  .then(function() {

   try {
    exec('/usr/bin/killall aplay');
    exec('/usr/bin/aplay --device=plughw:Loopback ' + track);
   } catch (e) {
    console.log('/usr/bin/aplay --device=plughw:Loopback ' + track)
   };

  });
};

//here we play both channel when button is pressed
ControllerBrutefir.prototype.playbothsweepfile = function(track) {
 var self = this;
 self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefir::clearAddPlayTrack');
 var track = '/data/plugins/audio_interface/brutefir/tools/512kMeasSweep_48k_20_to_20000_LR_refR.WAV';
 var safeUri = track.replace(/"/g, '\\"');

 return self.mpdPlugin.sendMpdCommand('stop', [])
  .then(function() {
   try {
    exec('/usr/bin/killall aplay');
    exec('/usr/bin/aplay --device=plughw:Loopback ' + track);
   } catch (e) {
    console.log('/usr/bin/aplay --device=plughw:Loopback ' + track)
   };

  });
};

//here we play left pink noise channel when button is pressed
ControllerBrutefir.prototype.playleftpinkfile = function(track) {
 var self = this;
 self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefir::clearAddPlayTrack');
 var track = '/data/plugins/audio_interface/brutefir/tools/PinkNoise_48k_16-bit_L.WAV';
 var safeUri = track.replace(/"/g, '\\"');

 return self.mpdPlugin.sendMpdCommand('stop', [])
  .then(function() {
   try {
    exec('/usr/bin/killall aplay');
    exec('/usr/bin/aplay --device=plughw:Loopback ' + track);
   } catch (e) {
    console.log('/usr/bin/aplay --device=plughw:Loopback ' + track)
   };

  });
};

//here we play right pink noise channel when button is pressed
ControllerBrutefir.prototype.playrightpinkfile = function(track) {
 var self = this;
 self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefir::clearAddPlayTrack');
 var track = '/data/plugins/audio_interface/brutefir/tools/PinkNoise_48k_16-bit_R.WAV';
 var safeUri = track.replace(/"/g, '\\"');

 return self.mpdPlugin.sendMpdCommand('stop', [])
  .then(function() {
   try {
    exec('/usr/bin/killall aplay');
    exec('/usr/bin/aplay --device=plughw:Loopback ' + track);
   } catch (e) {
    console.log('/usr/bin/aplay --device=plughw:Loopback ' + track)
   };

  });
};


//here we play both pink noise channels when button is pressed
ControllerBrutefir.prototype.playbothpinkfile = function(track) {
 var self = this;
 self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefir::clearAddPlayTrack');
 var track = '/data/plugins/audio_interface/brutefir/tools/PinkNoise_48k_16-bit_BOTH.WAV';
 var safeUri = track.replace(/"/g, '\\"');

 return self.mpdPlugin.sendMpdCommand('stop', [])
  .then(function() {
   try {
    exec('/usr/bin/killall aplay');
    exec('/usr/bin/aplay --device=plughw:Loopback ' + track);
   } catch (e) {
    console.log('/usr/bin/aplay --device=plughw:Loopback ' + track)
   };

  });
};

//here we stop aplay
ControllerBrutefir.prototype.stopaplay = function(track) {
 var self = this;
 //self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefir::clearAddPlayTrack');

 return self.mpdPlugin.sendMpdCommand('stop', [])
  .then(function() {
   try {
    exec('/usr/bin/killall aplay');
   } catch (e) {
    self.data.logger('Stopping aplay')
   };
  });
};

ControllerBrutefir.prototype.rebuildBRUTEFIRAndRestartDaemon = function() {
 var self = this;
 var defer = libQ.defer();
 self.createBRUTEFIRFile()
  .then(function(e) {
   var edefer = libQ.defer();
   exec("/usr/bin/sudo /bin/systemctl restart brutefir.service", {
    uid: 1000,
    gid: 1000
   }, function(error, stdout, stderr) {
    if (error) {
     //	self.logger.error('Cannot Enable brutefir');
     self.commandRouter.pushToastMessage('error', 'Brutefir failed to start. Check your config !');
    } else {
     //self.logger.error('Brutefir started ! ');
     self.commandRouter.pushToastMessage('success', 'Attempt to start Brutefir...');
    }
    edefer.resolve();
   });

   return edefer.promise;
  })
  .then(self.startBrutefirDaemon.bind(self))
  .then(function(e) {
   setTimeout(function() {
     self.logger.info("Connecting to daemon");
        // self.brutefirDaemonConnect(defer);
    }, 2000)
    .fail(function(e) {
     //	defer.reject(new Error('Brutefir failed to start. Check your config !'));
     self.commandRouter.pushToastMessage('error', "Brutefir failed to start. Check your config !");
     self.logger.info("Brutefir failed to start. Check your config !");
    });
  });

 return defer.promise;
};

ControllerBrutefir.prototype.setVolumeParameters = function() {
 var self = this;
 // here we set the volume controller in /volumio/app/volumecontrol.js
 // we need to do it since it will be automatically set to the loopback device by alsa controller
 // to retrieve those values we need to save the configuration of the system, found in /data/configuration/audio_interface/alsa_controller/config.json
 // before enabling the loopback device. We do this in saveHardwareAudioParameters(), which needs to be invoked just before brutefir is enabled
 setTimeout(function() {
  //  return new Promise(function(resolve, reject) { 
  //var defer = libQ.defer();
  var settings = {
   // need to set the device that brutefir wants to control volume to
   device: self.config.get('alsa_device'),
   // need to set the device name of the original device brutefir is controlling
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

ControllerBrutefir.prototype.saveHardwareAudioParameters = function() {
 var self = this;
 var defer = libQ.defer();

 var conf;
 // we save the alsa configuration for future needs here, note we prepend alsa_ to avoid confusion with other brutefir settings
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

}

ControllerBrutefir.prototype.setAdditionalConf = function(type, controller, data) {
 var self = this;
 return self.commandRouter.executeOnPlugin(type, controller, 'setConfigParam', data);
};

ControllerBrutefir.prototype.outputDeviceCallback = function() {
 var self = this;
 var defer = libQ.defer();
 setTimeout(function() {
  self.setVolumeParameters()
 }, 2500);
 self.restoreVolumioconfig()
 //  self.rebuildBRUTEFIRAndRestartDaemon()
 defer.resolve()
 return defer.promise;
};

//here we set the Loopback output
ControllerBrutefir.prototype.setLoopbackoutput = function() {
 var self = this;
 var defer = libQ.defer();
 var outputp
 outputp = self.config.get('alsa_outputdevicename')
 setTimeout(function() {
  var stri = {
   "output_device": {
    "value": "Loopback",
    "label": (outputp + " through brutefir")
   }
  }
  self.commandRouter.executeOnPlugin('system_controller', 'i2s_dacs', 'disableI2SDAC', '');
  return self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'saveAlsaOptions', stri);
 }, 4500);
 var volumeval = self.config.get('alsa_volumestart')
 if (volumeval != 'disabled') {
  setTimeout(function() {
   exec('/volumio/app/plugins/system_controller/volumio_command_line_client/volumio.sh volume ' + volumeval, {
    uid: 1000,
    gid: 1000,
    encoding: 'utf8'
   }, function(error, stdout, stderr) {
    if (error) {
     self.logger.error('Cannot set startup volume: ' + error);
    } else {
     self.logger.info("Setting volume on startup at " + volumeval);
    }
   });
  }, 23000);
 }
 // retur
 return defer.promise;
};

//here we restore config of volumio when the plugin is disabled
ControllerBrutefir.prototype.restoresettingwhendisabling = function() {

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

ControllerBrutefir.prototype.getAdditionalConf = function(type, controller, data) {
 var self = this;
 return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
}
