'use strict';

// I used tomatpasser's gpio-buttons plugin as a basis for this project
var libQ = require("kew");
var fs = require("fs-extra");
var Gpio = require("onoff").Gpio;
var config = new (require("v-conf"))();
var io = require('socket.io-client');
var sleep = require('sleep');
var socket = io.connect("http://localhost:3000");
var execSync = require('child_process').execSync;

// Event string consts
const SYSTEM_STARTUP = "systemStartup";
const SYSTEM_SHUTDOWN = "systemShutdown";
const MUSIC_PLAY = "musicPlay";
const MUSIC_PAUSE = "musicPause";
const MUSIC_STOP = "musicStop";

// Events that we can detect and do something
const events = [SYSTEM_STARTUP, SYSTEM_SHUTDOWN, MUSIC_PLAY, MUSIC_PAUSE, MUSIC_STOP];

module.exports = GPIOControl;

// Constructor
function GPIOControl(context) {
	var self = this;

	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger = self.context.logger;
	self.load18nStrings();
	self.GPIOs = [];
	self.piBoard = self.getPiBoardInfo();
}

// Volumio is starting
GPIOControl.prototype.onVolumioStart = function(){
	var self = this;
	var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, "config.json");
	config.loadFile(configFile);

	self.log(`Detected ${self.piBoard.name}`);
	self.log(`40 GPIOs: ${self.piBoard.fullGPIO}`);
	self.log("Initialized");

	return libQ.resolve();
}

// Volumio is shutting down
GPIOControl.prototype.onVolumioShutdown = function() {
	var self = this;

	self.handleEvent(SYSTEM_SHUTDOWN);

	return libQ.resolve();
};

// Return config filename
GPIOControl.prototype.getConfigurationFiles = function() {
	return ["config.json"];
}

// Plugin has started
GPIOControl.prototype.onStart = function() {
	var self = this;
	var defer = libQ.defer();

	// read and parse status once
	socket.emit("getState", "");
	socket.once("pushState", self.statusChanged.bind(self));

	// listen to every subsequent status report from Volumio
	// status is pushed after every playback action, so we will be
	// notified if the status changes
	socket.on("pushState", self.statusChanged.bind(self));

	// Create pin objects
	self.createGPIOs()
		.then (function(result) {
			self.log("GPIOs created");
			self.handleEvent(SYSTEM_STARTUP);

			defer.resolve();
		});

	return defer.promise;
};

// Pluging has stopped
GPIOControl.prototype.onStop = function() {
	var self = this;
	var defer = libQ.defer();

	self.clearGPIOs()
		.then (function(result) {
			self.log("GPIOs destroyed");
			defer.resolve();
		});

	return libQ.resolve();
};

// The usual plugin guff :p

GPIOControl.prototype.onRestart = function() {
	var self = this;
};

GPIOControl.prototype.onInstall = function () {
	var self = this;
};

GPIOControl.prototype.onUninstall = function () {
	var self = this;
};

GPIOControl.prototype.getConf = function (varName) {
	var self = this;
};

GPIOControl.prototype.setConf = function(varName, varValue) {
	var self = this;
};

GPIOControl.prototype.getAdditionalConf = function (type, controller, data) {
	var self = this;
};

GPIOControl.prototype.setAdditionalConf = function () {
	var self = this;
};

GPIOControl.prototype.setUIConfig = function (data) {
	var self = this;
};

// Read config from UI
GPIOControl.prototype.getUIConfig = function() {
	var defer = libQ.defer();
	var self = this;
	var lang_code = self.commandRouter.sharedVars.get("language_code");
	var UIConfigFile;

	// Depending on our pi version change the number of pins available in GUI
	if (self.piBoard.fullGPIO)
		UIConfigFile = __dirname + "/UIConfig.json";
	else
		UIConfigFile = __dirname  + "/UIConfig-OldSchool.json";

	self.log(`UI Config file ${UIConfigFile}`);

	self.commandRouter.i18nJson(
		__dirname + "/i18n/strings_" + lang_code + ".json",
		__dirname + "/i18n/strings_en.json",
		UIConfigFile
	)
		.then(function(uiconf)
		{
			//var i = 0;
			events.forEach(function(e) {

				// Strings for data fields
				var s1 = e.concat("Enabled");
				var s2 = e.concat("Pin");
				var s3 = e.concat("State");

				// Strings for config
				var c1 = e.concat(".enabled");
				var c2 = e.concat(".pin");
				var c3 = e.concat(".state");

				// Extend the find method on the content array - mental but works
				uiconf.sections[0].content.findItem = function(obj) {
					return this.find(function(item) {
						for (var prop in obj)
							if (!(prop in item) || obj[prop] !== item[prop])
								 return false;
						return true;
					});
				}

				// Populate our controls
				self.setSwitchElement(uiconf, s1, config.get(c1));
				self.setSelectElementStr(uiconf, s2, config.get(c2));
				self.setSelectElement(uiconf, s3, config.get(c3), self.boolToString(config.get(c3)));
			});

			defer.resolve(uiconf);
		})
		.fail(function()
		{
			defer.reject(new Error());
		});

	return defer.promise;
};

// Save config
GPIOControl.prototype.saveConfig = function(data){
	var self = this;

	self.clearGPIOs();

	// Loop through standard events
	events.forEach(function(item) {

		// Element names
		var e1 = item.concat("Enabled");
		var e2 = item.concat("Pin");
		var e3 = item.concat("State");

		// Strings for config
		var c1 = item.concat(".enabled");
		var c2 = item.concat(".pin");
		var c3 = item.concat(".state");

		config.set(c1, data[e1]);
		config.set(c2, data[e2]["value"]);
		config.set(c3, data[e3]["value"]);
	});

	self.log("Saving config");
	self.createGPIOs();

	// Pins have been reset to fire off system startup
	self.handleEvent(SYSTEM_STARTUP);

	// retrieve playing status
	socket.emit("getState", "");

	self.commandRouter.pushToastMessage('success', self.getI18nString("PLUGIN_CONFIGURATION"), self.getI18nString("SETTINGS_SAVED"));
};

// Create GPIO objects for future events
GPIOControl.prototype.createGPIOs = function() {
	var self = this;

	self.log("Reading config and creating GPIOs");

	events.forEach(function(e) {
		var c1 = e.concat(".enabled");
		var c2 = e.concat(".pin");
		var c3 = e.concat(".state");

		var enabled = config.get(c1);
		var pin = config.get(c2);
		var state = config.get(c3);

		if (enabled){
			self.log(`Will set GPIO ${pin} ${self.boolToString(state)} when ${e}`);
			var gpio = new Gpio(pin, "out");
			gpio.e = e;
			gpio.state = state ? 1 : 0;
			gpio.pin = pin;
			self.GPIOs.push(gpio);
		}
	});

	return libQ.resolve();
};

// Release our GPIO objects
GPIOControl.prototype.clearGPIOs = function () {
	var self = this;

	self.GPIOs.forEach(function(gpio) {
		self.log("Destroying GPIO " + gpio.pin);
		gpio.unexport();
	});

	self.GPIOs = [];

	return libQ.resolve();
};

// Playing status has changed
// (might not always be a play or pause action)
GPIOControl.prototype.statusChanged = function(state) {
	var self = this;

	if (state.status == "play")
		self.handleEvent(MUSIC_PLAY);
	else if (state.status == "pause")
		self.handleEvent(MUSIC_PAUSE);
	else if (state.status == "stop")
		self.handleEvent(MUSIC_STOP);
}

// An event has happened so do something about it
GPIOControl.prototype.handleEvent = function(e) {
	var self = this;

	self.GPIOs.forEach(function(gpio) {
		if (gpio.e == e){
			self.log(`Turning GPIO ${gpio.pin} ${self.boolToString(gpio.state)} (${e})`);
			gpio.writeSync(gpio.state);
			if (e == SYSTEM_SHUTDOWN)
				sleep.sleep(5);
		}
	});
}

// Output to log
GPIOControl.prototype.log = function(s) {
	var self = this;
	self.logger.info("[GPIO_Control] " + s);
}

// Function for printing booleans
GPIOControl.prototype.boolToString = function(value){
	var self = this;
	return value ? self.getI18nString("ON") : self.getI18nString("OFF");
}

// A method to get some language strings used by the plugin
GPIOControl.prototype.load18nStrings = function() {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
    }
    catch (e) {
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};

// Retrieve a string
GPIOControl.prototype.getI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};

// Retrieve a UI element from UI config
GPIOControl.prototype.getUIElement = function(obj, field){
	var self = this;
	var lookfor = JSON.parse('{"id":"' + field + '"}');
	return obj.sections[0].content.findItem(lookfor);
}

// Populate switch UI element
GPIOControl.prototype.setSwitchElement = function(obj, field, value){
	var self = this;
	var result = self.getUIElement(obj, field);
	if (result)
		result.value = value;
}

// Populate select UI element
GPIOControl.prototype.setSelectElement = function(obj, field, value, label){
	var self = this;
	var result = self.getUIElement(obj, field);
	if (result){
		result.value.value = value;
		result.value.label = label;
	}
}

// Populate select UI element when value matches the label
GPIOControl.prototype.setSelectElementStr = function(obj, field, value){
	var self = this;
	self.setSelectElement(obj, field, value, value.toString());
}

// Retrieves information about the Pi hardware
// Ignores the compute module for now
GPIOControl.prototype.getPiBoardInfo = function(){
	var self = this;
	var regex = "(?:Pi)" +
		"(?:\\s(\\d+))?" +
		"(?:\\s(Zero)(?:\\s(W))?)?" +
		"(?:\\sModel\\s(?:([AB])(?:\\s(Plus))?))?" +
		"(?:\\sRev\\s(\\d+)(?:\\.(\\d+))?)?";
	var re = new RegExp(regex, "gi"); // global and case insensitive
	var boardName = self.getPiBoard(); // Returns Pi 1 as a defualt
	var groups = re.exec(boardName);
	var pi = new Object();;

	// Regex groups
	// ============
	// 0 - Full text matched
	// 1 - Board number: 0, 1, 2, 3
	// 2 - Zero: Zero
	// 3 - Zero W: W
	// 4 - Model: A, B
	// 5 - Model plus: +
	// 6 - PCB major revision: int
	// 7 - PCB minor revision: int

	// Have we found a valid Pi match
	if (groups[0]){
		pi.name = boardName; // Full board name
		pi.isZero = groups[2] == "Zero" // null, Zero
		pi.isZeroW = groups[3] == "W"; // null, W
		pi.model = groups[4]; // null, A, B
		pi.isModelPlus = groups[5] == "Plus"; // null, plus
		pi.revisionMajor = groups[6]; // null, digit
		pi.revisionMinor = groups[7]; // null, digit
		pi.boardNumber = 1; // Set to Pi 1 (default - not model number found)

		if (pi.isZero) // We found a Pi Zero
			pi.boardNumber = 0;
		else if (groups[1])	// We have Pi with a model number; i.e. 2, 3
			pi.boardNumber = Number(groups[1].trim());

		// Do we have 40 GPIOs or not?
		if ((pi.boardNumber == 1)  && !pi.isModelPlus)
			pi.fullGPIO = false;
		else
			pi.fullGPIO = true;
	}
	else{
		// This should never happen
		pi.name = "Unknown";
		pi.fullGPIO = false;
	}

	// Return pi object
	return pi;
}

// Try to get the hardware board we're running on currently (default is Pi 1)
// Pi names
//
// https://elinux.org/RPi_HardwareHistory
// Raspberry Pi Zero Rev1.3, Raspberry Pi Model B Rev 1, Raspberry Pi 2 Model B Rev 1.0
GPIOControl.prototype.getPiBoard = function(){
	var self = this;
	var board;
	try {
		board = execSync("cat /proc/device-tree/model").toString();
	}
	catch(e){
		self.log("Failed to read Pi board so default to Pi 1!");
		board = "Pi Rev";
	}
	return board;
}