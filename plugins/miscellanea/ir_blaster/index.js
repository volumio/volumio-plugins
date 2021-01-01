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
var volScaling = {'minVol': 0, 'maxVol': 100, 'step': 5};

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
    remote.name = self.config.get('remotename');
    remote.gpio_pin = self.config.get('gpio_pin');
    // get lirc remote name
    self.getRemoteName().then(
        function () {
            self.logger.info('[IR-Blaster] Remote details: ' + JSON.stringify(remote));
            self.addVolumeScripts();
        });
    
    self.getVolume();

  	// Once the Plugin has successfull started resolve the promise
  	defer.resolve();

    return defer.promise;
};

ir_blaster.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    self.removeVolumeScripts();

    // Once the Plugin has successfull stopped resolve the promise
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
            

            // Volume section
            const SEC_VOL = 2;

            uiconf.sections[SEC_VOL].content[0].value = self.config.get('vol_min');
            uiconf.sections[SEC_VOL].content[1].value = self.config.get('vol_max');
            // get current volume:
            self.getVolume();
            uiconf.sections[SEC_VOL].content[2].value = currentvolume;
            //self.logger.info('[IR-Blaster] Preparing config GUI. Volume: ', currentvolume);

            uiconf.sections[SEC_VOL].content[3].value = self.config.get('map_to_100');

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

// Adapted from Allo Relay attenuator plugin  (alloSteppedVolumeAttenuator)

ir_blaster.prototype.addVolumeScripts = function() {
    var self = this;

    var enabled = true;
    var setVolumeScript = __dirname + '/scripts/setvolume.sh ' + remote.remote;
    var getVolumeScript = __dirname + '/scripts/getvolume.sh';
    var setMuteScript = __dirname + '/scripts/setmute.sh ' + remote.remote;
    var getMuteScript = __dirname + '/scripts/getmute.sh';
    var minVol = self.config.get('vol_min');
    var maxVol = self.config.get('vol_max');
    var mapTo100 = self.config.get('map_to_100', false);

    var data = {'enabled': enabled, 'setvolumescript': setVolumeScript, 'getvolumescript': getVolumeScript, 'setmutescript': setMuteScript,'getmutescript': getMuteScript, 'minVol': minVol, 'maxVol': maxVol, 'mapTo100': mapTo100};
    //self.logger.info('[IR-Blaster] Setting parameters'+ JSON.stringify(data));
    self.commandRouter.updateVolumeScripts(data);
    //self.commandRouter.volumioupdatevolume(Volume);
};

ir_blaster.prototype.removeVolumeScripts = function() {
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

ir_blaster.prototype.updateRemoteSettings = function (data) {
    var self = this;
    self.logger.info('[IR-Blaster] Updated remote settings: ' + JSON.stringify(data));


    if (Number.isInteger(Number(data['gpio_pin'])) && data['gpio_pin'] != remote.gpio_pin) {
        self.config.set('gpio_pin', data['gpio_pin']);
        remote.gpio_pin = data['gpio_pin'];
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
                self.addVolumeScripts();
                self.commandRouter.pushToastMessage('success', 'IR-Blaster', 'Updated remote to ' + remote.name);
                self.logger.info('[IR-Blaster] Remote details: ' + JSON.stringify(remote));
            });
        });
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
    self.config.set('vol_cur', data['vol_cur']);
    if (Number.isInteger(Number(data['vol_cur']))) {
        // This is to make sure data['vol_cur'] is a pure integer number. Hopefully enough to avoid shell script command injection (?)
        currentvolume = data['vol_cur'];
        self.logger.info('[IR-Blaster] current volume ' + currentvolume);
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
        self.logger.info('[IR-Blaster] Current volume should be an integer value: ' + data['vol_cur']);
    };
    self.config.set('map_to_100', data['map_to_100']);
    self.logger.info('[IR-Blaster] Updated volume settings: ' + currentvolume);
    self.addVolumeScripts();

    currentvolume = Number(currentvolume);
    volScaling.minVol = data['vol_min'];
    volScaling.maxVol = data['vol_max'];
    if (volScaling.maxVol <= volScaling.minVol) volScaling.maxVol = volScaling.minVol + 1;

    if (data['map_to_100']) {
        volScaling.step = 100 / (volScaling.maxVol - volScaling.minVol);
        volScaling.minVol = 0;
        volScaling.maxVol = 100;
        currentvolume = currentvolume * volScaling.step;
    } else {
        volScaling.step = 1;
    }
    self.logger.info('[IR-Blaster] Updated volume settings: ' + JSON.stringify(volScaling));
    self.logger.info('[IR-Blaster] Current volume: ' + currentvolume);

    // Some test calls for debugging:
    //self.alsavolume('+');
    //self.alsavolume('-');
    self.alsavolume(50);
    //self.alsavolume('mute');
    //self.alsavolume('toggle');
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
            currentvolume = VolumeInteger;
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
    return currentvolume;
};


ir_blaster.prototype.retrievevolume = function () {    
    return currentvolume;
};