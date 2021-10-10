'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

module.exports = rotelampcontrol;
function rotelampcontrol(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
//        this.volumeControl = this.context.volumeControl;

}

rotelampcontrol.prototype.onVolumioStart = function()
{
    var self = this;

    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
}

rotelampcontrol.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();
    var device = self.getAdditionalConf("system_controller", "system", "device");
    var ampDefinitionFile = this.commandRouter.pluginManager.getConfigurationFile(this.context,'ampCommands.json')
    this.ampDefinitions = new(require('v-conf'))();
    this.ampDefinitions.loadFile(ampDefinitionFile);

    self.commandRouter.logger.info('onStart function got additional conf: ' + JSON.stringify(device));
    self.logger.info('[ROTELAMPCONTROL] onStart: loaded AmpDefinitions: ' + JSON.stringify(self.ampDefinitions));
    self.logger.info('[ROTELAMPCONTROL] onStart: loaded AmpDefinitions for ' + self.ampDefinitions.data.amps.length + ' Amplifiers.');

	self.debugLogging = (self.config.get('logging')==true);
	self.loadI18nStrings();

    //get available devices for UI
    self.listSerialDevices()
    .then(function(list) {
        self.logger.info('[ROTELAMPCONTROL] onStart: found ' + list.length + ' devices: ' + list);
        self.serialDevices = list;
        setTimeout(function() {
            self.configSerialInterface();
            defer.resolve();
        },2000)
    });
    //configure interface if amp selected
    //update volume settings
    //install listener to catch info from amp
    
    return defer.promise;
};

rotelampcontrol.prototype.getConfigurationFiles = function() {
    return ['config.json','ampCommands.json'];
}

rotelampcontrol.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    self.removeVolumeScripts();
    defer.resolve();

    return libQ.resolve();
};

rotelampcontrol.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

rotelampcontrol.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;
    var selected = 0;
    var lbl = "";

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            //serial_interface section
            var serialFromConfig = self.config.get('serialInterfaceDev')
            selected = 0;
            for (var n = 0; n < self.serialDevices.length; n++)
            {
                self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[0].options', {
                    value: n+1,
                    label: self.serialDevices[n]
                });
                if (self.serialDevices[n] == serialFromConfig) {
                    selected = n+1;
                }
            };
            if (selected > 0) {
                uiconf.sections[0].content[0].value.value = selected;
                uiconf.sections[0].content[0].value.label = serialFromConfig;                
            }

            // amp_settings section
            var ampFromConfig = self.config.get('ampType');
            selected = 0;
            for (var n = 0; n < self.ampDefinitions.data.amps.length; n++)
            {
                lbl = self.ampDefinitions.data.amps[n].vendor + ' - ' + self.ampDefinitions.data.amps[n].model;
                self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[0].options', {
                    value: n+1,
                    label: lbl
                });
                if (lbl == ampFromConfig) {
                    selected = n+1
                }
            };
            if (selected > 0) {
                uiconf.sections[1].content[0].value.value = selected;
                uiconf.sections[1].content[0].value.label = ampFromConfig;                
            }
            if (ampFromConfig != "...") {
                for (var n = 0; n < self.ampDefinitions.data.amps[0].sources.length; n++)
                {
                    self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[1].options', {
                        value: n+1,
                        label: self.ampDefinitions.data.amps[0].sources[n]
                    });
                };                
            }
            // debug_settings section
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

rotelampcontrol.prototype.setUIConfig = function(data) {
    var self = this;
    //Perform your installation tasks here
};

rotelampcontrol.prototype.getConf = function(varName) {
    var self = this;
    //Perform your installation tasks here
};

rotelampcontrol.prototype.setConf = function(varName, varValue) {
    var self = this;
    //Perform your installation tasks here
};

rotelampcontrol.prototype.configSerialInterface = function (){
    var self = this;
    var defer = libQ.defer();

    exec("/bin/stty -F /dev/ttyUSB0 115200 raw -echo -echoe -echok -echoctl -echoke", {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
        if (error !== null) {
            self.logger.error('[ROTELAMPCONTROL] configSerialInterface: Error, cannot configure serial interface '+error)
        } else {
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] configSerialInterface: Serial Interface configured.');
            //ACHTUNG: Promise handling ist hiernoch nicht clean
            self.addVolumeScripts();
        }
    });
    return defer.promise;
};

rotelampcontrol.prototype.listSerialDevices = function() {
    //read and return devices connected to RPi
    var self = this;
    var defer = libQ.defer();

    self.commandRouter.logger.info('[ROTELAMPCONTROL] listSerialDevices');
    exec("/bin/ls /dev/serial/by-id", {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
        if (error !== null) {
            self.logger.error('[ROTELAMPCONTROL] listSerialDevices: Cannot list serial devices - ' + error)
            defer.reject();
        } else {
            self.logger.info('[ROTELAMPCONTROL] listSerialDevices: ' + stdout);
            let devArray = stdout.split(/[\r\n|\n|\r]/).filter(String);
            defer.resolve(devArray);
        }
    });

    return defer.promise;
}

rotelampcontrol.prototype.activateListener = function() {
    //connect a listener to the port to read data from amp
}

rotelampcontrol.prototype.sendCommand  = function() {
    //send a command to the amp
}

rotelampcontrol.prototype.parseResponse = function() {
    //interpret and react on messages from amp
}

rotelampcontrol.prototype.addVolumeScripts = function() {
    var self = this;

    var enabled = true;
    var setVolumeScript = '/data/plugins/miscellanea/rotelampcontrol/rotelscripts/setvolume.sh /dev/ttyUSB0 ';
    var getVolumeScript = '/data/plugins/miscellanea/rotelampcontrol/rotelscripts/getvolume.sh /dev/ttyUSB0';
    var setMuteScript = '/data/plugins/miscellanea/rotelampcontrol/rotelscripts/setmute.sh /dev/ttyUSB0 ';
    var getMuteScript = '/data/plugins/miscellanea/rotelampcontrol/rotelscripts/getmute.sh /dev/ttyUSB0';
    var minVol = 0;
    var maxVol = 50;
//    var mapTo100 = self.config.get('map_to_100', false);
    var mapTo100 = false;

    var data = {'enabled': enabled, 'setvolumescript': setVolumeScript, 'getvolumescript': getVolumeScript, 'setmutescript': setMuteScript,'getmutescript': getMuteScript, 'minVol': minVol, 'maxVol': maxVol, 'mapTo100': mapTo100};
    self.logger.info('Adding Rotel Axx parameters: '+ JSON.stringify(data))
    self.commandRouter.updateVolumeScripts(data);
    self.logger.info("Rotel amp: outputdevice: " + JSON.stringify(self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'outputdevice')));
    self.logger.info("Rotel amp: cards: " + JSON.stringify(this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getAlsaCards', '')));
    self.logger.info("Rotel amp: mixerdev: " + JSON.stringify(this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'mixer')));
    self.logger.info("Rotel amp: maxvolume: " + JSON.stringify(this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumemax')));
    self.logger.info("Rotel amp: volumecurve: " + JSON.stringify(this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumecurvemode')));
    self.logger.info("Rotel amp: mixertype: " + JSON.stringify(this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'mixer_type')));
    //Prepare the data for updating the Volume Settings
    var device = self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'outputdevice');
    var name = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getAlsaCards', '')[device].name;
    var mixer = 'ROTEL A12';
    // var maxVolume = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumemax');
    var maxVolume = "50";
    var volumeCurve = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumecurvemode');
    // var volumeSteps = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumesteps');
    var volumeSteps = "1";
    var mixerType = 'Software';
    var volSettingsData = {
        'device': device,
        'name': name,
        'mixer': mixer,
        'maxvolume': maxVolume,
        'volumecurve': '', //volumeCurve,
        'volumesteps': volumeSteps,
        'mixertype': mixerType
    };
    self.logger.info("ROTEL amp: Volume Settings: " + JSON.stringify(volSettingsData))
    self.commandRouter.volumioUpdateVolumeSettings(volSettingsData);
//	self.commandRouter.setStartupVolume();
};

rotelampcontrol.prototype.updateVolumeSettings = function() {
//update the volumio Volume Settings, mainly make this an Override plugin
// 	var self = this;

// 	var data = {
// 		device = '',
// 		mixer = '',
// 		maxvolume = '50',
// 		volumecurve = '',
// 		volumesteps = '50',
// 		currentvolume = '',
// 		hasHWMute = false,
// 		currentmute = false,
// 		premutevolume = '0',
// 		mixertype = 'Hardware',
// 		devicename = 'Rotel A12',
// 		volumeOverride = true,
// 		overridePluginType = 'miscellanea',
// 		overridePluginName = 'rotelampcontrol'
// 	}
};

rotelampcontrol.prototype.alsavolume = function (VolumeInteger) {
    //override the alsavolume function to send volume commands to the amp
// 	var self = this;
  
// 	//   var defer = libQ.defer();
// 	//   self.logger.info('VolumeController::SetAlsaVolume' + VolumeInteger);
// 	//   if (mixertype === 'None') {
// 	// 	Volume.vol = 100;
// 	// 	Volume.mute = false;
// 	// 	Volume.disableVolumeControl = true;
// 	// 	defer.resolve(Volume);
// 	//   } else {
// 	// 	switch (VolumeInteger) {
// 	// 	  case 'mute':
// 	// 		// Mute
// 	// 		self.getVolume(function (err, vol) {
// 	// 		  if (err) {
// 	// 			self.logger.error('Cannot get ALSA Volume: ' + err);
// 	// 		  }
// 	// 		  if (!vol) {
// 	// 			vol = currentvolume;
// 	// 		  }
// 	// 		  currentmute = true;
// 	// 		  premutevolume = vol;
// 	// 		  if (mixertype === 'Software') {
// 	// 			Volume.vol = currentvolume;
// 	// 			Volume.mute = true;
// 	// 			Volume.disableVolumeControl = false;
// 	// 			defer.resolve(Volume);
// 	// 			self.setVolume(0, function (err) {
// 	// 			  if (err) {
// 	// 				self.logger.error('Cannot set ALSA Volume: ' + err);
// 	// 			  }
// 	// 			});
// 	// 		  } else {
// 	// 			Volume.vol = premutevolume;
// 	// 			Volume.mute = true;
// 	// 			Volume.disableVolumeControl = false;
// 	// 			defer.resolve(Volume);
// 	// 			self.setMuted(true, function (err) {
// 	// 			  if (err) {
// 	// 				self.logger.error('Cannot set mute ALSA: ' + err);
// 	// 			  }
// 	// 			});
// 	// 		  }
// 	// 		});
// 	// 		break;
// 	// 	  case 'unmute':
// 	// 		// Unmute
// 	// 		currentmute = false;
// 	// 		// Log Volume Control
// 	// 		Volume.vol = premutevolume;
// 	// 		Volume.mute = false;
// 	// 		Volume.disableVolumeControl = false;
// 	// 		currentvolume = premutevolume;
// 	// 		defer.resolve(Volume);
// 	// 		self.setVolume(premutevolume, function (err) {
// 	// 		  if (err) {
// 	// 			self.logger.error('Cannot set ALSA Volume: ' + err);
// 	// 		  }
// 	// 		});
// 	// 		break;
// 	// 	  case 'toggle':
// 	// 		// Mute or unmute, depending on current state
// 	// 		if (Volume.mute) {
// 	// 		  defer.resolve(self.alsavolume('unmute'));
// 	// 		} else {
// 	// 		  defer.resolve(self.alsavolume('mute'));
// 	// 		}
// 	// 		break;
// 	// 	  case '+':
// 	// 		self.getVolume(function (err, vol) {
// 	// 		  if (err) {
// 	// 			self.logger.error('Cannot get ALSA Volume: ' + err);
// 	// 		  }
// 	// 		  if (!vol || currentmute) {
// 	// 			vol = currentvolume;
// 	// 		  }
// 	// 		  VolumeInteger = Number(vol) + Number(volumesteps);
// 	// 		  if (VolumeInteger > 100) {
// 	// 			VolumeInteger = 100;
// 	// 		  }
// 	// 		  if (VolumeInteger > maxvolume) {
// 	// 			VolumeInteger = maxvolume;
// 	// 		  }
// 	// 		  currentvolume = VolumeInteger;
// 	// 		  Volume.vol = VolumeInteger;
// 	// 		  Volume.mute = false;
// 	// 		  Volume.disableVolumeControl = false;
// 	// 		  defer.resolve(Volume);
// 	// 		  self.setVolume(VolumeInteger, function (err) {
// 	// 			if (err) {
// 	// 			  self.logger.error('Cannot set ALSA Volume: ' + err);
// 	// 			}
// 	// 		  });
// 	// 		});
// 	// 		break;
// 	// 	  case '-':
// 	// 		// Decrease volume by one (TEST ONLY FUNCTION - IN PRODUCTION USE A NUMERIC VALUE INSTEAD)
// 	// 		self.getVolume(function (err, vol) {
// 	// 		  if (err) {
// 	// 			self.logger.error('Cannot get ALSA Volume: ' + err);
// 	// 		  }
// 	// 		  if (!vol || currentmute) {
// 	// 			vol = currentvolume;
// 	// 		  }
// 	// 		  VolumeInteger = Number(vol) - Number(volumesteps);
// 	// 		  if (VolumeInteger < 0) {
// 	// 			VolumeInteger = 0;
// 	// 		  }
// 	// 		  if (VolumeInteger > maxvolume) {
// 	// 			VolumeInteger = maxvolume;
// 	// 		  }
// 	// 		  currentvolume = VolumeInteger;
// 	// 		  Volume.vol = VolumeInteger;
// 	// 		  Volume.mute = false;
// 	// 		  Volume.disableVolumeControl = false;
// 	// 		  defer.resolve(Volume);
// 	// 		  self.setVolume(VolumeInteger, function (err) {
// 	// 			if (err) {
// 	// 			  self.logger.error('Cannot set ALSA Volume: ' + err);
// 	// 			}
// 	// 		  });
// 	// 		});
// 	// 		break;
// 	// 	  default:
// 	// 		// Set the volume with numeric value 0-100
// 	// 		if (VolumeInteger < 0) {
// 	// 		  VolumeInteger = 0;
// 	// 		}
// 	// 		if (VolumeInteger > 100) {
// 	// 		  VolumeInteger = 100;
// 	// 		}
// 	// 		if (VolumeInteger > maxvolume) {
// 	// 		  VolumeInteger = maxvolume;
// 	// 		}
// 	// 		currentvolume = VolumeInteger;
// 	// 		Volume.vol = VolumeInteger;
// 	// 		Volume.mute = false;
// 	// 		Volume.disableVolumeControl = false;
// 	// 		defer.resolve(Volume);
// 	// 		self.setVolume(VolumeInteger, function (err) {
// 	// 		  if (err) {
// 	// 			self.logger.error('Cannot set ALSA Volume: ' + err);
// 	// 		  }
// 	// 		});
// 	// 	}
// 	//   }
// 	  return defer.promise;
};
  
rotelampcontrol.prototype.retrievevolume = function () {
    //override the retrievevolume function to read the volume from the amp
// 	var self = this;
  
// 	  var defer = libQ.defer();
// 		// 	this.getVolume(function (err, vol) {
// 	// 	  if (err) {
// 	// 		self.logger.error('Cannot get ALSA Volume: ' + err);
// 	// 	  }
// 	// 	  self.getMuted(function (err, mute) {
// 	// 		if (err) {
// 	// 		  mute = false;
// 	// 		}
// 	// 		// Log volume control
// 	// 		self.logger.info('VolumeController:: Volume=' + vol + ' Mute =' + mute);
// 	// 		if (!vol) {
// 	// 		  vol = currentvolume;
// 	// 		  mute = currentmute;
// 	// 		} else {
// 	// 		  currentvolume = vol;
// 	// 		}
// 	// 		Volume.vol = vol;
// 	// 		Volume.mute = mute;
// 	// 		Volume.disableVolumeControl = false;
// 	// 		return libQ.resolve(Volume)
// 	// 		  .then(function (Volume) {
// 	// 			defer.resolve(Volume);
// 	// 			self.commandRouter.volumioupdatevolume(Volume);
// 	// 		  });
// 	// 	  });
// 	// 	});
// 	  return defer.promise;
};
  
rotelampcontrol.prototype.removeVolumeScripts = function() {
    var self = this;

    var enabled = false;
    var setVolumeScript = '';
    var getVolumeScript = '';
    var setMuteScript = '';
    var getMuteScript = '';
    var minVol = 0;
    var maxVol = 100;
    var mapTo100 = false;

    var data = {'enabled': enabled, 'setvolumescript': setVolumeScript, 'getvolumescript': getVolumeScript, 'setmutescript': setMuteScript,'getmutescript': getMuteScript, 'minVol': minVol, 'maxVol': maxVol, 'mapTo100': mapTo100};
    self.commandRouter.updateVolumeScripts(data);
};

rotelampcontrol.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
    var confs = self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
    return confs;
};

//Gets called when user changes and saves debug settings
rotelampcontrol.prototype.updateDebugSettings = function (data) {
    var self = this;
    var defer = libQ.defer();
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTORL] updateDebugSettings: Saving Debug Settings:' + JSON.stringify(data));
    self.config.set('logging', (data['logging']))
    self.debugLogging = data['logging'];
    defer.resolve();
    self.commandRouter.pushToastMessage('success', self.getI18nString('TOAST_SAVE_SUCCESS'), self.getI18nString('TOAST_DEBUG_SAVE'));
    return defer.promise;
};

//Gets called when user changes and saves SerialDevice Settings
rotelampcontrol.prototype.updateSerialSettings = function (data) {
    var self = this;
    var defer = libQ.defer();
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTORL] updateSerialSettings: Saving Serial Settings:' + JSON.stringify(data));
    self.config.set('serialInterfaceDev', (data['serial_interface_dev'].label))
    defer.resolve();
    self.commandRouter.pushToastMessage('success', self.getI18nString('TOAST_SAVE_SUCCESS'), self.getI18nString('TOAST_SERIAL_SAVE'));
    return defer.promise;
};

//Gets called when user changes and saves AmpSettings
rotelampcontrol.prototype.updateAmpSettings = function (data) {
    var self = this;
    var defer = libQ.defer();
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTORL] updateAmpSettings: Saving Amplifier Settings:' + JSON.stringify(data));
    self.config.set('ampType', data['amp_type'].label);
    self.config.set('volumioInput', data['volumio_input'].label);
    self.config.set('maxVolume', parseInt(data['max_volume']));
    self.config.set('startupVolume',  parseInt(data['startup_volume']));
    self.config.set('volumeSteps', parseInt(data['volume_steps']));
    self.config.set('pauseWhenMuted', (data['pause_when_muted']));
    self.config.set('pauseWhenInputChanged', (data['pause_when_input_changed']));
    defer.resolve();
    self.commandRouter.pushToastMessage('success', self.getI18nString('TOAST_SAVE_SUCCESS'), self.getI18nString('TOAST_AMP_SAVE'));
    return defer.promise;
};



// Retrieve a string
rotelampcontrol.prototype.getI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined) {
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] getI18nString("'+key+'"):'+ self.i18nStrings[key]);
        return self.i18nStrings[key];
    } else {
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] getI18nString("'+key+'")'+ self.i18nStringsDefaults[key]);
        return self.i18nStringsDefaults['ROTELAMPCONTROL'][key];
    };
}
// A method to get some language strings used by the plugin
rotelampcontrol.prototype.loadI18nStrings = function() {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] loadI18nStrings: '+__dirname + '/i18n/strings_' + language_code + ".json");
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] loadI18nStrings: loaded: '+JSON.stringify(self.i18nStrings));
    }
    catch (e) {
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] loadI18nStrings: ' + language_code + ' not found. Fallback to en');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};