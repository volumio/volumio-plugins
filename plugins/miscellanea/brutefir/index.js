'use strict';

var libQ = require('kew');
var libNet = require('net');
var libFast = require('fast.js');
var libLevel = require('level');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var nodetools = require('nodetools');

// Define the ControllerBrutefirplug class
module.exports = ControllerBrutefirplug;
function ControllerBrutefirplug(context) {
	// This fixed variable will let us refer to 'this' object at deeper scopes
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
}


ControllerBrutefirplug.prototype.getConfigurationFiles = function()
{
	var self = this;

	return ['config.json'];
}

ControllerBrutefirplug.prototype.addToBrowseSources = function () {
	var self = this;
	var data = {name: 'Brutefir', uri: 'Brutefir',plugin_type:'miscellanea',plugin_name:'brutefirplug'};
	self.commandRouter.volumioAddToBrowseSources(data);
};

// Plugin methods -----------------------------------------------------------------------------
ControllerBrutefireplug.prototype.onVolumioStart = function() {
	var self = this;

	var configFile=self.commandRouter.pluginManager.getConfigurationFile(self.context,'config.json');
	self.config = new (require('v-conf'))();
	self.config.loadFile(configFile);

	self.startBrutefireplugDaemon();
	setTimeout(function () {
	self.BrutefireplugDaemonConnect();
	}, 5000);



};

ControllerBrutefireplug.prototype.startBrutefireplugDaemon = function() {
	var self = this;
	exec("brutefir", function (error, stdout, stderr) {
		if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while starting Brutefirplug: ' + error);
		}
		else {
			self.commandRouter.pushConsoleMessage('Brutefir Daemon Started');
		}
	});
};

ControllerBrutefirplug.prototype.BrutefirplugDaemonConnect = function() {
	var self = this;

	// TODO use names from the package.json instead
	self.servicename = 'Brutefirplug';
	self.displayname = 'Brutefir';


	// Each core gets its own set of Brutefir sockets connected
	var nHost='localhost';
	var nPort=3002;
	self.connBrutefirplugCommand = libNet.createConnection(nPort, nHost); // Socket to send commands
	self.connBrutefirplugStatus = libNet.createConnection(nPort, nHost); // Socket to listen for status changes

	// Start a listener for receiving errors
	self.connBrutefirplugCommand.on('error', function(err) {
		console.error('Brutefir command error:');
		console.error(err);
	});
	self.connBrutefirplugStatus.on('error', function(err) {
		console.error('Brutefir status error:');
		console.error(err);
	});

	// Init some command socket variables
	self.bBrutefirplugCommandGotFirstMessage = false;
	self.BrutefirplugCommandReadyDeferred = libQ.defer(); // Make a promise for when the Brutefir connection is ready to receive events (basically when it emits 'spop 0.0.1').
	self.BrutefirplugCommandReady = self.BrutefirplugCommandReadyDeferred.promise;
	self.arrayResponseStack = [];
	self.sResponseBuffer = '';

	// Start a listener for command socket messages (command responses)
	self.connBrutefirplugCommand.on('data', function(data) {
		self.sResponseBuffer = self.sResponseBuffer.concat(data.toString());

		// If the last character in the data chunk is a newline, this is the end of the response
		if (data.slice(data.length - 1).toString() === '\n') {
			// If this is the first message, then the connection is open
			if (!self.bBrutefirplugCommandGotFirstMessage) {
				self.bBrutefirplugCommandGotFirstMessage = true;
				try {
					self.BrutefirplugCommandReadyDeferred.resolve();
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
	self.bBrutefirplugStatusGotFirstMessage = false;
	self.sStatusBuffer = '';

	// Start a listener for status socket messages
	self.connBrutefirStatus.on('data', function(data) {
		self.sStatusBuffer = self.sStatusBuffer.concat(data.toString());

		// If the last character in the data chunk is a newline, this is the end of the status update
		if (data.slice(data.length - 1).toString() === '\n') {
			// Put socket back into monitoring mode
			self.connBrutefirplugStatus.write('idle\n');

			// If this is the first message, then the connection is open
			if (!self.bBrutefirplugStatusGotFirstMessage) {
				self.bBrutefirplugStatusGotFirstMessage = true;
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


ControllerBrutefirplug.prototype.onStop = function() {
	var self = this;
	exec("killall brutefir", function (error, stdout, stderr) {

	});
};

};

// Brutefirplug stop
ControllerBrutefirplug.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefirplug::stop');

	return self.sendBrutefirplugCommand('stop', []);
};

ControllerBrutefirplug.prototype.onRestart = function() {
	var self = this;
	//
};

ControllerBrutefirplug.prototype.onInstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerBrutefirplug.prototype.onUninstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerBrutefirplug.prototype.getUIConfig = function() {
	var self = this;

	var defer = libQ.defer();

	var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');


	uiconf.sections[0].content[0].value = config.get('leftfilter');
	uiconf.sections[0].content[1].value = config.get('rightfilter');
	uiconf.sections[0].content[2].value = config.get('magnitude');
	uiconf.sections[1].content[0].value = config.get('coef31.5');
	uiconf.sections[1].content[1].value = config.get('coef63.0');
	uiconf.sections[1].content[2].value = config.get('coef125');
	uiconf.sections[1].content[3].value = config.get('coef250');
	uiconf.sections[1].content[4].value = config.get('coef500');
	uiconf.sections[1].content[5].value = config.get('coef1000');
	uiconf.sections[1].content[6].value = config.get('coef2000');
	uiconf.sections[1].content[7].value = config.get('coef4000');
	uiconf.sections[1].content[8].value = config.get('coef8000');
	uiconf.sections[1].content[9].value = config.get('coef16000');


	return uiconf;
};

ControllerBrutefirplug.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerBrutefirplug.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerBrutefirplug.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// Public Methods ---------------------------------------------------------------------------------------
// These are 'this' aware, and return a promise





// Internal methods ---------------------------------------------------------------------------
// These are 'this' aware, and may or may not return a promise

// Send command to Brutefir
ControllerBrutefirplug.prototype.sendBrutefirplugCommand = function(sCommand, arrayParameters) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefirplug::sendBrutefirplugCommand');

	// Convert the array of parameters to a string
	var sParameters = libFast.reduce(arrayParameters, function(sCollected, sCurrent) {
		return sCollected + ' ' + sCurrent;
	}, '');

	// Pass the command to Brutefir when the command socket is ready
	self.BrutefirplugCommandReady
	.then(function() {
		return libQ.nfcall(libFast.bind(self.connBrutefirplugCommand.write, self.connBrutefirplugCommand), sCommand + sParameters + '\n', 'utf-8');
	});

	var BrutefirplugResponseDeferred = libQ.defer();
	var BrutefirplugResponse = BrutefirplugResponseDeferred.promise;
	self.arrayResponseStack.push(BrutefirplugResponseDeferred);

	// Return a promise for the command response
	return BrutefirplugResponse;
};

// Brutefir get state
ControllerBrutefirplug.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerBrutefirplug::getState');

	return self.sendBrutefirplugCommand('status', []);
};



// Pass the error if we don't want to handle it


ControllerBrutefirplug.prototype.createBrutefirplugFile = function () {
    var self = this;

    var defer=libQ.defer();


    try {

        fs.readFile(__dirname + "/brutefir.conf.tmpl", 'utf8', function (err, data) {
            if (err) {
                defer.reject(new Error(err));
                return console.log(err);
            }
		
            var conf1 = data.replace("${leftfilter}", config.get('leftfiler'));
            var conf2 = data.replace("${rightfilter}", config.get('rightfilter'));

            fs.writeFile("/home/volumio/.brutefir_config_essai", conf2, 'utf8', function (err) {
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

ControllerBrutefirplug.prototype.saveBrutefirconfig = function (data) {
    var self = this;

    var defer = libQ.defer();

    config.set('leftfilter', data['leftfilter']);
    config.set('rightfilter', data['rightfilter']);

    self.rebuildBRUTEFIRPLUGAndRestartDaemon()
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


ControllerBrutefirplug.prototype.rebuildBRUTEFIRPLUGAndRestartDaemon = function () {
    var self=this;
    var defer=libQ.defer();

    self.createBRUTEFIRPLUGFile()
        .then(function(e)
        {
            var edefer=libQ.defer();
            exec("killall brutefir", function (error, stdout, stderr) {
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
}
