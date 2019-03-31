'use strict';
// test in /home/volumio/volumio-plugins/plugins/system_controller/rpi_gpio_action_buttons
// volumio vrestart
// volumio plugin refresh
// sudo journalctl -f


var libQ = require('kew');
//var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var Gpio = require('onoff').Gpio;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var switches = ["SW1", "SW2", "SW3", "SW4", "SW5", "SW6", "SW7"];
//var swval = [1,1,1,1,1,1,1];

module.exports = rpiGpioActionButtons;
function rpiGpioActionButtons(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
	this.triggers = [];

}

rpiGpioActionButtons.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=self.commandRouter.pluginManager.getConfigurationFile(self.context,'config.json');
	self.config = new (require('v-conf'))();
	self.config.loadFile(configFile);
	self.logger.info('RPI-GPIO-Buttons config from: '+configFile);
    return libQ.resolve();
}

rpiGpioActionButtons.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};

rpiGpioActionButtons.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();
	// Once the Plugin has successfull started resolve the promise
	self.createTriggers()
		.then (function (result) {
			self.logger.info("GPIO-Buttons started");
			defer.resolve();
		});

    return defer.promise;
};

rpiGpioActionButtons.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();
    // Once the Plugin has successfull stopped resolve the promise

	self.clearTriggers()
		.then (function (result) {
			self.logger.info("GPIO-Buttons stopped");
			defer.resolve();
		});

    //return libQ.resolve();
	return defer.promise;
};

rpiGpioActionButtons.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

rpiGpioActionButtons.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    //var lang_code = this.commandRouter.sharedVars.get('language_code');
	var lang_code = 'en';

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
//-- modify uiconfig

			var i = 0;
			var j = 0;
			var fs = require('fs');
			var content = fs.readFileSync('/data/favourites/my-web-radio');
			var webradios = JSON.parse(content);

			switches.forEach(function(action, index, array) {
 				// Strings for config
				var c1 = action.concat('.enabled'); // c1=SW1.enabled
				var c2 = action.concat('.pin');
				var c3 = action.concat('.value');

				uiconf.sections[0].content[3*i].value = self.config.get(c1);
				uiconf.sections[0].content[3*i+1].value.value = self.config.get(c2);
				uiconf.sections[0].content[3*i+1].value.label = self.config.get(c2).toString();
				var s7=self.config.get(c3);
				if (s7.service=="webradio") var vis='Play '+s7.service+': '+s7.name;
				else var vis=s7.service+' '+s7.name;
				uiconf.sections[0].content[3*i+2].value.value = self.config.get(c3);
				uiconf.sections[0].content[3*i+2].value.label = vis;
				// create options. GPIO 2-27
				for (j=2;j<28;j++) uiconf.sections[0].content[3*i+1].options[j-2]={"value": j,"label": j.toString()};

				j=0;
				uiconf.sections[0].content[3*i+2].options[j]={"value":{"service": "volumio", "name": "stop", "uri": ""},"label": "Volumio stop"}; j++;
				uiconf.sections[0].content[3*i+2].options[j]={"value":{"service": "volumio", "name": "play", "uri": ""},"label": "Volumio play"}; j++;
				uiconf.sections[0].content[3*i+2].options[j]={"value":{"service": "volumio", "name": "mute", "uri": ""},"label": "Volumio mute"}; j++;
				uiconf.sections[0].content[3*i+2].options[j]={"value":{"service": "volumio", "name": "unmute", "uri": ""},"label": "Volumio unmute"}; j++;
				uiconf.sections[0].content[3*i+2].options[j]={"value":{"service": "volumio", "name": "muteUnmute", "uri": ""},"label": "Volumio toggle mute/unmute"}; j++;
				uiconf.sections[0].content[3*i+2].options[j]={"value":{"service": "volumio", "name": "pausePlay", "uri": ""},"label": "Volumio toggle pause/play"}; j++;
				uiconf.sections[0].content[3*i+2].options[j]={"value":{"service": "volumio", "name": "volumeUp", "uri": ""},"label": "Volumio volumeUp"}; j++;
				uiconf.sections[0].content[3*i+2].options[j]={"value":{"service": "volumio", "name": "volumeDown", "uri": ""},"label": "Volumio volumeDown"}; j++;
				uiconf.sections[0].content[3*i+2].options[j]={"value":{"service": "volumio", "name": "shutdown", "uri": ""},"label": "Volumio shutdown"}; j++;

				webradios.forEach(function(action, index, array) {
					var rlabel='Play webradio: '+action.name;
					uiconf.sections[0].content[3*i+2].options[j]={"value":{"service": action.service, "name": action.name, "uri": action.uri},"label": rlabel};	j++;
				});
				
				i = i + 1;
			});

//-- end modify

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

rpiGpioActionButtons.prototype.saveConfig = function(data) {
	var self = this;

	switches.forEach(function(action, index, array) {
 		// Strings for data fields
		var s1 = action.concat('Enabled');
		var s2 = action.concat('Pin');
		var s3 = action.concat('usage');

		// Strings for config
		var c1 = action.concat('.enabled');
		var c2 = action.concat('.pin');
		var c3 = action.concat('.value');
		
		var d1=data[s1];
		var d2=data[s2]['value'];
		var d3=data[s3]['value'];
		
		self.config.set(c1, d1);
		self.config.set(c2, d2);
		self.config.set(c3, d3);
		
		//var s10=d3.service;
		//var s11=d3.name;
		//var s12=d3.uri;
		//var s13=JSON.stringify(d3);
		//self.logger.info('RPI-GPIO-Buttons-s: '+d1+' '+d2+' '+s10+' '+s11+' '+s12+' - '+s13);
	});

	self.clearTriggers()
		.then(self.createTriggers());

	self.commandRouter.pushToastMessage('success',"RPI-GPIO-Buttons", "Configuration saved");
};

rpiGpioActionButtons.prototype.createTriggers = function() {
	var self = this;

	self.logger.info('RPI-GPIO-Buttons. Reading config and creating triggers...');

	switches.forEach(function(action, index, array) {
		var c1 = action.concat('.enabled');
		var enabled = self.config.get(c1);

		if(enabled === true){
			var c2 = action.concat('.pin');
			var pin = self.config.get(c2);
			//var c3 = action.concat('.value');
			//var s7=self.config.get(c3);
			//var vis=s7.service+' '+s7.name;
			//self.logger.info('RPI-GPIO-Buttons: '+ action + ' on GPIO' + pin+' S: '+vis+' index='+index);
			
			var jj = new Gpio(pin,'in','falling', {debounceTimeout: 200}); // 
			jj.watch(self.listener.bind(self,index+1));
			self.triggers.push(jj);
		}
	});
		
	return libQ.resolve();
};


rpiGpioActionButtons.prototype.clearTriggers = function () {
	var self = this;
	self.logger.info("RPI-GPIO-Buttons: Destroying triggers:");
	self.triggers.forEach(function(trigger, index, array) {
  		//self.logger.info("RPI-GPIO-Buttons: Destroying trigger " + index);
		trigger.unwatchAll();
		trigger.unexport();		

	});
	
	self.triggers = [];

	return libQ.resolve();	
};

rpiGpioActionButtons.prototype.listener = function(action,err,value){
	var self = this;
	//self.logger.info('RPI-GPIO-Buttons SW'+action+' Err: '+err+' Value: '+value);
	var c3 = 'SW'+action+'.value';
	var s7=self.config.get(c3);
	if (s7.service == "volumio") { 
		self.logger.info('RPI-GPIO-Buttons '+s7.name);
		switch (s7.name) {
			case 'stop':		socket.emit('getState','');
								socket.once('pushState', function (state) {
									if(state.status=='play') { socket.emit('stop');	}
								});	break;
			case 'volumeDown':	socket.emit('volume','-'); break;
			case 'volumeUp':	socket.emit('volume','+'); break;
			case 'mute':		socket.emit('mute'); break;
			case 'unmute':		socket.emit('unmute'); break;
			case 'play':		socket.emit('play'); break;
			case 'pause':		socket.emit('getState','');
								socket.once('pushState', function (state) {
									if(state.status=='play' && state.service=='webradio'){ socket.emit('stop'); } 
									else if (state.status=='play') { socket.emit('pause'); }			
								}); break;
			case 'muteUnmute':	socket.emit('getState','');
								socket.once('pushState', function (state) {
									if (state.status=='mute') { socket.emit('unmute'); }
									else { socket.emit('mute'); }
								}); break;
			case 'pausePlay':	socket.emit('getState','');
								socket.once('pushState', function (state) {
									if(state.status=='play' && state.service=='webradio') { socket.emit('stop'); } 
									else if(state.status=='play') { socket.emit('pause'); } else socket.emit('play');
								}); break;
			case 'shutdown':	this.commandRouter.shutdown(); break;
			default:			self.commandRouter.pushToastMessage('error',"RPI-GPIO-Buttons", 'Unknown command: '+s7.name);
		}
	}
	else { // play webradio
		self.logger.info('RPI-GPIO-Buttons addplay'+s7.uri);
		socket.emit('clearQueue');
		socket.emit('addPlay', s7);
	}
};


rpiGpioActionButtons.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

rpiGpioActionButtons.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

rpiGpioActionButtons.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};



//-------------------------------------------------------------------------------------------------------

