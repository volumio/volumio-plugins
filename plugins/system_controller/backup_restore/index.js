'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

var items = ["queue", "playlist", "favourites", "configuration", "albumart"];
var backupFile = "/boot/volumio_data.tar";


module.exports = backupRestore;
function backupRestore(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



backupRestore.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

backupRestore.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();


	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

backupRestore.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

backupRestore.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

backupRestore.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {


            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};


backupRestore.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

backupRestore.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

backupRestore.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



// backup & restore methods

backupRestore.prototype.backup = function(data) {
    var defer = libQ.defer();
    var self = this;


	exec("/bin/rm " + backupFile + ".* && /bin/touch " + backupFile, function (error) {});
	
	items.forEach(function(item) {
		if (data[item] == true) {
			execSync("/bin/tar -uf " + backupFile + " /data/" + item, function (error) {
				if (error !== null) {
					console.log("Archive ERROR: "+ error);
					self.commandRouter.pushToastMessage('error',"Backup & Restore Plugin", self.commandRouter.getI18nString('COMMON.SETTINGS_SAVE_ERROR'));
					defer.reject(new Error());
				}				
			
				if (item == "configuration")
					exec("/bin/tar -f " + backupFile + " --delete data/configuration/plugins.json", function (error) {});
			});
			
		}
	});
	
	exec("/bin/gzip " + backupFile, function (error) {
		self.commandRouter.pushToastMessage('success',"Backup & Restore Plugin", self.commandRouter.getI18nString('COMMON.SETTINGS_SAVED_SUCCESSFULLY'));
		defer.resolve();
	});

    return defer.promise;
};


backupRestore.prototype.restore = function(data) {
    var defer = libQ.defer();
    var self = this;
        
    exec("/bin/tar -zxf " + backupFile + ".gz --overwrite -C / ", function (error) {
    	if (error == null) {
			self.commandRouter.pushToastMessage('success',"Backup & Restore Plugin", self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_DESCRIPTION'));
			defer.resolve();
		}
		else {
			console.log("Restore ERROR: "+ error);
			self.commandRouter.pushToastMessage('error',"Backup & Restore Plugin", self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_ERROR'));
			defer.reject(new Error());
		}
	});

    return defer.promise;
};






