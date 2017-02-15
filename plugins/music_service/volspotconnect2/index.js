'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;


// Define the ControllerVolspotconnect class
module.exports = ControllerVolspotconnect;

function ControllerVolspotconnect(context) {

	var self = this;

	var self = this;
	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;

}

ControllerVolspotconnect.prototype.onVolumioStart = function()
{
	var self= this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
	    		//self.createVOLSPOTCONNECTFile();
	return libQ.resolve();
}

ControllerVolspotconnect.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};


ControllerVolspotconnect.prototype.onPlayerNameChanged = function (playerName) {
	var self = this;

	self.onRestart();
};


// Plugin methods -----------------------------------------------------------------------------

ControllerVolspotconnect.prototype.startVolspotconnectDaemon = function() {
	var self = this;
	var defer=libQ.defer();

	exec("/usr/bin/sudo /bin/systemctl start volspotconnect2.service volspotconnect2purgecache.timer", {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.logger.info('The following error occurred while starting VOLSPOTCONNECT: ' + error);
            		defer.reject();
		}
		else {
			self.logger.info('Volspotconnect Daemon Started');
           		defer.resolve();
		}
	});

		return defer.promise;

};


ControllerVolspotconnect.prototype.onStop = function() {
	var self = this;

	self.logger.info("Killing Spotify-connect-web daemon");
	exec("/usr/bin/sudo /bin/systemctl stop volspotconnect2.service volspotconnect22.service", function (error, stdout, stderr) { 
	if(error){
		self.logger.info('Error in killing Voslpotconnect')
	}
	});

   return libQ.resolve();
};

ControllerVolspotconnect.prototype.onStart = function() {

var self = this;

	var defer=libQ.defer();

	self.startVolspotconnectDaemon()
		.then(function(e)
		{
			self.logger.info('Volspotconnect Started');
			defer.resolve();
		})
		.fail(function(e)
		{
			defer.reject(new Error());
		});

	return defer.promise;
};

 /*
	this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.rebuildVOLSPOTCONNECTAndRestartDaemon.bind(this));
	this.commandRouter.sharedVars.registerCallback('alsa.outputdevicemixer', this.rebuildVOLSPOTCONNECTAndRestartDaemon.bind(this));
	this.commandRouter.sharedVars.registerCallback('system.name', this.rebuildVOLSPOTCONNECTAndRestartDaemon.bind(this));


*/
// Volspotconnect stop
/*
ControllerVolspotconnect.prototype.stop = function() {
	var self = this;
	

    self.logger.info("Killing Volspotconnect2 daemon");
	exec("/usr/bin/sudo /bin/systemctl stop volspotconnect2.service", {uid:1000,gid:1000}, function (error, stdout, stderr) { 
	if(error){
self.logger.info('Error in killing Voslpotconnect2')
	}
	});

   return libQ.resolve();
};


ControllerVolspotconnect.prototype.onRestart = function() {
	var self = this;
	//
};

ControllerVolspotconnect.prototype.onInstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolspotconnect.prototype.onUninstall = function() {
	var self = this;
   self.logger.info("Killing Spotify-connect-web daemon");
	exec("/usr/bin/sudo /bin/systemctl stop volspotconnect.service", {uid:1000,gid:1000}, function (error, stdout, stderr) { 
	if(error){
self.logger.info('Error in killing Voslpotconnect')
	}
	});

   return libQ.resolve();
};
*/
ControllerVolspotconnect.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;
	var lang_code = this.commandRouter.sharedVars.get('language_code');

        self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
                __dirname+'/i18n/strings_en.json',
                __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
 uiconf.sections[0].content[0].value = self.config.get('bitrate');
 /*
value = self.config.get('bitrate');
	self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', value);
	self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[0].options'), value));
*/

            defer.resolve(uiconf);
            })
                .fail(function()
            {
                defer.reject(new Error());
        });

        return defer.promise
};

ControllerVolspotconnect.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolspotconnect.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolspotconnect.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};
/*
ControllerVolspotconnect.prototype.purgecache = function intervalFunc() {
	var self = this;
	console.log ('essai  timer')
		exec("/data/plugins/music_service/volspotconnect2/remove.sh", function (error, stdout, stderr) { }
	setInterval(intervalFunc, 500);
	
	//Perform your installation tasks here
};
*/
ControllerVolspotconnect.prototype.getAdditionalConf = function (type, controller, data) {
	var self = this;
	return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
};

// Public Methods ---------------------------------------------------------------------------------------

ControllerVolspotconnect.prototype.createVOLSPOTCONNECTFile = function () {
    var self = this;

    var defer=libQ.defer();


    try {

        fs.readFile(__dirname + "/volspotconnect2.tmpl", 'utf8', function (err, data) {
            if (err) {
                defer.reject(new Error(err));
                return console.log(err);
            }
					
		var outdev = self.commandRouter.sharedVars.get('alsa.outputdevice');
		var devicename = self.commandRouter.sharedVars.get('system.name');
		var hwdev ='plughw:' + outdev;
				if (outdev == "softvolume") {
					hwdev = "softvolume"
					}
		var conf1 = data.replace("${bitrate}", self.config.get('bitrate'));
		var conf2 = conf1.replace("${devicename}", devicename);
		var conf3 = conf2.replace("${outdev}", hwdev);
							
	            fs.writeFile("/data/plugins/music_service/volspotconnect2/startconnect.sh", conf3, 'utf8', function (err) {
                
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

ControllerVolspotconnect.prototype.createVOLSPOTCONNECT2File = function () {
    var self = this;

    var defer=libQ.defer();


    try {

        fs.readFile(__dirname + "/volspotconnect22.tmpl", 'utf8', function (err, data) {
            if (err) {
                defer.reject(new Error(err));
                return console.log(err);
            }
					
		var outdev = self.commandRouter.sharedVars.get('alsa.outputdevice');
		var devicename = self.commandRouter.sharedVars.get('system.name');
		var hwdev ='plughw:' + outdev;
				if (outdev == "softvolume") {
					hwdev = "softvolume"
					}
		var conf1 = data.replace("${bitrate}", self.config.get('bitrate'));
		var conf2 = conf1.replace("${devicename}", devicename);
		var conf3 = conf2.replace("${outdev}", hwdev);
							
	            fs.writeFile("/data/plugins/music_service/volspotconnect2/startconnect2.sh", conf3, 'utf8', function (err) {
                
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


ControllerVolspotconnect.prototype.saveVolspotconnectAccount = function (data) {
    var self = this;

    var defer = libQ.defer();
    
   	self.config.set('bitrate', data['bitrate'].value);
	self.rebuildVOLSPOTCONNECTAndRestartDaemon()
        .then(function(e){
            defer.resolve({});
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        })


    return defer.promise;

};

ControllerVolspotconnect.prototype.rebuildVOLSPOTCONNECTAndRestartDaemon = function () {
    var self=this;
    var defer=libQ.defer();
 
    self.createVOLSPOTCONNECTFile()
    self.createVOLSPOTCONNECT2File()
        .then(function(e)
        {
            var edefer=libQ.defer();
            exec("/usr/bin/sudo /bin/systemctl restart volspotconnect2.service volspotconnect22.service",{uid:1000,gid:1000}, function (error, stdout, stderr) {
                edefer.resolve();
            });
            return edefer.promise;
        })
        .then(self.startVolspotconnectDaemon.bind(self))
        .then(function(e)
        {
        self.commandRouter.pushToastMessage('success', "Configuration update", 'Volumio Spotify Connect has been successfully updated');
   defer.resolve({});
        });

    return defer.promise;
}