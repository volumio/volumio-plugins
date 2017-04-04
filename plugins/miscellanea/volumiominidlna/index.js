'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;


// Define the ControllerVolumiominidlna class
module.exports = ControllerVolumiominidlna;

function ControllerVolumiominidlna(context) {
	var self = this;

	var self = this;
	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;

}

ControllerVolumiominidlna.prototype.onVolumioStart = function()
{
	var self= this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
	//    		self.createVolumiominidlnaFile();
	return libQ.resolve();
}

ControllerVolumiominidlna.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};




// Plugin methods -----------------------------------------------------------------------------

ControllerVolumiominidlna.prototype.startVolumiominidlnaDaemon = function() {
	var self = this;
	var defer=libQ.defer();

		exec("/usr/bin/sudo /bin/systemctl start volumiominidlna.service", {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.logger.info('The following error occurred while starting Volumiominidlna ' + error);
            		defer.reject();
		}
		else {
			self.logger.info('Volumiominidlna Daemon Started');
           		defer.resolve();
		}
	});

		return defer.promise;
};


ControllerVolumiominidlna.prototype.onStop = function() {
	var self = this;

	self.logger.info("Killing Volumiominidlna");
		exec("/usr/bin/sudo /bin/systemctl stop volumiominidlna.service", {uid:1000,gid:1000}, function (error, stdout, stderr) { 
	if(error){
	self.logger.info('Error in killing Volumiominidlna')
	}
	});

   return libQ.resolve();
};

ControllerVolumiominidlna.prototype.onStart = function() {
    var self = this;

    var defer=libQ.defer();

  self.startVolumiominidlnaDaemon()
        .then(function(e)
        {
            self.logger.info('Volumiominidlna started');
			defer.resolve();
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        });


    return defer.promise;
};

// Volumiominidlna stop



ControllerVolumiominidlna.prototype.onRestart = function() {
	var self = this;
	//
};

ControllerVolumiominidlna.prototype.onInstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolumiominidlna.prototype.onUninstall = function() {
	var self = this;
   self.logger.info("Killing Volumiominidlna");
	exec("/usr/bin/sudo /bin/systemctl stop volumiominidlna.service", {uid:1000,gid:1000}, function (error, stdout, stderr) { 
	if(error){
self.logger.info('Error in killing Volumiominidlna')
	}
	});

   return libQ.resolve();
};

ControllerVolumiominidlna.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;
	var lang_code = this.commandRouter.sharedVars.get('language_code');

        self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
                __dirname+'/i18n/strings_en.json',
                __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {

uiconf.sections[0].content[0].value = self.config.get('audio_folder');
uiconf.sections[0].content[1].value = self.config.get('picture_folder');
uiconf.sections[0].content[2].value = self.config.get('video_folder');
            defer.resolve(uiconf);
            })
                .fail(function()
            {
                defer.reject(new Error());
        });

        return defer.promise;
};

ControllerVolumiominidlna.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolumiominidlna.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolumiominidlna.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};


// Public Methods ---------------------------------------------------------------------------------------

ControllerVolumiominidlna.prototype.createVolumiominidlnaFile = function () {
    var self = this;

    var defer=libQ.defer();


    try {

        fs.readFile(__dirname + "/Volumiominidlna.tmpl", 'utf8', function (err, data) {
            if (err) {
                defer.reject(new Error(err));
                return console.log(err);
            }
			

		var conf1 = data.replace("${audio_folder}", self.config.get('audio_folder'));
		var conf2 = conf1.replace("${picture_folder}", self.config.get('picture_folder'));
		var conf3 = conf2.replace("${video_folder}", self.config.get('video_folder'));
					
	            fs.writeFile("/data/configuration/miscellanea/volumiominidlna/minidlna.conf", conf3, 'utf8',  function (err) {
                if (err)
                    defer.reject(new Error(err));
                else defer.resolve();
            });
            
        });


    }
    catch (err) {


    }

    return defer.promise;

};

ControllerVolumiominidlna.prototype.saveVolumiominidlnaAccount = function (data) {
    var self = this;

    var defer = libQ.defer();

	self.config.set('audio_folder', data['audio_folder']);
	self.config.set('picture_folder', data['picture_folder']);
	self.config.set('video_folder', data['video_folder']);
	self.rebuildVolumiominidlnaAndRestartDaemon()
        .then(function(e){
            defer.resolve({});
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        })


    return defer.promise;

};

ControllerVolumiominidlna.prototype.rebuildVolumiominidlnaAndRestartDaemon = function () {
    var self=this;
    var defer=libQ.defer();
    self.createVolumiominidlnaFile()	
        .then(function(e)
        {
            var edefer=libQ.defer();
            exec("/usr/bin/sudo /bin/systemctl restart volumiominidlna.service",{uid:1000,gid:1000}, function (error, stdout, stderr) {
                edefer.resolve();
            });
            return edefer.promise;
        })
        .then(self.startVolumiominidlnaDaemon.bind(self))
        .then(function(e)
        {
        self.commandRouter.pushToastMessage('success', "Configuration update", 'Volumiominidlna has been successfully updated');
   defer.resolve({});
        });

    return defer.promise;
}
