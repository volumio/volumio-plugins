'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
const pluginPath = '/data/plugins/miscellanea/music_services_shield/';
const sudoCommand = '/bin/echo volumio | /usr/bin/sudo -S ';
const buildShieldScript = 'moveallprocesses.sh';

// Config parameters
const userCpuSpec = 'userCpuSpec';
const userMpd = 'userMpd';
const userSpotify = 'userSpotify';
const rtMpd = 'rtMpd';
const rtSpotify = 'rtSpotify';
const rtPriority = 'rtPriority';


module.exports = musicServicesShield;
function musicServicesShield(context) {
	var self = this;

	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger = self.context.logger;
	self.configManager = self.context.configManager;
}

musicServicesShield.prototype.executeScript = function(prefix, script)
{
	var self = this;
	var defer=libQ.defer();
	try {
		exec(prefix + script, {
		   uid: 1000,
		   gid: 1000
		}, function (error, stdout, stderr) {
			if (error) {
				self.logger.info('failed ' + error);
			} else {
				self.logger.info('succeeded', script);
			}
			defer.resolve();
		})
	 } catch (e) {
		self.logger.info('Error executing script', e);
		defer.resolve();
	 }

	 return defer.promise;
}

musicServicesShield.prototype.executeScriptAsSudo = function(script)
{
	var self = this;
	return self.executeScript(sudoCommand, pluginPath + script);
}

musicServicesShield.prototype.onVolumioStart = function()
{
	var self = this;
	var defer=libQ.defer();

	try {
	        var configFile=self.commandRouter.pluginManager.getConfigurationFile(self.context,'config.json');

 		self.config = new (require('v-conf'))();
		self.config.loadFile(configFile);
	} catch (e) {
		self.logger.info('Error executing script', e);
	}

	defer.resolve();

	return defer.promise;
}

musicServicesShield.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

	try {
		self.commandRouter.pushToastMessage('info', 'Attempting to move processes to user CPU set', 'Please wait');

		self.writeAllConfigParameters();

		exec(sudoCommand + pluginPath + buildShieldScript, {
		   uid: 1000,
		   gid: 1000
		}, function (error, stdout, stderr) {
			if (error) {
				self.logger.info('failed ' + error);
				self.commandRouter.pushToastMessage('error', 'Could not move processes to user CPU set!', error);
			} else {
                self.commandRouter.pushToastMessage('success', 'Moved processes to user CPU set', stdout);
            }

            defer.resolve();
        });
    } catch (e) {
        self.logger.info('Error moving processes to user CPU set', e);
        self.commandRouter.pushToastMessage('error', 'Error moving processes to user CPU set', e);

        defer.resolve();
	}

    return defer.promise;
};

musicServicesShield.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

	try {
	    // Remove all the services from the shield and recreate the shield without them
        self.disableShieldViaConfig();
        self.executeScriptAsSudo(buildShieldScript);
    } catch (e) {
        self.logger.info('Error moving processes to user CPU set', e);
        self.commandRouter.pushToastMessage('error', 'Error moving processes to user CPU set', e);
    }

    defer.resolve();

    return libQ.resolve();
};

musicServicesShield.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


musicServicesShield.prototype.listUserTasks = function() {
    var defer = libQ.defer();
    var self = this;
	var tasks;
	tasks = '<p>not found</p>';
	var outputFile;
	outputFile = pluginPath + 'config/out.txt';
	try {
        exec(pluginPath + 'usertaskstable.sh ' + outputFile, {
            uid: 1000,
            gid: 1000
        }, function (error, stdout, stderr) {
            if (error) {
                self.logger.info('failed ' + error);
                self.commandRouter.pushToastMessage('error', 'Could not list user tasks!', error);
            } else {
                fs.readFile(outputFile, 'utf8', function (err, tasks) {
                    if (err) {
                        self.logger.info('Error reading tasks', err);
                    } else {
                        self.logger.info('user tasks ' + stdout);
                        var modalData = {
                            title: 'User Tasks',
                            message: tasks,
                            size: 'lg',
                            buttons: [{
                                name: 'Close',
                                class: 'btn btn-warning',
                                emit: 'closeModals',
                                payload: ''
                            },]
                        }
                        self.commandRouter.broadcastMessage("openModal", modalData);
                    }
                });
            }
        });
    } catch (e) {
        self.logger.error('Could list user tasks: ' + e);
    }

    defer.resolve();

    return defer.promise;
};

musicServicesShield.prototype.writeConfigParameter = function(name)
{
	// Writes the parameter value from the current local config into the corresponding config file
    var self = this;
	execSync(pluginPath + 'setconfigparameter.sh ' + name + ' ' + self.config.get(name));
}

musicServicesShield.prototype.disableConfigParameter = function(name)
{
    var self = this;
	execSync(pluginPath + 'setconfigparameter.sh ' + name + ' false');
}

musicServicesShield.prototype.disableShieldViaConfig = function()
{
    var self = this;
	self.disableConfigParameter(userMpd);
	self.disableConfigParameter(userSpotify);
	self.disableConfigParameter(rtMpd);
	self.disableConfigParameter(rtSpotify);
}

musicServicesShield.prototype.writeAllConfigParameters = function()
{
    var self = this;
	self.writeConfigParameter(userCpuSpec);
	self.writeConfigParameter(userMpd);
	self.writeConfigParameter(userSpotify);
	self.writeConfigParameter(rtMpd);
	self.writeConfigParameter(rtSpotify);
	self.writeConfigParameter(rtPriority);
}

musicServicesShield.prototype.saveConfig = function(data) {
    var defer = libQ.defer();
    var self = this;

    self.config.set(userCpuSpec, data.userCpuSpec.value);
    self.config.set(userMpd, data.userMpd);
    self.config.set(userSpotify, data.userSpotify);
    self.config.set(rtMpd, data.rtMpd);
    self.config.set(rtSpotify, data.rtSpotify);
    self.config.set(rtPriority, data.rtPriority.value);
    self.config.save();

	self.writeAllConfigParameters();

	self.executeScriptAsSudo(buildShieldScript).then(function(){
		self.commandRouter.pushToastMessage('success', 'Music Services Shield', 'Changes saved');
		defer.resolve();
	});

    return defer.promise;
};

// Configuration Methods -----------------------------------------------------------------------------

musicServicesShield.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            var findOption = function (optionVal, options) {
                for (var i = 0; i < options.length; i++) {
                    if (options[i].value === optionVal)
                        return options[i];
                }
            };

            uiconf.sections[0].content[1].value = findOption(self.config.get(userCpuSpec), uiconf.sections[0].content[1].options);
			uiconf.sections[0].content[2].value = self.config.get(userMpd);
			uiconf.sections[0].content[3].value = self.config.get(userSpotify);
			uiconf.sections[0].content[4].value = self.config.get(rtMpd);
			uiconf.sections[0].content[5].value = self.config.get(rtSpotify);
            uiconf.sections[0].content[6].value = findOption(self.config.get(rtPriority), uiconf.sections[0].content[6].options);

            try{
                // Hide the spotify options if the plugin is not active
                var spotifyPlugin = self.commandRouter.pluginManager.getPlugin('music_service', 'volspotconnect2');
                if (!spotifyPlugin){
                    uiconf.sections[0].content[3].value = false;
                    uiconf.sections[0].content[3].hidden = true;
                    uiconf.sections[0].content[5].value = false;
                    uiconf.sections[0].content[5].hidden = true;
                }
            } catch(e){
                self.logger.error('Could not get spotify plugin' + e);
            }

			defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

musicServicesShield.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

musicServicesShield.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

musicServicesShield.prototype.getConf = function(configFile) {
	var self = this;
	//Perform your installation tasks here

	self.config = new (require('v-conf'))();
	self.config.loadFile(configFile);
};

musicServicesShield.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here

	self.config = new (require('v-conf'))();
	self.config.loadFile(configFile);
};




