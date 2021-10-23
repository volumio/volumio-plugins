'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var spawn = require('child_process').spawn;

module.exports = rotelampcontrol;
function rotelampcontrol(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;

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
    //set some important parameters
	self.debugLogging = (self.config.get('logging')==true);
    self.currentVolume = self.config.get('startupVolume');
    self.currentMute = false;
    self.selectedAmp ={} ;
	self.loadI18nStrings();
    //load amp definitions from file
    self.loadAmpDefinitions()
    //initialize list of serial devices available to the system
    .then(_=> self.listSerialDevices())
    //set the active amp
    .then(_ => self.setActiveAmp())
    //configure the serial interface
    .then(_ => self.configSerialInterface())
    //attach listener to handle messages from the amp
    .then(serialDev => self.attachListener(serialDev))
    // .then(function(){
    //     //updateVolumeSettings and tell volumio that this is an override plugin
    // })
    // .then(function(){

    // })
    .then(function(){
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] onStart: successfully started plugin');
            defer.resolve();
    });
    
    return defer.promise;
};

rotelampcontrol.prototype.loadAmpDefinitions = function() {
    var self = this;

    var ampDefinitionFile = this.commandRouter.pluginManager.getConfigurationFile(this.context,'ampCommands.json')
    self.ampDefinitions = new(require('v-conf'))();
    self.ampDefinitions.loadFile(ampDefinitionFile);
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] loadAmpDefinitions: loaded AmpDefinitions: ' + JSON.stringify(self.ampDefinitions.data));
    //Generate list of Amp Names as combination of Vendor + Model
    self.ampVendorModelList = [];
    for (var n = 0; n < self.ampDefinitions.data.amps.length; n++)
    {
        self.ampVendorModelList.push(self.ampDefinitions.data.amps[n].vendor + ' - ' + self.ampDefinitions.data.amps[n].model);
    };
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] loadAmpDefinitions: loaded AmpDefinitions for ' + self.ampVendorModelList.length + ' Amplifiers.');
    return libQ.resolve();
};

rotelampcontrol.prototype.SerialInterface = function(dev) {
    this.serialInterfaceDev = "/dev/serial/by-id/" + dev;
}

rotelampcontrol.prototype.setActiveAmp = function() {
    var self = this;

    if ((self.config.get('ampType')!==undefined)&&(self.config.get('ampType')!=='...'))  {
        var selectedAmpIdx = self.ampVendorModelList.indexOf(self.config.get('ampType'));
        self.selectedAmp = self.ampDefinitions.data.amps[selectedAmpIdx];
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] setActiveAmp: ' + JSON.stringify(self.selectedAmp));
    } else {
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] setActiveAmp: not yet configured');
        self.selectedAmp = {};
    }
    return libQ.resolve();
}

rotelampcontrol.prototype.getConfigurationFiles = function() {
    return ['config.json','ampCommands.json'];
}

rotelampcontrol.prototype.onStop = function() {
    var self = this;

    self.detachListener();
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] onStopped: successfully stopped plugin');

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
            for (var n = 0; n < self.ampVendorModelList.length; n++)
            {
                self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[0].options', {
                    value: n+1,
                    label: self.ampVendorModelList[n]
                });
                if (self.ampVendorModelList[n] == ampFromConfig) {
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
			uiconf.sections[2].content[0].value = (self.config.get('logging')==true)
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
    if ((self.config.get('serialInterfaceDev')!==undefined) && 
        (self.config.get('serialInterfaceDev')!=='...') &&
        (Object.keys(self.selectedAmp).length > 0))  {
            //define the configuration of the serial interface
            const bits = parseInt(self.selectedAmp.dataBits);
            self.serialOptions = ''
            if ((bits > 4) && (bits <9)) {
                self.serialOptions = ' cs'+bits;
            };
            switch (self.selectedAmp.handshaking) {
                case 'RTS/CTS':
                    self.serialOptions = self.serialOptions + ' crtscts';
                    break;
                case 'DTR/DSR':
                    self.serialOptions = self.serialOptions + ' cdtrdsr';
                    break;
                default:
                    break;
            };
            switch (parseInt(self.selectedAmp.stopBit)) {
                case 1:
                    self.serialOptions = self.serialOptions + ' -cstopb';
                    break;
                case 2:
                    self.serialOptions = self.serialOptions + ' cstopb';
                    break;
                default:
                    break;
            };
            switch (self.selectedAmp.parity) {
                case 'no':
                    self.serialOptions = self.serialOptions + ' -parenb';
                    break;
                case 'odd':
                    self.serialOptions = self.serialOptions + ' parenb parodd';
                    break;
                case 'even':
                    self.serialOptions = self.serialOptions + ' parenb -parodd';
                    break;
                default:
                    break;
            }
            if (self.selectedAmp.ttyOptions != undefined) {
                self.serialOptions = self.serialOptions + ' ' + self.selectedAmp.ttyOptions;        
            }
            //construct the path to the device
            self.serialInterfaceDev = "/dev/serial/by-id/" + self.config.get('serialInterfaceDev');
            //construct the command for configuring the serial interface
            const cmdString = "/bin/stty -F " + self.serialInterfaceDev + ' ' + self.selectedAmp.baudRate + self.serialOptions;
            exec(cmdString, {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
                if (error !== null) {
                    self.logger.error('[ROTELAMPCONTROL] configSerialInterface: Error, cannot configure serial interface with "' + cmdString + '" ' + error)
                    defer.reject()
                } else {
                    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] configSerialInterface: Serial Interface configured with "' + cmdString +'"');
                    defer.resolve(self.serialInterfaceDev);
                }
            });
    } else {
        self.serialInterfaceDev = '';
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] configSerialInterface: Configuration still incomplete. Settings need to be completed.');
        defer.resolve('');
    }
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
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] listSerialDevices: ' + stdout);
            self.serialDevices = stdout.split(/[\r\n|\n|\r]/).filter(String);
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] listSerialDevices: found ' + self.serialDevices.length + ' devices.');
            defer.resolve();
        }
    });
    return defer.promise;
}

rotelampcontrol.prototype.sendCommand  = function() {
    //send a command to the amp
}

rotelampcontrol.prototype.chopResponse = function(data) {
    //first, chop up responses, if they do not arrive line by line
    var self = this;
    self.ampResponses += data.toString();
    var responses = self.ampResponses.split(self.selectedAmp.responses.separator);
    for (let i = 0; i < responses.length - 1; i++) {
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] chopResponse: ' + responses[i]);
        self.parseResponse(responses[i]);
    }
    self.ampResponses = responses[responses.length - 1];                
}

rotelampcontrol.prototype.parseResponse = function(data) {
    //interpret and react on messages from amp
    var self = this;
    var vol = NaN;
    var source = NaN;
    var match = data.match(new RegExp(self.selectedAmp.responses.respVolume,'i'));
    if (match !== null) {
        vol = parseInt(match[1]);
        var response = 'volumeVal';
    } else {
        match = data.match(new RegExp(self.selectedAmp.responses.respSource,'i'));
        if (match !== null) {
            source = match[1];
            var response = 'sourceVal';
        } else {
            var response = data;
        }       
    } 
    switch (response) {
        case self.selectedAmp.responses.respPowerOn:
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled PowerOn');
            break;
        case self.selectedAmp.responses.respPowerOff:
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled PowerOff');            
            break;
        case self.selectedAmp.responses.respMuteOff:
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled MuteOff');            
            break;
        case self.selectedAmp.responses.respMuteOn:
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled MuteOn');            
            break;
        case 'volumeVal':
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled volume is ' + vol);            
            break;
        case 'sourceVal':
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled source is ' + source);            
            break;
        default:
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: unhandled response "' + response +'"');
            break;
    }
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
    var mapTo100 = false;

    var data = {'enabled': enabled, 'setvolumescript': setVolumeScript, 'getvolumescript': getVolumeScript, 'setmutescript': setMuteScript,'getmutescript': getMuteScript, 'minVol': minVol, 'maxVol': maxVol, 'mapTo100': mapTo100};
    if (self.debugLogging) self.logger.info('Adding Rotel Axx parameters: '+ JSON.stringify(data))
    self.commandRouter.updateVolumeScripts(data);
    if (self.debugLogging) self.logger.info("Rotel amp: outputdevice: " + JSON.stringify(self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'outputdevice')));
    if (self.debugLogging) self.logger.info("Rotel amp: cards: " + JSON.stringify(this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getAlsaCards', '')));
    if (self.debugLogging) self.logger.info("Rotel amp: mixerdev: " + JSON.stringify(this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'mixer')));
    if (self.debugLogging) self.logger.info("Rotel amp: maxvolume: " + JSON.stringify(this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumemax')));
    if (self.debugLogging) self.logger.info("Rotel amp: volumecurve: " + JSON.stringify(this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumecurvemode')));
    if (self.debugLogging) self.logger.info("Rotel amp: mixertype: " + JSON.stringify(this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'mixer_type')));
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
    if (self.debugLogging) self.logger.info("ROTEL amp: Volume Settings: " + JSON.stringify(volSettingsData))
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
    // //override the retrievevolume function to read the volume from the amp
    // var self = this;
    // var defer = libQ.defer();
    // //original gibt getVolume fehler oder volume integer an die Cb-funktion zurück
    // //to do:
    // //mute abfragen ggf. mute setzten, bei fehler mute= false
    // //vol abfragen


    // this.getVolume(function (err, vol) {
    //     if (err) {
    //     self.logger.error('Cannot get ALSA Volume: ' + err);
    //     }
    //     self.getMuted(function (err, mute) {
    //     if (err) {
    //         mute = false;
    //     }
    //     // Log volume control
    //     self.logger.info('VolumeController:: Volume=' + vol + ' Mute =' + mute);
    //     if (!vol) {
    //         vol = currentvolume;
    //         mute = currentmute;
    //     } else {
    //         currentvolume = vol;
    //     }
    //     Volume.vol = vol;
    //     Volume.mute = mute;
    //     Volume.disableVolumeControl = false;
    //     return libQ.resolve(Volume)
    //         .then(function (Volume) {
    //         defer.resolve(Volume);
    //         self.commandRouter.volumioupdatevolume(Volume);
    //         });
    //     });
    // });
    // return defer.promise;
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

rotelampcontrol.prototype.attachListener = function(devPath){
	var self = this;
	var defer = libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] attachListener: ' + devPath);
    if (self.config.get('serialInterfaceDev') != "...") {
        try {
            self.handle = spawn("/bin/cat", [devPath]);
            self.ampResponses = "";
            self.handle.stdout.on('data', function(data){
                self.chopResponse(data);
            });
            self.handle.stdout.on('end', function(){
                    self.logger.error('[ROTELAMPCONTROL] attachListener: Stream from Serial Interface ended.');
            });
            self.handle.stderr.on('data', (data) => {
                self.logger.error('[ROTELAMPCONTROL] attachListener: ' + `stderr: ${data}`);
            });

            self.handle.on('close', (code) => {
                self.logger.error('[ROTELAMPCONTROL] attachListener: ' + `child process exited with code ${code}`);
            });
        	if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] attachListener: attached and listening');
        	defer.resolve();
        } catch (error) {
            self.logger.error('[ROTELAMPCONTROL] attachListener: could not connect to device' + error);
            defer.reject();
        }
    }
	return defer.promise;
}

rotelampcontrol.prototype.detachListener = function (){
	var self = this;
	var defer = libQ.defer();
	if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] detachListener: ');
	self.handle.kill();
	defer.resolve();
	return defer.promise;
}