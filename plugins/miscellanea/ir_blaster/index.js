'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var { execFileSync } = require('child_process');
var { execFile }= require('child_process');
const os = require('os');
const kernelMajor = os.release().slice(0, os.release().indexOf('.'));
const kernelMinor = os.release().slice(os.release().indexOf('.') + 1, os.release().indexOf('.', os.release().indexOf('.') + 1));

var currentvolume = '';
var currentlyMuted = false;
var remote = { 'gpio_pin': 12, 'remote': '', 'name': '' };
var volScaling = { 'minVol': 0, 'maxVol': 100, 'step': 5 };
var volConfig = { 'minVol': 0, 'maxVol': 20, 'mapTo100': true };

var useScript = true;  // if true use (shell) scripts to send IR commands, otherwise use volumeOverride

module.exports = ir_blaster;

function ir_blaster(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}


ir_blaster.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

ir_blaster.prototype.onStart = function() {
    var self = this;
	  var defer=libQ.defer();

    var device = self.getAdditionalConf("system_controller", "system", "device");
//    self.logger.info('[IR-Blaster] Device: '+ JSON.stringify(device));
    if (device == "Raspberry PI") {
        self.enablePIOverlay();
    }
    self.logger.info('[IR-Blaster] Loaded configuration: ' + JSON.stringify(self.config.data));
    useScript = self.config.get('useScript', true);

    remote.name = self.config.get('remotename');  
    remote.gpio_pin = self.config.get('gpio_pin');
    // get lirc remote name
    self.getRemoteName().then(
        function () {
            self.logger.info('[IR-Blaster] Remote details: ' + JSON.stringify(remote));
            self.configureVolumeScale();
            if (useScript) {
                self.addVolumeScripts();
                self.getVolume();
            } else {
                self.configureVolumeOverride();
            }
        });  
  	// Once the Plugin has successfully started resolve the promise
  	defer.resolve();

    return defer.promise;
};

ir_blaster.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    if (useScript) {
        self.removeVolumeScripts();
    } else {

    }
    // Once the Plugin has successfully stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

ir_blaster.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

ir_blaster.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {

            // Remote section
            const SEC_REM = 1;
            var dirs = fs.readdirSync(__dirname + "/remotes");
            self.logger.info('[IR-Blaster] Found definitions for remotes: ' + dirs);
            // Get names for remotes based on their file name
            var name;
            for (var i = 0; i < dirs.length; i++) {
                if (dirs[i].endsWith(".lircd.conf")) {
                    name = dirs[i].split(".lircd.conf", 1)[0];
                    self.configManager.pushUIConfigParam(uiconf, `sections[${SEC_REM}].content[1].options`, {
                        value: __dirname + "/remotes/" + dirs[i],
                        label: name
                    });
                    if (name === remote.name) {
                        uiconf.sections[SEC_REM].content[1].value.label = name;
                        uiconf.sections[SEC_REM].content[1].value.value = __dirname + "/remotes/" + dirs[i];
                    }
                }
            }

            uiconf.sections[SEC_REM].content[0].value = self.config.get('gpio_pin');
            uiconf.sections[SEC_REM].content[2].value = useScript;
            

            // Volume section
            const SEC_VOL = 2;

            uiconf.sections[SEC_VOL].content[0].value = volConfig.minVol;
            uiconf.sections[SEC_VOL].content[1].value = volConfig.maxVol;
            if (useScript) {
                // get current volume:
                self.getVolume();
                uiconf.sections[SEC_VOL].content[2].value = currentvolume;
            } else {
                uiconf.sections[SEC_VOL].content[2].value = Math.round(currentvolume/volScaling.step);
            }
            //self.logger.info('[IR-Blaster] Preparing config GUI. Volume: ', currentvolume);

            uiconf.sections[SEC_VOL].content[3].value = volConfig.mapTo100;

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

ir_blaster.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

ir_blaster.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ir_blaster.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ir_blaster.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// Actual working methods ----------------------------------------------------

// Script based methods
// Adapted from Allo Relay attenuator plugin  (alloSteppedVolumeAttenuator)

ir_blaster.prototype.addVolumeScripts = function() {
    var self = this;

    var enabled = true;
    var setVolumeScript = __dirname + '/scripts/setvolume.sh ' + remote.remote;
    var getVolumeScript = __dirname + '/scripts/getvolume.sh';
    var setMuteScript = __dirname + '/scripts/setmute.sh ' + remote.remote;
    var getMuteScript = __dirname + '/scripts/getmute.sh';

    var data = { 'enabled': enabled, 'setvolumescript': setVolumeScript, 'getvolumescript': getVolumeScript, 'setmutescript': setMuteScript, 'getmutescript': getMuteScript, 'minVol': volConfig.minVol, 'maxVol': volConfig.maxVol, 'mapTo100': volConfig.mapTo100};
    //self.logger.info('[IR-Blaster] Setting parameters'+ JSON.stringify(data));
    self.commandRouter.updateVolumeScripts(data);
};

ir_blaster.prototype.removeVolumeScripts = function() {
    var self = this;

    var enabled = false;
    var setVolumeScript = '';
    var getVolumeScript = '';
    var setMuteScript = '';
    var getMuteScript = '';

    var data = { 'enabled': enabled, 'setvolumescript': setVolumeScript, 'getvolumescript': getVolumeScript, 'setmutescript': setMuteScript, 'getmutescript': getMuteScript, 'minVol': volConfig.minVol, 'maxVol': volConfig.maxVol, 'mapTo100': volConfig.mapTo100};
    self.commandRouter.updateVolumeScripts(data);
};

// volumeOverride methods
ir_blaster.prototype.configureVolumeOverride = function (enable) {
    var self = this;
    var enableOverride;

    // We have to pass 'device' and 'mixer' to 'volumioUpdateVolumeSettings' otherwise it fails!
    // Ideally 'volumeOverride' should be able to be set w/o the need to do this...
    // This would require changes to ''
    //
    // For now use workaround: get current settings and pass them back...
    var device = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'outputdevice');
    var mixerdev = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'mixer');
    // These seetings are only needed for when we want to dsiable the plugin again...
    //var volumecurve = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'volumecurvemode');
    //var mixertype = this.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'mixer_type');

    // Enable override by default: but if 'false' is passed to routine then switch it off
    if (enable == false) {
        enableOverride = false;
    } else enableOverride = true;

    const data = { 'device': device, 'mixer': mixerdev, 'volumeOverride': enableOverride, 'pluginType': 'miscellanea', 'pluginName': 'ir_blaster', 'volumesteps': volScaling.step, 'maxvolume': volScaling.maxVol };
    self.logger.info('[IR-Blaster] Setting parameters'+ JSON.stringify(data));
    self.commandRouter.volumioUpdateVolumeSettings(data);
};

ir_blaster.prototype.configureVolumeScale = function () {
    var self = this;

    volConfig.minVol = Number(self.config.get('vol_min'));
    volConfig.maxVol = Number(self.config.get('vol_max'));
    volConfig.mapTo100 = self.config.get('map_to_100', false);

    if (volConfig.mapTo100) {
        volScaling.step = 100 / (volConfig.maxVol - volConfig.minVol);
        volScaling.minVol = 0;
        volScaling.maxVol = 100;
//        currentvolume = currentvolume * volScaling.step;
    } else {
        volScaling.step = 1;
        volScaling.minVol = volConfig.minVol;
        volScaling.maxVol = volConfig.maxVol;
    }
    self.logger.info('[IR-Blaster] Updated volume settings: ' + JSON.stringify(volScaling));
};

ir_blaster.prototype.updateRemoteSettings = function (data) {
    var self = this;
    var scriptChanged = false;

    self.logger.info('[IR-Blaster] Updated remote settings: ' + JSON.stringify(data));


    if (Number.isInteger(Number(data['gpio_pin'])) && data['gpio_pin'] != remote.gpio_pin) {
        self.config.set('gpio_pin', data['gpio_pin']);
        remote.gpio_pin = data['gpio_pin'];
    }

    if (data['useScript'] !== undefined && data['useScript'] != useScript) {
        useScript = data['useScript'];
        self.config.set('useScript', useScript);
        scriptChanged = true;
    }

    if (data['remotename']['label'] != remote.name) {
        // remote has changed...
        remote.name = data['remotename']['label'];
        self.config.set('remotename', remote.name);
        //self.logger.info('[IR-Blaster] Remote settings changed to ' + data['remotename']['label']);
        // Copy to default location:
        execFileSync("/bin/cp", [data['remotename']['value'], "/etc/lirc/lircd.conf"], { uid: 1000, gid: 1000, encoding: 'utf8' });

        // Now we have to restart, otherwise lircd does not notice the change in config file...
        //execSync("sudo /bin/systemctl restart lirc.service", { uid: 1000, gid: 1000 });
        self.restartLirc(true).then(function () {
            self.getRemoteName().then(function () {
                // update scripts as remote name has changed...
                if (useScript) self.addVolumeScripts();
                self.commandRouter.pushToastMessage('success', 'IR-Blaster', 'Updated remote to ' + remote.name);
                self.logger.info('[IR-Blaster] Remote details: ' + JSON.stringify(remote));
            });
        });
    }

    if (scriptChanged) {
        if (useScript) {
            self.configureVolumeOverride(false);
            self.addVolumeScripts();
        } else {
            currentvolume = Number(currentvolume) * volScaling.step;
            self.configureVolumeOverride();
            self.retrievevolume();
        }
    }
}

ir_blaster.prototype.getRemoteName = function () {
    var defer = libQ.defer();
    var self = this;
    // Work out the name of the remote: use the 'irsend list' command
    const rname = exec('/usr/bin/irsend list "" ""', { uid: 1000, gid: 1000, encoding: 'utf8' },
        function (error, stdout, stderr) {
            if (error != null) {
                self.logger.info('[IR-Blaster] Could not get lirc remote name : ' + error);
                defer.reject();
            } else {
                // Turns out it sends the outout to stderr; took me ages to figure out...
                const rn = stderr.split("irsend: ");
                self.logger.info(`[IR-Blaster] New lirc remote name: ${rn[1]}`);
                remote.remote = rn[1].trim();
                defer.resolve();
            }
        });
    return defer.promise;
}

ir_blaster.prototype.updateVolumeSettings = function (data) {
    var self = this;
    self.logger.info('[IR-Blaster] Updated volume settings: ' + JSON.stringify(data));

    self.config.set('vol_min', data['vol_min']);
    self.config.set('vol_max', data['vol_max']);
    self.config.set('map_to_100', data['map_to_100']);
    self.configureVolumeScale();

    if (Number.isInteger(Number(data['vol_cur']))) {
        // This is to make sure data['vol_cur'] is a pure integer number. Hopefully enough to avoid shell script command injection (?)
        currentvolume = data['vol_cur'];
        self.config.set('vol_cur', currentvolume);
        if (useScript) {
            execFile(__dirname + '/scripts/initvolume.sh', [currentvolume], { uid: 1000, gid: 1000 },
                function (error, stdout, stderr) {
                    if (error != null) {
                        self.logger.info('[IR-Blaster] Initvolume.sh : ' + error);
                        //                    defer.reject();
                    } else {
                        self.logger.info('[IR-Blaster] Volume initialised');
                        //                    defer.resolve();
                    }
                });
        } else {
            currentvolume = Number(currentvolume);
            if (volConfig.mapTo100) currentvolume *= volScaling.step;
        }
        self.logger.info('[IR-Blaster] Updated volume settings: ' + currentvolume);
    } else {
        self.logger.info('[IR-Blaster] Current volume should be an integer value: ' + data['vol_cur']);
    };

    if (useScript) {
        self.addVolumeScripts();
    } else {
        self.configureVolumeOverride();
        self.retrievevolume();
    }
}



// Adapted from ir_receiver plugin
ir_blaster.prototype.enablePIOverlay = function() {
    var defer = libQ.defer();
    var self = this;

    if (kernelMajor < '4' || (kernelMajor === '4' && kernelMinor < '19')) {
        if (!fs.existsSync('/proc/device-tree/lirc_rpi')) {
            self.logger.info('[IR-Blaster] HAT did not load /proc/device-tree/lirc_rpi!');
            exec('/usr/bin/sudo /usr/bin/dtoverlay lirc-rpi gpio_out_pin=' + remote.gpio_pin, { uid: 1000, gid: 1000 },
                function (error, stdout, stderr) {
                    if(error != null) {
                        self.logger.info('[IR-Blaster] Error enabling lirc-rpi overlay: ' + error);
                        defer.reject();
                    } else {
                        self.logger.info('[IR-Blaster] lirc-rpi overlay using gpio pin ' + remote.gpio_pin);
                        defer.resolve();
                    }
                });
        } else {
            self.logger.info('[IR-Blaster] HAT already loaded /proc/device-tree/lirc_rpi!');
        }
    } else {
        if (fs.readdirSync('/proc/device-tree').find(function (fn) { return fn.startsWith('gpio-ir-transmitter'); }) === undefined) {
            self.logger.info('[IR-Blaster] HAT did not load /proc/device-tree/gpio-ir-transmitter!');
            exec('/usr/bin/sudo /usr/bin/dtoverlay gpio-ir-tx gpio_pin=' + remote.gpio_pin, { uid: 1000, gid: 1000 },
                function (error, stdout, stderr) {
                    if (error != null) {
                        self.logger.info('[IR-Blaster] Error enabling gpio-ir-tx overlay: ' + error);
                        defer.reject();
                    } else {
                        self.logger.info('[IR-Blaster] gpio-ir-tx overlay enabled using gpio pin ' + remote.gpio_pin);
                        defer.resolve();
                    }
                });
        } else {
            self.logger.info('[IR-Blaster] HAT already loaded /proc/device-tree/gpio-ir-transmitter!');
        }
    }
    return defer.promise;
};

ir_blaster.prototype.getVolume = function () {
    var self = this;

    const volout = execSync(__dirname + '/scripts/getvolume.sh', { uid: 1000, gid: 1000, encoding: 'utf8' });
    if (volout != null) {
        currentvolume = volout.trim();
        self.logger.info('[IR-Blaster] Read volume ' + currentvolume);
    } else {
        self.logger.info('[IR-Blaster] Error reading volume');
    }
};

ir_blaster.prototype.importRemoteDefinitions = function (data) {
    var self = this;

    var dirs = fs.readdirSync("/data/INTERNAL");
    var copied = 0;
    for (var i = 0; i < dirs.length; i++) {
        if (dirs[i].endsWith(".lircd.conf")) {
            fs.copyFileSync("/data/INTERNAL/" + dirs[i], __dirname + "/remotes/" + dirs[i]);
            copied++;
        }
    }
    if (copied > 0) {
        self.logger.info('[IR-Blaster] Copied ' + copied + ' remote definition(s).');
        self.commandRouter.pushToastMessage('success', 'IR-Blaster', 'Imported ' + copied + ' remote definition(s).');
    } else {
        self.logger.info('[IR-Blaster] No new remote definitions found.');
        self.commandRouter.pushToastMessage('info', 'IR-Blaster', 'Did not find any remote definitions to import.');
    }      
    return copied;
};

ir_blaster.prototype.sendRemoteCommand = function (commandArray) {
    var defer = libQ.defer();
    var self = this;
    const arg1 = ['SEND_ONCE', remote.remote];
    const args = arg1.concat(commandArray); 
    execFile('/usr/bin/irsend', args, { uid: 1000, gid: 1000 },
        function (error, stdout, stderr) {
            if (error != null) {
                self.logger.info('[IR-Blaster] Error sending IR signal: ' + error);
                defer.reject();
            } else {
                self.logger.info('[IR-Blaster] Send IR signal ' + commandArray);
                defer.resolve();
            }
        });

    return defer.promise;
};


ir_blaster.prototype.powerToggle = function(data) {

    return this.sendRemoteCommand('KEY_POWER');
};


ir_blaster.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
    var confs = self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
    return confs;
};

// Adapted from ir_receiver plugin
ir_blaster.prototype.restartLirc = function (message) {
    var self = this;
    var defer = libQ.defer();

    exec('usr/bin/sudo /bin/systemctl stop lirc.service', { uid: 1000, gid: 1000 },
        function (error, stdout, stderr) {
            if (error != null) {
                self.logger.info('Cannot kill irexec: ' + error);
            }
            setTimeout(function () {

                exec('usr/bin/sudo /bin/systemctl start lirc.service', { uid: 1000, gid: 1000 },
                    function (error, stdout, stderr) {
                        if (error != null) {
                            self.logger.info('Error restarting LIRC: ' + error);
                            defer.reject();
                            if (message) {
                                self.commandRouter.pushToastMessage('error', 'IR-Blaster', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_ERROR'));
                            }
                        } else {
                            self.logger.info('lirc correctly started');
                            defer.resolve();
                            if (message) {
                                self.commandRouter.pushToastMessage('success', 'IR-Blaster', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_DESCRIPTION'));
                            }
                        }
                    });
            }, 1000)
        });
    return defer.promise;
}

// Functions to be used with volumeOverride

ir_blaster.prototype.alsavolume = function (VolumeInteger) {
    var self = this;
    var defer = libQ.defer();
    
    var volChange = 0;
    var muteToggled = false;
    var cmdArray = [];
        
    switch (VolumeInteger) {
    case 'mute':
        // Mute
        if (!currentlyMuted) muteToggled = true;                  
        break;
    case 'unmute':
        // Unmute
        if (currentlyMuted) {
            muteToggled = true;
        }
        break;
    case 'toggle':
        // Mute or unmute, depending on current state
        muteToggled = true;
        break;
    case '+':
        if (currentvolume < volScaling.maxVol) {
            volChange = 1;
            currentvolume += volScaling.step;
        }
        break;
    case '-':
        // Decrease volume by one (TEST ONLY FUNCTION - IN PRODUCTION USE A NUMERIC VALUE INSTEAD)
        if (currentvolume > volScaling.minVol) {
            volChange = -1;
            currentvolume -= volScaling.step;
        }
        break;
    default:
        // Set the volume with numeric value 0-100
        if (VolumeInteger < volScaling.minVol) {
            VolumeInteger = volScaling.minVol;
        }
        if (VolumeInteger > volScaling.maxVol) {
            VolumeInteger = volScaling.maxVol;
        }
        if (VolumeInteger != currentvolume) {
            volChange = Math.round((VolumeInteger - currentvolume)/volScaling.step);
            currentvolume += volChange * volScaling.step;
        }
    }
    if (muteToggled) {
        currentlyMuted = !currentlyMuted;
        cmdArray = ['KEY_MUTE'];
        self.logger.info('Mute state toggled. New mute state: ' + currentlyMuted);
    } else {
        if (volChange != 0) {
            self.logger.info('Volume changed by ' + volChange + ' step(s). New volume : ' + currentvolume);
            var command;
            if (volChange > 0) command = 'KEY_VOLUMEUP '; else command = 'KEY_VOLUMEDOWN ';
            var i = 0;
            while (i < Math.abs(volChange)) {
                cmdArray.push(command);
                i++;
            }
        }
    }
    self.logger.info('LIRC command string: ' + cmdArray);
    if (cmdArray != []) self.sendRemoteCommand(cmdArray);    

    const Volume = {
        'vol': Math.round(currentvolume), 'mute': currentlyMuted, 'disableVolumeControl': false
    };
    self.commandRouter.volumioupdatevolume(Volume);
    defer.resolve(Volume);

    return defer.promise;
};


ir_blaster.prototype.retrievevolume = function () {    
    const Volume = {
        'vol': Math.round(currentvolume), 'mute': currentlyMuted, 'disableVolumeControl': false
    };

    return libQ.resolve(Volume)
        .then(function (Volume) {
            libQ.defer().resolve(Volume);
            self.commandRouter.volumioupdatevolume(Volume);
        });
};