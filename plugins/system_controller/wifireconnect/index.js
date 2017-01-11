'use strict';

var libQ = require('kew');
var libNet = require('net');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;


// Define the ControllerWifireconnect class
module.exports = ControllerWifireconnect;

function ControllerWifireconnect(context) {

	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



ControllerWifireconnect.prototype.onVolumioStart = function()
{
	var self= this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
	    		self.createWIFIRECONNECTFile();
	return libQ.resolve();
}

ControllerWifireconnect.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};




// Plugin methods -----------------------------------------------------------------------------

ControllerWifireconnect.prototype.startWifireconnectDaemon = function() {
	var self = this;
	var defer=libQ.defer();

		exec("/usr/bin/sudo /bin/systemctl start wifireconnect.timer", {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while starting Wifireconnect: ' + error);
            defer.reject();
		}
		else {
			self.commandRouter.pushConsoleMessage('Wifireconnect Daemon Started');
            defer.resolve();
		}
	});

		return defer.promise;
};


ControllerWifireconnect.prototype.onStop = function() {
	var self = this;

	self.logger.info("Killing wifireconnect");
		exec("/usr/bin/sudo /bin/systemctl stop wifireconnect.timer", {uid:1000,gid:1000}, function (error, stdout, stderr) { 
	if(error){
	self.logger.info('Error in killing wifireconnect')
	}
	});

   return libQ.resolve();
};

ControllerWifireconnect.prototype.onStart = function() {
    var self = this;

    var defer=libQ.defer();

  self.startWifireconnectDaemon()
        .then(function(e)
        {
            setTimeout(function () {
                self.logger.info("Connecting to daemon");
                self.wifireconnectDaemonConnect(defer);
            }, 5000);
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        });


    return defer.promise;
};

ControllerWifireconnect.prototype.wifireconnectDaemonConnect = function(defer) {
 var self = this;
};

// Wifireconnect stop
ControllerWifireconnect.prototype.stop = function() {
	var self = this;
	

    self.logger.info("Killing wifireconnect");
	exec("/usr/bin/sudo /bin/systemctl stop wifireconnect.timer", {uid:1000,gid:1000}, function (error, stdout, stderr) { 
	if(error){
self.logger.info('Error in killing wifireconnect')
	}
	});

   return libQ.resolve();
};


ControllerWifireconnect.prototype.onRestart = function() {
	var self = this;
	//
};

ControllerWifireconnect.prototype.onInstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerWifireconnect.prototype.onUninstall = function() {
	var self = this;
   self.logger.info("Killing wifireconnect");
	exec("/usr/bin/sudo /bin/systemctl stop wifireconnect.timer", {uid:1000,gid:1000}, function (error, stdout, stderr) { 
	if(error){
self.logger.info('Error in killing wifireconnect')
	}
	});

   return libQ.resolve();
};

ControllerWifireconnect.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;
	var lang_code = this.commandRouter.sharedVars.get('language_code');

        self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
                __dirname+'/i18n/strings_en.json',
                __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {

uiconf.sections[0].content[0].value = self.config.get('serverip');
uiconf.sections[0].content[1].value = self.config.get('interface');
            defer.resolve(uiconf);
            })
                .fail(function()
            {
                defer.reject(new Error());
        });

        return defer.promise;
};

ControllerWifireconnect.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerWifireconnect.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerWifireconnect.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};


// Public Methods ---------------------------------------------------------------------------------------

ControllerWifireconnect.prototype.createWIFIRECONNECTFile = function () {
    var self = this;

    var defer=libQ.defer();


    try {

        fs.readFile(__dirname + "/wifireconnect.sh.tmpl", 'utf8', function (err, data) {
            if (err) {
                defer.reject(new Error(err));
                return console.log(err);
            }
			

		var conf1 = data.replace("${serverip}", self.config.get('serverip'));
		var conf2 = conf1.replace("${interface}", self.config.get('interface'));
					
	            fs.writeFile("/data/plugins/system_controller/wifireconnect/wifireconnect.sh", conf2, 'utf8', function (err) {
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

ControllerWifireconnect.prototype.saveWifireconnectAccount = function (data) {
    var self = this;

    var defer = libQ.defer();

	self.config.set('serverip', data['serverip']);
	self.config.set('interface', data['interface']);
	self.rebuildWIFIRECONNECTAndRestartDaemon()
        .then(function(e){
            self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration of Wifireconnect has been successfully updated');
            defer.resolve({});
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        })


    return defer.promise;

};

ControllerWifireconnect.prototype.rebuildWIFIRECONNECTAndRestartDaemon = function () {
    var self=this;
    var defer=libQ.defer();
    self.createWIFIRECONNECTFile()	
        .then(function(e)
        {
            var edefer=libQ.defer();
            exec("/usr/bin/sudo /bin/systemctl restart wifireconnect.timer",{uid:1000,gid:1000}, function (error, stdout, stderr) {
                edefer.resolve();
            });
            return edefer.promise;
        })
        .then(self.startWifireconnectDaemon.bind(self))
        .then(function(e)
        {
        self.commandRouter.pushToastMessage('success', "Configuration update", 'wifireconnect has been successfully updated');
   defer.resolve({});
        });

    return defer.promise;
}
