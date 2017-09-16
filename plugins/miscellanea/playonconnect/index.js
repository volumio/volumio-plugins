'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;


// Define the Controllerplayonconnect class
module.exports = Controllerplayonconnect;

function Controllerplayonconnect(context) {
	var self = this;

	var self = this;
	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;

}

Controllerplayonconnect.prototype.onVolumioStart = function()
{
	var self= this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
	//    		self.createplayonconnectFile();
	return libQ.resolve();
}

Controllerplayonconnect.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};




// Plugin methods -----------------------------------------------------------------------------

Controllerplayonconnect.prototype.startplayonconnectDaemon = function() {
	var self = this;
	var defer=libQ.defer();

		exec("/usr/bin/sudo /bin/systemctl start playonconnect.timer", {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.logger.info('The following error occurred while starting playonconnect ' + error);
            		defer.reject();
		}
		else {
			self.logger.info('playonconnect Daemon Started');
           		defer.resolve();
		}
	});

		return defer.promise;
};


Controllerplayonconnect.prototype.onStop = function() {
	var self = this;

	self.logger.info("Killing playonconnect");
		exec("/usr/bin/sudo /bin/systemctl stop playonconnect.timer", {uid:1000,gid:1000}, function (error, stdout, stderr) { 
	if(error){
	self.logger.info('Error in killing playonconnect')
	}
	});

   return libQ.resolve();
};

Controllerplayonconnect.prototype.onStart = function() {
    var self = this;

    var defer=libQ.defer();

  self.startplayonconnectDaemon()
        .then(function(e)
        {
            self.logger.info('playonconnect started');
			defer.resolve();
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        });


    return defer.promise;
};

// playonconnect stop



Controllerplayonconnect.prototype.onRestart = function() {
	var self = this;
	//
};

Controllerplayonconnect.prototype.onInstall = function() {
	var self = this;
	//Perform your installation tasks here
};

Controllerplayonconnect.prototype.onUninstall = function() {
	var self = this;
   self.logger.info("Killing playonconnect");
	exec("/usr/bin/sudo /bin/systemctl stop playonconnect.timer", {uid:1000,gid:1000}, function (error, stdout, stderr) { 
	if(error){
self.logger.info('Error in killing playonconnect')
	}
	});

   return libQ.resolve();
};

Controllerplayonconnect.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;
	var lang_code = this.commandRouter.sharedVars.get('language_code');

        self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
                __dirname+'/i18n/strings_en.json',
                __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {

uiconf.sections[0].content[0].value = self.config.get('serverip');
uiconf.sections[0].content[1].value = self.config.get('streamtoplay');
            defer.resolve(uiconf);
            })
                .fail(function()
            {
                defer.reject(new Error());
        });

        return defer.promise;
};

Controllerplayonconnect.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

Controllerplayonconnect.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

Controllerplayonconnect.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};


// Public Methods ---------------------------------------------------------------------------------------

Controllerplayonconnect.prototype.createPLAYONCONNECTFile = function () {
    var self = this;

    var defer=libQ.defer();


    try {

        fs.readFile(__dirname + "/playonconnect.sh.tmpl", 'utf8', function (err, data) {
            if (err) {
                defer.reject(new Error(err));
                return console.log(err);
            }
			

		var conf1 = data.replace("${serverip}", self.config.get('serverip'));
		var conf2 = conf1.replace("${streamtoplay}", self.config.get('streamtoplay'));
					
	            fs.writeFile("/data/plugins/miscellanea/playonconnect/playonconnect.sh", conf2, 'utf8', function (err) {
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

Controllerplayonconnect.prototype.saveplayonconnectAccount = function (data) {
    var self = this;

    var defer = libQ.defer();

	self.config.set('serverip', data['serverip']);
	self.config.set('streamtoplay', data['streamtoplay']);
	self.rebuildplayonconnectAndRestartDaemon()
        .then(function(e){
            defer.resolve({});
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        })


    return defer.promise;

};

Controllerplayonconnect.prototype.rebuildplayonconnectAndRestartDaemon = function () {
    var self=this;
    var defer=libQ.defer();
    self.createPLAYONCONNECTFile()	
        .then(function(e)
        {
            var edefer=libQ.defer();
            exec("/usr/bin/sudo /bin/systemctl restart playonconnect.timer",{uid:1000,gid:1000}, function (error, stdout, stderr) {
                edefer.resolve();
            });
            return edefer.promise;
        })
        .then(self.startplayonconnectDaemon.bind(self))
        .then(function(e)
        {
        self.commandRouter.pushToastMessage('success', "Configuration update", 'playonconnect has been successfully updated');
   defer.resolve({});
        });

    return defer.promise;
}
