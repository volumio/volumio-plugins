'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = alloSteppedVolumeAttenuator;
function alloSteppedVolumeAttenuator(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;

}



alloSteppedVolumeAttenuator.prototype.onVolumioStart = function()
{
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);


    return libQ.resolve();
}

alloSteppedVolumeAttenuator.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();
    var device = self.getAdditionalConf("system_controller", "system", "device");
    if (device == "Raspberry PI") {
        self.enablePIOverlay();
    }

    setTimeout(function() {
        self.startRattenu();
        defer.resolve();
    },2000)


    return defer.promise;
};

alloSteppedVolumeAttenuator.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

alloSteppedVolumeAttenuator.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    self.removeVolumeScripts();
    self.stopRattenu();
    defer.resolve();

    return libQ.resolve();
};

alloSteppedVolumeAttenuator.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

alloSteppedVolumeAttenuator.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            self.configManager.setUIConfigParam(uiconf,'sections[0].content[0].value',self.config.get('map_to_100', false));

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};


alloSteppedVolumeAttenuator.prototype.setUIConfig = function(data) {
    var self = this;
    //Perform your installation tasks here
};

alloSteppedVolumeAttenuator.prototype.getConf = function(varName) {
    var self = this;
    //Perform your installation tasks here
};

alloSteppedVolumeAttenuator.prototype.setConf = function(varName, varValue) {
    var self = this;
    //Perform your installation tasks here
};


alloSteppedVolumeAttenuator.prototype.startRattenu = function () {
    var self = this;

    exec("/usr/bin/sudo /bin/systemctl start rattenu.service", {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
        if (error !== null) {
            self.logger.info('Error, cannot start R ATTENU '+error)
        } else {
            self.logger.info('R Attenu started')
            self.addVolumeScripts();
        }
    });

};

alloSteppedVolumeAttenuator.prototype.stopRattenu = function () {
    var self = this;

    exec("/usr/bin/sudo /bin/systemctl stop rattenu.service", {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
        if (error !== null) {
            self.logger.info('Error, cannot stop R ATTENU '+error)
        } else {
            self.logger.info('R Attenu stopped')
        }
    });

};

alloSteppedVolumeAttenuator.prototype.addVolumeScripts = function() {
    var self = this;

    var enabled = true;
    var setVolumeScript = '/data/plugins/miscellanea/allo_relay_volume_attenuator/setvolume.sh';
    var getVolumeScript = '/data/plugins/miscellanea/allo_relay_volume_attenuator/getvolume.sh';
    var setMuteScript = '/data/plugins/miscellanea/allo_relay_volume_attenuator/setmute.sh';
    var getMuteScript = '/data/plugins/miscellanea/allo_relay_volume_attenuator/getmute.sh';
    var minVol = 0;
    var maxVol = 63;
    var mapTo100 = self.config.get('map_to_100', false);

    var data = {'enabled': enabled, 'setvolumescript': setVolumeScript, 'getvolumescript': getVolumeScript, 'setmutescript': setMuteScript,'getmutescript': getMuteScript, 'minVol': minVol, 'maxVol': maxVol, 'mapTo100': mapTo100};
    self.logger.info('Adding Allo Relay attenuator parameters'+ JSON.stringify(data))
    self.commandRouter.updateVolumeScripts(data);
};

alloSteppedVolumeAttenuator.prototype.removeVolumeScripts = function() {
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

alloSteppedVolumeAttenuator.prototype.enablePIOverlay = function() {
    var defer = libQ.defer();
    var self = this;

    exec('/usr/bin/sudo /usr/bin/dtoverlay lirc-rpi gpio_in_pin=17', {uid:1000,gid:1000},
        function (error, stdout, stderr) {
            if(error != null) {
                self.logger.info('Error enabling lirc-rpi overlay: '+error);
                defer.reject();
            } else {
                self.logger.info('lirc-rpi overlay enabled');
                defer.resolve();
            }
        });

    return defer.promise;
};

alloSteppedVolumeAttenuator.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
    var confs = self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
    return confs;
};

alloSteppedVolumeAttenuator.prototype.saveRelayAttOptions = function (data) {
    var self = this;
    
    self.config.set('map_to_100', data['map_to_100']);

    setTimeout(function(){
        self.addVolumeScripts();
        self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
    },500)
};
