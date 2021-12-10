'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
const path=require('path');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn

const Gpio = require('onoff').Gpio;
const io = require('socket.io-client');
const dtoverlayRegex = /^([0-9]+):\s+rotary-encoder\s+pin_a=([0-9]+) pin_b=([0-9]+).*$/gm

const maxRotaries = 3;

const rotaryTypes = new Array(
	"...",
	"1/1",
	"1/2",
	"...",
	"1/4"
);

const dialActions = new Array(
	"DOTS",
	"VOLUME",
	"SKIP",
	"SEEK",
	"EMIT",
	"SCROLL"	
);

const btnActions = new Array(
	"DOTS",
	"PLAY",
	"PAUSE",
	"PLAYPAUSE",
	"STOP",
	"REPEAT",
	"RANDOM",
	"CLEARQUEUE",
	"MUTE",
	"UNMUTE",
	"TOGGLEMUTE",
	"SHUTDOWN",
	"REBOOT",
	"EMIT",
);

module.exports = rotaryencoder2;
function rotaryencoder2(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
}



rotaryencoder2.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

rotaryencoder2.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();
	
	self.debugLogging = (self.config.get('logging')==true);
	self.handles=[].fill(null,0,maxRotaries);
	self.buttons=[].fill(null,0,maxRotaries);
	self.pushDownTime=[].fill(0,0,maxRotaries);
	self.status=null;
	self.loadI18nStrings();

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] onStart: Config loaded: ' + JSON.stringify(self.config));

	self.socket = io.connect('http://localhost:3000');
	self.socket.emit('getState');
	self.socket.on('pushState',function(data){
		self.status = data;
		self.lastTime = data.seek - Date.now();
	})

	self.activateRotaries([...Array(maxRotaries).keys()])
	.then(_=>{
		return self.activateButtons([...Array(maxRotaries).keys()])
	})
	.then(_=> {
		self.commandRouter.pushToastMessage('success',"Rotary Encoder II - successfully loaded")
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] onStart: Plugin successfully started.');				
		defer.resolve();				
	})
	.fail(error => {
		self.commandRouter.pushToastMessage('error',"Rotary Encoder II", self.getI18nString('ROTARYENCODER2.TOAST_START_FAIL'))
		self.logger.error('[ROTARYENCODER2] onStart: Rotarys not initialized: '+error);
		defer.reject();
	});

    return defer.promise;
};

rotaryencoder2.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] onStop: Stopping Plugin.');

	self.deactivateRotaries([...Array(maxRotaries).keys()])
	.then(_=>{
		return self.deactivateButtons([...Array(maxRotaries).keys()])
	})
	.then(_=> {
		self.socket.off('pushState');
		self.socket.disconnect();
	})
	.then(_=>{
		self.commandRouter.pushToastMessage('success',"Rotary Encoder II", self.getI18nString('ROTARYENCODER2.TOAST_STOP_SUCCESS'))
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] onStop: Plugin successfully stopped.');				
		defer.resolve();	
	})
	.fail(err=>{
		self.commandRouter.pushToastMessage('success',"Rotary Encoder II", self.getI18nString('ROTARYENCODER2.TOAST_STOP_FAIL'))
		self.logger.error('[ROTARYENCODER2] onStop: Failed to cleanly stop plugin.'+err);				
		defer.reject();	
	})
    return defer.promise;
};

rotaryencoder2.prototype.onRestart = function() {
    var self = this;
    var defer=libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] onRestart: free resources');
};


// Configuration Methods -----------------------------------------------------------------------------

rotaryencoder2.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] getUIConfig: starting: ');
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] getUIConfig: i18nStrings'+JSON.stringify(self.i18nStrings));
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] getUIConfig: i18nStringsDefaults'+JSON.stringify(self.i18nStringsDefaults));

    var lang_code = this.commandRouter.sharedVars.get('language_code');

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] getUIConfig: language code: ' + lang_code + ' dir: ' + __dirname);

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
			//Settings for rotaries
			for (let i = 0; i < maxRotaries; i++) {
				uiconf.sections[i].content[0].value = (self.config.get('enabled' + i)==true)
				uiconf.sections[i].content[1].value.value = self.config.get('rotaryType' + i) | 0;
				uiconf.sections[i].content[1].value.label = rotaryTypes[parseInt(self.config.get('rotaryType' + i))|0];
				uiconf.sections[i].content[2].value = parseInt(self.config.get('pinA' + i)) | 0;
				uiconf.sections[i].content[3].value = parseInt(self.config.get('pinB' + i)) | 0;
				uiconf.sections[i].content[4].value.value = self.config.get('dialAction' + i) | 0;
				uiconf.sections[i].content[4].value.label = self.getI18nString('ROTARYENCODER2.'+dialActions[parseInt(self.config.get('dialAction' + i))|0]);
				uiconf.sections[i].content[5].value = self.config.get('socketCmdCCW' + i);
				uiconf.sections[i].content[6].value = self.config.get('socketDataCCW' + i);
				uiconf.sections[i].content[7].value = self.config.get('socketCmdCW' + i);
				uiconf.sections[i].content[8].value = self.config.get('socketDataCW' + i);
				uiconf.sections[i].content[9].value = parseInt(self.config.get('pinPush' + i)) | 0;
				uiconf.sections[i].content[10].value = parseInt(self.config.get('pinPushDebounce' + i)) | 0;
				uiconf.sections[i].content[11].value = (self.config.get('pushState' + i)==true)
				uiconf.sections[i].content[12].value.value = self.config.get('pushAction' + i) | 0;
				uiconf.sections[i].content[12].value.label = self.getI18nString('ROTARYENCODER2.'+btnActions[parseInt(self.config.get('pushAction' + i))|0]);
				uiconf.sections[i].content[13].value = self.config.get('socketCmdPush' + i);
				uiconf.sections[i].content[14].value = self.config.get('socketDataPush' + i);
				uiconf.sections[i].content[15].value.value = self.config.get('longPushAction' + i) | 0;
				uiconf.sections[i].content[15].value.label = self.getI18nString('ROTARYENCODER2.'+btnActions[parseInt(self.config.get('longPushAction' + i))|0]);
				uiconf.sections[i].content[16].value = self.config.get('socketCmdLongPush' + i);
				uiconf.sections[i].content[17].value = self.config.get('socketDataLongPush' + i);	
			}
			//logging section
			uiconf.sections[maxRotaries].content[0].value = (self.config.get('logging')==true)
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

rotaryencoder2.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

 
//Gets called when user saves settings from the GUI
rotaryencoder2.prototype.updateEncoder = function(data){
	var self = this;
	var defer = libQ.defer();
	var dataString = JSON.stringify(data);

	var rotaryIndex = parseInt(dataString.match(/rotaryType([0-9])/)[1]);
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] updateEncoder: Rotary'+(rotaryIndex + 1)+' with:' + JSON.stringify(data));

	self.sanityCheckSettings(rotaryIndex, data)
	.then(_ => {
		//disable all rotaries before we make changes
		//this is necessary, since there seems to be an issue in the Kernel, that breaks the 
		//eventHandlers if a dtoverlay with low index is removed and others with higher index exist
		return self.deactivateRotaries([...Array(maxRotaries).keys()])
		.then(_=>{
			return self.deactivateButtons([...Array(maxRotaries).keys()])
		})
	})
	.then(_ => {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] updateEncoder: Changing Encoder '+(rotaryIndex + 1)+' Settings to new values');
		if (data['enabled'+rotaryIndex]==true) {
			self.config.set('rotaryType'+rotaryIndex, (data['rotaryType'+rotaryIndex].value));
			self.config.set('pinA'+rotaryIndex, (data['pinA'+rotaryIndex]));
			self.config.set('pinB'+rotaryIndex, (data['pinB'+rotaryIndex]));
			self.config.set('dialAction'+rotaryIndex, (data['dialAction'+rotaryIndex].value));
			self.config.set('socketCmdCCW'+rotaryIndex, (data['socketCmdCCW'+rotaryIndex]));
			self.config.set('socketDataCCW'+rotaryIndex, (data['socketDataCCW'+rotaryIndex]));
			self.config.set('socketCmdCW'+rotaryIndex, (data['socketCmdCW'+rotaryIndex]));
			self.config.set('socketDataCW'+rotaryIndex, (data['socketDataCW'+rotaryIndex]));
			self.config.set('pinPush'+rotaryIndex, (data['pinPush'+rotaryIndex]));
			self.config.set('pinPushDebounce'+rotaryIndex, (data['pinPushDebounce'+rotaryIndex]));
			self.config.set('pushState'+rotaryIndex,(data['pushState'+rotaryIndex]))
			self.config.set('pushAction'+rotaryIndex, (data['pushAction'+rotaryIndex].value));
			self.config.set('socketCmdPush'+rotaryIndex, (data['socketCmdPush'+rotaryIndex]));
			self.config.set('socketDataPush'+rotaryIndex, (data['socketDataPush'+rotaryIndex]));
			self.config.set('longPushAction'+rotaryIndex, (data['longPushAction'+rotaryIndex].value));
			self.config.set('socketCmdLongPush'+rotaryIndex, (data['socketCmdLongPush'+rotaryIndex]));
			self.config.set('socketDataLongPush'+rotaryIndex, (data['socketDataLongPush'+rotaryIndex]));
			self.config.set('enabled'+rotaryIndex, true);	
		} else {
			self.config.set('enabled'+rotaryIndex, false);
		}
		return self.activateRotaries([...Array(maxRotaries).keys()])
		.then(_=>{
			return self.activateButtons([...Array(maxRotaries).keys()])
		})
	})
	.then(_ => {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] updateEncoder: SUCCESS with Toast: '+self.getI18nString('ROTARYENCODER2.TOAST_SAVE_SUCCESS')+' ' +self.getI18nString('ROTARYENCODER2.TOAST_MSG_SAVE')+ (rotaryIndex + 1));
		self.commandRouter.pushToastMessage('success', self.getI18nString('ROTARYENCODER2.TOAST_SAVE_SUCCESS'), self.getI18nString('ROTARYENCODER2.TOAST_MSG_SAVE')+ (rotaryIndex + 1));
		defer.resolve();	
	})
	.fail(err => {
		self.commandRouter.pushToastMessage('error', self.getI18nString('ROTARYENCODER2.TOAST_SAVE_FAIL'), self.getI18nString('ROTARYENCODER2.TOAST_MSG_SAVE')+ (rotaryIndex + 1));
		defer.reject(err);
	})
	return defer.promise;

}

//Checks if the user settings in the GUI make sense
rotaryencoder2.prototype.sanityCheckSettings = function(rotaryIndex, data){
	var self = this;
	var defer = libQ.defer();
	var newPins = [];
	var otherPins = [];
	var allPins = [];

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] sanityCheckSettings: Rotary'+(rotaryIndex + 1)+' for:' + JSON.stringify(data));

	//Disabling rotaries is always allowed
	if (data['enabled'+rotaryIndex] == false) {
		if (self.config.get('enabled'+rotaryIndex) == true) {
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] sanityCheckSettings: Disabling rotary ' + (rotaryIndex+1) +' is OK.' );
			defer.resolve();	
		} else {
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] sanityCheckSettings: Rotary ' + (rotaryIndex+1) +' was already disabled, nothing to do.' );
			defer.resolve();	
		} 
	} else {
		if (data['pinPush'+rotaryIndex] == '') {
			data['pinPush'+rotaryIndex] = '0' //if pinPush is empty, set it to 0 (disabled)
		}
		//check if GPIO pins are integer
		if (!Number.isInteger(parseInt(data['pinA'+rotaryIndex])) || !Number.isInteger(parseInt(data['pinB'+rotaryIndex])) || !Number.isInteger(parseInt(data['pinPush'+rotaryIndex]))) {
			self.commandRouter.pushToastMessage('error', self.getI18nString('ROTARYENCODER2.TOAST_WRONG_PARAMETER'), self.getI18nString('ROTARYENCODER2.TOAST_NEEDS_INTEGER'));
			if (self.debugLogging) self.logger.error('[ROTARYENCODER2] sanityCheckSettings: Pin values must be Integer ' );
			defer.reject('Pin value must be integer.');
		} else { 
			newPins.push(parseInt(data['pinA'+rotaryIndex]));
			newPins.push(parseInt(data['pinB'+rotaryIndex]));
			if (data['pinPush'+rotaryIndex] > 0) {
				newPins.push(parseInt(data['pinPush'+rotaryIndex]));
			}
			for (let i = 0; i < maxRotaries; i++) {
				if ((!i==rotaryIndex) && (this.config.get('enabled'+i))) {
					otherPins.push(parseInt(this.config.get('pinA'+i)));
					otherPins.push(parseInt(this.config.get('pinB'+i)));
					otherPins.push(parseInt(this.config.get('pinPush'+i)));
				}
			}
			//check if duplicate number used
			if (newPins.some((item,index) => newPins.indexOf(item) != index)) {
				self.commandRouter.pushToastMessage('error', self.getI18nString('ROTARYENCODER2.TOAST_WRONG_PARAMETER'), self.getI18nString('ROTARYENCODER2.TOAST_PINS_DIFFERENT'));
				self.logger.error('[ROTARYENCODER2] sanityCheckSettings: duplicate pins. new: ' + newPins );
				defer.reject('Duplicate pin numbers provided.');
			} else {
				//check if any of the numbers used is also used in another active rotary
				allPins = [...otherPins, ...newPins];
				if (allPins.some((item,index) => allPins.indexOf(item) != index)) {
					self.commandRouter.pushToastMessage('error', self.getI18nString('ROTARYENCODER2.TOAST_WRONG_PARAMETER'), self.getI18nString('ROTARYENCODER2.TOAST_PINS_BLOCKED'));
					self.logger.error('[ROTARYENCODER2] sanityCheckSettings: Pin(s) used in other rotary already.');
					defer.reject('One or more pins already used in other rotary.')
				} else {
					//check if Rotary Type is selected
					if (![1,2,4].includes(data['rotaryType'+rotaryIndex].value)) {
						self.commandRouter.pushToastMessage('error', self.getI18nString('ROTARYENCODER2.TOAST_WRONG_PARAMETER'), self.getI18nString('ROTARYENCODER2.TOAST_NO_TYPE'));
						self.logger.error('[ROTARYENCODER2] sanityCheckSettings: Periods per tick not set.');
						defer.reject('Must select periods per tick.')
					} else {		
						data['pinPushDebounce'+rotaryIndex] = Math.max(0,data['pinPushDebounce'+rotaryIndex]);
						data['pinPushDebounce'+rotaryIndex] = Math.min(1000,data['pinPushDebounce'+rotaryIndex]);
						defer.resolve('pass');	
					}
				}		
			}
		}				
	}
	return defer.promise;
}

//Gets called when user changes and saves debug settings
rotaryencoder2.prototype.updateDebugSettings = function (data) {
	var self = this;
	var defer = libQ.defer();
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] updateDebugSettings: Saving Debug Settings:' + JSON.stringify(data));
	self.config.set('logging', (data['logging']))
	self.debugLogging = data['logging'];
	defer.resolve();
	self.commandRouter.pushToastMessage('success', self.getI18nString('ROTARYENCODER2.TOAST_SAVE_SUCCESS'), self.getI18nString('ROTARYENCODER2.TOAST_DEBUG_SAVE'));
	return defer.promise;
};

rotaryencoder2.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

rotaryencoder2.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

rotaryencoder2.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

//Function to recursively activate all rotaries that are passed by Index in an Array
rotaryencoder2.prototype.activateRotaries = function (rotaryIndexArray) {
	var self = this;
	var defer = libQ.defer();
	var rotaryIndex;

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] activateRotaries: ' + rotaryIndexArray.map(i =>  {return i + 1}));

	if (Array.isArray(rotaryIndexArray)){
		if (rotaryIndexArray.length > 0) {
			rotaryIndex = rotaryIndexArray[rotaryIndexArray.length - 1];
			return self.activateRotaries(rotaryIndexArray.slice(0,rotaryIndexArray.length - 1))
			.then(_=> {
				if (self.config.get('enabled'+rotaryIndex)) {
					return self.addOverlay(self.config.get('pinA'+rotaryIndex),self.config.get('pinB'+rotaryIndex),self.config.get('rotaryType'+rotaryIndex))
					.then(_=>{
						return self.attachListener(self.config.get('pinA'+rotaryIndex));
					})
					.then(handle => {
						return self.addEventHandle(handle, rotaryIndex)
					})								
				} else {
					return defer.resolve();
				}
			})
		} else {
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] activateRotaries: end of recursion.');
			defer.resolve();
		}
	} else {
		self.logger.error('[ROTARYENCODER2] activateRotaries: rotaryIndexArray must be an Array');
		defer.reject('rotaryIndexArray must be an Array of integers')
	} 
	return defer.promise;
}

//Function to recursively deactivate all rotaries that are passed by Index in an Array
rotaryencoder2.prototype.deactivateRotaries = function (rotaryIndexArray) {
	var self = this;
	var defer = libQ.defer();
	var rotaryIndex;

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] deactivateRotaries: ' + rotaryIndexArray.map(i =>  {return i + 1}));

	if (Array.isArray(rotaryIndexArray)){
		if (rotaryIndexArray.length > 0) {
			rotaryIndex = rotaryIndexArray[0];
			self.deactivateRotaries(rotaryIndexArray.slice(1,rotaryIndexArray.length))
			.then(_=> {
				if (self.config.get('enabled'+rotaryIndex)) {
					return self.detachListener(self.handles[rotaryIndex])
					.then(_=>{ return self.checkOverlayExists(rotaryIndex)})
					.then(idx=>{if (idx > -1) return self.removeOverlay(idx)})
					.then(_=>{
						if (self.debugLogging) self.logger.info('[ROTARYENCODER2] deactivateRotaries: deactivated rotary' + (rotaryIndex + 1));
						return defer.resolve();
					})												
				} else {
					return defer.resolve()
				}
			})
		} else {
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] deactivateRotaries: end of recursion.');
			defer.resolve();
		}
	} else {
		self.logger.error('[ROTARYENCODER2] deactivateRotaries: rotaryIndexArray must be an Array: ' + rotaryIndexArray);
		defer.reject('rotaryIndexArray must be an Array of integers')
	} 
	return defer.promise;
}

rotaryencoder2.prototype.activateButtons = function (rotaryIndexArray) {
	var self = this;
	var defer = libQ.defer();
	var rotaryIndex;

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] activateButtons: ' + rotaryIndexArray.map(i =>  {return i + 1}));

	if (Array.isArray(rotaryIndexArray)){
		if (rotaryIndexArray.length > 0) {
			rotaryIndex = rotaryIndexArray[rotaryIndexArray.length - 1];
			self.activateButtons(rotaryIndexArray.slice(0,rotaryIndexArray.length - 1))
			.then(_=> {
				if (self.config.get('enabled'+rotaryIndex)) {
					var gpio = self.config.get('pinPush'+rotaryIndex);
					//configure pushButton if not disabled
					if (Number.isInteger(gpio) && (gpio > 0)) {
						gpio = parseInt(gpio);
						var debounce = self.config.get('pinPushDebounce'+rotaryIndex);
						if (!Number.isInteger(debounce)){
							debounce = 0
						} else {
							debounce = parseInt(debounce);
						};
						if (self.debugLogging) self.logger.info('[ROTARYENCODER2] activateButtons: Now assign push button: ' + (rotaryIndex + 1));
						self.buttons[rotaryIndex] = new Gpio(gpio, 'in', 'both', {debounceTimeout: debounce});
						self.buttons[rotaryIndex].watch((err,value) => {
							if (err) {
								return self.logger.error('[ROTARYENCODER2] Push Button '+(rotaryIndex+1)+' caused an error.')
							}
							switch (value==self.config.get('pushState'+rotaryIndex)) {
								case true: //(falling edge & active_high) or (rising edge and active low) = released
									var pushTime = Date.now() - self.pushDownTime[rotaryIndex]
									if (self.debugLogging) self.logger.info('[ROTARYENCODER2] Push Button '+(rotaryIndex+1)+' released after '+pushTime+'ms.');
									if (pushTime > 1500) {
										self.emitPushCommand(true, rotaryIndex)
									} else {
										self.emitPushCommand(false, rotaryIndex)
									}
									break;
							
								case false: //(falling edge & active low) or (rising edge and active high) = pressed
									if (self.debugLogging) self.logger.info('[ROTARYENCODER2] Push Button '+(rotaryIndex+1)+' pressed.');
									self.pushDownTime[rotaryIndex] = Date.now();						
									break;
							
								default:
									break;
							}
						})
						if (self.debugLogging) self.logger.info('[ROTARYENCODER2] Push Button '+(rotaryIndex+1)+' now resolving.');
						return defer.resolve();	
					} else {
						if (self.debugLogging) self.logger.info('[ROTARYENCODER2] Push Button '+(rotaryIndex+1)+' is disabled (no Gpio).');
						return defer.resolve();	
					}						
				} else {
					return defer.resolve();	
				}
			})
		} else {
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] activateButtons: end of recursion.');
			defer.resolve();
		}
	} else {
		self.logger.error('[ROTARYENCODER2] activateButtons: rotaryIndexArray must be an Array');
		defer.reject('rotaryIndexArray must be an Array of integers')
	} 

	return defer.promise;
}

//Function to recursively deactivate all buttons that are passed by Index in an Array
rotaryencoder2.prototype.deactivateButtons = function (rotaryIndexArray) {
	var self = this;
	var defer = libQ.defer();
	var rotaryIndex;

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] deactivateButtons: ' + rotaryIndexArray.map(i =>  {return i + 1}));

	if (Array.isArray(rotaryIndexArray)){
		if (rotaryIndexArray.length > 0) {
			rotaryIndex = rotaryIndexArray[0];
			self.deactivateButtons(rotaryIndexArray.slice(1,rotaryIndexArray.length))
			.then(_=>{
				if (self.config.get('enabled'+rotaryIndex)) {
					if (self.config.get('pinPush1'+rotaryIndex)>0) {
						self.buttons[rotaryIndex].unwatchAll();
						self.buttons[rotaryIndex].unexport();
						if (self.debugLogging) self.logger.info('[ROTARYENCODER2] deactivateButtons: deactivated button ' + (rotaryIndex + 1));
						defer.resolve();	
					} else {
						if (self.debugLogging) self.logger.info('[ROTARYENCODER2] deactivateButtons: button ' + (rotaryIndex + 1) + ' is disabled.');
						defer.resolve();	
					}						
				} else {
					defer.resolve();
				}

			})
		} else {
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] deactivateButtons: end of recursion.');
			defer.resolve();
		}
	} else {
		self.logger.error('[ROTARYENCODER2] deactivateButtons: rotaryIndexArray must be an Array');
		defer.reject('rotaryIndexArray must be an Array of integers')
	} 
	return defer.promise;
}

rotaryencoder2.prototype.addEventHandle = function (handle, rotaryIndex) {
	var self = this; 

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] addEventHandle for rotary: ' + (rotaryIndex + 1));
	self.handles[rotaryIndex]=handle;
	self.handles[rotaryIndex].stdout.on("data", function (chunk) {
		var i=0;
		while (chunk.length - i >= 16) {
			var type = chunk.readUInt16LE(i+8)
			var value = chunk.readInt32LE(i+12)
			i += 16
			if (type == 2) {
				if (self.debugLogging) self.logger.info('[ROTARYENCODER2] addEventHandle received from rotary: '+(rotaryIndex +1) + ' -> Dir: '+value)
				self.emitDialCommand(value,rotaryIndex)
			} 
		}
	});
	self.handles[rotaryIndex].stdout.on('end', function(){
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] addEventHandle: Stream from rotary encoder ended.');
	});
	self.handles[rotaryIndex].stderr.on('data', (data) => {
		self.logger.error('[ROTARYENCODER2] addEventHandle: ' + `stderr: ${data}`);
	});
	self.handles[rotaryIndex].on('close', (code) => {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] addEventHandle: ' + `child process exited with code ${code} `);
	});

}

rotaryencoder2.prototype.emitDialCommand = function(val,rotaryIndex){
	var self = this;
	var action = self.config.get('dialAction'+rotaryIndex)
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] emitDialCommand: '+action + ' with value ' + val + 'for Rotary: '+(rotaryIndex + 1))

	switch (val) {
		case 1: //CW
			switch (action) {
				case dialActions.indexOf("VOLUME"): //1
					self.socket.emit('volume','+');					
					if (self.debugLogging) self.logger.info('[ROTARYENCODER2] emitDialCommand: VOLUME UP')
					break;
			
				case dialActions.indexOf("SKIP"): //2
					self.socket.emit('next');				
					break;
			
				case dialActions.indexOf("SEEK"): //3
					if (self.status.trackType != 'webradio' && self.status.status == 'play') {
						let jumpTo = Math.min(Math.floor((Date.now() + self.lastTime)/1000 + 10),Math.floor(self.status.duration));
						if (self.debugLogging) self.logger.info('[ROTARYENCODER2] skip fwd to: ' + jumpTo);
						self.socket.emit('seek', jumpTo);
					}				
					break;
			
				case dialActions.indexOf("EMIT"): //4
					self.socket.emit(self.config.get('socketCmdCW'+rotaryIndex), self.config.get('socketDataCW'+rotaryIndex));				
					break;
			
				default:
					break;
			}
			break;
		case -1: //CCW
			switch (action) {
				case dialActions.indexOf("VOLUME"): //1
					self.socket.emit('volume','-');					
					if (self.debugLogging) self.logger.info('[ROTARYENCODER2] emitDialCommand: VOLUME DOWN')
					break;
			
				case dialActions.indexOf("SKIP"): //2
					self.socket.emit('prev');				
					break;
			
				case dialActions.indexOf("SEEK"): //3
					if (self.status.trackType != 'webradio' && self.status.status == 'play') {
						let jumpTo = Math.max(Math.floor((Date.now() + self.lastTime)/1000 - 10),0);
						if (self.debugLogging) self.logger.info('[ROTARYENCODER2] skip back to: ' + jumpTo);
						self.socket.emit('seek', jumpTo);
					}				
					break;
			
				case dialActions.indexOf("EMIT"): //4
					self.socket.emit(self.config.get('socketCmdCCW'+rotaryIndex), self.config.get('socketDataCCW'+rotaryIndex));				
					break;
			
				default:
					break;
			}
			break;
		default:
			break;
	}
}

rotaryencoder2.prototype.emitPushCommand = function(longPress,rotaryIndex){
	var self = this;
	var cmd = '';
	var data = '';
	if (longPress) {
		var action = self.config.get('longPushAction'+rotaryIndex)
		if (action == btnActions.indexOf("EMIT")) {
			cmd = self.config.get('socketCmdLongPush' + rotaryIndex);
			data = self.config.get('socketDataLongPush' + rotaryIndex);
		} 
	} else {
		var action = self.config.get('pushAction'+rotaryIndex)
		if (action == btnActions.indexOf("EMIT")) {
			cmd = self.config.get('socketCmdPush' + rotaryIndex);
			data = self.config.get('socketDataPush' + rotaryIndex);
		} 
	}
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] emitPushCommand: '+action + 'for Rotary: '+(rotaryIndex + 1))

	switch (action) {
		case btnActions.indexOf("DOTS"): //0
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] buttonAction: button of rotary ' + (rotaryIndex + 1) + ' pressed but no action selected.');
			break;
		case btnActions.indexOf("PLAY"): //1
			self.socket.emit('play')
			break;
		case btnActions.indexOf("PAUSE"): //2
			self.socket.emit('pause')
			break;
		case btnActions.indexOf("PLAYPAUSE"): //3
			switch (self.status.status) {
				case 'pause':
				case 'stop':
					self.socket.emit('play');				
					break;
				case 'play':
					self.socket.emit('pause');
					break;
				default:
					break;
			}
			break;
		case btnActions.indexOf("STOP"): //4
			self.socket.emit('stop')
			break;
		case btnActions.indexOf("REPEAT"): //5
			var newVal = !(self.status.repeat && self.status.repeatSingle);
			var newSingle = !(self.status.repeat == self.status.repeatSingle);
			self.socket.emit('setRepeat',{
				'value': newVal,
				'repeatSingle': newSingle
			})
			break;
		case btnActions.indexOf("RANDOM"): //6
			self.socket.emit('setRandom',{'value':!self.status.random})
			break;
		case btnActions.indexOf("CLEARQUEUE"): //7
			self.socket.emit('clearQueue')
			break;
		case btnActions.indexOf("MUTE"): //8
			self.socket.emit('mute')
			break;
		case btnActions.indexOf("UNMUTE"): //9
			self.socket.emit('unmute')
			break;
		case btnActions.indexOf("TOGGLEMUTE"): //10
			if (self.status.mute) {
				self.socket.emit('unmute');
			} else {
				self.socket.emit('mute');
			}
			break;
		case btnActions.indexOf("SHUTDOWN"): //11
			self.socket.emit('shutdown')
			break;
		case btnActions.indexOf("REBOOT"): //12
			self.socket.emit('reboot')
			break;
		case btnActions.indexOf("EMIT"): //13
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] buttonAction: button of rotary ' + (rotaryIndex + 1) + ' emit ' + cmd +';'+data);
			self.socket.emit(cmd,data);
			break;
	
		default:
			break;
	}
}

rotaryencoder2.prototype.addOverlay = function (pinA, pinB, stepsPerPeriod) {
	var self = this;
	var defer = libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] addOverlay: ' + pinA + ' ' + pinB + ' ' + stepsPerPeriod);
	exec('/usr/bin/sudo /usr/bin/dtoverlay ' + 'rotary-encoder pin_a='+pinA+' pin_b='+pinB+' relative_axis=true steps-per-period='+stepsPerPeriod+' &', {uid: 1000, gid: 1000}, function (err, stdout, stderr) {
		if (err) {
			self.logger.error('[ROTARYENCODER2] addOverlay: ' + stderr);
			defer.reject(stderr);
		} else {
			if (self.debugLogging) {
				exec('/bin/ls -R /dev/input', {uid: 1000, gid: 1000}, function (err, stdout, stderr) {
					self.logger.info(stdout)
				})
			}
			setTimeout(() => {
				defer.resolve(stdout);
			}, 1000);
		}
	})           
	return defer.promise;
}

rotaryencoder2.prototype.removeOverlay = function(idx) {
	var self = this;
	var defer = libQ.defer();
	
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] removeOverlay: ' + idx);
	if (idx > -1) {
		exec('/usr/bin/sudo /usr/bin/dtoverlay -r '+idx+' &', {uid: 1000, gid: 1000}, function (err, stdout, stderr) {
			if (err) {
				defer.reject(stderr);
			} else {
				if (self.debugLogging) self.logger.info('[ROTARYENCODER2] removeOverlay: ' + idx + ' returned: ' + stdout);
				exec('/usr/bin/sudo /usr/bin/dtoverlay -l', {uid: 1000, gid: 1000}, function (err, stdout, stderr) {
					if (self.debugLogging) self.logger.info('[ROTARYENCODER2] removeOverlay: "overlay -l" returned: ' + stdout + stderr);
					defer.resolve(stdout);			
				})
			}
		})           	
	} else {
		defer.resolve();
	}
	return defer.promise;
}

/**
 * Function looks for rotary-encoder overlays that alread use one of the provided GPIOs.
 * It returns an array with the index numbers of the overlay list returned by "dtoverlay -l"
 * If no matches are found, the returned array is empty
 * @param {Number} pin_a 
 * @param {Number} pin_b 
 * @returns Array
 */
 rotaryencoder2.prototype.checkOverlayExists = function(rotaryIndex) {
	var self = this;
	var defer = libQ.defer();
    var match;
    var overlay = -1;

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] checkOverlayExists: Checking for existing overlays for Rotary: ' + (rotaryIndex + 1));
	var pin_a = self.config.get('pinA' + rotaryIndex);
	var pin_b = self.config.get('pinB'+rotaryIndex);
	if (self.config.get('enabled'+rotaryIndex)){
		exec('/usr/bin/sudo /usr/bin/dtoverlay -l', {uid: 1000, gid: 1000}, function (err, stdout, stderr) {
			if(err) {
				self.logger.error('[ROTARYENCODER2] checkOverlayExists: Could not execute "dtoverlays -l": ' + stderr);
				defer.reject();
			}
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] checkOverlayExists: check pinA=' + pin_a + 'pinB=' + pin_b + ' in ' + stdout);
			dtoverlayRegex.lastIndex = 0;
			while (match = dtoverlayRegex.exec(stdout)) {
				if ((pin_a == match[2]) && (pin_b == match[3]))  {
					if (self.debugLogging) self.logger.info('[ROTARYENCODER2] checkOverlayExists: rotary ' + (rotaryIndex + 1) + 'uses overlay ' + match[1]);
					overlay = match[1];
				}             
			}
			if (overlay > -1) {
				defer.resolve(overlay);
			} else {
				if (self.debugLogging) self.logger.info('[ROTARYENCODER2] checkOverlayExists: rotary ' + (rotaryIndex + 1) + ' not using any overlay.');
				defer.resolve(overlay);	
			}
		});
	} else {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] checkOverlayExists: rotary ' + (rotaryIndex + 1) + ' is not active.');
		defer.resolve(-1);
	}
	return defer.promise;
}

rotaryencoder2.prototype.attachListener = function (pinA){
	var self = this;
	var defer = libQ.defer();
	var pinHex = Number(pinA).toString(16);

	var path = "/dev/input/by-path/platform-rotary\@"+pinHex+"-event";
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] attachListener: ' + path);
	var handle = spawn("/bin/cat", [path],{uid: 1000, gid: 1000});	
	defer.resolve(handle);
	return defer.promise;
}

rotaryencoder2.prototype.detachListener = function (handle){
	var self = this;
	var defer = libQ.defer();
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] detachListener: ' + handle);
    if (handle!=undefined) {
	    if (handle.kill()) {
        	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] detachListener: successfully killed handler process');
        	defer.resolve();
        } else {
            self.logger.error('[ROTARYENCODER2] detachListener: could not kill handler process');
            defer.reject();
        }

    } else {
        if (self.debugLogging) self.logger.info('[ROTARYENCODER2] detachListener: no handler process to kill');
        defer.resolve();
    }
	return defer.promise;
}

// Retrieve a string
rotaryencoder2.prototype.getI18nString = function (key) {
    var self = this;

	key = key.replace(/^ROTARYENCODER2\./,'');
    if (self.i18nStrings['ROTARYENCODER2'][key] !== undefined) {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] getI18nString("'+key+'"):'+ self.i18nStrings['ROTARYENCODER2'][key]);
        return self.i18nStrings['ROTARYENCODER2'][key];
	} else {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] getI18nString("'+key+'")'+ self.i18nStringsDefaults['ROTARYENCODER2'][key]);
        return self.i18nStringsDefaults['ROTARYENCODER2'][key];
	};
}
// A method to get some language strings used by the plugin
rotaryencoder2.prototype.loadI18nStrings = function() {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] loadI18nStrings: '+__dirname + '/i18n/strings_' + language_code + ".json");
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] loadI18nStrings: loaded: '+JSON.stringify(self.i18nStrings));
    }
    catch (e) {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] loadI18nStrings: ' + language_code + ' not found. Fallback to en');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};