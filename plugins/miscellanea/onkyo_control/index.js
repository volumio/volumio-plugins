var libQ = require('kew');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var eiscp = require('eiscp');

var currentState;

module.exports = onkyoControl;

function onkyoControl(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;

}

onkyoControl.prototype.onVolumioStart = function () {
    var self = this;
    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    self.logger.info("ONKYO-CONTROL:  CONFIG FILE: " + configFile);
    this.config.loadFile(configFile);

    return libQ.resolve();
}

onkyoControl.prototype.onStart = function () {
    var self = this;
    var defer = libQ.defer();

    self.load18nStrings();


    eiscp.on('connect', function () {
        self.logger.info("ONKYO-CONTROL: eiscp connected ");

        var disconnectCallback = function () {
            self.logger.info("ONKYO-CONTROL:  eiscp.disconnect()");
            eiscp.disconnect();
            self.logger.info("ONKYO-CONTROL:  eiscp.disconnect() finished");
        };

        var commands = [];

        if (self.currentState === 'play') {
            if (self.config.get('poweron')) {
                commands.push('system-power=on');
            }
            if (self.config.get('setVolume') && !isNaN(self.config.get('setVolumeValue'))) {
                commands.push('volume=' + self.config.get('setVolumeValue'));
            }
        } else if (self.currentState === 'stop') {
            commands.push('system-power=standby');
        }

        commands.forEach(function (command, index, array) {
            self.logger.info("ONKYO-CONTROL:  eiscp.command('" + command + "')");

            if (index < array.length - 1) {
                eiscp.command(command);
            } else {
                eiscp.command(command, disconnectCallback);
            }
        });

    });

    eiscp.on('error', function (error) {
        self.logger.error("ONKYO-CONTROL:  An error occurred trying to comminicate with the receiver: " + error);
    });

    socket.on('pushState', function (state) {

        var connectionOptions = {
            reconnect: false,
            send_delay: 5000,
            verify_commands: false
        };

        if (!self.config.get('autolocate')) {
            if (self.config.get('receiverPort') && self.config.get('receiverPort') !== '' && !isNaN(self.config.get('receiverPort'))) {
                connectionOptions.port = self.config.get('receiverPort');
                self.logger.info("ONKYO-CONTROL: Overriding default connection port: " + JSON.stringify(connectionOptions));
            }
            if (self.config.get('receiverIP') && self.config.get('receiverIP') !== '') {
                connectionOptions.host = self.config.get('receiverIP');
                self.logger.info("ONKYO-CONTROL: Overriding default connection host / ip: " + JSON.stringify(connectionOptions));
            }
        } else {
            connectionOptions.port = 60128;
            connectionOptions.host = '';
        }

        self.logger.info("ONKYO-CONTROL: *********** ONKYO PLUGIN STATE CHANGE ********");
        self.logger.info("ONKYO-CONTROL: New state: " + JSON.stringify(state) + " connection: " + JSON.stringify(connectionOptions));
        if (self.currentState && state.status !== self.currentState && !eiscp.is_connected) {

            if (state.status === 'play' && (self.config.get('poweron') || self.config.get('setVolume'))) {
                clearTimeout(self.standbyTimout);
                self.logger.info("ONKYO-CONTROL: eiscp connecting... ");
                eiscp.connect(connectionOptions);

            } else if (state.status === 'stop' && self.config.get('standby')) {
                self.logger.info("ONKYO-CONTROL: Starting standby timeout: " + self.config.get('standbyDelay') + " seconds");
                self.standbyTimout = setTimeout(function () {
                    self.logger.info("ONKYO-CONTROL: eiscp connecting... ");
                    eiscp.connect(connectionOptions);
                }, self.config.get('standbyDelay') * 1000);

            }

        }
        self.currentState = state.status;

    });

    self.logger.info("ONKYO-CONTROL: *********** ONKYO PLUGIN STARTED ********");
    // Once the Plugin has successfull started resolve the promise
    defer.resolve();

    return defer.promise;
};

onkyoControl.prototype.onStop = function () {
    var self = this;
    var defer = libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

onkyoControl.prototype.onRestart = function () {
    var self = this;
    // Optional, use if you need it
};


onkyoControl.prototype.getConfigurationFiles = function () {
    return ['config.json'];
}

// Configuration Methods -----------------------------------------------------------------------------

onkyoControl.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function (uiconf) {


            self.logger.info("ONKYO-CONTROL: getUIConfig()");

            uiconf.sections[0].content[0].value = self.config.get('autolocate');
            uiconf.sections[0].content[1].value = self.config.get('receiverSelect');
            uiconf.sections[0].content[2].value = self.config.get('receiverIP');
            uiconf.sections[0].content[3].value = self.config.get('receiverPort');

            uiconf.sections[1].content[0].value = self.config.get('poweron');
            uiconf.sections[1].content[1].value = self.config.get('standby');
            uiconf.sections[1].content[2].value = self.config.get('standbyDelay');
            uiconf.sections[1].content[3].value = self.config.get('setVolume');
            uiconf.sections[1].content[4].value = self.config.get('setVolumeValue');

            eiscp.discover({timeout: 5}, function (err, results) {
                if (err) {
                    self.logger.info("ONKYO-CONTROL: Error discovering receivers: " + results);
                } else {
                    self.logger.info("ONKYO-CONTROL: Found these receivers on the local network: " + JSON.stringify(results));
                    results.forEach(function (receiver) {
                        uiconf.sections[0].content[1].options.push({"value": receiver.host, "label": receiver.model})
                    });
                }
                uiconf.sections[0].content[1].options.push({
                    "value": "manual",
                    "label": self.getI18nString("TRANSLATE.SELECT_RECEIVER_MANUAL")
                })
                defer.resolve(uiconf);
            });

        })
        .fail(function () {
            defer.reject(new Error());
        });

    return defer.promise;
};


onkyoControl.prototype.setUIConfig = function (data) {
    var self = this;
    //Perform your installation tasks here
};

onkyoControl.prototype.getConf = function (varName) {
    var self = this;
    //Perform your installation tasks here
};

onkyoControl.prototype.setConf = function (varName, varValue) {
    var self = this;
    //Perform your installation tasks here
};

onkyoControl.prototype.saveConnectionConfig = function (data) {
    var self = this;
    var defer = libQ.defer();

    self.config.set('autolocate', data['autolocate']);
    self.config.set('receiverSelect', data['receiverSelect']);

    if (data['receiverSelect'].value !== "manual") {
        self.config.set('receiverIP', data['receiverSelect'].value);
        self.config.set('receiverPort', '60128');
    } else {
        self.config.set('receiverIP', data['receiverIP']);
        if (!data['receiverPort'] || data['receiverPort'] === '' || isNaN(data['receiverPort'])) {
            self.config.set('receiverPort', '60128');
        } else {
            self.config.set('receiverPort', data['receiverPort']);
        }
    }


    self.logger.info("ONKYO-CONTROL: saveConnectionConfig() data: " + JSON.stringify(data));

    defer.resolve();

    self.commandRouter.pushToastMessage('success', self.getI18nString("SETTINGS_SAVED"), self.getI18nString("SETTINGS_SAVED_CONNECTION"));

    return defer.promise;
};

onkyoControl.prototype.saveActionConfig = function (data) {
    var self = this;
    var defer = libQ.defer();

    self.logger.info("ONKYO-CONTROL: saveActionConfig() data: " + JSON.stringify(data));

    self.config.set('poweron', data['poweron']);
    self.config.set('standby', data['standby']);

    if (data['standbyDelay'] <= 0) {
        self.config.set('standbyDelay', 0);
    } else {
        self.config.set('standbyDelay', data['standbyDelay']);
    }

    self.config.set('setVolume', data['setVolume']);

    if (data['setVolumeValue'] <= 0) {
        self.config.set('setVolumeValue', 0);
    } else {
        self.config.set('setVolumeValue', data['setVolumeValue']);
    }

    defer.resolve();

    self.commandRouter.pushToastMessage('success', self.getI18nString("SETTINGS_SAVED"), self.getI18nString("SETTINGS_SAVED_ACTION"));

    return defer.promise;
};

// Internationalisation Methods -----------------------------------------------------------------------------

onkyoControl.prototype.load18nStrings = function () {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
    } catch (e) {
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};

onkyoControl.prototype.getI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};