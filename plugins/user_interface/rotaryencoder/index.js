'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');

const detentActionType = Object.freeze({ "NO_ACTION": 0, "VOLUME": 1, "PREVNEXT": 2, "SEEK": 3, "SCROLL": 4 });
const buttonActionType = Object.freeze({ "NO_ACTION": 0, "PLAY": 1, "PAUSE": 2, "PLAYPAUSE": 3, "STOP": 4, "REPEAT": 5, "RANDOM": 6, "CLEARQUEUE": 7, "MUTE": 8, "UNMUTE": 9, "TOGGLEMUTE": 10, "SHUTDOWN": 11, "REBOOT": 12, "RESTARTAPP": 13, "DUMPLOG": 14 });

var rotaryEncoder = require('onoff-rotary');
var pressed;

module.exports = rotaryencoder;
function rotaryencoder(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
};

rotaryencoder.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context,'config.json');
	self.config = new (require('v-conf'))();
	self.config.loadFile(configFile);

    return libQ.resolve();
};

rotaryencoder.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();
	
	if(self.config.get('enable_debug_logging'))
		self.logger.info('[Rotary encoder] Loaded configuration: ' + JSON.stringify(self.config.data));
	
	if(self.config.get('first_encoder_CLK') !== undefined && self.config.get('first_encoder_CLK') !== 0 && self.config.get('first_encoder_DT') !== undefined && self.config.get('first_encoder_DT') !== 0)
		self.constructFirstEncoder();
	
	if(self.config.get('second_encoder_CLK') !== undefined && self.config.get('second_encoder_CLK') !== 0 && self.config.get('second_encoder_DT') !== undefined && self.config.get('second_encoder_DT') !== 0)
		self.constructSecondEncoder();
	
	// Once the Plugin has successfully started resolve the promise
	defer.resolve();

    return defer.promise;
};

rotaryencoder.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfully stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

rotaryencoder.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};

rotaryencoder.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};

// Configuration Methods -----------------------------------------------------------------------------

rotaryencoder.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');
	var encodingOpts = fs.readJsonSync((__dirname + '/options/encodingOptions.json'),  'utf8', {throws: false});
	var detentOpts = fs.readJsonSync((__dirname + '/options/detentOptions.json'),  'utf8', {throws: false});
	var buttonOpts = fs.readJsonSync((__dirname + '/options/buttonOptions.json'),  'utf8', {throws: false});
	
    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
			self.logger.info('Loading settings page...');
			
			// Global settings
			uiconf.sections[0].content[0].value = self.config.get('longPressThresholdInMilliseconds');
			self.logger.info("[Rotary encoder] 1/4 settings loaded");
			
			// First encoder
			uiconf.sections[1].content[0].value = self.config.get('first_encoder_CLK');
			uiconf.sections[1].content[1].value = self.config.get('first_encoder_DT');		
			uiconf.sections[1].content[2].value = self.config.get('first_encoder_SW');
		
			for (var n = 0; n < encodingOpts.encodings.length; n++)
			{
				self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[3].options', {
					value: encodingOpts.encodings[n].enc,
					label: encodingOpts.encodings[n].label
				});
				
				if(encodingOpts.encodings[n].enc == parseInt(self.config.get('first_encoder_encoding')))
				{
					uiconf.sections[1].content[3].value.value = encodingOpts.encodings[n].enc;
					uiconf.sections[1].content[3].value.label = encodingOpts.encodings[n].label;
				}
			}
			
			for (var n = 0; n < detentOpts.detentActionTypes.length; n++)
			{
				self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[4].options', {
					value: detentOpts.detentActionTypes[n].type,
					label: detentOpts.detentActionTypes[n].label
				});
				
				if(detentOpts.detentActionTypes[n].type == parseInt(self.config.get('first_encoder_detentActionType')))
				{
					uiconf.sections[1].content[4].value.value = detentOpts.detentActionTypes[n].type;
					uiconf.sections[1].content[4].value.label = detentOpts.detentActionTypes[n].label;
				}
			}
			
			for (var n = 0; n < buttonOpts.buttonActionTypes.length; n++)
			{
				self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[5].options', {
					value: buttonOpts.buttonActionTypes[n].type,
					label: buttonOpts.buttonActionTypes[n].label
				});
				self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[6].options', {
					value: buttonOpts.buttonActionTypes[n].type,
					label: buttonOpts.buttonActionTypes[n].label
				});
				
				if(buttonOpts.buttonActionTypes[n].type == parseInt(self.config.get('first_encoder_buttonActionType')))
				{
					uiconf.sections[1].content[5].value.value = buttonOpts.buttonActionTypes[n].type;
					uiconf.sections[1].content[5].value.label = buttonOpts.buttonActionTypes[n].label;
				}
				if(buttonOpts.buttonActionTypes[n].type == parseInt(self.config.get('first_encoder_longPressActionType')))
				{
					uiconf.sections[1].content[6].value.value = buttonOpts.buttonActionTypes[n].type;
					uiconf.sections[1].content[6].value.label = buttonOpts.buttonActionTypes[n].label;
				}
			}
			self.logger.info("[Rotary encoder] 2/4 settings loaded");
			
			// Second encoder
			uiconf.sections[2].content[0].value = self.config.get('second_encoder_CLK');
			uiconf.sections[2].content[1].value = self.config.get('second_encoder_DT');		
			uiconf.sections[2].content[2].value = self.config.get('second_encoder_SW');
		
			for (var n = 0; n < encodingOpts.encodings.length; n++)
			{
				self.configManager.pushUIConfigParam(uiconf, 'sections[2].content[3].options', {
					value: encodingOpts.encodings[n].enc,
					label: encodingOpts.encodings[n].label
				});
				
				if(encodingOpts.encodings[n].enc == parseInt(self.config.get('second_encoder_encoding')))
				{
					uiconf.sections[2].content[3].value.value = encodingOpts.encodings[n].enc;
					uiconf.sections[2].content[3].value.label = encodingOpts.encodings[n].label;
				}
			}
			
			for (var n = 0; n < detentOpts.detentActionTypes.length; n++)
			{
				self.configManager.pushUIConfigParam(uiconf, 'sections[2].content[4].options', {
					value: detentOpts.detentActionTypes[n].type,
					label: detentOpts.detentActionTypes[n].label
				});
				
				if(detentOpts.detentActionTypes[n].type == parseInt(self.config.get('second_encoder_detentActionType')))
				{
					uiconf.sections[2].content[4].value.value = detentOpts.detentActionTypes[n].type;
					uiconf.sections[2].content[4].value.label = detentOpts.detentActionTypes[n].label;
				}
			}
			
			for (var n = 0; n < buttonOpts.buttonActionTypes.length; n++)
			{
				self.configManager.pushUIConfigParam(uiconf, 'sections[2].content[5].options', {
					value: buttonOpts.buttonActionTypes[n].type,
					label: buttonOpts.buttonActionTypes[n].label
				});
				self.configManager.pushUIConfigParam(uiconf, 'sections[2].content[6].options', {
					value: buttonOpts.buttonActionTypes[n].type,
					label: buttonOpts.buttonActionTypes[n].label
				});
				
				if(buttonOpts.buttonActionTypes[n].type == parseInt(self.config.get('second_encoder_buttonActionType')))
				{
					uiconf.sections[2].content[5].value.value = buttonOpts.buttonActionTypes[n].type;
					uiconf.sections[2].content[5].value.label = buttonOpts.buttonActionTypes[n].label;
				}
				if(buttonOpts.buttonActionTypes[n].type == parseInt(self.config.get('second_encoder_longPressActionType')))
				{
					uiconf.sections[2].content[6].value.value = buttonOpts.buttonActionTypes[n].type;
					uiconf.sections[2].content[6].value.label = buttonOpts.buttonActionTypes[n].label;
				}
			}
			self.logger.info("[Rotary encoder] 3/4 settings loaded");
			
			uiconf.sections[3].content[0].value = self.config.get('enable_debug_logging');
			self.logger.info("[Rotary encoder] 4/4 settings loaded");

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};


rotaryencoder.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

rotaryencoder.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

rotaryencoder.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// Configuration ---------------------------------------------------------------------------------------
rotaryencoder.prototype.determineAPICommand = function(buttonAction) {
	switch(buttonAction)
	{
		case buttonActionType.PLAY:
			return 'play';
			break;
		case buttonActionType.PAUSE:
			return 'pause';
			break;
		case buttonActionType.PLAYPAUSE:
			return 'toggle';
			break;
		case buttonActionType.TOGGLEMUTE:
			return 'volume toggle';
			break;
		case buttonActionType.STOP:
			return 'stop';
			break;
		case buttonActionType.REPEAT:
			return 'repeat';
			break;
		case buttonActionType.RANDOM:
			return 'random';
			break;
		case buttonActionType.CLEARQUEUE:
			return 'clear';
			break;
		case buttonActionType.MUTE:
			return 'volume mute';
			break;
		case buttonActionType.UNMUTE:
			return 'volume unmute';
			break;
		case buttonActionType.SHUTDOWN:
			return 'volume unmute';
			break;
		case buttonActionType.REBOOT:
			return 'volume unmute';
			break;
		case buttonActionType.RESTARTAPP:
			return 'vrestart';
			break;
		case buttonActionType.DUMPLOG:
			return 'logdump';
			break;
	}
};

rotaryencoder.prototype.constructFirstEncoder = function ()
{
	var self = this;
	try
	{
		self.firstEncoder = rotaryEncoder(self.config.get('first_encoder_CLK'), self.config.get('first_encoder_DT'), self.config.get('first_encoder_SW'), self.config.get('first_encoder_encoding'));
	}
	catch (ex)
	{
		self.logger.info('[Rotary encoder] Could not initiate rotary encoder #1 with error: ' + ex);
	}
	
	self.firstEncoder.on('rotation', direction => {
		if (direction > 0) 
		{
			if(self.config.get('enable_debug_logging'))
				self.logger.info('[Rotary encoder] Encoder #1 rotated right');
							
			if(self.config.get('first_encoder_detentActionType') == detentActionType.NO_ACTION && !self.config.get('enable_debug_logging'))
				self.logger.info('[Rotary encoder] Encoder #1 rotated right');
			
			if(self.config.get('first_encoder_detentActionType') == detentActionType.VOLUME)
				self.executeCommand('volume plus');
			else if(self.config.get('first_encoder_detentActionType') == detentActionType.SEEK)
				self.executeCommand('seek plus');
			else if(self.config.get('first_encoder_detentActionType') == detentActionType.PREVNEXT)
				self.executeCommand('next');
			else if(self.config.get('first_encoder_detentActionType') == detentActionType.SCROLL)
				self.emitToSocket('scroll', 'down');
		}
		else
		{
			if(self.config.get('enable_debug_logging'))
				self.logger.info('[Rotary encoder] Encoder #1 rotated left');
			
			if(self.config.get('first_encoder_detentActionType') == detentActionType.NO_ACTION && !self.config.get('enable_debug_logging'))
				self.logger.info('[Rotary encoder] Encoder #1 rotated left');
			
			if(self.config.get('first_encoder_detentActionType') == detentActionType.VOLUME)
				self.executeCommand('volume minus');
			else if(self.config.get('first_encoder_detentActionType') == detentActionType.SEEK)
				self.executeCommand('seek minus');
			else if(self.config.get('first_encoder_detentActionType') == detentActionType.PREVNEXT)
				self.executeCommand('previous');
			else if(self.config.get('first_encoder_detentActionType') == detentActionType.SCROLL)
				self.emitToSocket('scroll', 'up');
		}
	});
	
	if(self.config.get('first_encoder_SW') !== 0)
	{
		self.firstEncoder.on('click', pressState => {				
			if(self.config.get('enable_debug_logging'))
					self.logger.info('[Rotary encoder] Encoder #1 button pressed; press state = ' + (pressState == 0 ? 'pressed' : 'released'));			
			
			var released;
			if(pressState == 1)
			{
				released = new Date();
				if((released - self.pressed) >= self.config.get('longPressThresholdInMilliseconds'))
				{
					if(self.config.get('first_encoder_longPressActionType') != buttonActionType.NO_ACTION)
					{
						if(self.config.get('first_encoder_longPressActionType') != buttonActionType.SHUTDOWN && self.config.get('first_encoder_longPressActionType') != buttonActionType.REBOOT)
							self.executeCommand(self.determineAPICommand(self.config.get('first_encoder_longPressActionType')));
						else
						{
							if(self.config.get('first_encoder_longPressActionType') == buttonActionType.SHUTDOWN)
								self.commandRouter.shutdown();
							else
								self.commandRouter.reboot();
						}
					}

					if(self.config.get('enable_debug_logging'))
						self.logger.info('[Rotary encoder] Long press detected');
				}
				else
				{
					if(self.config.get('first_encoder_buttonActionType') != buttonActionType.NO_ACTION)
					{
						if(self.config.get('first_encoder_buttonActionType') != buttonActionType.SHUTDOWN && self.config.get('first_encoder_buttonActionType') != buttonActionType.REBOOT)
							self.executeCommand(self.determineAPICommand(self.config.get('first_encoder_buttonActionType')));
						else
						{
							if(self.config.get('first_encoder_buttonActionType') == buttonActionType.SHUTDOWN)
								self.commandRouter.shutdown();
							else
								self.commandRouter.reboot();
						}
					}

					if(self.config.get('enable_debug_logging'))					
						self.logger.info('[Rotary encoder] Normal press detected');
				}
			}
			else
				self.pressed = new Date();
			
			if(self.config.get('enable_debug_logging') && released != undefined)
				self.logger.info('[Rotary encoder] Time passed (in milliseconds): ' + (released - self.pressed));
		});
	}
	
};

rotaryencoder.prototype.constructSecondEncoder = function ()
{
	var self = this;
	try
	{
		this.secondEncoder = rotaryEncoder(self.config.get('second_encoder_CLK'), self.config.get('second_encoder_DT'), self.config.get('second_encoder_SW'), self.config.get('second_encoder_encoding'));
	}
	catch (ex)
	{
		self.logger.info('[Rotary encoder] Could not initiate rotary encoder #2 with error: ' + ex);
	}
	
	this.secondEncoder.on('rotation', direction => {
		if (direction > 0) 
		{
			if(self.config.get('enable_debug_logging') == true)
				self.logger.info('[Rotary encoder] Encoder #2 rotated right');
			
			if(self.config.get('second_encoder_detentActionType') == detentActionType.NO_ACTION && !self.config.get('enable_debug_logging'))
				self.logger.info('[Rotary encoder] Encoder #2 rotated right');
				
			if(self.config.get('second_encoder_detentActionType') == detentActionType.VOLUME)
				self.executeCommand('volume plus');
			else if(self.config.get('second_encoder_detentActionType') == detentActionType.SEEK)
				self.executeCommand('seek plus');
			else if(self.config.get('second_encoder_detentActionType') == detentActionType.PREVNEXT)
				self.executeCommand('next');
			else if(self.config.get('second_encoder_detentActionType') == detentActionType.SCROLL)
				self.emitToSocket('scroll', 'down');
		}
		else
		{
			if(self.config.get('enable_debug_logging'))
				self.logger.info('[Rotary encoder] Encoder #2 rotated left');
			
			if(self.config.get('second_encoder_detentActionType') == detentActionType.NO_ACTION && !self.config.get('enable_debug_logging'))
				self.logger.info('[Rotary encoder] Encoder #2 rotated left');
				
			if(self.config.get('second_encoder_detentActionType') == detentActionType.VOLUME)
				self.executeCommand('volume minus');
			else if(self.config.get('second_encoder_detentActionType') == detentActionType.SEEK)
				self.executeCommand('seek minus');
			else if(self.config.get('second_encoder_detentActionType') == detentActionType.PREVNEXT)
				self.executeCommand('previous');
			else if(self.config.get('second_encoder_detentActionType') == detentActionType.SCROLL)
				self.emitToSocket('scroll', 'up');
		}
	});
	
	if(self.config.get('second_encoder_SW') !== 0)
	{
		self.secondEncoder.on('click', pressState => {				
			if(self.config.get('enable_debug_logging'))
					self.logger.info('[Rotary encoder] Encoder #2 button pressed; press state = ' + (pressState == 0 ? 'pressed' : 'released'));			
			
			var released;
			if(pressState == 1)
			{
				released = new Date();
				if((released - self.pressed) >= self.config.get('longPressThresholdInMilliseconds'))
				{
					if(self.config.get('second_encoder_longPressActionType') != buttonActionType.NO_ACTION)
					{
						if(self.config.get('second_encoder_longPressActionType') != buttonActionType.SHUTDOWN && self.config.get('second_encoder_longPressActionType') != buttonActionType.REBOOT)
							self.executeCommand(self.determineAPICommand(self.config.get('second_encoder_longPressActionType')));
						else
						{
							if(self.config.get('second_encoder_longPressActionType') == buttonActionType.SHUTDOWN)
								self.commandRouter.shutdown();
							else
								self.commandRouter.reboot();
						}
					}

					if(self.config.get('enable_debug_logging'))
						self.logger.info('[Rotary encoder] Long press detected');
				}
				else
				{
					if(self.config.get('second_encoder_buttonActionType') != buttonActionType.NO_ACTION)
					{
						if(self.config.get('second_encoder_buttonActionType') != buttonActionType.SHUTDOWN && self.config.get('second_encoder_buttonActionType') != buttonActionType.REBOOT)
							self.executeCommand(self.determineAPICommand(self.config.get('second_encoder_buttonActionType')));
						else
						{
							if(self.config.get('second_encoder_buttonActionType') == buttonActionType.SHUTDOWN)
								self.commandRouter.shutdown();
							else
								self.commandRouter.reboot();
						}
					}

					if(self.config.get('enable_debug_logging'))					
						self.logger.info('[Rotary encoder] Normal press detected');
				}
			}
			else
				self.pressed = new Date();
			
			if(self.config.get('enable_debug_logging') && released != undefined)
				self.logger.info('[Rotary encoder] Time passed (in milliseconds): ' + (released - self.pressed));
		});
	}
};

rotaryencoder.prototype.destroyFirstEncoder = function ()
{
	var self = this;
	var defer = libQ.defer();
	try
	{
		if(this.firstEncoder != undefined)
			this.firstEncoder.destroy();
		defer.resolve();
	}
	catch (ex)
	{
		self.logger.info('[Rotary encoder] Could not deinit rotary encoder #1 with error: ' + ex);
		defer.reject(new Error());
	}
	
	return defer.promise;
};

rotaryencoder.prototype.destroySecondEncoder = function ()
{
	var self = this;
	var defer = libQ.defer();
	try
	{
		if(this.secondEncoder != undefined)
			this.secondEncoder.destroy();
		defer.resolve();
	}
	catch (ex)
	{
		self.logger.info('[Rotary encoder] Could not deinit rotary encoder #2 with error: ' + ex);
		defer.reject(new Error());
	}
	
	return defer.promise;
};

rotaryencoder.prototype.executeCommand = function (cmd)
{
	var self = this;
	var defer = libQ.defer();
	var command = '/usr/local/bin/volumio ' + cmd;
	
	if(self.config.get('enable_debug_logging'))
			self.logger.info('[Rotary encoder] Executing command: ' + command);
	
	exec(command, {uid:1000, gid:1000}, function (error, stout, stderr) {		
		if(error)
			self.logger.error(stderr);
		
		defer.resolve();
	});
	
	return defer.promise;
};

rotaryencoder.prototype.emitToSocket = function (message, value)
{
	var self = this;
	var defer = libQ.defer();
	
	if(self.config.get('enable_debug_logging'))
			self.logger.info('[Rotary encoder] Emmiting to socket: ' + message + ' ' + value);

	socket.emit(message, value);
	defer.resolve();

	return defer.promise;
};

rotaryencoder.prototype.updateGlobalSettings = function (data)
{
	var self = this;
	var defer = libQ.defer();

	self.config.set('longPressThresholdInMilliseconds', data['longPressThresholdInMilliseconds']);
	defer.resolve();
	
	self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved global settings.");

	return defer.promise;
};

rotaryencoder.prototype.updateFirstEncoder = function (data)
{
	var self = this;
	var defer = libQ.defer();

	self.destroyFirstEncoder()
	.then(function(updateConf)
	{
		self.config.set('first_encoder_CLK', parseInt(data['first_encoder_CLK']));
		self.config.set('first_encoder_DT', parseInt(data['first_encoder_DT']));
		self.config.set('first_encoder_SW', parseInt(data['first_encoder_SW']));
		self.config.set('first_encoder_encoding', parseInt(data['first_encoder_encoding'].value));
		self.config.set('first_encoder_detentActionType', parseInt(data['first_encoder_detentActionType'].value));
		self.config.set('first_encoder_buttonActionType', parseInt(data['first_encoder_buttonActionType'].value));
		self.config.set('first_encoder_longPressActionType', parseInt(data['first_encoder_longPressActionType'].value));
		defer.resolve(updateConf);
	})
	.then(function(rebuild)
	{
		self.constructFirstEncoder();
		defer.resolve(rebuild);
	})
	.fail(function()
	{
		defer.reject(new Error());
	});
	
	if(self.config.get('enable_debug_logging'))
		self.logger.info('[Rotary encoder] Saved configuration for encoder #1, data: ' + JSON.stringify(data));
	self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved first encoder settings.");

	return defer.promise;
};

rotaryencoder.prototype.updateSecondEncoder = function (data)
{
	var self = this;
	var defer = libQ.defer();

	self.destroySecondEncoder()
	.then(function(updateConf)
	{
		self.config.set('second_encoder_CLK', parseInt(data['second_encoder_CLK']));
		self.config.set('second_encoder_DT', parseInt(data['second_encoder_DT']));
		self.config.set('second_encoder_SW', parseInt(data['second_encoder_SW']));
		self.config.set('second_encoder_encoding', parseInt(data['second_encoder_encoding'].value));
		self.config.set('second_encoder_detentActionType', parseInt(data['second_encoder_detentActionType'].value));
		self.config.set('second_encoder_buttonActionType', parseInt(data['second_encoder_buttonActionType'].value));
		self.config.set('second_encoder_longPressActionType', parseInt(data['second_encoder_longPressActionType'].value));
		defer.resolve(updateConf);
	})
	.then(function(rebuild)
	{
		self.constructSecondEncoder();
		defer.resolve(rebuild);
	})
	.fail(function()
	{
		defer.reject(new Error());
	});
	
	if(self.config.get('enable_debug_logging'))
		self.logger.info('[Rotary encoder] Saved configuration for encoder #2, data: ' + JSON.stringify(data));
	self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved second encoder settings.");

	return defer.promise;
};

rotaryencoder.prototype.updateDebugSettings = function (data)
{
	var self = this;
	var defer = libQ.defer();

	self.config.set('enable_debug_logging', data['enable_debug_logging']);
	defer.resolve();
	
	self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved debug settings.");

	return defer.promise;
};