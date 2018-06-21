'use strict';

var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var fs = require('fs-extra');
var libNet = require('net');
var libQ = require('kew');
var net = require('net');

// Define the ControllerSqueezelite class
module.exports = ControllerSqueezelite;

function ControllerSqueezelite(context) 
{
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

};

ControllerSqueezelite.prototype.onVolumioStart = function()
{
	var self = this;
	self.logger.info("Squeezelite initiated");
	
	this.configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	self.getConf(this.configFile);
	
	return libQ.resolve();	
};

ControllerSqueezelite.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};

// Plugin methods -----------------------------------------------------------------------------
ControllerSqueezelite.prototype.onStop = function() {
	var self = this;
	var defer = libQ.defer();

	self.stopService('squeezelite')
	.then(function(edefer)
	{
		defer.resolve();
	})
	.fail(function(e)
	{
		self.commandRouter.pushToastMessage('error', "Stopping failed", "Could not stop the Squeezelite plugin in a fashionable manner, error: " + e);
		defer.reject(new error());
	});

	return defer.promise;
};

ControllerSqueezelite.prototype.stop = function() {
	var self = this;
	var defer = libQ.defer();

	self.stopService('squeezelite')
	.then(function(edefer)
	{
		defer.resolve();
	})
	.fail(function(e)
	{
		self.commandRouter.pushToastMessage('error', "Stopping failed", "Could not stop the Squeezelite plugin in a fashionable manner, error: " + e);
		defer.reject(new error());
	});

	return defer.promise;
};

ControllerSqueezelite.prototype.onStart = function() {
	var self = this;
	var defer = libQ.defer();

	self.restartService('squeezelite', true)
	.then(function(edefer)
	{
		defer.resolve();
	})
	.fail(function(e)
	{
		self.commandRouter.pushToastMessage('error', "Startup failed", "Could not start the Squeezelite plugin in a fashionable manner.");
		self.logger.info("Could not start the Squeezelite plugin in a fashionable manner.");
		defer.reject(new error());
	});

	return defer.promise;
};

ControllerSqueezelite.prototype.onRestart = function() 
{
	// Do nothing
	self.logger.info("performing onRestart action");
	
	var self = this;
};

ControllerSqueezelite.prototype.onInstall = function() 
{
	self.logger.info("performing onInstall action");
	
	var self = this;
};

ControllerSqueezelite.prototype.onUninstall = function() 
{
	// Perform uninstall tasks here!
};

ControllerSqueezelite.prototype.getUIConfig = function() {
    var self = this;
	var defer = libQ.defer();    
    var lang_code = this.commandRouter.sharedVars.get('language_code');

	self.getConf(this.configFile);
	self.logger.info("Loaded the previous config.");
	
	var cards = [];
	cards.push({ hwAddress: "default", name: "ALSA default", description: "System-wide default audio device" });
	var stdOut = execSync("/opt/squeezelite -l | grep '^\\s*[a-z]\\{2,10\\}:[A-Z]*=[a-z]*[A-Z,]\\{0,\\}\\(=[0-1]\\)\\{0,2\\}'").toString().split(/\r?\n/);
	for (var line in stdOut)
	{
		if(stdOut[line] != "")
		{
			var cardObj = stdOut[line].split("-");
			cards.push({ hwAddress: cardObj[0].toString().trim(), name: cardObj[1].toString().trim(), description: cardObj[2].toString().trim() });
		}
	}
	//self.logger.info('Cards: ' + JSON.stringify(cards));
	var seconds = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"];

	self.commandRouter.i18nJson(__dirname+'/i18n/strings_' + lang_code + '.json',
		__dirname + '/i18n/strings_en.json',
		__dirname + '/UIConfig.json')
    .then(function(uiconf)
    {
		self.logger.info("## populating UI...");
		
		uiconf.sections[0].content[0].value = self.config.get('enabled');
		uiconf.sections[0].content[1].value = self.config.get('name');
		self.logger.info("1/2 Squeezelite settings sections loaded");
		
		for (var soundcard in cards)
		{
			//self.logger.info('Card to add: ' + cards[soundcard].name + ' BLOB: ' + JSON.stringify(cards[soundcard]));			
			var oLabel = cards[soundcard].hwAddress == "default" ? '[ALSA] ' + cards[soundcard].description
			: '[(' + cards[soundcard].hwAddress.substring(0, cards[soundcard].hwAddress.indexOf(":")) + ') ' + cards[soundcard].name.substring(0, cards[soundcard].name.indexOf(",")) + '] ' + cards[soundcard].description;
			
			self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[0].options', {
				value: cards[soundcard].hwAddress,
				label: oLabel
			});
			
			if(self.config.get('output_device') == cards[soundcard].hwAddress)
			{
				uiconf.sections[1].content[0].value.value = cards[soundcard].hwAddress;
				uiconf.sections[1].content[0].value.label = oLabel;
			}
		}
		
		for (var s in seconds)
		{
			self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[1].options', {
				value: s,
				label: s
			});
			
			if(self.config.get('soundcard_timeout') == s)
			{
				uiconf.sections[1].content[1].value.value = self.config.get('soundcard_timeout');
				uiconf.sections[1].content[1].value.label = self.config.get('soundcard_timeout');
			}
		}		
		uiconf.sections[1].content[2].value = self.config.get('alsa_params');
		uiconf.sections[1].content[3].value = self.config.get('extra_params');
		self.logger.info("2/2 Squeezelite settings sections loaded");

		self.logger.info("Populated config screen.");
		
		defer.resolve(uiconf);
	})
	.fail(function()
	{
		defer.reject(new Error());
	});

	return defer.promise;
};

ControllerSqueezelite.prototype.setUIConfig = function(data) {
	var self = this;
	
	self.logger.info("Updating UI config");
	var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');
	
	return libQ.resolve();
};

ControllerSqueezelite.prototype.getConf = function(configFile) {
	var self = this;
	this.config = new (require('v-conf'))()
	this.config.loadFile(configFile)
	
	return libQ.resolve();
};

ControllerSqueezelite.prototype.setConf = function(conf) {
	var self = this;
	return libQ.resolve();
};

// Public Methods ---------------------------------------------------------------------------------------

ControllerSqueezelite.prototype.updateSqueezeliteServerConfig = function (data)
{
	var self = this;
	var defer = libQ.defer();
	
	self.config.set('enabled', data['enabled']);
	self.config.set('name', data['name']);
	
	self.logger.info("Successfully updated Squeezelite server configuration");

	self.constructUnit(__dirname + "/unit/squeezelite.unit-template", __dirname + "/unit/squeezelite.service")
	.then(function(stopIfNeeded){
		if(self.config.get('enabled') != true)
		{
			self.stopService("squeezelite")
			.then(function(edefer)
			{
				defer.resolve();
			})
			.fail(function()
			{
				self.commandRouter.pushToastMessage('error', "Stopping failed", "Stopping Squeezelite failed with error: " + error);
				defer.reject(new Error());
			});
		}
	});
	
	return defer.promise;
};

ControllerSqueezelite.prototype.updateSqueezeliteAudioConfig = function (data)
{
	var self = this;
	var defer = libQ.defer();
	
	self.config.set('output_device', data['output_device'].value);
	self.config.set('soundcard_timeout', data['soundcard_timeout'].value);
	self.config.set('alsa_params', data['alsa_params']);
	self.config.set('extra_params', data['extra_params']);
	
	self.logger.info("Successfully updated Squeezelite audio configuration");

	self.constructUnit(__dirname + "/unit/squeezelite.unit-template", __dirname + "/unit/squeezelite.service")
	.then(function(stopIfNeeded){
		if(self.config.get('enabled') != true)
		{
			self.stopService("squeezelite")
			.then(function(edefer)
			{
				defer.resolve();
			})
			.fail(function()
			{
				self.commandRouter.pushToastMessage('error', "Stopping failed", "Stopping Squeezelite failed with error: " + error);
				defer.reject(new Error());
			});
		}
	});
	
	return defer.promise;
};

ControllerSqueezelite.prototype.moveAndReloadService = function (unitTemplate, unitFile, serviceName)
{
	var self = this;
	var defer = libQ.defer();

	var command = "/bin/echo volumio | /usr/bin/sudo -S /bin/cp " + unitTemplate + " " + unitFile;
	
	exec(command, {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while moving ' + serviceName + ': ' + error);
			self.commandRouter.pushToastMessage('error', "Moving service failed", "Stopping " + serviceName + " failed with error: " + error);
			defer.reject();
		}
		else {
			self.commandRouter.pushConsoleMessage(serviceName + ' moved');
			self.commandRouter.pushToastMessage('success', "Moved", "Moved " + serviceName + ".");
		}
	});
		
	command = "/bin/echo volumio | /usr/bin/sudo -S systemctl daemon-reload";
	exec(command, {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while reloading ' + serviceName + ': ' + error);
			self.commandRouter.pushToastMessage('error', "Reloading service failed", "Reloading " + serviceName + " failed with error: " + error);
			defer.reject();
		}
		else {
			self.commandRouter.pushConsoleMessage(serviceName + ' reloaded');
			self.commandRouter.pushToastMessage('success', "Reloading", "Reloading " + serviceName + ".");
			defer.resolve();
		}
	});
			

	return defer.promise;
};

ControllerSqueezelite.prototype.restartService = function (serviceName, boot)
{
	var self = this;
	var defer = libQ.defer();

	if(self.config.get('enabled'))
	{
		var command = "/bin/echo volumio | /usr/bin/sudo -S /bin/systemctl restart " + serviceName;
		
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
	}
	else
	{
		self.logger.info("Not starting " + serviceName + "; it's not enabled.");
		defer.resolve();
	}

	return defer.promise;
};

ControllerSqueezelite.prototype.stopService = function (serviceName)
{
	var self = this;
	var defer = libQ.defer();

	var command = "/bin/echo volumio | /usr/bin/sudo -S /bin/systemctl stop " + serviceName;
	
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

ControllerSqueezelite.prototype.constructUnit = function(unitTemplate, unitFile)
{
	var self = this;
	var defer = libQ.defer();
	
	var replacementDictionary = [
		{ placeholder: "${NAME}", replacement: self.config.get('name') },
		{ placeholder: "${OUTPUT_DEVICE}", replacement: self.config.get('output_device') },
		{ placeholder: "${SOUNDCARD_TIMEOUT}", replacement: self.config.get('soundcard_timeout') },
		{ placeholder: "${ALSA_PARAMS}", replacement: self.config.get('alsa_params') },
		{ placeholder: "${EXTRA_PARAMS}", replacement: self.config.get('extra_params') }
	];
	
	for (var rep in replacementDictionary)
	{
		if(replacementDictionary[rep].replacement == undefined || replacementDictionary[rep].replacement == 'undefined')
				replacementDictionary[rep].replacement = " ";
		else
		{
			if (replacementDictionary[rep].placeholder == "${NAME}" && self.config.get('name') != '')
				replacementDictionary[rep].replacement = "-n " + replacementDictionary[rep].replacement;
			else if (replacementDictionary[rep].placeholder == "${OUTPUT_DEVICE}")
			{				
				if (self.config.get('output_device') != '')
					replacementDictionary[rep].replacement = "-o " + replacementDictionary[rep].replacement;
				else
					replacementDictionary[rep].replacement = "-o default";
			}
			else if (replacementDictionary[rep].placeholder == "${SOUNDCARD_TIMEOUT}")
				replacementDictionary[rep].replacement = "-C " + replacementDictionary[rep].replacement;
			else if (replacementDictionary[rep].placeholder == "${ALSA_PARAMS}" && self.config.get('alsa_params') != '')
				replacementDictionary[rep].replacement = "-a " + replacementDictionary[rep].replacement;
		}
	}
	
	self.replaceStringsInFile(unitTemplate, unitFile, replacementDictionary)
	.then(function(activate)
	{
		self.moveAndReloadService(unitFile, '/etc/systemd/system/squeezelite.service', 'Squeezelite');
	})
	.then(function(resolve){
		self.restartService('squeezelite', false);
		defer.resolve();
	})
	.fail(function(resolve){
		defer.reject();
	});
	
	return defer.promise;
}

ControllerSqueezelite.prototype.replaceStringsInFile = function(sourceFilePath, destinationFilePath, replacements)
{
	var self = this;
	var defer = libQ.defer();
	
	fs.readFile(sourceFilePath, 'utf8', function (err, data) {
		if (err) {
			defer.reject(new Error(err));
		}
		
		var tmpConf = data;
		for (var rep in replacements)
		{
			tmpConf = tmpConf.replace(replacements[rep].placeholder, replacements[rep].replacement);
			//self.logger.info('Replacing ' + replacements[rep].placeholder + " with " + replacements[rep].replacement);
		}
		
		fs.writeFile(destinationFilePath, tmpConf, 'utf8', function (err) {
                if (err)
				{
					self.commandRouter.pushConsoleMessage('Could not write the script with error: ' + err);
                    defer.reject(new Error(err));
				}
                else 
				{
					self.logger.info('New unit-file created!');
					defer.resolve();
				}
        });
	});
	
	return defer.promise;
};
