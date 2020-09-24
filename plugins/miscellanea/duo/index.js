'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

module.exports = duo;
function duo(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

};

duo.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
};

duo.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

duo.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

duo.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

duo.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;
	
    var lang_code = this.commandRouter.sharedVars.get('language_code');
	var failmodes = fs.readJsonSync((__dirname + '/options/failmodes.json'),  'utf8', {throws: false});
	
    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
			uiconf.sections[0].content[0].value = self.config.get('enable_duo');
			uiconf.sections[0].content[1].value = self.config.get('ikey');
			uiconf.sections[0].content[2].value = self.config.get('skey');
			uiconf.sections[0].content[3].value = self.config.get('api_host');
			for (var n = 0; n < failmodes.mode.length; n++){
				self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[4].options', {
					value: failmodes.mode[n].value,
					label: failmodes.mode[n].name
				});
				
				if(failmodes.mode[n].value == self.config.get('failmode'))
				{
					uiconf.sections[0].content[4].value.value = failmodes.mode[n].value;
					uiconf.sections[0].content[4].value.label = failmodes.mode[n].name;
				}
			}
			uiconf.sections[0].content[5].value = self.config.get('disable_password');

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

duo.prototype.getConfigurationFiles = function() {
	return ['config.json'];
};

duo.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

duo.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

duo.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// Update Config Methods -----------------------------------------------------------------------------

duo.prototype.saveConfig = function(data)
{
	var self = this;
	var defer = libQ.defer();
	
	//console.log('[DUO] config: ' + JSON.stringify(data));
	self.config.set('enable_duo', data['enable_duo']);
	self.config.set('ikey', data['ikey']);
	self.config.set('skey', data['skey']);
	self.config.set('api_host', data['api_host']);
	self.config.set('failmode', data['failmode'].value);
	self.config.set('disable_password', data['disable_password']);
	
	self.logger.info("Successfully updated DUO configuration");
	self.toggleDuo();
	
	return defer.promise;
};

duo.prototype.toggleDuo = function()
{
	var self = this;
	var defer = libQ.defer();
	
	// define the replacement dictionary
	var replacementDictionary = [
		{ placeholder: "${IKEY}", replacement: self.config.get('ikey') },
		{ placeholder: "${SKEY}", replacement: self.config.get('skey') },
		{ placeholder: "${HOST}", replacement: self.config.get('api_host') },
		{ placeholder: "${FAILMODE}", replacement: self.config.get('failmode') }
	];
	
	self.logger.info('[DUO] Updating system configuration...');
	self.createDuoConfig(replacementDictionary)
	.then(function (copySshdConfig) {
		exec("/usr/bin/rsync --ignore-missing-args /etc/pam.d/sshd "+ __dirname +"/templates/sshd", {uid:1000, gid:1000}, function (error, stout, stderr) {
			if(error)
			{
				self.logger.error('Could not copy config file to temp location with error: ' + error);
				defer.reject(new Error(error));
			}
		});
	})
	.then(function (preparePwdFile) {
		if(self.config.get("disable_password"))
		{
			execSync("/bin/touch "+ __dirname +"/templates/disable_password", {uid:1000, gid:1000}, function (error, stout, stderr) {
				if(error)
				{
					self.logger.error('Could not touch disable_password with error: ' + error);
					defer.reject(new Error(error));
				}
			});
		}
		else
		{
			execSync("/bin/rm -f "+ __dirname +"/templates/disable_password", {uid:1000, gid:1000}, function (error, stout, stderr) {
				if(error)
				{
					self.logger.error('Could not touch disable_password with error: ' + error);
					defer.reject(new Error(error));
				}
			});
		}
	})
	.then(function (executeScript) {
		if(self.config.get("enable_duo"))
		{
			self.logger.info("[DUO] Enabling DUO for SSH");
			execSync("/bin/sh "+ __dirname +"/templates/enableDuoPAM.sh", {uid:1000, gid:1000}, function (error, stout, stderr) {
				if(error)
				{
					self.logger.error('Could not execute enable script with error: ' + error);
					defer.reject(new Error(error));
				}
			});
		}
		else
		{
			self.logger.info("[DUO] Disabling DUO for SSH");
			execSync("/bin/sh "+ __dirname +"/templates/disableDuoPAM.sh", {uid:1000, gid:1000}, function (error, stout, stderr) {				
				if(error)
				{
					self.logger.error('Could not execute disable script with error: ' + error);
					defer.reject(new Error(error));
				}
			});
		}
	})
	.then(function (placeFiles) {
		exec("/usr/bin/sudo /bin/systemctl restart duo-pam-activator", {uid:1000, gid:1000}, function (error, stout, stderr) {
			if(error)
			{
				self.logger.error('Could not replace /etc/pam.d/sshd with error: ' + error);
				defer.reject(new Error(error));
			}
		});
		
		defer.resolve(placeFiles);
		self.logger.info("[DUO] Enabled DUO for SSH sessions");
		self.commandRouter.pushToastMessage('success', "Successful push", "Successfully pushed new DUO configuration");
	});
	
	return defer.promise;
};

duo.prototype.createDuoConfig = function(replacements)
{
	var self = this;
	var defer = libQ.defer();
	
	fs.readFile(__dirname + "/templates/pam_duo.template", 'utf8', function (err, data) {
		if (err) {
			defer.reject(new Error(err));
		}

		var tmpConf = data;
		for (var rep in replacements)
		{
			tmpConf = tmpConf.replace(replacements[rep]["placeholder"], replacements[rep]["replacement"]);			
		}
			
		fs.writeFile(__dirname + "/templates/pam_duo.conf", tmpConf, 'utf8', function (error) {
			if (error)
			{
				self.logger.error('Could not write the config file with error: ' + error);
				defer.reject(new Error(error));
			}				
		});
		
		defer.resolve();
	});
	
	return defer.promise;
};
