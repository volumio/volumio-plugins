'use strict';

var libQ = require('kew');
var libNet = require('net');
var libFast = require('fast.js');
//var libLevel = require('level');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
//var nodetools = require('nodetools');
var telnet = require('telnet-client');
var connection = new telnet();
var libFsExtra = require('fs-extra');
var io = require('socket.io-client');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var spawn = require('child_process').spawn;

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

ControllerBrutefir.prototype.getConfigurationFiles = function()
{
//	var self = this;

	return ['config.json'];
};

ControllerBrutefir.prototype.addToBrowseSources = function () {
	var self = this;
	var data = {name: 'Brutefir', uri: 'brutefir',plugin_type:'miscellanea',plugin_name:'brutefir'};
	self.commandRouter.volumioAddToBrowseSources(data);
};
ControllerBrutefir.prototype.getConfigParam = function (key) {
	//var self = this;
	return this.config.get(key);
};
ControllerBrutefir.prototype.getAdditionalConf = function (type, controller, data) {
	var self = this;
	return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
};

ControllerBrutefir.prototype.setAdditionalConf = function (type, controller, data) {
	var self = this;
	return self.commandRouter.executeOnPlugin(type, controller, 'setConfigParam', data);
};

ControllerBrutefir.prototype.getLabelForSelect = function (options, key) {
	var n = options.length;
	for (var i = 0; i < n; i++) {
		if (options[i].value == key)
			return options[i].label;
	}

	return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};


ControllerBrutefir.prototype.getConfigurationFiles = function()
{
	var self = this;

	return ['config.json'];
};

//ControllerBrutefir.prototype.addToBrowseSources = function () {
//	var self = this;
//	var data = {name: 'Brutefir', uri: 'brutefir',plugin_type:'miscellanea',plugin_name:'brutefir'};
//	self.commandRouter.volumioAddToBrowseSources(data);
//};

// Plugin methods -----------------------------------------------------------------------------
ControllerBrutefir.prototype.onStart = function() {
	var self = this;
};

ControllerBrutefir.prototype.onVolumioStart = function() {
	var self = this;

	var configFile=self.commandRouter.pluginManager.getConfigurationFile(self.context,'config.json');
	self.config = new (require('v-conf'))();
	self.config.loadFile(configFile);

	self.startBrutefirDaemon();
	setTimeout(function () {
	self.brutefirDaemonConnect();
	}, 5000);
};

ControllerBrutefir.prototype.startBrutefirDaemon = function() {
	var self = this;	
	exec("/usr/bin/brutefir", function (error, stdout, stderr) {
		if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while starting Brutefir: ' + error);
		}
		else {
			self.commandRouter.pushConsoleMessage('Brutefir Daemon Started');
		}
	});
};

ControllerBrutefir.prototype.brutefirDaemonConnect = function() {
	var self = this;
	// Here we send the command to brutfir via telnet
	self.servicename = 'brutefir';
	self.displayname = 'Brutefir';
	var coef31 = self.config.get('coef31');
	var coef63 = self.config.get('coef63');
	var coef125 = self.config.get('coef125');
	var coef250 = self.config.get('coef250');
	var coef500 = self.config.get('coef500');
	var coef1000 = self.config.get('coef1000');
	var coef2000 = self.config.get('coef2000');
	var coef4000 = self.config.get('coef4000');
	var coef8000 = self.config.get('coef8000');
	var coef16000 = self.config.get('coef16000');
	
	var params = {
	host: 'localhost',
	port: 3002,
	//shellPrompt: '/ # ',
	timeout: 35000,
	// removeEcho: 4
	};

	//here we compose the eq cmd
	var cmd = 'lmc eq 0 mag 31/'+ coef31+', 63/'+coef63 + ', 125/'+coef125 + ', 250/'+coef250+ ', 500/'+coef500 + ', 1000/'+coef1000 + ', 2000/'+coef2000 + ', 4000/'+coef4000 + ', 8000/'+coef8000 + ', 16000/'+coef16000;

	//here we send the cmd via telnet
	connection.on('ready', function(prompt) {
	connection.exec(cmd, function(err, response) {
	console.log(response);
	});
	});

	connection.on('timeout', function() {
	console.log('socket timeout!')
	connection.end();
	});

	connection.on('close', function() {
	console.log('connection closed');
	});
	connection.connect(params);
	
	//};
};


ControllerBrutefir.prototype.onStop = function() {
	var self = this;
	exec("killall brutefir", function (error, stdout, stderr) {

	});
};

ControllerBrutefir.prototype.onRestart = function() {
	var self = this;
	//
};

ControllerBrutefir.prototype.onInstall = function() {
	var self = this;
//	//Perform your installation tasks here
};

//ControllerBrutefir.prototype.onUninstall = function() {
//	var self = this;
	//Perform your installation tasks here
//};

ControllerBrutefir.prototype.getUIConfig = function() {
	var self = this;
	//var coef31 = self.config.get('coef31');
	var defer = libQ.defer();
	var value;
//var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');
	var uiconf = libFsExtra.readJsonSync(__dirname + '/UIConfig.json');
		var uiconf = libFsExtra.readJsonSync(__dirname + '/UIConfig.json');
	value = self.getAdditionalConf('miscellanea', 'brutefir', 'coef31');
	self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', value);
	self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[1].options'), value));	
//	uiconf.sections[0].content[2].value = config.get('magnitude');
//	uiconf.sections[0].content[0].value = config.get('coef31');
//	uiconf.sections[0].content[1].value = config.get('coef63');
//	uiconf.sections[0].content[2].value = config.get('coef125');
//	uiconf.sections[0].content[3].value = config.get('coef250');
//	uiconf.sections[0].content[4].value = config.get('coef500');
//	uiconf.sections[0].content[5].value = config.get('coef1000');
//	uiconf.sections[0].content[6].value = config.get('coef2000');
//	uiconf.sections[0].content[7].value= config.get('coef4000');
//	uiconf.sections[0].content[8].value = config.get('coef8000');
//	uiconf.sections[0].content[9].value = config.get('coef16000');
//	uiconf.sections[1].content[0].value = config.get('leftfilter');
//	uiconf.sections[1].content[1].value = config.get('rightfilter');
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[1].value',self.config.get('coef31'));
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[2].value',self.config.get('coef63'));
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[3].value',self.config.get('coef63'));
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[4].value',self.config.get('coef125'));
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[5].value',self.config.get('coef250'));
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[6].value',self.config.get('coef500'));
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[7].value',self.config.get('coef1000'));
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[8].value',self.config.get('coef2000'));
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[9].value',self.config.get('coef4000'));
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[10].value',self.config.get('coef8000'));
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[11].value',self.config.get('coef16000'));
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[12].value',self.config.get('leftfilter'))
//self.configManager.setUIConfigParam(uiconf,'sections[0].content[13].value',self.config.get('rightfilter'))

	return uiconf;
};

ControllerBrutefir.prototype.setUIConfig = function(data) {
	var self = this;
	var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');

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


ControllerBrutefir.prototype.createBrutefirFile = function () {
    var self = this;

    var defer=libQ.defer();


    try {

        fs.readFile(__dirname + "/brutefir.conf.tmpl", 'utf8', function (err, data) {
            if (err) {
                defer.reject(new Error(err));
                return console.log(err);
            }
		
		var conf1 = data.replace("${leftfilter}", config.get('leftfilter'));
            	var conf2 = conf1.replace("${rightfilter}", config.get('rightfilter'));

            fs.writeFile("/home/volumio/brutefir_config_essai", conf2, 'utf8', function (err) {
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

ControllerBrutefir.prototype.setConfigParam = function (data) {
	this.config.set(data.key, data.value);
};

ControllerBrutefir.prototype.saveBrutefirconfigAccount1 = function (data) {
    var self = this;
    var defer = libQ.defer();
	self.setConfigParam({key: 'coef31', value: data.coef31.value});
	self.setConfigParam({key: 'coef63', value: data.coef63.value});
	self.setConfigParam({key: 'coef125', value: data.coef125.value});
	self.setConfigParam({key: 'coef250', value: data.coef250.value});
	self.setConfigParam({key: 'coef500', value: data.coef500.value});
	self.setConfigParam({key: 'coef1000', value: data.coef1000.value});
	self.setConfigParam({key: 'coef2000', value: data.coef2000.value});
	self.setConfigParam({key: 'coef4000', value: data.coef4000.value});
	self.setConfigParam({key: 'coef8000', value: data.coef8000.value});
	self.setConfigParam({key: 'coef16000', value: data.coef16000.value});
	//self.setConfigParam({key: 'leftfilter', value: data.leftfilter.value});
	//self.setConfigParam({key: 'rightfilter', value: data.rightfilter.value});
//    config.set('coef31', data['coef31']);
//    config.set('coef63', data['coef63']);
//    config.set('coef125', data['coef125']);
//    config.set('coef250', data['coef250']);
//    config.set('coef500', data['coef500']);
//    config.set('coef1000', data['coef1000']);
//    config.set('coef2000', data['coef2000']);
//    config.set('coef4000', data['coef4000']);
//    config.set('coef8000', data['coef8000']);
//    config.set('coef16000', data['coef16000']);
//    config.set('leftfilter', data['leftfilter']);
//    config.set('rightfilter', data['rightfilter']);
    
//self.rebuildBRUTEFIRAndRestartDaemon()
//        .then(function(e){
//            self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
//            defer.resolve({});
//        })
//        .fail(function(e)
//        {
//            defer.reject(new Error());
//        })
self.logger.info('Equalizer configurations have been set');


	self.commandRouter.pushToastMessage('success', "Configuration update", 'Equalizer configuration has been successfully updated');

	defer.resolve({});
	this.updateEqualizerSettings();



    return defer.promise;

};

ControllerBrutefir.prototype.updateEqualizerSettings  = function () {
	var self = this;


	var coef31 = self.config.get('coef31');
	var coef63 = self.config.get('coef63');
	var coef125 = self.config.get('coef125');
	var coef250 = self.config.get('coef250');
	var coef500 = self.config.get('coef500');
	var coef1000 = self.config.get('coef1000');
	var coef2000 = self.config.get('coef2000');
	var coef4000 = self.config.get('coef4000');
	var coef8000 = self.config.get('coef8000');
	var coef16000 = self.config.get('coef16000');
	var settings = {
		coef31 : coef31,
		coef63 : coef63,	
		coef125 : coef125,	
		coef250 : coef250,	
		coef500 : coef500,	
		coef1000 : coef1000,	
		coef2000 : coef2000,	
		coef4000 : coef4000,	
		coef8000 : coef8000,
		coef16000 : coef16000		
	
	}

	return self.commandRouter.brutefirUpdateEqualizerSettings(settings)
};


ControllerBrutefir.prototype.saveBrutefirconfigAccount2 = function (data) {
    var self = this;

    var defer = libQ.defer();

    config.set('leftfilter', data['leftfilter']);
    config.set('rightfilter', data['rightfilter']);
    
self.rebuildBRUTEFIRAndRestartDaemon()
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


ControllerBrutefir.prototype.rebuildBRUTEFIRAndRestartDaemon = function () {
    var self=this;
    var defer=libQ.defer();

    self.createBrutefirFile()
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

