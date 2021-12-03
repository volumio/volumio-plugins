'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = HueControl;
const io = require('socket.io-client');

//hue api setup
const v3 = require('node-hue-api').v3
    , discovery = v3.discovery
    , hueApi = v3.api
;
const ApiError = require('node-hue-api').ApiError;

const HUE_APP_NAME = 'hue_control';
const HUE_DEVICE_NAME = 'volumio';

function HueControl(context) {
    const self = this;

    self.context = context;
    self.commandRouter = this.context.coreCommand;
    self.logger = new HueLogger(this.context.logger);
    self.configManager = this.context.configManager;

    self.volumioClient = null;
    self.playerStatus = null;

    self.hueUsername = null;
    self.hueBridgeAdress = null;
    self.hueDevice = null;
    self.hueDeviceOptionSelection = null;
    self.switchOffTimer = null;
}


function HueLogger(volumioLogger) {
    const self = this;
    this.logger = volumioLogger;
}

HueLogger.prototype.info = function (message) {
    const self = this;
    self.logger.info(`hue_control: ${message}`);
};

HueLogger.prototype.warn = function (message) {
    const self = this;
    self.logger.warn(`hue_control: ${message}`);
};

HueLogger.prototype.error = function (message) {
    const self = this;
    self.logger.error(`hue_control: ${message}`);
};

HueLogger.prototype.debug = function (message) {
    const self = this;
    self.logger.debug(`hue_control: ${message}`);
};

HueControl.prototype.onVolumioStart = function () {
    const self = this;

    self.logger.debug('onVolumioStart');

    let configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
};

HueControl.prototype.onStart = function () {
    const self = this;

    self.logger.info('onStart');

    // connect to the volumio service and listen for player state changes
    self.volumioClient = io.connect('http://localhost:3000');
    self.volumioClient.on('pushState', self.onVolumioState.bind(self));
    // request the value of the current player state
    self.volumioClient.emit('getState', '');

    var defer = libQ.defer();

    // load config properties
    self.hueBridgeAdress = self.config.get("hue_bridge_address");
    self.hueUsername = self.config.get('hue_api_username');
    self.hueDevice = self.config.get("hue_device");

    // if username and bridge_address are set => load available hue devices
    if (self.isPaired()) {
        self.getAllLights().then(lights => {
                self.hueDeviceOptionSelection = self.mapDevicesToOptionArray(lights);
            }
        );
    }

    // Once the Plugin has successfully started resolve the promise
    defer.resolve();

    return defer.promise;
};

HueControl.prototype.onStop = function () {
    const self = this;

    self.logger.info('onStop');

    if (self.volumioClient) {
        self.volumioClient.disconnect();
        self.volumioClient = null;
    }

    var defer = libQ.defer();

    // Once the Plugin has successfully stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

HueControl.prototype.onRestart = function () {
    const self = this;
    // Optional, use if you need it
};
// UI Actions -----------------------------------------------------------------------------

HueControl.prototype.mapDevicesToOptionArray = function (lights) {
    return lights.map(value => {
        return {'value': value.id, 'label': value.name};
    });
};

HueControl.prototype.pairBridge = function (data) {
    const self = this;
    self.logger.debug('pairBridge');
    if (!data['hue_bridge_address'] || 0 === data['hue_bridge_address'].length) {
        self.logger.error("Empty bridge address passed.");
        self.commandRouter.pushToastMessage('error', "Connect failed", "Empty bridge address!");
        return
    }
    // save ip address into config file
    self.config.set("hue_bridge_address", data['hue_bridge_address']);
    self.createUser(data['hue_bridge_address']).then(username => {
        if (username && username.length > 0) {
            self.config.set("hue_api_username", username);
            self.hueUsername = username;
            self.getAllLights().then(lights => {
                self.hueDeviceOptionSelection = self.mapDevicesToOptionArray(lights);
            });
            var respconfig = self.commandRouter.getUIConfigOnPlugin('miscellanea', 'hue_control', {});
            respconfig.then(function (config) {
                self.commandRouter.broadcastMessage('pushUiConfig', config);
            });
        }
    });
};

HueControl.prototype.unpairBridge = function () {
    const self = this;
    self.logger.info('Unpair Bridge');
    self.config.set("hue_api_username", "");
    self.hueUsername = null;
    self.hueDevice = null;
    self.commandRouter.pushToastMessage('success', "Bridge unpaired", `Bridge is now unpaired. Please delete Volumio from App List `);
    var respconfig = self.commandRouter.getUIConfigOnPlugin('miscellanea', 'hue_control', {});
    respconfig.then(function (config) {
        self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
};

HueControl.prototype.saveSettings = function (data) {
    const self = this;
    if (data['hue_device'] && 0 <= data['hue_device'].value) {
        self.config.set("hue_device", data['hue_device'].value);
        self.hueDevice = data['hue_device'].value;
    } else {
        self.config.set("hue_device", -1);
        self.logger.error("Save failed. hue_device=" + data['hue_device'].value);
        self.commandRouter.pushToastMessage('error', "Save failed", "Hue device selection invalid");
        return;
    }
    if (data['switch_off_delay'] && 0 < data['switch_off_delay']) {
        self.config.set("switch_off_delay", data['switch_off_delay']);
        self.switchOffTimer = data['switch_off_delay'];
    } else {
        self.logger.error("Save failed: Switch off delay has to be a number > 0");
        self.commandRouter.pushToastMessage('error', "Save failed", "Switch off delay has to be a number > 0");
    }
    self.commandRouter.pushToastMessage('success', "Settings saved", `Settings successfully saved.`);

};

// Hue Connection -----------------------------------------------------------------------------

HueControl.prototype.turnHueDeviceOn = async function (deviceId) {
    const self = this;
    return self.controlHueDevice(deviceId, {on: true});

};

HueControl.prototype.turnHueDeviceOff = async function (deviceId) {
    const self = this;
    return self.controlHueDevice(deviceId, {on: false});
};

HueControl.prototype.controlHueDevice = async function (deviceId, state) {
    const self = this;
    return hueApi.createLocal(self.hueBridgeAdress).connect(self.hueUsername)
        .then(api => {
            return api.lights.setLightState(deviceId, state)
        });
};


HueControl.prototype.getAllLights = async function () {
    const self = this;
    return hueApi.createLocal(self.hueBridgeAdress).connect(self.hueUsername)
        .then(api => {
            return api.lights.getAll();
        });
};

HueControl.prototype.isPaired = function () {
    const self = this;
    return ((self.hueUsername && 0 < self.hueUsername.length) &&
        (self.hueBridgeAdress && 0 < self.hueBridgeAdress.length));
};

HueControl.prototype.createUser = async function (ipAddress) {
    const self = this;
    // Create an unauthenticated instance of the Hue API so that we can create a new user
    var unauthenticatedApi;
    try {
        unauthenticatedApi = await hueApi.createLocal(ipAddress).connect();
    } catch (e) {
        self.logger.error("Unable to connect to " + ipAddress);
        self.commandRouter.pushToastMessage('error', "Connect failed", `Unable to connect to ` + ipAddress);
        return;
    }

    let createdUser;
    try {
        createdUser = await unauthenticatedApi.users.createUser(HUE_APP_NAME, HUE_DEVICE_NAME);
        self.logger.info('*******************************************************************************\n');
        self.logger.info('User has been created on the Hue Bridge. The following username can be used to\n' +
            'authenticate with the Bridge and provide full local access to the Hue Bridge.\n' +
            'YOU SHOULD TREAT THIS LIKE A PASSWORD\n');
        self.logger.info(`Hue Bridge User: ${createdUser.username}`);
        self.logger.info(`Hue Bridge User Client Key: ${createdUser.clientkey}`);
        self.logger.info('*******************************************************************************\n');

        // Create a new API instance that is authenticated with the new user we created
        self.hueClient = await hueApi.createLocal(ipAddress).connect(createdUser.username);

        // Do something with the authenticated user/api
        const bridgeConfig = await self.hueClient.configuration.get();
        self.logger.info(`Connected to Hue Bridge: ${bridgeConfig.name} :: ${bridgeConfig.ipaddress}`);
    } catch (err) {
        if (err instanceof ApiError && err.getHueErrorType() === 101) {
            self.logger.error('The Link button on the bridge was not pressed. Please press the Link button and try again.');
            self.commandRouter.pushToastMessage('error', "Connect failed", "The Link button on the bridge was not pressed. Please press the Link button and try again.");
        } else {
            self.logger.error(`Unexpected Error: ${err.message}`);
            self.commandRouter.pushToastMessage('error', "Connect failed", `Unexpected Error: ${err.message}`);
        }
        return;
    }
    if (createdUser.username) {
        self.commandRouter.pushToastMessage('success', "Bridge connected.", "Successfully connected to bridge!");
        return createdUser.username;
    } else {
        self.commandRouter.pushToastMessage('error', "Connect failed", `Unable to receive username from bridge.`);
    }
};

// Volumio Connection -----------------------------------------------------------------------------

HueControl.prototype.onVolumioState = function (state) {
    const self = this;

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
            if (self.isPaired()) {
                self.logger.info(`switch on hue device with id ${self.hueDevice}`);
                self.turnHueDeviceOn(self.hueDevice).then(
                    result => {
                        if (result) {
                            self.logger.info(`Hue device successfully switch on`);
                        } else {
                            self.logger.error(`Unable to switch on hue device`);
                        }
                    });
            }
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

HueControl.prototype.switchOffTimeout = function () {
    const self = this;

    // timeout expired
    self.switchOffTimer = null;

    // switch off volumio device if available
    if (self.isPaired()) {
        self.logger.info(`switch off hue device with id ${self.hueDevice}`);
        self.turnHueDeviceOff(self.hueDevice).then(
            result => {
                if (result) {
                    self.logger.info(`Hue device successfully switch off`);
                } else {
                    self.logger.error(`Unable to switch off hue device`);
                }
            });
    }
};

// Configuration Methods -----------------------------------------------------------------------------

HueControl.prototype.getUIConfig = function () {
    const self = this;
    const defer = libQ.defer();

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function (uiconf) {

            // Bridge Address
            uiconf.sections[0].content[0].value = self.config.get('hue_bridge_address');
            uiconf.sections[1].content[0].value = self.config.get('hue_bridge_address');


            // remove either the connect on or disconnect section
            var indexOfSectionToRemove = (self.isPaired()) ? 0 : 1;
            uiconf.sections.splice(indexOfSectionToRemove, 1);

            // Remove device selection if bridge is not connected
            if (!self.isPaired()) {
                uiconf.sections[1].content.splice(1, 1);
            } else {
                uiconf.sections[1].content[1].options = self.hueDeviceOptionSelection;
            }
            // switch off delay
            let hueDevice = self.config.get("hue_device");
            if (!hueDevice) {
                hueDevice = -1
            }
            if (self.isPaired() && hueDevice >= 0) {
                const selectedLight = self.hueDeviceOptionSelection.find(value => {
                    return value.value === hueDevice
                });
                if (selectedLight) {
                    uiconf.sections[1].content[1].value = {"value": hueDevice, "label": selectedLight.label};
                }
            }
            uiconf.sections[1].content[0].value = self.config.get('switch_off_delay');


            defer.resolve(uiconf);
        })
        .fail(function () {
            defer.reject(new Error());
        });

    return defer.promise;
};

HueControl.prototype.getConfigurationFiles = function () {
    return ['config.json'];
};

HueControl.prototype.setUIConfig = function (data) {
    const self = this;
    //Perform your installation tasks here
};

HueControl.prototype.getConf = function (varName) {
    const self = this;
    //Perform your installation tasks here
};

HueControl.prototype.setConf = function (varName, varValue) {
    const self = this;
    //Perform your installation tasks here
};



