'use strict';

const libQ = require('kew');
const tradfriLib = require('node-tradfri-client');
const TradfriClient = tradfriLib.TradfriClient;
const io = require('socket.io-client');

const SUPPORTED_DEVICES = [];
SUPPORTED_DEVICES[tradfriLib.AccessoryTypes.remote] = false;
SUPPORTED_DEVICES[tradfriLib.AccessoryTypes.slaveRemote] = false;
SUPPORTED_DEVICES[tradfriLib.AccessoryTypes.lightbulb] = true;
SUPPORTED_DEVICES[tradfriLib.AccessoryTypes.plug] = true;
SUPPORTED_DEVICES[tradfriLib.AccessoryTypes.motionSensor] = false;

function turnTradfriDeviceOrGroupOn(deviceOrGroup) {
    if (deviceOrGroup instanceof tradfriLib.Accessory) {
        if (deviceOrGroup.lightList) {
            deviceOrGroup.lightList.forEach(function (light, i) {
                if (!light.onOff) {
                    light.turnOn();
                }
            });
        }
        if (deviceOrGroup.plugList) {
            deviceOrGroup.plugList.forEach(function (plug, i) {
                if (!plug.onOff) {
                    plug.turnOn();
                }
            });
        }
    } else {
        // group
        if (!deviceOrGroup.onOff) {
            deviceOrGroup.turnOn();
        }
    }
}

function turnTradfriDeviceOrGroupOff(deviceOrGroup) {
    if (deviceOrGroup instanceof tradfriLib.Accessory) {
        if (deviceOrGroup.lightList) {
            deviceOrGroup.lightList.forEach(function (light, i) {
                if (light.onOff) {
                    light.turnOff();
                }
            });
        }
        if (deviceOrGroup.plugList) {
            deviceOrGroup.plugList.forEach(function (plug, i) {
                if (plug.onOff) {
                    plug.turnOff();
                }
            });
        }
    } else {
        // group
        if (deviceOrGroup.onOff) {
            deviceOrGroup.turnOff();
        }
    }
}

function TradfriLogger(volumioLogger) {
    var self = this;

    this.logger = volumioLogger;
}

TradfriLogger.prototype.info = function(message) {
    var self = this;
    self.logger.info(`tradfri_plugin: ${message}`);
}

TradfriLogger.prototype.warn = function(message) {
    var self = this;
    self.logger.warn(`tradfri_plugin: ${message}`);
}

TradfriLogger.prototype.error = function(message) {
    var self = this;
    self.logger.error(`tradfri_plugin: ${message}`);
}

TradfriLogger.prototype.debug = function(message) {
    var self = this;
    self.logger.debug(`tradfri_plugin: ${message}`);
}

module.exports = TradfriController;
function TradfriController(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = new TradfriLogger(this.context.logger);
    this.configManager = this.context.configManager;

    this.tradfriClient = null;
    this.volumioClient = null;
    this.playerStatus = null;

    this.tradfriDevices = {};
    this.tradfriGroups = {};
    this.tradfriDeviceOrGroup = null;
    this.switchOffTimer = null;
}

TradfriController.prototype.onVolumioStart = function() {
    var self = this;

    self.logger.debug('onVolumioStart');

    const configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
}

TradfriController.prototype.onStart = function() {
    var self = this;

    self.logger.debug('onStart');

    // connect to the volumio service and listen for player state changes
    self.volumioClient = io.connect('http://localhost:3000');
    self.volumioClient.on('pushState', self.onVolumioState.bind(self));
    // request the value of the current player state
    self.volumioClient.emit('getState', '');

    // when identity and psk are available, try to discover and connect to the gateway
    const identity = self.config.get('tradfri.gateway.identity');
    const psk = self.config.get('tradfri.gateway.psk');

    if (identity && psk) {
        tradfriLib.discoverGateway()
        .then(self.onTradfriGatewayDiscovered.bind(self))
        .catch(self.onTradfriConnectError.bind(self));
    }

    return libQ.resolve();
};

TradfriController.prototype.onStop = function() {
    var self = this;

    self.logger.debug('onStop');

    if (self.volumioClient) {
        self.volumioClient.disconnect();
        self.volumioClient = null;
    }

    if (self.tradfriClient) {
        self.tradfriClient.destroy();
        self.tradfriClient = null;
    }

    self.playerStatus = null;
    return libQ.resolve();
};

TradfriController.prototype.onRestart = function() { };


// UI Actions -----------------------------------------------------------------------------

TradfriController.prototype.tradfriConnect = function(data) {
    var self = this;

    self.logger.debug('tradfri connect');

    // start discovering Tradfri gateway
    tradfriLib.discoverGateway(10000) // timeout 10 seconds
    .then(self.onTradfriGatewayDiscovered.bind(self, data['security_code']))
    .catch(self.onTradfriConnectError.bind(self));
}

TradfriController.prototype.tradfriDisconnect = function(data) {
    var self = this;

    self.logger.debug('tradfri disconnect');

    if (self.tradfriClient) {
        self.tradfriClient.destroy();
        self.tradfriClient = null;
    }

    self.config.set('tradfri.gateway.identity', '');
    self.config.set('tradfri.gateway.psk', '');

    self.commandRouter.pushToastMessage('success', "Tradfri Disconnect", 'You have been successfully disconnected from your Tradfri gateway.');

    return libQ.resolve();
}

TradfriController.prototype.saveTradfriSettings = function(data) {
    var self = this;

    self.logger.debug(`tradfri settings / device_or_group: [old](${self.config.get('tradfri.device_or_group')}) [new](${data['tradfri_device_or_group']})`);
    self.logger.debug(`tradfri settings / switch_off_delay: [old](${self.config.get('tradfri.switch_off_delay')}) [new](${data['switch_off_delay']})`);

    if (data['tradfri_device_or_group'] !== self.config.get('tradfri.device_or_group')) {
        if (self.tradfriDeviceOrGroup) {
            turnTradfriDeviceOrGroupOff(self.tradfriDeviceOrGroup);
        }

        self.tradfriDeviceOrGroup = null;

        var findDeviceOrGroupByName = function(dict) {
            var deviceOrGroup = null;
            for (var key in dict) {
                if (dict[key].name == data['tradfri_device_or_group']) {
                    deviceOrGroup = dict[key];
                    break;
                }
            };
            return deviceOrGroup;
        }

        self.tradfriDeviceOrGroup = findDeviceOrGroupByName(self.tradfriDevices);

        if (!self.tradfriDeviceOrGroup) {
            self.tradfriDeviceOrGroup = findDeviceOrGroupByName(self.tradfriGroups);
        }

        if (self.tradfriDeviceOrGroup instanceof tradfriLib.Accessory) {
            if (!SUPPORTED_DEVICES[self.tradfriDeviceOrGroup.type]) {
                // device not supported
                self.tradfriDeviceOrGroup = null;
            }
        }

        if (self.playerStatus == 'play' && self.tradfriDeviceOrGroup) {
            // volumio is playing
            // switch on
            self.logger.info(`switch on ${self.tradfriDeviceOrGroup.name}`);
            turnTradfriDeviceOrGroupOn(self.tradfriDeviceOrGroup);
        }
    }

    self.config.set('tradfri.device_or_group', data['tradfri_device_or_group']);
    self.config.set('tradfri.switch_off_delay', data['switch_off_delay']);

    return libQ.resolve();
}


// Tradfri Connection -----------------------------------------------------------------------------

TradfriController.prototype.onTradfriConnectError = function(error) {
    var self = this;

    if (e instanceof tradfriLib.TradfriError) {
        switch (e.code) {
            case tradfriLib.TradfriErrorCodes.ConnectionTimedOut: {
                self.logger.error('tradfri gateway connection timeout');
            }
            case tradfriLib.TradfriErrorCodes.AuthenticationFailed: {
                self.logger.error('tradfri gateway authentication failed');
            }
            case tradfriLib.TradfriErrorCodes.ConnectionFailed: {
                self.logger.error('tradfri gateway connection error');
            }
        }
    }

    libQ.resolve();
    self.commandRouter.pushToastMessage('error', "Tradfri Connect", 'Failed connect you to your Tradfri gateway.');
}

TradfriController.prototype.tradfriLogger = function(message, severity) {
    var self = this;

    switch (severity) {
        case 'info':
            self.logger.info(message);
            break;
        case 'warn':
            self.logger.warn(message);
            break;
        case 'debug':
            self.logger.debug(message);
            break;
        case 'error':
            self.logger.error(message);
            break;
        default:
        case 'silly':
            self.logger.debug(message);
            break;
    }
}

TradfriController.prototype.onTradfriGatewayDiscovered = function(security_code, gateway) {
    var self = this;

    if (!gateway) {
        // no gateway discovered
        libQ.resolve();
        return;
    }

    self.logger.debug(`tradfri gateway ${gateway.name} discovered`);

    self.tradfriClient = new TradfriClient(gateway.host, {
        watchConnection: true,
        customLogger: self.tradfriLogger.bind(self)
    });

    const identity = self.config.get('tradfri.gateway.identity');
    const psk = self.config.get('tradfri.gateway.psk');

    if (identity && psk) {
        self.tradfriClient.connect(identity, psk)
        .then(self.onTradfriConnected.bind(self))
        .catch(self.onTradfriConnectError.bind(self));
    } else {
        self.tradfriClient.authenticate(security_code)
        .then(self.onTradfriAuthenticated.bind(self))
        .catch(self.onTradfriConnectError.bind(self));
    }
}

TradfriController.prototype.onTradfriAuthenticated = function(token) {
    var self = this;

    self.logger.debug('tradfri authentication successful');

    self.config.set('tradfri.gateway.identity', token.identity);
    self.config.set('tradfri.gateway.psk', token.psk);

    self.tradfriClient.connect(token.identity, token.psk)
    .then(self.onTradfriConnected.bind(self))
    .catch(self.onTradfriConnectError.bind(self));
}

TradfriController.prototype.onTradfriConnected = function() {
    var self = this;

    self.logger.info('connected to tradfri gateway');

    self.tradfriClient
    .on('device updated', self.onDeviceOrGroupUpdated.bind(self))
    .on('device removed', self.onDeviceOrGroupRemoved.bind(self, false))
    .observeDevices();

    self.tradfriClient
    .on('group updated', self.onDeviceOrGroupUpdated.bind(self))
    .on('group removed', self.onDeviceOrGroupRemoved.bind(self, true))
    .observeGroupsAndScenes();

    libQ.resolve();
    self.commandRouter.pushToastMessage('success', "Tradfri Connect", 'You have been successfully connected to your Tradfri gateway.');
}

TradfriController.prototype.onDeviceOrGroupUpdated = function(deviceOrGroup) {
    var self = this;
    var switchOn = false;

    if (deviceOrGroup instanceof tradfriLib.Accessory) {
        self.logger.debug(`device updated: ${deviceOrGroup.instanceId}:${deviceOrGroup.name}`);
        self.tradfriDevices[deviceOrGroup.instanceId] = deviceOrGroup;

        if (!SUPPORTED_DEVICES[deviceOrGroup.type]) {
            // device not supported
            return;
        }
    } else {
        self.logger.debug(`group updated: ${deviceOrGroup.instanceId}:${deviceOrGroup.name}`);
        self.tradfriGroups[deviceOrGroup.instanceId] = deviceOrGroup;
    }

    const tradfriDeviceOrGroupConfigured = self.config.get('tradfri.device_or_group');

    if (self.tradfriDeviceOrGroup) {
        // device or group already found
        if (deviceOrGroup.name == tradfriDeviceOrGroupConfigured) {
            // device or group of interest updated
            if (deviceOrGroup.instanceId != self.tradfriDeviceOrGroup.instanceId) {
                // the device or group has the same name but a different instance id
                switchOn = true;
            }

            self.tradfriDeviceOrGroup = deviceOrGroup;
        } else {
            if (deviceOrGroup.instanceId == self.tradfriDeviceOrGroup.instanceId) {
                // the device or group was renamed
                self.tradfriDeviceOrGroup = null;
            }
        }
    } else {
        // device or group not already found
        if (deviceOrGroup.name == tradfriDeviceOrGroupConfigured) {
            // device or group of interest found
            self.tradfriDeviceOrGroup = deviceOrGroup;
            switchOn = true;
        }
    }

    if (switchOn && self.playerStatus == 'play') {
        // volumio is playing
        // switch on
        self.logger.info(`switch on ${self.tradfriDeviceOrGroup.name}`);
        turnTradfriDeviceOrGroupOn(self.tradfriDeviceOrGroup);
    }
}

TradfriController.prototype.onDeviceOrGroupRemoved = function(instanceId, isGroup) {
    var self = this;

    if (isGroup) {
        self.logger.debug(`group removed: ${instanceId}`);
        delete self.tradfriGroups[instanceId];
    } else {
        self.logger.debug(`device removed: ${instanceId}`);
        delete self.tradfriDevices[instanceId];
    }

    if (self.tradfriDeviceOrGroup && self.tradfriDeviceOrGroup.instanceId == instanceId) {
        // the device of interest was removed
        self.tradfriDeviceOrGroup = null;
    }
}


// Volumio Connection -----------------------------------------------------------------------------

TradfriController.prototype.onVolumioState = function(state) {
    var self = this;

    if (state.status != self.playerStatus) {
        self.playerStatus = state.status;

        self.logger.debug(`new player status: ${self.playerStatus}`);

        if (self.playerStatus == 'play') {
            // volumio is playing
            // stop timer if started
            if (self.switchOffTimer) {
                clearTimeout(self.switchOffTimer);
                self.switchOffTimer = null;
            }
            // switch on volumio device if available
            if (self.tradfriDeviceOrGroup) {
                // tradfri device available
                self.logger.info(`switch on ${self.tradfriDeviceOrGroup.name}`);
                turnTradfriDeviceOrGroupOn(self.tradfriDeviceOrGroup);
            }
        } else {
            // volumio is not playing
            // start timer if not already started
            if (!self.switchOffTimer) {
                self.logger.debug(`starting switch off timer`);
                self.switchOffTimer = setTimeout(
                    self.switchOffTimeout.bind(self),
                    self.config.get('tradfri.switch_off_delay') * 1000
                );
            }
        }
    }
}

TradfriController.prototype.switchOffTimeout = function() {
    var self = this;

    // timeout expired
    self.switchOffTimer = null;

    // switch off volumio device if available
    if (self.tradfriDeviceOrGroup) {
        // tradfri device available
        self.logger.info(`switch off ${self.tradfriDeviceOrGroup.name}`);
        turnTradfriDeviceOrGroupOff(self.tradfriDeviceOrGroup);
    }
}


// Configuration Methods -----------------------------------------------------------------------------

TradfriController.prototype.getUIConfig = function() {
    var self = this;
    const defer = libQ.defer();

    self.logger.debug('getUIConfig');

    const lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf) {
            var identity = self.config.get('tradfri.gateway.identity');
            var psk = self.config.get('tradfri.gateway.psk');

            // remove either the authenticate on or logout section
            var indexOfSectionToRemove = (identity && psk) ? 0 : 1;

            // tradfri security code
            uiconf.sections[0].content[0].value = '';
            // tradfri device or group
            uiconf.sections[2].content[0].value = self.config.get('tradfri.device_or_group');
            // switch off delay
            uiconf.sections[1].content[0].value = self.config.get('tradfri.switch_off_delay');

            uiconf.sections.splice(indexOfSectionToRemove, 1);

            defer.resolve(uiconf);
        })
        .fail(function() {
            defer.reject(new Error());
        });

    return defer.promise;
};

TradfriController.prototype.getConfigurationFiles = function() {
    return ['config.json'];
}

TradfriController.prototype.setUIConfig = function(data) { };

TradfriController.prototype.getConf = function(varName) { };

TradfriController.prototype.setConf = function(varName, varValue) { };
