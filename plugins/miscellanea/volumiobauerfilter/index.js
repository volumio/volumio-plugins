'use strict';

var libQ = require('kew');
var libNet = require('net');
var libFast = require('fast.js');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
//var nodetools = require('nodetools');

// Define the ControllerBauerfilter class
module.exports = ControllerBauerfilter;
function ControllerBauerfilter(context) {
	// This fixed variable will let us refer to 'this' object at deeper scopes
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



ControllerBauerfilter.prototype.onVolumioStart = function()
{
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

}

ControllerBauerfilter.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}


// Plugin methods -----------------------------------------------------------------------------

ControllerBauerfilter.prototype.startVolumiobauerfilterDaemon = function() {
	var self = this;

    var defer=libQ.defer();

    return defer.promise;
};


ControllerBauerfilter.prototype.onStop = function() {
	var self = this;


    return libQ.defer();
};

ControllerBauerfilter.prototype.onStart = function() {
    var self = this;

    var defer=libQ.defer();

  self.startVolspotconnectDaemon()
        .then(function(e)
        {
            setTimeout(function () {
                self.logger.info("Connecting to daemon");
                self.volumiobauerfilterDaemonConnect(defer);
            }, 5000);
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        });

	this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.rebuildVOLUMIOBAUERFILTERAndRestartDaemon.bind(this));

    return defer.promise;
};

// Volspotconnect stop
ControllerBauerfilter.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBauerfilter::stop');

	return self.sendVolumiobauerfilterCommand('stop', []);
};

ControllerBauerfilter.prototype.onRestart = function() {
	var self = this;
	//
};

ControllerBauerfilter.prototype.onInstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerBauerfilter.prototype.onUninstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerBauerfilter.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;
	
	var lang_code = this.commandRouter.sharedVars.get('language_code');

        self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
                __dirname+'/i18n/strings_en.json',
                __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {

uiconf.sections[0].content[0].value = self.config.get('frequency');
uiconf.sections[0].content[1].value = self.config.get('attenuation');

            defer.resolve(uiconf);
            })
                .fail(function()
            {
                defer.reject(new Error());
        });

        return defer.promise;
};

ControllerBauerfilter.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerBauerfilter.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerBauerfilter.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// Public Methods ---------------------------------------------------------------------------------------
// These are 'this' aware, and return a promise



// Rebuild a library of user's playlisted Spotify tracks


// Define a method to clear, add, and play an array of tracks


// Internal methods ---------------------------------------------------------------------------
// These are 'this' aware, and may or may not return a promise



// Volspotconnect get state
ControllerBauerfilter.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBauerfilter::getState');

	return self.sendVolspotconnectCommand('status', []);
};


// Announce updated Volspotconnect state




ControllerBauerfilter.prototype.logDone = function(timeStart) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + '------------------------------ ' + (Date.now() - timeStart) + 'ms');
	return libQ.resolve();
};

ControllerBauerfilter.prototype.logStart = function(sCommand) {
	var self = this;
	self.commandRouter.pushConsoleMessage('\n' + '[' + Date.now() + '] ' + '---------------------------- ' + sCommand);
	return libQ.resolve();
};



ControllerBauerfilter.prototype.createVOLUMIOBAUERFILTERFile = function () {
    var self = this;

    var defer=libQ.defer();


    try {

        fs.readFile(__dirname + "/asoundrc.tmpl", 'utf8', function (err, data) {
            if (err) {
                defer.reject(new Error(err));
                return console.log(err);
            }
		
		var conf1 = data.replace("${frequency}", self.config.get('frequency'));
		var conf2 = conf1.replace("${attenuation}", self.config.get('attenuation'));
		

	            fs.writeFile("/etc/asound.conf", conf2, 'utf8', function (err) {
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

ControllerBauerfilter.prototype.saveVolumiobauerfilterAccount = function (data) {
    var self = this;

    var defer = libQ.defer();

    self.config.set('frequency', data['frequency']);
    self.config.set('attenuation', data['attenuation']);
   
    self.rebuildBAUERFILTERAndRestartDaemon()
        .then(function(e){
            self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
            defer.resolve({});
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        })


    return defer.promise;

};


ControllerBauerfilter.prototype.rebuildVOLUMIOBAUERFILTERAndRestartDaemon = function () {
    var self=this;
    var defer=libQ.defer();

    self.createVOLUMIOBAUERFILTERFile()
        .then(function(e)
        {
            var edefer=libQ.defer();
            exec("killall node", function (error, stdout, stderr) { //not done in a elegant way
                edefer.resolve();
            });
            return edefer.promise;
        })
        .then(self.startVolumiobauerfilterDaemon.bind(self))
        .then(function(e)
        {
            setTimeout(function () {
                self.logger.info("Connecting to daemon");
                self.volumiobauerfilterDaemonConnect(defer);
            }, 5000);
        });

    return defer.promise;
}

