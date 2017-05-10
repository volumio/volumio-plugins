'use strict';

var libQ = require('kew');
var fs=require('fs-extra');

// Define the IrController class
module.exports = IrController;


function IrController(context) {
	var self = this;
	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;


}

IrController.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

}

IrController.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

IrController.prototype.onStop = function() {
	var self = this;
};

IrController.prototype.onStart = function() {
	var self = this;

	var defer = libQ.defer();

	var deviceName = self.getAdditionalConf("system_controller", "system", "device");

	self.createHardwareConf(deviceName);

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


IrController.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;

	var lang_code = this.commandRouter.sharedVars.get('language_code');

	self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
		__dirname+'/i18n/strings_en.json',
		__dirname + '/UIConfig.json')
		.then(function(uiconf)
		{
			uiconf.sections[0].content[0].value = self.config.get('enable_roll_off');
			defer.resolve(uiconf);
		})
		.fail(function()
		{
			defer.reject(new Error());
		});

	return defer.promise;
};