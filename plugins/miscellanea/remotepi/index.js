'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var os = require('os');
var Gpio = require('onoff').Gpio;
var sleep = require('sleep');
var hwShutdown = false;
var shutdownCtrl, initShutdown;
var lircOverlayBanner = "#### RemotePi lirc setting below: do not alter ####" + os.EOL;

module.exports = remotepi;
function remotepi(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}


remotepi.prototype.onVolumioStart = function() {
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
};

remotepi.prototype.onVolumioShutdown = function() {
    var self = this;

    if (!hwShutdown) {
        self.logger.info("Shutdown initiated by software (UI element or CLI)");
        // Execute shutdown signal sequence on GPIO15
        initShutdown.write(1);
        sleep.msleep(125);
        initShutdown.write(0);
        sleep.msleep(200);
        initShutdown.write(1);
        sleep.msleep(400);
        initShutdown.write(0);
    } else {
        self.logger.info("Shutdown initiated by hardware knob or IR remote control");
    }
    // Reconfigure GPIO14 as output. Then set it to "high" to allow the RemotePi
    // to recognize when the shutdown process on the RasPi has been finished
    shutdownCtrl.unwatchAll();
    shutdownCtrl.unexport();
    shutdownCtrl = new Gpio(14, "out");
    shutdownCtrl.write(1);
    sleep.sleep(4);

    return libQ.resolve();  
};

remotepi.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();

    self.dtctHwShutdown();
    initShutdown = new Gpio(15, "out");
    self.writeBootStr();
    defer.resolve()

    return defer.promise;
};

remotepi.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    self.rmBootStr();
    shutdownCtrl.unwatchAll();
    shutdownCtrl.unexport();
    initShutdown.unexport();

    return libQ.resolve();
};


// Configuration Methods -----------------------------------------------------------------------------

remotepi.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf) {
            uiconf.sections[0].content[0].value = self.config.get("enable_gpio17");
            defer.resolve(uiconf);
        })
        .fail(function() {
            defer.reject(new Error());
        });

    return defer.promise;
};

remotepi.prototype.getConfigurationFiles = function() {
    return ["config.json"];
};

remotepi.prototype.dtctHwShutdown = function() {
    var self = this;

    // As the RemotePi signals a shutdown event (hardware knob or IR receiver) to the RasPi by
    // setting the level on the pin of GPIO14 to "high" configure GPIO14 as input and watch it
    shutdownCtrl = new Gpio(14, "in", "rising");
    shutdownCtrl.watch(function (error, value) {
        if (error) {
            throw error;
        }
        if (value == 1) {
            hwShutdown = true;
            return self.commandRouter.shutdown();
        }
    });
};

// The functions "writeBootStr" and "rmBootStr" are derived from "writeI2SDAC" and "disableI2SDAC" of
// Volumio's i2s_dacs plugin; many thanks to its coders for the inspiration

remotepi.prototype.writeBootStr = function() {
    var self = this;
    var bootstring = "dtoverlay=lirc-rpi,gpio_in_pin=18" + os.EOL;
    var searchexp = new RegExp(lircOverlayBanner + "dtoverlay=.*" + os.EOL);
    var configFile = "/boot/config.txt";
    var newConfigTxt;

    if (self.config.get("enable_gpio17")) {
        bootstring = "dtoverlay=lirc-rpi,gpio_in_pin=17" + os.EOL;
    }

    fs.readFile(configFile, "utf8", function (error, configTxt) {
        if (error) {
            self.logger.error("Error reading " + configFile + ": " + error);
            self.commandRouter.pushToastMessage("error", "RemotePi", "Error reading " + configFile + ": " + error);
        } else {
            newConfigTxt = configTxt.replace(searchexp, lircOverlayBanner + bootstring);
            if (configTxt == newConfigTxt && configTxt.search(lircOverlayBanner + bootstring) == -1) {
                newConfigTxt = configTxt + os.EOL + lircOverlayBanner + bootstring + os.EOL;
            }
            fs.writeFile(configFile, newConfigTxt, "utf8", function (error) {
                if (error) {
                    self.logger.error("Error writing " + configFile + ": " + error);
                    self.commandRouter.pushToastMessage("error", "RemotePi", "Error writing " + configFile + ": " + error);
                }
            });
        }
    });
};

remotepi.prototype.rmBootStr = function() {
    var self = this;
    var configFile = "/boot/config.txt";
    var searchexp = new RegExp(os.EOL + os.EOL + "*" + lircOverlayBanner + "dtoverlay=.*" + os.EOL + "*");

    fs.readFile(configFile, "utf8", function (error, configTxt) {
        if (error) {
            self.logger.error("Error reading" + configFile + ": " + error);
            self.commandRouter.pushToastMessage("error", "RemotePi", "Error reading " + configFile + ": " + error);
        } else {
            configTxt = configTxt.replace(searchexp, os.EOL);
            fs.writeFile(configFile, configTxt, "utf8", function (error) {
                if (error) {
                    self.logger.error("Error writing" + configFile + ": " + error);
                    self.commandRouter.pushToastMessage("error", "RemotePi", "Error writing " + configFile + ": " + error);
                }
            });
        }
    });
};

remotepi.prototype.saveConf = function(data) {
    var self = this;

    self.config.set("enable_gpio17", data.gpio17);
    self.writeBootStr();
    self.commandRouter.pushToastMessage("info", "RemotePi", "A reboot is required for the change to take effect.");
};
