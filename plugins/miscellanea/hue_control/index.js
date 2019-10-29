'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = hueControl;
const io = require('socket.io-client');

//hue api setup
const v3 = require('node-hue-api').v3
    , discovery = v3.discovery
    , hueApi = v3.api
;

var hueClient = null;
const hueAppName = 'hue_control';
const hueDeviceName = 'volumio';

function hueControl(context) {
    var self = this;

    self.context = context;
    self.commandRouter = this.context.coreCommand;
    self.logger = new HueLogger(this.context.logger);
    this.configManager = this.context.configManager;

    this.volumioClient = null;
    this.playerStatus = null;

    this.switchOffTimer = null;
}


function HueLogger(volumioLogger) {
    var self = this;
    this.logger = volumioLogger;
}

HueLogger.prototype.info = function (message) {
    var self = this;
    self.logger.info(`hue_control: ${message}`);
};

HueLogger.prototype.warn = function (message) {
    var self = this;
    self.logger.warn(`hue_control: ${message}`);
};

HueLogger.prototype.error = function (message) {
    var self = this;
    self.logger.error(`hue_control: ${message}`);
};

HueLogger.prototype.debug = function (message) {
    var self = this;
    self.logger.debug(`hue_control: ${message}`);
};

hueControl.prototype.onVolumioStart = function () {
    var self = this;

    self.logger.debug('onVolumioStart');

    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
};

hueControl.prototype.onStart = function () {
    var self = this;

    self.logger.info('onStart');

    // connect to the volumio service and listen for player state changes
    self.volumioClient = io.connect('http://localhost:3000');
    self.volumioClient.on('pushState', self.onVolumioState.bind(self));
    // request the value of the current player state
    self.volumioClient.emit('getState', '');

    var defer = libQ.defer();


    // Once the Plugin has successfull started resolve the promise
    defer.resolve();

    return defer.promise;
};

hueControl.prototype.onStop = function () {
    var self = this;

    self.logger.info('onStop');

    if (self.volumioClient) {
        self.volumioClient.disconnect();
        self.volumioClient = null;
    }

    var defer = libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

hueControl.prototype.onRestart = function () {
    var self = this;
    // Optional, use if you need it
};
// UI Actions -----------------------------------------------------------------------------

hueControl.prototype.pairBridge = function (data) {
    var self = this;
    self.logger.debug('pairBridge');
    if (!data['hue_bridge_address'] || 0 === data['hue_bridge_address'].length) {
        self.logger.error("Empty bridge address passed.");
        self.commandRouter.pushToastMessage('error', "Connect failed", "Empty bridge address!");
        return
    }
    // save ip address into config file
    self.config.set("hue_bridge_address", data['hue_bridge_address']);
    let apiUsername = null;
    try {
        apiUsername = self.createUser(data['hue_bridge_address'])
    } catch (err) {
        if (err.getHueErrorType() === 101) {
            self.logger.error('The Link button on the bridge was not pressed. Please press the Link button and try again.');
            self.commandRouter.pushToastMessage('error', "Connect failed", "The Link button on the bridge was not pressed. Please press the Link button and try again.");
        } else {
            self.logger.error(`Unexpected Error: ${err.message}`);
            self.commandRouter.pushToastMessage('error', "Connect failed", `Unexpected Error: ${err.message}`);
        }
    }
    if (apiUsername) {
        self.commandRouter.pushToastMessage('success', "Bridge connected.", "Successfully connected to bridge!");
        self.config.set("hue_api_username", apiUsername)
    }
};

// Hue Connection -----------------------------------------------------------------------------

hueControl.prototype.isConnected =  function() {
    let self = this;
    const apiUsername = self.config.get('hue_api_username');
    return !(!apiUsername || 0 === apiUsername.length);
};

hueControl.prototype.createUser = async function(ipAddress) {

    // Create an unauthenticated instance of the Hue API so that we can create a new user
    const unauthenticatedApi = await hueApi.createLocal(ipAddress).connect();

    let createdUser;
    createdUser = await unauthenticatedApi.users.createUser(hueAppName, hueDeviceName);
    self.logger.info('*******************************************************************************\n');
    self.logger.info('User has been created on the Hue Bridge. The following username can be used to\n' +
        'authenticate with the Bridge and provide full local access to the Hue Bridge.\n' +
        'YOU SHOULD TREAT THIS LIKE A PASSWORD\n');
    self.logger.info(`Hue Bridge User: ${createdUser.username}`);
    self.logger.info(`Hue Bridge User Client Key: ${createdUser.clientkey}`);
    self.logger.info('*******************************************************************************\n');

    // Create a new API instance that is authenticated with the new user we created
    hueClient = await hueApi.createLocal(ipAddress).connect(createdUser.username);

    // Do something with the authenticated user/api
    const bridgeConfig = await hueClient.configuration.get();
    self.logger.info(`Connected to Hue Bridge: ${bridgeConfig.name} :: ${bridgeConfig.ipaddress}`);
    return createdUser.username;
};

// Volumio Connection -----------------------------------------------------------------------------

hueControl.prototype.onVolumioState = function (state) {
    var self = this;

    if (state.status !== self.playerStatus) {
        self.playerStatus = state.status;

        self.logger.debug(`new player status: ${self.playerStatus}`);

        if (self.playerStatus === 'play') {
            // volumio is playing
            // stop timer if started
            if (self.switchOffTimer) {
                clearTimeout(self.switchOffTimer);
                self.switchOffTimer = null;
            }
            // switch on volumio device if available
            // TODO: Replace with hue function
            // if (self.tradfriDeviceOrGroup) {
            //     // tradfri device available
            //     self.logger.info(`switch on ${self.tradfriDeviceOrGroup.name}`);
            //     turnTradfriDeviceOrGroupOn(self.tradfriDeviceOrGroup);
            // }
        } else {
            // volumio is not playing
            // start timer if not already started
            if (!self.switchOffTimer) {
                self.logger.debug(`starting switch off timer`);
                self.switchOffTimer = setTimeout(
                    self.switchOffTimeout.bind(self),
                    self.config.get('switch_off_delay') * 1000
                );
            }
        }
    }
};

hueControl.prototype.switchOffTimeout = function () {
    var self = this;

    // timeout expired
    self.switchOffTimer = null;

    // switch off volumio device if available
    // TODO: Replace with hue function
    // if (self.tradfriDeviceOrGroup) {
    //     // tradfri device available
    //     self.logger.info(`switch off ${self.tradfriDeviceOrGroup.name}`);
    //     turnTradfriDeviceOrGroupOff(self.tradfriDeviceOrGroup);
    // }
};

// Configuration Methods -----------------------------------------------------------------------------

hueControl.prototype.getUIConfig = function () {
    console.log("getUIConfig")
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function (uiconf) {

            // Bridge Address
            uiconf.sections[0].content[0].value = self.config.get('hue_bridge_address');
            uiconf.sections[1].content[1].value = self.config.get('hue_bridge_address');

            // switch off delay
            uiconf.sections[2].content[0].value = self.config.get('switch_off_delay');

            // remove either the connect on or disconnect section
            var indexOfSectionToRemove = (self.isConnected()) ? 0 : 1;
            uiconf.sections.splice(indexOfSectionToRemove, 1);

            // Remove device selection if bridge is not connected
            if (!self.isConnected()) {
                uiconf.sections[1].content.splice(1, 1);
            }

            defer.resolve(uiconf);
        })
        .fail(function () {
            defer.reject(new Error());
        });

    return defer.promise;
};

hueControl.prototype.getConfigurationFiles = function () {
    return ['config.json'];
};

hueControl.prototype.setUIConfig = function (data) {
    var self = this;
    //Perform your installation tasks here
};

hueControl.prototype.getConf = function (varName) {
    var self = this;
    //Perform your installation tasks here
};

hueControl.prototype.setConf = function (varName, varValue) {
    var self = this;
    //Perform your installation tasks here
};



