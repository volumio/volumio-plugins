'use strict';

var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var fs = require('fs-extra');
var ifconfig = require('wireless-tools/ifconfig');
var ip = require('ip');
var libNet = require('net');
var libQ = require('kew');
var moment = require('moment-timezone');
var net = require('net');
var currentIp = '';

// Define the ControllerPydPiper class
module.exports = ControllerPydPiper;

function ControllerPydPiper(context) 
{
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

};

ControllerPydPiper.prototype.onVolumioStart = function()
{
	var self = this;
	self.logger.info("PydPiper initiated");
	
	this.configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	self.getConf(this.configFile);
	
	return libQ.resolve();	
};

ControllerPydPiper.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};

// Plugin methods -----------------------------------------------------------------------------
ControllerPydPiper.prototype.onStop = function() {
	var self = this;
	var defer = libQ.defer();

	self.stopService('pydpiper')
	.then(function(edefer)
	{
		defer.resolve();
	})
	.fail(function(e)
	{
		self.commandRouter.pushToastMessage('error', "Stopping failed", "Could not stop the LMS plugin in a fashionable manner, error: " + e);
		defer.reject(new error());
	});

	return defer.promise;
};

ControllerPydPiper.prototype.stop = function() {
	var self = this;
	var defer = libQ.defer();

	self.stopService('pydpiper')
	.then(function(edefer)
	{
		defer.resolve();
	})
	.fail(function(e)
	{
		self.commandRouter.pushToastMessage('error', "Stopping failed", "Could not stop the LMS plugin in a fashionable manner, error: " + e);
		defer.reject(new error());
	});

	return defer.promise;
};

ControllerPydPiper.prototype.onStart = function() {
	var self = this;
	var defer = libQ.defer();

	self.restartService('pydpiper', true)
	.then(function(edefer)
	{
		defer.resolve();
	})
	.fail(function(e)
	{
		self.commandRouter.pushToastMessage('error', "Startup failed", "Could not start the LMS plugin in a fashionable manner.");
		self.logger.info("Could not start the LMS plugin in a fashionable manner.");
		defer.reject(new error());
	});

	return defer.promise;
};

ControllerPydPiper.prototype.onRestart = function() 
{
	// Do nothing
	self.logger.info("performing onRestart action");
	
	var self = this;
};

ControllerPydPiper.prototype.onInstall = function() 
{
	self.logger.info("performing onInstall action");
	
	var self = this;
};

ControllerPydPiper.prototype.onUninstall = function() 
{
	// Perform uninstall tasks here!
};

ControllerPydPiper.prototype.getUIConfig = function() {
    var self = this;
	var defer = libQ.defer();    
    var lang_code = this.commandRouter.sharedVars.get('language_code');

	self.getConf(this.configFile);
	self.logger.info("Loaded the previous config.");
	
	// Populate drop down boxes	
	var available_drivers = fs.readJsonSync((__dirname + '/options/drivers.json'),  'utf8', {throws: false});
	var available_units = fs.readJsonSync((__dirname + '/options/units.json'),  'utf8', {throws: false});
	var available_mounts = fs.readJsonSync((__dirname + '/options/mount_points.json'),  'utf8', {throws: false});
	var zones = moment.tz.names();	
	if(self.config.get('enable_debug_logging'))
		self.logger.info("Zone count: " + zones.length);	
	
	self.commandRouter.i18nJson(__dirname+'/i18n/strings_' + lang_code + '.json',
		__dirname + '/i18n/strings_en.json',
		__dirname + '/UIConfig.json')
    .then(function(uiconf)
    {
		self.logger.info("## populating UI...");
		var consoleUrl = 'http://' + currentIp + ':9000';
		
		uiconf.sections[0].content[0].value = self.config.get('parallel');
		for (var n = 0; n < available_drivers.drivers.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[1].options', {
				value: available_drivers.drivers[n].driver,
				label: available_drivers.drivers[n].name
			});
			
			if(available_drivers.drivers[n].driver == self.config.get('driver'))
			{
				uiconf.sections[0].content[1].value.value = available_drivers.drivers[n].driver;
				uiconf.sections[0].content[1].value.label = available_drivers.drivers[n].name;
			}
		}
		uiconf.sections[0].content[2].value = self.config.get('width');
		uiconf.sections[0].content[3].value = self.config.get('height');
		uiconf.sections[0].content[4].value = self.config.get('rs');
		uiconf.sections[0].content[5].value = self.config.get('e');
		uiconf.sections[0].content[6].value = self.config.get('d4');
		uiconf.sections[0].content[7].value = self.config.get('d5');
		uiconf.sections[0].content[8].value = self.config.get('d6');
		uiconf.sections[0].content[9].value = self.config.get('d7');
		uiconf.sections[0].content[10].value = self.config.get('i2caddress');
		uiconf.sections[0].content[11].value = self.config.get('i2cport');
		self.logger.info("1/2 PydPiper settings loaded");
		
		for (var zone in zones)
		{
			self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[0].options', {
				value: zones[zone],
				label: zones[zone]
			});
			
			if(self.config.get('timezone') == zones[zone])
			{
				uiconf.sections[1].content[0].value.value = zones[zone];
				uiconf.sections[1].content[0].value.label = zones[zone];
			}
		}
		for (var n = 0; n < available_units.units.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[1].options', {
				value: available_units.units[n].type,
				label: available_units.units[n].name
			});
			
			if(available_units.units[n].type == self.config.get('units'))
			{
				uiconf.sections[1].content[1].value.value = available_units.units[n].type;
				uiconf.sections[1].content[1].value.label = available_units.units[n].name;
			}
		}
		uiconf.sections[1].content[2].value = self.config.get('use_weather');
		uiconf.sections[1].content[3].value = self.config.get('wapi');
		uiconf.sections[1].content[4].value = self.config.get('wlocale');
		for (var n = 0; n < available_mounts.points.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[5].options', {
				value: available_mounts.points[n].point,
				label: available_mounts.points[n].name
			});
			
			if(available_mounts.points[n].point == self.config.get('mount_point'))
			{
				uiconf.sections[1].content[5].value.value = available_mounts.points[n].point;
				uiconf.sections[1].content[5].value.label = available_mounts.points[n].name;
			}
		}
		uiconf.sections[1].content[6].value = self.config.get('pages_file');
		self.logger.info("2/2 PydPiper settings loaded");
		
		self.logger.info("Populated config screen.");
		
		defer.resolve(uiconf);
	})
	.fail(function()
	{
		defer.reject(new Error());
	});

	return defer.promise;
};

ControllerPydPiper.prototype.setUIConfig = function(data) {
	var self = this;
	
	self.logger.info("Updating UI config");
	var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');
	
	return libQ.resolve();
};

ControllerPydPiper.prototype.getConf = function(configFile) {
	var self = this;
	this.config = new (require('v-conf'))()
	this.config.loadFile(configFile)
	
	return libQ.resolve();
};

ControllerPydPiper.prototype.setConf = function(conf) {
	var self = this;
	return libQ.resolve();
};

// Public Methods ---------------------------------------------------------------------------------------

ControllerPydPiper.prototype.updateConnectionSettings = function (data)
{
	var self = this;
	var defer = libQ.defer();
	
	self.config.set('parallel', data['parallel']);
	self.config.set('driver', data['driver'].value);
	self.config.set('width', self.tryParse(data['width'], 80));
	self.config.set('height', self.tryParse(data['height'], 16));
	self.config.set('rs', self.tryParse(data['rs'], 0));
	self.config.set('e', self.tryParse(data['e'], 0));
	self.config.set('d4', self.tryParse(data['d4'], 0));
	self.config.set('d5', self.tryParse(data['d5'], 0));
	self.config.set('d6', self.tryParse(data['d6'], 0));
	self.config.set('d7', self.tryParse(data['d7'], 0));
	self.config.set('i2caddress', data['i2caddress']);
	self.config.set('i2cport', self.tryParse(data['i2cport'], 0));
	self.commandRouter.pushToastMessage('success', "Successfully saved connection settings");

	self.updateUnitFile()
	.then(function(reload)
	{
		self.reloadServices();
		defer.resolve(reload);
	})
	.then(function(restart)
	{
		self.restartService("pydpiper", false);
		defer.resolve(restart);
	})
	.fail(function()
	{
		self.commandRouter.pushToastMessage('error', "Restart failed", "Restarting pydpiper failed with error: " + error);
		defer.reject(new Error());
	});
	
	return defer.promise;
};

ControllerPydPiper.prototype.updateOutputSettings = function (data)
{
	var self = this;
	var defer = libQ.defer();
	
	self.config.set('timezone', data['timezone'].value);
	self.config.set('units', data['units'].value);
	self.config.set('use_weather', data['use_weather']);
	self.config.set('wapi', data['wapi']);
	self.config.set('wlocale', data['wlocale']);
	self.config.set('mount_point', data['mount_point'].value);
	self.config.set('pages_file', data['pages_file']);
	self.commandRouter.pushToastMessage('success', "Successfully saved output settings");

	self.updateUnitFile()	
	.then(function(reload)
	{
		self.reloadServices();
		defer.resolve(reload);
	})
	.then(function(restart)
	{
		self.restartService("pydpiper", false);
		defer.resolve(restart);
	})
	.fail(function()
	{
		self.commandRouter.pushToastMessage('error', "Restart failed", "Restarting pydpiper failed with error: " + error);
		defer.reject(new Error());
	});
	
	return defer.promise;
};

ControllerPydPiper.prototype.tryParse = function(str,defaultValue) {
     var retValue = defaultValue;
	 str = str.toString();
     if(str !== null) {
         if(str.length > 0) {
             if (!isNaN(str)) {
                 retValue = parseInt(str);
             }
         }
     }
     return retValue;
};

ControllerPydPiper.prototype.reloadServices = function ()
{
	var self = this;
	var defer=libQ.defer();

	var command = "/usr/bin/sudo /bin/systemctl daemon-reload";
	
	exec(command, {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			defer.reject();
		}
		else {
			defer.resolve();
		}
	});

	return defer.promise;
};

ControllerPydPiper.prototype.restartService = function (serviceName, boot)
{
	var self = this;
	var defer=libQ.defer();

	var command = "/usr/bin/sudo /bin/systemctl restart " + serviceName;
	
	exec(command, {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while starting ' + serviceName + ': ' + error);
			self.commandRouter.pushToastMessage('error', "Restart failed", "Restarting " + serviceName + " failed with error: " + error);
			defer.reject();
		}
		else {
			self.commandRouter.pushConsoleMessage(serviceName + ' started');
			if(boot == false)
				self.commandRouter.pushToastMessage('success', "Restarted " + serviceName, "Restarted " + serviceName + " for the changes to take effect.");
			
			defer.resolve();
		}
	});

	return defer.promise;
};

ControllerPydPiper.prototype.stopService = function (serviceName)
{
	var self = this;
	var defer=libQ.defer();

	var command = "/usr/bin/sudo /bin/systemctl stop " + serviceName;
	
	exec(command, {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while stopping ' + serviceName + ': ' + error);
			self.commandRouter.pushToastMessage('error', "Stopping service failed", "Stopping " + serviceName + " failed with error: " + error);
			defer.reject();
		}
		else {
			self.commandRouter.pushConsoleMessage(serviceName + ' stopped');
			self.commandRouter.pushToastMessage('success', "Stopping", "Stopped " + serviceName + ".");
			defer.resolve();
		}
	});

	return defer.promise;
};

ControllerPydPiper.prototype.updateUnitFile = function ()
{
	var self = this;
	var defer = libQ.defer();
		
	var template = "ExecStart=/usr/bin/docker run --network=host --privileged -v /var/log:/var/log:rw";
	if(self.config.get('mount_point') == 'local')
		template += " -v /home/volumio/pydPiper:/app:ro dhrone/pydpiper:latest python /app/pydPiper.py --volumio";
	else
		template += " dhrone/pydpiper:latest python /app/pydPiper.py --volumio";
	
	template += " --driver " + self.config.get('driver') + " --width " + self.config.get('width') + " --height " + self.config.get('height');
	
	if(self.config.get('parallel'))
		template += " --rs " + self.config.get('rs') + " --e " + self.config.get('e') + " --d4 " + self.config.get('d4') + " --d5 " + self.config.get('d5') + " --d6 " + self.config.get('d6') + " --d7 " + self.config.get('d7');
	else
		template +=  " --i2caddress " + self.config.get('i2caddress') + " --i2cport " + self.config.get('i2cport');
	
	template += " --timezone " + self.config.get('timezone');
	
	if(self.config.get('use_weather'))
		template += " --wapi " + self.config.get('wapi') + " --wlocale " + self.config.get('wlocale') + " --temperature " + self.config.get('units');
	
	template += " --pages " + self.config.get('pages_file');
	
	var command = "/bin/echo volumio | /usr/bin/sudo -S /bin/sed -i -- 's|ExecStart.*|" + template + "|g' /etc/systemd/system/pydpiper.service";
	exec(command, {uid:1000, gid:1000}, function (error, stout, stderr) {
		if(error)
			console.log(stderr);

		defer.resolve();
	});
	
	return defer.promise;
};
