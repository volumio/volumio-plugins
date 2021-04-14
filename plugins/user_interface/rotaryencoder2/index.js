'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
const path=require('path');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

const Gpio = require('onoff').Gpio;
const inputEvent = require('input-event');
const io = require('socket.io-client');
const socket = io.connect('http://localhost:3000');
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
	"RESTARTAPP",
	"DUMPLOG",
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

	self.debugLogging = (self.config.get('logging')==true);
	self.inputs=[].fill(null,0,maxRotaries);
	self.events=[].fill(null,0,maxRotaries);
	self.buttons=[].fill(null,0,maxRotaries);
	self.pushDownTime=[].fill(0,0,maxRotaries);
	self.status=null;
    return libQ.resolve();
}

rotaryencoder2.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();
	var activate = [];

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] onStart: Config loaded: ' + JSON.stringify(self.config));
	for (let i = 0; i < maxRotaries; i++) {
		if (self.config.get('enabled'+i)) {
			activate.push(i);
		}	
	}
	socket.emit('getState');
	socket.on('pushState',function(data){
		self.status = data;		
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] received Websock Status: ' + JSON.stringify(self.status));
	})
	self.activateRotaries(activate)
	.then(_ => {
		self.commandRouter.pushToastMessage('success',"Rotary Encoder II",  self.commandRouter.getI18nString('ROTARYENCODER2.TOAST_START_SUCCESS'))
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] onStart: Plugin successfully started.');				
		defer.resolve();
	})
	.fail(err => {
		self.commandRouter.pushToastMessage('error',"Rotary Encoder II", "Failed to start plugin.")
		self.logger.error('[ROTARYENCODER2] onStart: Failed to start plugin:' + err)
		defer.reject();
	});

    return defer.promise;
};

rotaryencoder2.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();
	var deactivate=[];

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] onStop: Stopping Plugin.');

	for (let i = 0; i < maxRotaries; i++) {
		if (self.config.get('enabled'+i)) {
			deactivate.push(i);
		}	
	}
	socket.off();
	self.deactivateRotaries(deactivate)
	.then(_ => {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] onStop: Plugin successfully stopped.');				
		defer.resolve();
	})
	.fail(err => {
		self.commandRouter.pushToastMessage('error',"Rotary Encoder II", "Failed to stop plugin.")
		self.logger.error('[ROTARYENCODER2] onStop: Failed to stop plugin.');
		defer.reject();
	})
    return defer.promise;
};

rotaryencoder2.prototype.onRestart = function() {
    var self = this;
    var defer=libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] onRestart: free resources');
	this.onStop()
	.then(defer.resolve())
	.fail(defer.reject())

	return defer.promise;
};


// Configuration Methods -----------------------------------------------------------------------------

rotaryencoder2.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

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
				uiconf.sections[i].content[4].value.label = self.commandRouter.getI18nString('ROTARYENCODER2.'+dialActions[parseInt(self.config.get('dialAction' + i))|0]);
				uiconf.sections[i].content[5].value = self.config.get('socketCmdCCW' + i);
				uiconf.sections[i].content[6].value = self.config.get('socketDataCCW' + i);
				uiconf.sections[i].content[7].value = self.config.get('socketCmdCW' + i);
				uiconf.sections[i].content[8].value = self.config.get('socketDataCW' + i);
				uiconf.sections[i].content[9].value = parseInt(self.config.get('pinPush' + i)) | 0;
				uiconf.sections[i].content[10].value = parseInt(self.config.get('pinPushDebounce' + i)) | 0;
				uiconf.sections[i].content[11].value = (self.config.get('pushState' + i)==true)
				uiconf.sections[i].content[12].value.value = self.config.get('pushAction' + i) | 0;
				uiconf.sections[i].content[12].value.label = self.commandRouter.getI18nString('ROTARYENCODER2.'+btnActions[parseInt(self.config.get('pushAction' + i))|0]);
				uiconf.sections[i].content[13].value = self.config.get('socketCmdPush' + i);
				uiconf.sections[i].content[14].value = self.config.get('socketDataPush' + i);
				uiconf.sections[i].content[15].value.value = self.config.get('longPushAction' + i) | 0;
				uiconf.sections[i].content[15].value.label = self.commandRouter.getI18nString('ROTARYENCODER2.'+btnActions[parseInt(self.config.get('longPushAction' + i))|0]);
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

rotaryencoder2.prototype.getI18nFile = function (langCode) {
	const i18nFiles = fs.readdirSync(path.join(__dirname, 'i18n'));
	const langFile = 'strings_' + langCode + '.json';
  
	// check for i18n file fitting the system language
	if (i18nFiles.some(function (i18nFile) { return i18nFile === langFile; })) {
	  return path.join(__dirname, 'i18n', langFile);
	}
	// return default i18n file
	return path.join(__dirname, 'i18n', 'strings_en.json');
  };
  
rotaryencoder2.prototype.updateEncoder = function(data){
	var self = this;
	var defer = libQ.defer();
	var dataString = JSON.stringify(data);

	var rotaryIndex = parseInt(dataString.match(/rotaryType([0-9])/)[1]);
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] updateEncoder: Saving Encoder '+(rotaryIndex + 1)+' Settings:' + JSON.stringify(data));

	self.sanityCheckSettings(rotaryIndex,data)
	.then(removableDTOs => {
		if (removableDTOs.length > 0) {
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] updateEncoder: calling deactivateRotaries for rotary ' + (rotaryIndex + 1));
			return self.deactivateRotaries([rotaryIndex])
		}
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
			self.config.set('enabled'+rotaryIndex, (data['enabled'+rotaryIndex]));	
		} else {
			self.config.set('rotaryType'+rotaryIndex, 0);
			self.config.set('pinA'+rotaryIndex, "");
			self.config.set('pinB'+rotaryIndex, "");
			self.config.set('dialAction'+rotaryIndex, 0);
			self.config.set('socketCmdCCW'+rotaryIndex, "");
			self.config.set('socketDataCCW'+rotaryIndex, "");
			self.config.set('socketCmdCW'+rotaryIndex, "");
			self.config.set('socketDataCW'+rotaryIndex, "");
			self.config.set('pinPush'+rotaryIndex, "");
			self.config.set('pinPushDebounce'+rotaryIndex, "");
			self.config.set('pushState'+rotaryIndex,false)
			self.config.set('pushAction'+rotaryIndex, 0);
			self.config.set('socketCmdPush'+rotaryIndex, "");
			self.config.set('socketDataPush'+rotaryIndex, "");
			self.config.set('longPushAction'+rotaryIndex, 0);
			self.config.set('socketCmdLongPush'+rotaryIndex, "");
			self.config.set('socketDataLongPush'+rotaryIndex, "");
			self.config.set('enabled'+rotaryIndex, (data['enabled'+rotaryIndex]));	
		}
	})
	.then(_=> {
		if (self.config.get('enabled'+rotaryIndex)) {
			return self.activateRotaries([rotaryIndex])
		}
	})
	.then(_ => {
		self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved Encoder "+ (rotaryIndex + 1) +" settings.");
		defer.resolve();	
	})
	.fail(_ => {
		self.commandRouter.pushToastMessage('error', "Failed to change settings.", "Could not save new settings and activate rotary.");
		defer.reject();
	})
	return defer.promise;

}

rotaryencoder2.prototype.sanityCheckSettings = function(rotaryIndex, data){
	var self = this;
	var defer = libQ.defer();
	var pinA = -1;
	var pinB = -1;
	var newPins = [];
	var oldPins = [];
	const hasDuplicates = arr => arr.some((item, index) => arr.indexOf(item) !== index)

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] sanityCheckSettings: Rotary'+(rotaryIndex + 1)+'for:' + JSON.stringify(data));

	if (data['enabled'+rotaryIndex] == false) {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] sanityCheckSettings: Disabling rotary' + (rotaryIndex+1) +'is OK.' );
	} else {
		if (!Number.isInteger(parseInt(data['pinA'+rotaryIndex])) || !Number.isInteger(parseInt(data['pinB'+rotaryIndex])) || !Number.isInteger(parseInt(data['pinPush'+rotaryIndex]))) {
			self.commandRouter.pushToastMessage('error', "Incorrect parameters.", "Pins can only be integers.");
			defer.reject()
			return;
		} 
		newPins = [parseInt(data['pinA'+rotaryIndex]),parseInt(data['pinB'+rotaryIndex]),parseInt(data['pinPush'+rotaryIndex])];
		for (let i = 0; i < maxRotaries; i++) {
			if ((!i==rotaryIndex) && (this.config.get('enabled'+i))) {
				oldPins.push(this.config.get('pinA'+i));
				oldPins.push(this.config.get('pinB'+i));
				oldPins.push(this.config.get('pinPush'+i));
			}
		}
		if (hasDuplicates(newPins)) {
			self.commandRouter.pushToastMessage('error', "Incorrect parameters.", "Pin A, Pin B and Push Button Pin must be different.");
			self.logger.error('[ROTARYENCODER2] sanityCheckSettings: duplicate pins. new: ' + newPins );
			defer.reject()
			return;
		}
		if (hasDuplicates([...newPins,...oldPins])) {
			self.commandRouter.pushToastMessage('error', "Incorrect parameters.", "One or more pins selected for rotary "+(rotaryIndex+1)+" are already in use. Free up used pins first.");
			self.logger.error('[ROTARYENCODER2] sanityCheckSettings: duplicate pins. old:' + oldPins +' new: ' + newPins );
			defer.reject()
			return;
		}
		
		pinA = parseInt(data['pinA'+rotaryIndex]);
		pinB = parseInt(data['pinB'+rotaryIndex]);
	}
	self.checkDTOverlayExists(pinA, pinB)
	.then(foundNew => {
		switch (foundNew.length) {
			case 0:
				if (self.debugLogging) self.logger.info('[ROTARYENCODER2] sanityCheckSettings: Rotary: '+(rotaryIndex + 1)+'. All dtOverlays free.');
				defer.resolve(foundNew);
				break;
			case 1:
				return self.checkDTOverlayExists(parseInt(self.config.get('pinA'+rotaryIndex)),parseInt(self.config.get('pinB'+rotaryIndex)))
				.then(foundOld => {
					switch (foundOld.length) {
						case 0:
							self.commandRouter.pushToastMessage('error', "Incorrect parameters.", "Pin already in use for another overlay. Deactivate other overlay first.");
							defer.reject();
							break;
						case 1:
							if (foundNew[0]==foundOld[0]) {
								if (self.debugLogging) self.logger.info('[ROTARYENCODER2] sanityCheckSettings: Rotary: '+(rotaryIndex + 1)+'. Only own overlay blocking, can be removed.');
								defer.resolve(foundNew);
							} else {
								self.commandRouter.pushToastMessage('error', "Incorrect parameters.", "Pin already in use for another overlay. Deactivate other overlay first.");
								defer.reject();
							}
							break;
						default:
							self.commandRouter.pushToastMessage('error', "Incorrect parameters.", "Pins already in use for another overlay. Deactivate other overlay first.");
							defer.reject();
							break;
					}
				});
				break;

			default:
				defer.reject();
				break;
		} 

	})
	.fail(err => defer.reject(err))
	return defer.promise;
}

rotaryencoder2.prototype.updateDebugSettings = function (data) {
	var self = this;
	var defer = libQ.defer();
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] updateDebugSettings: Saving Debug Settings:' + JSON.stringify(data));
	self.config.set('logging', (data['logging']))
	self.debugLogging = data['logging'];
	defer.resolve();
	self.commandRouter.pushToastMessage('success', "Saved settings", "Successfully saved debug settings.");
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

/**
 * Function looks for rotary-encoder overlays that alread use one of the provided GPIOs.
 * It returns an array with the index numbers of the overlay list returned by "dtoverlay -l"
 * If no matches are found, the returned array is empty
 * @param {Number} pin_a 
 * @param {Number} pin_b 
 * @returns Array
 */
rotaryencoder2.prototype.checkDTOverlayExists = function(pin_a, pin_b) {
	var self = this;
	var defer = libQ.defer();
    var match;
    var overlay = [];

	if (pin_a == NaN) pin_a = 0;
	if (pin_b == NaN) pin_b = 0;
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] checkDTOverlayExists: Checking for existing overlays for GPIOs: '+pin_a+' & '+pin_b);
    exec('/usr/bin/sudo /usr/bin/dtoverlay -l', {uid: 1000, gid: 1000}, function (err, stdout, stderr) {
        if(err) {
			self.logger.error('[ROTARYENCODER2] checkDTOverlayExists: Could not execute "dtoverlays -l": ' + stderr);
			defer.reject();
		}
		while (match = dtoverlayRegex.exec(stdout)) {
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] checkDTOverlayExists: Existing Rotary overlays:' + match[0]);
			if (pin_a == match[2] | pin_b == match[2] | pin_a == match[3] | pin_b == match[3])  {
				if (self.debugLogging) self.logger.info('[ROTARYENCODER2] checkDTOverlayExists: Pin already in use for a rotary: ' + match[1]);
				overlay.push(match[1]);
			}             
		}
		defer.resolve(overlay);
    });
	return defer.promise;
}

/**
 * Removes overlays from device tree. Rotary index is the rotary number in code (starting with 0). In the
 * GUI numbering starts with 1 (so for all messages to the user index is increased by 1)
 * @param {number} rotaryIndex number of the rotary to be removed (zero based, different from GUI)
 * @returns {void}
 */
rotaryencoder2.prototype.removeDTOverlay = function(overlayIndex) {
	var self = this;
	var defer = libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] removeDTOverlay: Overlays to be removed: ' + overlayIndex);
	var i = overlayIndex;
	exec('/usr/bin/sudo /usr/bin/dtoverlay -r ' + i, {uid: 1000, gid: 1000}, function (err, stdout, stderr) {
				if(err) {
					self.logger.error('[ROTARYENCODER2] removeDTOverlay: Failed to delete overlay: ' + i +' - '+ stderr);
					defer.reject();
				} else {
					if (self.debugLogging) self.logger.info('[ROTARYENCODER2] removeDTOverlay: Successfully deleted dtoverlay ' + i);
					defer.resolve();
				}
	});  
	return defer.promise;
}

/**
 * Adds rotary encoder to device tree overlay with pin_a and pin_b as connected IO and the
 * defined number of steps per Period. To change turning direction of rotary swap pins.
 * For details see:
 * https://www.kernel.org/doc/Documentation/input/rotary-encoder.txt
 * @param {} pin_a First pin of the rotary (sometimes called CLK)
 * @param {*} pin_b Second pin of the rotary (sometimes called DAT or DET)
 * @param {*} stepsPerPeriod If the rotary has click positions, this parameter describes, how many clicks occur per complete transition (high-low-high)
 * @returns 
 */
rotaryencoder2.prototype.addDTOverlay = function(rotaryIndex){
	var self = this;
	var defer = libQ.defer();

	var pin_a = self.config.get('pinA'+rotaryIndex);
	var pin_b = self.config.get('pinB'+rotaryIndex);
	var stepsPerPeriod = self.config.get('rotaryType'+rotaryIndex);

    var parameter = 'rotary-encoder pin_a=' + pin_a + ' pin_b=' + pin_b + ' relative_axis=true steps-per-period=' + stepsPerPeriod
    if (self.debugLogging) self.logger.info('[ROTARYENCODER2] addDTOverlay: Adding overlay: ' + parameter)
    exec('/usr/bin/sudo /usr/bin/dtoverlay ' + parameter, {uid: 1000, gid: 1000}, function (err, stdout, stderr) {
        if(err) {
			self.logger.error('[ROTARYENCODER2] addDTOverlay: Failed to add overlay: ' + stderr);
			defer.reject();
		};
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] addDTOverlay: Overlay successfully added: ' + stdout);
        defer.resolve();
    });
	return defer.promise;  
}

rotaryencoder2.prototype.activateButton = function (rotaryIndex) {
	var self = this;
	var defer = libQ.defer();
	var cmd = '';
	var data = '';
	
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] activateButton: activate button for rotary ' + (rotaryIndex + 1));

	if (Gpio.accessible) {
		var pin = this.config.get('pinPush'+rotaryIndex);
		var timeout = this.config.get('pinPushDebounce'+rotaryIndex);		
		this.buttons[rotaryIndex] = new Gpio(pin,'in','both',{debounceTimeout: timeout});
		this.buttons[rotaryIndex].watch((err, value) => {
			if(err) {
				self.logger.error('[ROTARYENCODER2] activateButton: Failed trigger by button of rotary ' + (rotaryIndex + 1) + ': ' + stderr);
			}
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] activateButton: button of rotary ' + (rotaryIndex + 1) + ' received: '+value);			
			var timeNow = new Date();
			var active = self.config.get('pushState'+rotaryIndex)?0:1;
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] activateButton: active ' + active);
			if (value == active) {
			  self.pushDownTime = timeNow;
			  if (self.debugLogging) self.logger.info('[ROTARYENCODER2] buttonAction: pressed at ' + timeNow);
			} else {
			  this.buttonAction(timeNow - self.pushDownTime, rotaryIndex);
			}
		})
		defer.resolve();
	} else {
		self.logger.error('[ROTARYENCODER2] activateButton: Cannot access GPIOs.');
		defer.reject();
	}
	return defer.promise;
}

rotaryencoder2.prototype.buttonAction = function (duration, rotaryIndex) {
	var self = this;
	var cmd = '';
	var data = '';
	var execute = 0;

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] buttonAction: button of rotary ' + (rotaryIndex + 1) + ' pressed for ' + duration + ' ms.');
	if (duration > 1500) {  //long-press
		execute = this.config.get('longPushAction' + rotaryIndex)|0;
		if (execute == btnActions.indexOf("EMIT")) {
			cmd = self.config.get('socketCmdLongPush' + rotaryIndex);
			data = self.config.get('socketDataLongPush' + rotaryIndex);
		} 
	} else {
		execute = this.config.get('pushAction' + rotaryIndex)|0;
		if (execute == btnActions.indexOf("EMIT")) {
			cmd = self.config.get('socketCmdPush' + rotaryIndex);
			data = self.config.get('socketDataPush' + rotaryIndex);
		} 
	}
	switch (execute) {
		case btnActions.indexOf("DOTS"):
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] buttonAction: button of rotary ' + (rotaryIndex + 1) + ' pressed but no action selected.');
			break;
		case btnActions.indexOf("PLAY"):
			socket.emit('play','')
			break;
		case btnActions.indexOf("PAUSE"):
			socket.emit('pause','')
			break;
		case btnActions.indexOf("PLAYPAUSE"):
			socket.emit('toggle','')
			break;
		case btnActions.indexOf("STOP"):
			socket.emit('stop','')
			break;
		case btnActions.indexOf("REPEAT"):
			var newVal = !(self.status.repeat && self.status.repeatSingle);
			var newSingle = !(self.status.repeat == self.status.repeatSingle);
			socket.emit('setRepeat',{
				'value': newVal,
				'repeatSingle': newSingle
			})
			break;
		case btnActions.indexOf("RANDOM"):
			socket.emit('setRandom',{'value':!self.status.random})
			break;
		case btnActions.indexOf("CLEARQUEUE"):
			socket.emit('clearQueue','')
			break;
		case btnActions.indexOf("MUTE"):
			socket.emit('mute','')
			break;
		case btnActions.indexOf("UNMUTE"):
			socket.emit('unmute','')
			break;
		case btnActions.indexOf("TOGGLEMUTE"):
			if (self.status.mute) {
				socket.emit('unmute','');
			} else {
				socket.emit('mute','');
			}
			break;
		case btnActions.indexOf("SHUTDOWN"):
			socket.emit('shutdown','')
			break;
		case btnActions.indexOf("REBOOT"):
			socket.emit('reboot','')
			break;
		// TODO: vrestart command on commandline
		// case btnActions.indexOf("RESTARTAPP"):
	
		// 	break;
		// TODO: dumplog command on commandline
		// case btnActions.indexOf("DUMPLOG"):
			
		// 	break;
		case btnActions.indexOf("EMIT"):
			socket.emit(cmd,data);
			break;
		default:
			if (self.debugLogging) self.logger.info('[ROTARYENCODER2] buttonAction: button of rotary ' + (rotaryIndex + 1) + ' pressed but no action defined in code yet.');
			break;
	}
}

rotaryencoder2.prototype.deactivateButton = function (rotaryIndex) {
	var self = this;
	var defer = libQ.defer();
	
	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] deactivateButton: deactivate button for rotary ' + (rotaryIndex + 1 +this.buttons));
	try {
		this.buttons[rotaryIndex].unwatchAll();
		this.buttons[rotaryIndex].unexport();			
	} catch (error) {
		self.logger.error('[ROTARYENCODER2] deactivateButton: Failed to destroy objects.');
	}
	defer.resolve();
	return defer.promise;	
}

rotaryencoder2.prototype.activateRotaries = function(indexArray) {
	var self = this;
	var defer = libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] activateRotaries: activate [' + indexArray.map(n => n + 1) + ']');
	if (indexArray.length > 0) {
		var rotaryIndex = indexArray[indexArray.length - 1];
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] activateRotaries: Adding overlay for Rotary ' + (rotaryIndex+1));
		self.addDTOverlay(rotaryIndex)
		.then(_ => {return self.assignInput(rotaryIndex)})
		.then(_=> {return self.registerEvents(rotaryIndex)})
		.then(_ => {return self.activateButton(rotaryIndex)})
		.then(_=> {return self.activateRotaries(indexArray.slice(0,indexArray.length - 1))}) //recurse
		.then(_=> defer.resolve());
	} else {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] activateRotaries: No rotaries left to activate.');
		defer.resolve();
	}
	return defer.promise;
}

rotaryencoder2.prototype.deactivateRotaries = function(indexArray) {
	var self = this;
	var defer = libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] DeactivateRotaries: deactivate ['+ indexArray.map(n => n + 1) + ']');
	if (indexArray.length > 0) {
		var rotaryIndex = indexArray[indexArray.length-1];
		var pin_a =self.config.get('pinA'+rotaryIndex)|0;
		var pin_b= self.config.get('pinB'+rotaryIndex)|0;
		self.deactivateButton(rotaryIndex)
		.then(_ => {return self.unregisterEvents(rotaryIndex)})
		// self.unregisterEvents(rotaryIndex)
		.then(_ => {return self.unassignInput(rotaryIndex)})
		.then(_=> {return self.checkDTOverlayExists(pin_a, pin_b)})
		.then(result => {
			switch (result.length) {
				case 0:
					break;
				case 1:
					if (self.debugLogging) self.logger.info('[ROTARYENCODER2] DeactivateRotaries: Now removing overlay' + result[0]);
					return self.removeDTOverlay(result[0])
				default:
					self.logger.error('[ROTARYENCODER2] DeactivateRotaries: More than one overlay found, sanity check not done');
					defer.reject();
			}
		})	
		.then(_=> {return self.deactivateRotaries(indexArray.slice(0,indexArray.length-1))}) //recurse
		.then(_ => defer.resolve())
		.fail(_ =>{
			self.logger.error('[ROTARYENCODER2] DeactivateRotaries: Failed.');
			defer.reject();
		})		
	} else {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] DeactivateRotaries: No overlays left to remove.');
		defer.resolve();
	}
	return defer.promise;
}

rotaryencoder2.prototype.assignInput = function(rotaryIndex) {
	var self = this;
	var defer = libQ.defer();
	var devString;
	var pinAHex

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] assignInput: for rotary: ' + (rotaryIndex+1))

	if (self.inputs[rotaryIndex] != null) {
		self.logger.error('[ROTARYENCODER2] assignInput: Input ' + rotaryIndex + ' for Rotary ' + (rotaryIndex+1) + ' still assigned.')
		defer.reject();
	} else {
		pinAHex = parseInt(self.config.get('pinA'+rotaryIndex)).toString(16);
		devString = '/dev/input/by-path/platform-rotary\@'+ pinAHex +'-event';
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] assignInput: Assigning input ' + devString)
		self.inputs[rotaryIndex] = new inputEvent(devString);
		defer.resolve();
	}
	return defer.promise;
}

rotaryencoder2.prototype.unassignInput = function(rotaryIndex) {
	var self = this;
	var defer = libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] UnassignInput: for rotary: ' + (rotaryIndex+1))

	if (self.events[rotaryIndex] != null) {
		self.logger.error('[ROTARYENCODER2] assignInput: Events for Decoder ' + (rotaryIndex + 1) + ' not unregistered yet.')
		defer.reject();
	} else {
		if (self.inputs[rotaryIndex] != null) {
			self.inputs[rotaryIndex].close;
			self.inputs[rotaryIndex] = null;
		}
		defer.resolve();
	}
	return defer.promise;
}

rotaryencoder2.prototype.registerEvents = function(rotaryIndex) {
	var self = this;
	var defer = libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] registerEvents: for rotary: ' + (rotaryIndex +1))

	if (self.events[rotaryIndex] != null) {
		self.logger.error('[ROTARYENCODER2] registerEvents: Events for Rotary ' + (rotaryIndex+1) + ' still assigned.')
		defer.reject();		
	} else {
		if (self.debugLogging) self.logger.info('[ROTARYENCODER2] registerEvents: Registering events for input ' + rotaryIndex)
		self.events[rotaryIndex] = new inputEvent.Rotary(self.inputs[rotaryIndex]);
		switch (self.config.get('dialAction'+rotaryIndex)) {
			case 1: //Volume
				self.events[rotaryIndex].on('left', _ => socket.emit('volume', '-'));
				self.events[rotaryIndex].on('right', _ => socket.emit('volume', '+'));
				if (self.debugLogging) self.logger.info('[ROTARYENCODER2] registerEvents: "Volume" for rotary '+(rotaryIndex+1));
				break;
		
			case 2: //Skip
				self.events[rotaryIndex].on('left', _ => socket.emit('prev', ''));
				self.events[rotaryIndex].on('right', _ => socket.emit('next', ''));
				if (self.debugLogging) self.logger.info('[ROTARYENCODER2] registerEvents: "Skip" for rotary '+(rotaryIndex+1));
				break;	
			case 3: //seek
				if (self.debugLogging) self.logger.info('[ROTARYENCODER2] registerEvents: "Seek" function not yet implemented.');
				// self.events[rotaryIndex].on('left', _ => {
				// 	socket.emit('getState','');

				// 	socket.emit('seek', '-1')});
				// self.events[rotaryIndex].on('right', _ => socket.emit('seek', '1'));
				// if (self.debugLogging) self.logger.info('[ROTARYENCODER2] Registered "Seek" for rotary '+(rotaryIndex+1));
				break;	
			case 4:
				self.events[rotaryIndex].on('left', _ => socket.emit(self.config.get('socketCmdCCW'+rotaryIndex),self.config.get('socketDataCCW'+rotaryIndex)));
				self.events[rotaryIndex].on('right', _ => socket.emit(self.config.get('socketCmdCW'+rotaryIndex),self.config.get('socketDataCW'+rotaryIndex)));
				if (self.debugLogging) self.logger.info('[ROTARYENCODER2] registerEvents: socketCmd '+ self.config.get('socketCmdCCW'+rotaryIndex) + '/' + self.config.get('socketCmdCW'+rotaryIndex)+' for rotary '+(rotaryIndex+1));				
				break;
			default:
				self.events[rotaryIndex].on('left', ev => self.logger.info('[ROTARYENCODER2] registerEvents: Rotary '+(rotaryIndex+1)+' rotated left'));
				self.events[rotaryIndex].on('right', ev => self.logger.info('[ROTARYENCODER2] registerEvents: Rotary '+(rotaryIndex+1)+' rotated right'));
				break;
		}
	}
	defer.resolve();
	return defer.promise;
}

rotaryencoder2.prototype.unregisterEvents = function(rotaryIndex) {
	var self = this;
	var defer = libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTARYENCODER2] unregisterEvents: for rotary: ' + (rotaryIndex + 1))

	var i = rotaryIndex;
	if (self.events[i] != null) {
		self.events[i].removeAllListeners();
		self.events[i].close();
		self.events[i] = null;
	};
	defer.resolve();
	return defer.promise;
}
