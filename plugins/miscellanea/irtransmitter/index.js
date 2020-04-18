'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var execFile = require('child_process').execFile;
const os = require('os');
const kernelMajor = os.release().slice(0, os.release().indexOf('.'));
const kernelMinor = os.release().slice(os.release().indexOf('.') + 1, os.release().indexOf('.', os.release().indexOf('.') + 1));

var currentvolume = '';

module.exports = irtransmitter;
function irtransmitter(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



irtransmitter.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

irtransmitter.prototype.onStart = function() {
    var self = this;
	  var defer=libQ.defer();

    var device = self.getAdditionalConf("system_controller", "system", "device");
//    self.logger.info('[IR transmitter] Device: '+ JSON.stringify(device));
    if (device == "Raspberry PI") {
        self.enablePIOverlay();
    }
    self.logger.info('[IR-Transmitter] Loaded configuration: ' + JSON.stringify(self.config.data));
 
    self.addVolumeScripts();
    self.getVolume();

  	// Once the Plugin has successfull started resolve the promise
  	defer.resolve();

    return defer.promise;
};

irtransmitter.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    self.removeVolumeScripts();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

irtransmitter.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

irtransmitter.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            var dirs = fs.readdirSync(__dirname + "/remotes");
            //console.log('Read ' + dirs.length + ' files:');
            self.logger.info('[IR transmitter] ' + dirs);
            // Get names for remotes based on their file name
            var name;
            for (var i = 0; i < dirs.length; i++) {
                if (dirs[i].endsWith(".lircd.conf")) {
                    name = dirs[i].split(".lircd.conf", 1)[0];
                    self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[1].options', {
                        value: name,
                        label: name
                    });
 //                   console.log(dirs[i].split(".lircd.conf", 1)[0]);
                }
            }

            uiconf.sections[1].content[0].value = self.config.get('gpio_pin');
            //uiconf.sections[1].content[1].value = self.config.get('remotename');

            uiconf.sections[2].content[0].value = self.config.get('vol_min');
            uiconf.sections[2].content[1].value = self.config.get('vol_max');


            self.getVolume();
            uiconf.sections[2].content[2].value = currentvolume;
            self.logger.info('[IR transmitter] Preparing config GUI. Volume: ', currentvolume);

            uiconf.sections[2].content[3].value = self.config.get('map_to_100');

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

irtransmitter.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

irtransmitter.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

irtransmitter.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

irtransmitter.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// Actual working methods ----------------------------------------------------

// Adapted from Allo Relay attenuator plugin  (alloSteppedVolumeAttenuator)

irtransmitter.prototype.addVolumeScripts = function() {
    var self = this;

    var enabled = true;
    var setVolumeScript = __dirname + '/setvolume.sh';
    var getVolumeScript = __dirname + '/getvolume.sh';
    var setMuteScript = __dirname + '/setmute.sh';
    var getMuteScript = __dirname + '/getmute.sh';
    var minVol = self.config.get('vol_min');
    var maxVol = self.config.get('vol_max');
    var mapTo100 = self.config.get('map_to_100', false);

    var data = {'enabled': enabled, 'setvolumescript': setVolumeScript, 'getvolumescript': getVolumeScript, 'setmutescript': setMuteScript,'getmutescript': getMuteScript, 'minVol': minVol, 'maxVol': maxVol, 'mapTo100': mapTo100};
    //self.logger.info('[IR transmitter] Setting parameters'+ JSON.stringify(data));
    self.commandRouter.updateVolumeScripts(data);
    //self.commandRouter.volumioupdatevolume(Volume);
};

irtransmitter.prototype.removeVolumeScripts = function() {
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

irtransmitter.prototype.updateRemoteSettings = function (data) {
    var self = this;
    self.logger.info('[IR transmitter] Updated remote settings: ' + JSON.stringify(data));
    self.config.set('remotename', data['remotename']);
    self.config.set('gpio_pin', data['gpio_pin']);
}

irtransmitter.prototype.updateVolumeSettings = function (data) {
    var self = this;
    self.logger.info('[IR transmitter] Updated volume settings: ' + JSON.stringify(data));

    self.config.set('vol_min', data['vol_min']);
    self.config.set('vol_max', data['vol_max']);
    self.config.set('vol_cur', data['vol_cur']);
    if (Number.isInteger(Number(data['vol_cur']))) {
        // This is to make sure data['vol_cur'] is a pure integer number. Hopefully enough to avoid shell script command injection (?)
        currentvolume = data['vol_cur'];
        self.logger.info('[IR Transmitter] current volume ' + currentvolume);
        execFile(__dirname + '/initvolume.sh', [currentvolume], { uid: 1000, gid: 1000 },
            function (error, stdout, stderr) {
                if (error != null) {
                    self.logger.info('[IR Transmitter] Initvolume.sh : ' + error);
//                    defer.reject();
                } else {
                    self.logger.info('[IR Transmitter] Volume initialised');
//                    defer.resolve();
                }
            });
    } else {
        self.logger.info('[IR Transmitter] Current volume should be an integer value: ' + data['vol_cur']);
    };
    self.config.set('map_to_100', data['map_to_100']);
    self.logger.info('[IR transmitter] Updated volume settings: ' + currentvolume);
    self.addVolumeScripts();
}



// Adapted from ir_receiver plugin
irtransmitter.prototype.enablePIOverlay = function() {
    var defer = libQ.defer();
    var self = this;

    if (kernelMajor < '4' || (kernelMajor === '4' && kernelMinor < '19')) {
        if (!fs.existsSync('/proc/device-tree/lirc_rpi')) {
            self.logger.info('[IR Transmitter] HAT did not load /proc/device-tree/lirc_rpi!');
            exec('/usr/bin/sudo /usr/bin/dtoverlay lirc-rpi gpio_out_pin=12', { uid: 1000, gid: 1000 },
                function (error, stdout, stderr) {
                    if(error != null) {
                        self.logger.info('[IR Transmitter] Error enabling lirc-rpi overlay: ' + error);
                        defer.reject();
                    } else {
                        self.logger.info('[IR Transmitter] lirc-rpi overlay enabled');
                        defer.resolve();
                    }
                });
        } else {
            self.logger.info('[IR Transmitter] HAT already loaded /proc/device-tree/lirc_rpi!');
        }
    } else {
        if (fs.readdirSync('/proc/device-tree').find(function (fn) { return fn.startsWith('gpio-ir-transmitter'); }) === undefined) {
            self.logger.info('[IR Transmitter] HAT did not load /proc/device-tree/gpio-ir-transmitter!');
            exec('/usr/bin/sudo /usr/bin/dtoverlay gpio-ir-tx gpio_pin=12', { uid: 1000, gid: 1000 },
                function (error, stdout, stderr) {
                    if (error != null) {
                        self.logger.info('[IR Transmitter] Error enabling gpio-ir-tx overlay: ' + error);
                        defer.reject();
                    } else {
                        self.logger.info('[IR Transmitter] gpio-ir-tx overlay enabled');
                        defer.resolve();
                    }
                });
        } else {
            self.logger.info('[IR Transmitter] HAT already loaded /proc/device-tree/gpio-ir-transmitter!');
        }
    }
    return defer.promise;
};

irtransmitter.prototype.getVolume = function () {
    var self = this;

    const volout = execSync(__dirname + '/getvolume.sh', { uid: 1000, gid: 1000, encoding: 'utf8' });
    if (volout != null) {
        currentvolume = volout;
        self.logger.info('[IR Transmitter] Read volume ' + currentvolume);
    } else {
        self.logger.info('[IR Transmitter] Error reading volume');
    }
};

irtransmitter.prototype.powerToggle = function(data) {
    var defer = libQ.defer();
    var self = this;

    execFile('/usr/bin/irsend', ['SEND_ONCE', 'CamAudioOne', 'KEY_POWER'], {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('[IR Transmitter] Error sending IR power toggle signal: '+error);
                defer.reject();
            } else {
                self.logger.info('[IR Transmitter] Send IR power toggle signal');
                defer.resolve();
            }
        });

    return defer.promise;
};


irtransmitter.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
    var confs = self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
    return confs;
};


irtransmitter.prototype.restartLirc = function (message) {
    var self = this;

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
                            if (message) {
                                self.commandRouter.pushToastMessage('error', 'IR Controller', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_ERROR'));
                            }
                        } else {
                            self.logger.info('lirc correctly started');
                            if (message) {
                                self.commandRouter.pushToastMessage('success', 'IR Controller', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_DESCRIPTION'));
                            }
                        }
                    });
            }, 1000)
        });
}

