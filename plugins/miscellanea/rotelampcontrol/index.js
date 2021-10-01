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
    self.commandRouter.logger.info('onStart function got additional conf: ' + JSON.stringify(device));
	
	setTimeout(function() {
		self.configSerialInterface();
		defer.resolve();
	},2000)

    return defer.promise;
};

rotelampcontrol.prototype.getConfigurationFiles = function() {
	return ['config.json'];
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

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {


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

	exec("/bin/stty -F /dev/ttyUSB0 115200 raw -echo -echoe -echok -echoctl -echoke", {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
        if (error !== null) {
            self.logger.info('Error, cannot configure serial interface '+error)
        } else {
            self.logger.info('Serial interface configured')
            self.addVolumeScripts();
        }
    });

};


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
	var mapTo100 = true;

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
    var maxVolume = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumemax');
    var volumeCurve = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumecurvemode');
    var volumeSteps = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumesteps');
    var mixerType = 'Other';
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
//	self.commandRouter.setStartupVolume();
};

// rotelampcontrol.prototype.addVolumeSettings = function() {
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
// };

// rotelampcontrol.prototype.alsavolume = function (VolumeInteger) {
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
// };
  
// rotelampcontrol.prototype.retrievevolume = function () {
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
//   };
  
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

