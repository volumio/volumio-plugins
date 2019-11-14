'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var execSync = require('child_process').execSync;
var exec = require('child_process').exec;

// Define the IrController class
module.exports = IrController;


function IrController(context) {
    var self = this;
    // Save a reference to the parent commandRouter
    self.context = context;
    self.commandRouter = self.context.coreCommand;
    self.logger=self.commandRouter.logger;
    self.configManager = self.context.configManager;


}

IrController.prototype.onVolumioStart = function()
{
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();

}

IrController.prototype.getConfigurationFiles = function()
{
    return ['config.json'];
}

IrController.prototype.onStop = function() {
    var self = this;

    var defer = libQ.defer();

    exec('usr/bin/sudo /bin/systemctl stop lirc.service', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error stopping LIRC: '+error);
            } else {
                self.logger.info('lirc correctly stopped');
                defer.resolve();
            }
        });

    return defer.promise;
};

IrController.prototype.onStart = function() {
    var self = this;

    var defer = libQ.defer();

    var defer = libQ.defer();
    var device = self.getAdditionalConf("system_controller", "system", "device");
    if (device == "Raspberry PI") {
        self.enablePIOverlay();
    }

    var ir_profile = self.config.get('ir_profile', "JustBoom IR Remote");
    self.saveIROptions({"ir_profile":{"value": ir_profile, "notify":false}});
    defer.resolve();

    return defer.promise;
};

IrController.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
    var confs = self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
    return confs;
};

IrController.prototype.createHardwareConf = function(device){
    var self = this;

    exec('/usr/bin/sudo /bin/chmod 777 /etc/lirc/hardware.conf', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error setting hardware conf file perms: '+error);
            } else {
                self.logger.info('Hardware permissions set');
            }
        });

    try{
        fs.readFile(__dirname + "/hardware.conf.tmpl", 'utf8', function (err, data) {
            if (err) {
                return self.logger.error(err);
            }

            var conf;

            if (device == "Odroid-C") {
                conf = data.replace("${module}", "meson-ir");
            }
            else{
                conf = data.replace("${module}", "lirc_rpi");
            }

            fs.writeFile("/etc/lirc/hardware.conf", conf, 'utf8', function (err) {
                if (err) return self.logger.error(err);
            });
        });
    }
    catch (err){
        callback(err);
    }
}

IrController.prototype.restartLirc = function (message) {
    var self = this;

    exec('usr/bin/sudo /bin/systemctl stop lirc.service', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Cannot kill irexec: '+error);
            }
            setTimeout(function(){

    exec('usr/bin/sudo /bin/systemctl start lirc.service', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error restarting LIRC: '+error);
                if (message){
                    self.commandRouter.pushToastMessage('error', 'IR Controller', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_ERROR'));
                }
            } else {
                self.logger.info('lirc correctly started');
                if (message){
                    self.commandRouter.pushToastMessage('success', 'IR Controller', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_DESCRIPTION'));
                }
            }
        });
            },1000)
    });
}

IrController.prototype.saveIROptions = function (data) {
    var self = this;

    self.config.set("ir_profile", data.ir_profile.value);

    var deviceName = self.getAdditionalConf("system_controller", "system", "device");
    self.createHardwareConf(deviceName);
    var profileFolder = data.ir_profile.value.replace(/ /g, '\\ ');

    exec('/usr/bin/sudo /bin/chmod -R 777 /etc/lirc/*', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error setting lirc conf file perms: '+error);
            } else {
                self.logger.info('lirc permissions set');
                exec('/bin/cp -r ' + __dirname +'/configurations/'+profileFolder +
                    '/* /etc/lirc/', {uid:1000,gid:1000},
                    function (error, stdout, stderr) {
                        if(error != null) {
                            self.logger.info('Error copying configurations: '+error);
                            self.commandRouter.pushToastMessage('error', 'IR Controller', self.commandRouter.getI18nString('COMMON.SETTINGS_SAVE_ERROR'));
                        } else {
                            self.logger.info('lirc correctly updated');
                            self.commandRouter.pushToastMessage('success', 'IR Controller', self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
                            setTimeout(function(){

                                if (data.ir_profile.notify == undefined || data.ir_profile.notify == false){
                                    self.restartLirc(true);
                                }

                            },1000)

                        }
                    });

            }
        });
}

IrController.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');
    var dirs = fs.readdirSync(__dirname + "/configurations");

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            var activeProfile = self.config.get("ir_profile", "JustBoom IR Remote");
            uiconf.sections[0].content[0].value.value = activeProfile;
            uiconf.sections[0].content[0].value.label = activeProfile;

            for (var i = 0; i < dirs.length; i++) {
                self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[0].options', {
                    value: dirs[i],
                    label: dirs[i]
                });
            }

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

IrController.prototype.enablePIOverlay = function() {
    var defer = libQ.defer();
    var self = this;

    if (!fs.existsSync('/proc/device-tree/lirc_rpi')) {
        self.logger.info('HAT did not load /proc/device-tree/lirc_rpi!');
        exec('/usr/bin/sudo /usr/bin/dtoverlay lirc-rpi gpio_in_pin=25', {uid:1000,gid:1000},
            function (error, stdout, stderr) {
                if(error != null) {
                    self.logger.info('Error enabling lirc-rpi overlay: '+error);
                    defer.reject();
                } else {
                    self.logger.info('lirc-rpi overlay enabled');
                    defer.resolve();
                }
            });
    } else {
        self.logger.info('HAT already loaded /proc/device-tree/lirc_rpi!');
    }
    return defer.promise;
};

