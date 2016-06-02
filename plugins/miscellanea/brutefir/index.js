'use strict';
// This file is surely full of error. I have to say that I try to understand how it works by copying / modifying code from other plugins.
// as result plenty of line should be removed or added...
// not sure all var are required....
var libQ = require('kew');
var libNet = require('net');
var libFast = require('fast.js');
var fs = require('fs-extra');
var config = new(require('v-conf'))();
var telnet = require('telnet-client');
var connection = new telnet();
var io = require('socket.io-client');
var exec = require('child_process').exec;

// Define the ControllerBrutefir class
module.exports = ControllerBrutefir;
function ControllerBrutefir(context) {
 // This fixed variable will let us refer to 'this' object at deeper scopes
 var self = this;

 this.context = context;
 this.commandRouter = this.context.coreCommand;
 this.logger = this.context.logger;
 this.configManager = this.context.configManager;
 
}

ControllerBrutefir.prototype.onVolumioStart = function()
{
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);
}

ControllerBrutefir.prototype.getConfigurationFiles = function() {

 return ['config.json'];
}

ControllerBrutefir.prototype.addToBrowseSources = function() {
 //var self = this;
 var data = { name: 'Brutefir', uri: 'brutefir', plugin_type: 'miscellanea', plugin_name: 'brutefir'};
 this.commandRouter.volumioAddToBrowseSources(data);
};
// Plugin methods -----------------------------------------------------------------------------

ControllerBrutefir.prototype.startBrutefirDaemon = function() {
 var self = this;
 var defer=libQ.defer();
 exec("/usr/bin/brutefir -daemon /data/configuration/miscellanea/brutefir/volumio-brutefir-config", function(error, stdout, stderr) {
  if (error !== null) {
   self.commandRouter.pushConsoleMessage('The following error occurred while starting Brutefir: ' + error);
 defer.reject();
 } 
	else {
   self.commandRouter.pushConsoleMessage('Brutefir Daemon Started');
	defer.reject();
  }
 });
 return defer.promise;
};

ControllerBrutefir.prototype.brutefirDaemonConnect = function(defer) {
	var self = this;

	// TODO use names from the package.json instead
	self.servicename = 'brutefir';
	self.displayname = 'Brutefir';


	// Each core gets its own set of Brutefir sockets connected
	var nHost='localhost';
	var nPort=3002;
	self.connBrutefirCommand = libNet.createConnection(nPort, nHost); 
	self.connBrutefirStatus = libNet.createConnection(nPort, nHost, function(){
        self.addToBrowseSources();
        defer.resolve();
    }); // Socket to listen for status changes
	
	// Start a listener for receiving errors
	
	self.connBrutefirStatus.on('error', function(err) {
		self.logger.info('BRUTEFIR status error:');
		self.logger.info(err);
	try
        {
            defer.reject();
        } catch(ecc) {}


	});
/*
	// Init some command socket variables
	self.bBrutefirCommandGotFirstMessage = false;
	self.brutefirCommandReadyDeferred = libQ.defer(); 
	self.brutefirCommandReady = self.brutefirCommandReadyDeferred.promise;
	self.arrayResponseStack = [];
	self.sResponseBuffer = '';
*/
	// Start a listener for command socket messages (command responses)
	self.connBrutefirCommand.on('data', function(data) {
		self.sResponseBuffer = self.sResponseBuffer.concat(data.toString());

		// If the last character in the data chunk is a newline, this is the end of the response
		if (data.slice(data.length - 1).toString() === '\n') {
			// If this is the first message, then the connection is open
			if (!self.bBrutefirCommandGotFirstMessage) {
				self.bBrutefirCommandGotFirstMessage = true;
				try {
					self.brutefirCommandReadyDeferred.resolve();
				} catch (error) {
					self.pushError(error);
				}
				// Else this is a command response
			} else {
				try {
					self.arrayResponseStack.shift().resolve(self.sResponseBuffer);
				} catch (error) {
					self.pushError(error);
				}
			}

			// Reset the response buffer
			self.sResponseBuffer = '';
		}
	});

	// Init some status socket variables
	self.bBrutefirStatusGotFirstMessage = false;
	self.sStatusBuffer = '';

	// Start a listener for status socket messages
	self.connBrutefirStatus.on('data', function(data) {
		self.sStatusBuffer = self.sStatusBuffer.concat(data.toString());

		// If the last character in the data chunk is a newline, this is the end of the status update
		if (data.slice(data.length - 1).toString() === '\n') {
			// Put socket back into monitoring mode
			self.connBrutefirStatus.write('idle\n');

			// If this is the first message, then the connection is open
			if (!self.bBrutefirStatusGotFirstMessage) {
				self.bBrutefirStatusGotFirstMessage = true;
				// Else this is a state update announcement
			} else {
				var timeStart = Date.now();
				var sStatus = self.sStatusBuffer;

				self.logStart('Brutefir announces state update')
					/*.then(function(){
					 return self.getState.call(self);
					 })*/
					.then(function() {
						return self.parseState.call(self, sStatus);
					})
					.then(libFast.bind(self.pushState, self))
					.fail(libFast.bind(self.pushError, self))
					.done(function() {
						return self.logDone(timeStart);
					});
			}

			// Reset the status buffer
			self.sStatusBuffer = '';
		}
	});

	

};

// burtefir command
ControllerBrutefir.prototype.sendequalizer = function() {
	var self = this;
   	 self.config.set('gain', data['gain']);
	 self.config.set('coef31', data['coef31']);
    self.config.set('coef63', data['coef63']);
    self.config.set('coef125', data['coef125']);
    self.config.set('coef250', data['coef250']);
    self.config.set('coef500', data['coef500']);
    self.config.set('coef1000', data['coef1000']);
    self.config.set('coef2000', data['coef2000']);
    self.config.set('coef4000', data['coef4000']);
    self.config.set('coef8000', data['coef8000']);
    self.config.set('coef16000', data['coef16000']);

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefir::lmc eq 0 mag 31/'+coef31,', 63/'+coef63,', 125/'+coef125,', 250/'+coef250,', 500/'+coef500,', 1000/'+coef1000,', 2000/'+coef2000,', 4000/'+coef4000,', 8000/'+coef8000,', 16000/'+coef16000);

	// brutefir cmd
	return self.sendBrutefirCommand('lmc eq 0 mag 31/'+coef31,', 63/'+coef63,', 125/'+coef125,', 250/'+coef250,', 500/'+coef500,', 1000/'+coef1000,', 2000/'+coef2000,', 4000/'+coef4000,', 8000/'+coef8000,', 16000/'+coef16000);
};
/*  var BrutefirResponseDeferred = libQ.defer();
	// Pass the command to Spop when the command socket is ready
	self.spopCommandReady
	.then(function() {
		return libQ.nfcall(libFast.bind(self.connBrutefirCommand.write, self.connBrutefirCommand), sCommand + sParameters + '\n', 'utf-8');
	});


	var brutefirResponse = brutefirResponseDeferred.promise;

    if(sCommand!=='status')
    {
        self.commandRouter.logger.info("ADDING DEFER FOR COMMAND " + sCommand);
        self.arrayResponseStack.push(brutefirResponseDeferred);
    }
	// Return a promise for the command response
	return brutefirResponse;
*/


ControllerBrutefir.prototype.sendBrutefirCommand = function(sCommand, arrayParameters) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefir::sendBrutefirCommand');

	// Pass the command to Brutefir when the command socket is ready
	self.brutefirCommandReady
	.then(function() {
		return libQ.nfcall(libFast.bind(self.connBrutefirCommand.write, self.connBrutefirCommand), sCommand + sParameters + '\n', 'utf-8');
	});

	var brutefirResponseDeferred = libQ.defer();
	var brutefirResponse = brutefirResponseDeferred.promise;
	self.arrayResponseStack.push(brutefirResponseDeferred);

	// Return a promise for the command response
	return brutefirResponse;
};

ControllerBrutefir.prototype.onStop = function() {
	var self = this;
	exec("killall brutefir.real", function (error, stdout, stderr) {

	});
		 return libQ.defer();
};




ControllerBrutefir.prototype.stop = function() {
 var self = this;
  self.logger.info("Killing Brutefir daemon");
 exec("killall brutefir.real", function(error, stdout, stderr) {

 });
	 return libQ.defer();
};


ControllerBrutefir.prototype.onStart = function() {
    var self = this;

    var defer=libQ.defer();

    self.startBrutefirDaemon()
        .then(function(e)
        {
            setTimeout(function () {
                self.logger.info("Connecting to daemon");
                self.brutefirDaemonConnect(defer);
            }, 5000);
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        });


    return defer.promise;
};

ControllerBrutefir.prototype.handleBrowseUri=function(curUri)
{
	var self=this;

	//self.commandRouter.logger.info(curUri);
	var response;

	if (curUri.startsWith('brutefir')) {
		if(curUri=='brutefir')
		{
			response=libQ.resolve({
				navigation: {
					prev: {
						uri: 'brutefir'
					},
					list: [{
						service: 'brutefir',
						type: 'folder',
						icon: 'fa fa-folder-open-o',
						uri: 'brutefir'
					}

					]
				}
			});
		}
		/*else if(curUri.startsWith('brutefir'))
		{
			if(curUri=='brutefir')
				response=self.listPlaylists();
			else
			{
				response=self.listPlaylist(curUri);
			}
		}*/
	}

	return response;
};

ControllerBrutefir.prototype.onRestart = function() {
 var self = this;

};

ControllerBrutefir.prototype.onInstall = function() {
 var self = this;
 //	//Perform your installation tasks here
};

ControllerBrutefir.prototype.onUninstall = function() {
	var self = this;
//Perform your installation tasks here
};

ControllerBrutefir.prototype.getUIConfig = function() {
 var self = this;
 var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');
 	uiconf.sections[0].content[0].value = self.config.get('gain');
 	uiconf.sections[0].content[1].value = self.config.get('coef31');
 	uiconf.sections[0].content[2].value = self.config.get('coef63');
 	uiconf.sections[0].content[3].value = self.config.get('coef125');
 	uiconf.sections[0].content[4].value = self.config.get('coef250');
 	uiconf.sections[0].content[5].value = self.config.get('coef500');
 	uiconf.sections[0].content[6].value = self.config.get('coef1000');
 	uiconf.sections[0].content[7].value = self.config.get('coef2000');
 	uiconf.sections[0].content[8].value= self.config.get('coef4000');
 	uiconf.sections[0].content[9].value = self.config.get('coef8000');
 	uiconf.sections[0].content[10].value = self.config.get('coef16000');
 	uiconf.sections[1].content[0].value = self.config.get('leftfilter');
 	uiconf.sections[1].content[1].value = self.config.get('rightfilter');
	uiconf.sections[1].content[2].value = self.config.get('filter_size');
 	uiconf.sections[1].content[3].value = self.config.get('numb_part');
 	uiconf.sections[1].content[4].value = self.config.get('fl_bits');

 return uiconf;
};

ControllerBrutefir.prototype.setUIConfig = function(data) {
 var self = this;
// var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');

};

ControllerBrutefir.prototype.getConf = function(varName) {
 var self = this;
 //Perform your installation tasks here
};


ControllerBrutefir.prototype.setConf = function(varName, varValue) {
 var self = this;
 //Perform your installation tasks here
};

// Public Methods ---------------------------------------------------------------------------------------

// file is copied but field are filled with "undefined" instead of the value from UI
ControllerBrutefir.prototype.createBRUTEFIRFile = function() {
 var self = this;

 var defer = libQ.defer();


 try {

  fs.readFile(__dirname + "/brutefir.conf.tmpl", 'utf8', function(err, data) {
   if (err) {
    defer.reject(new Error(err));
    return console.log(err);
   }
			var outdev = self.commandRouter.sharedVars.get('alsa.outputdevice');
			var hwdev = 'hw:' + outdev;
			
   
   var conf1 = data.replace("${filter_size}", self.config.get('filter_size'));
   var conf2 = conf1.replace("${numb_part}", self.config.get('numb_part'));
   var conf3 = conf2.replace("${fl_bits}", self.config.get('fl_bits'));
   var conf4 = conf3.replace("${leftfilter}", self.config.get('leftfilter'));
   var conf5 = conf4.replace("${rightfilter}", self.config.get('rightfilter'));
   var conf6 = conf5.replace("${outdev}", hwdev);

   fs.writeFile("/data/configuration/miscellanea/brutefir/volumio-brutefir-config", conf6, 'utf8', function(err) {
    if (err)
     defer.reject(new Error(err));
    else defer.resolve();
   });


  });


 } catch (err) {


 }

 return defer.promise;

};


ControllerBrutefir.prototype.saveBrutefirconfigAccount1 = function (data) {
 var self = this;
 var defer = libQ.defer();

    self.config.set('gain', data['gain']);
    self.config.set('coef31', data['coef31']);
    self.config.set('coef63', data['coef63']);
    self.config.set('coef125', data['coef125']);
    self.config.set('coef250', data['coef250']);
    self.config.set('coef500', data['coef500']);
    self.config.set('coef1000', data['coef1000']);
    self.config.set('coef2000', data['coef2000']);
    self.config.set('coef4000', data['coef4000']);
    self.config.set('coef8000', data['coef8000']);
    self.config.set('coef16000', data['coef16000']);
    self.config.set('leftfilter', data['leftfilter']);
    self.config.set('rightfilter', data['rightfilter']);
    self.config.set('filter_size', data['filter_size']);
    self.config.set('numb_part', data['numb_part']);
    self.config.set('fl_bits', data['fl_bits']);
    
  self.saveBRUTEFIRnoRestartDaemon()
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

ControllerBrutefir.prototype.saveBRUTEFIRnoRestartDaemon = function () {
    var self=this;
    var defer=libQ.defer();

    self.createBRUTEFIRFile()
        .then(function(e)
        {
         var edefer=libQ.defer();
            exec("echo toto", function (error, stdout, stderr) {
                edefer.resolve();
            });
            return edefer.promise;
        }) 
        .then(function(e){
            self.onVolumioStart();
            return libQ.resolve();
        })
        .then(function(e)
        {
            defer.resolve();
        })
        .fail(function(e){
            defer.reject(new Error());
        })

    return defer.promise;
};


ControllerBrutefir.prototype.saveBrutefirconfigAccount2 = function(data) {
 var self = this;

 var defer = libQ.defer();

 self.config.set('leftfilter', data['leftfilter']);
 self.config.set('rightfilter', data['rightfilter']);
  self.config.set('filter_size', data['filter_size']);
 self.config.set('numb_part', data['numb_part']);
 self.config.set('fl_bits', data['fl_bits']);
 
self.rebuildBRUTEFIRAndRestartDaemon()
  .then(function(e) {
   self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
   defer.resolve({});
  })
  .fail(function(e)
 {
   defer.reject(new Error());
  })


 return defer.promise;

};


ControllerBrutefir.prototype.rebuildBRUTEFIRAndRestartDaemon = function() {
 var self = this;
 var defer = libQ.defer();

 self.createBRUTEFIRFile()
  .then(function(e) {
   var edefer = libQ.defer();
   exec("killall brutefir.real", function(error, stdout, stderr) {
    edefer.resolve();
   });
   return edefer.promise;
  })
  .then(self.startBrutefirDaemon.bind(self))
        .then(function(e)
        {
            setTimeout(function () {
                self.logger.info("Connecting to daemon");
                self.brutefirDaemonConnect(defer);
            }, 5000);
        });

 return defer.promise;
}
