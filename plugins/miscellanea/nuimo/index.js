'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var Nuimo =  require("./lib/nuimo.js");
var nuimo = null;

var nuimoDevice;
var lastButtonPressTime;
var buttonPress = false;
var buttonPressMuteDuration = 500;

// Required for Max Compatibility
process.env.NOBLE_REPORT_ALL_HCI_EVENTS=1

module.exports = controllerNuimo;
function controllerNuimo(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
    this.config = new (require('v-conf'))();
}



controllerNuimo.prototype.onVolumioStart = function()
{
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config.loadFile(configFile);

    return libQ.resolve();
}

controllerNuimo.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();

    self.initializeNuimo();
    defer.resolve();

    return defer.promise;
};

controllerNuimo.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    self.stopNuimo();
    defer.resolve();

    return libQ.resolve();
};



// Configuration Methods -----------------------------------------------------------------------------

controllerNuimo.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {


            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

controllerNuimo.prototype.getConfigurationFiles = function() {
    return ['config.json'];
}

controllerNuimo.prototype.initializeNuimo = function () {
    var self = this;
    nuimo = new Nuimo();

    nuimo.scan();
    self.initializeListeners();
};

controllerNuimo.prototype.stopNuimo = function () {
    nuimo.stop();
    nuimo = null;
};

controllerNuimo.prototype.initializeListeners = function () {

    nuimo.on("discover", (device) => {

        // stop scanning
        nuimo.stop();

    nuimoDevice = device;
    this.logger.info(`Discovered Nuimo (${device.uuid})`);

    device.on("connect", () => {
        this.logger.info("Nuimo connected");
});

    device.on("disconnect", () => {
        this.logger.info("Nuimo disconnected");
    // restarting scan
    nuimo.scan();
});

    device.on("press", () => {
        this.logger.info("Nuimo Button pressed");
    this.buttonAction('press', device);
});

    device.on("release", () => {
        this.logger.info("Nuimo Button released");
    this.buttonAction('release', device);
});

    device.on("swipe", (direction) => {
        switch (direction) {
        case (Nuimo.Swipe.LEFT):
            this.logger.info("Nuimo Swiped left");
            this.executePrevious(device);
            break;
        case (Nuimo.Swipe.RIGHT):
            this.logger.info("Nuimo Swiped right");
            this.executeNext(device);
            break;
        case (Nuimo.Swipe.UP):
            this.logger.info("Nuimo Swiped up");
            break;
        case (Nuimo.Swipe.DOWN):
            this.logger.info("Nuimo Swiped down");
            break;
        }
    });

    device.on("touch", (direction) => {
        switch (direction) {
        case (Nuimo.Area.LEFT):
            this.logger.info("Nuimo Touched left"); break;
        case (Nuimo.Area.RIGHT):
            this.logger.info("Nuimo Touched right"); break;
        case (Nuimo.Area.TOP):
            this.logger.info("Nuimo Touched top"); break;
        case (Nuimo.Area.BOTTOM):
            this.logger.info("Nuimo Touched bottom"); break;
        case (Nuimo.Area.LONGLEFT):
            this.logger.info("Nuimo Long touched left"); break;
        case (Nuimo.Area.LONGRIGHT):
            this.logger.info("Nuimo Long touched right"); break;
        case (Nuimo.Area.LONGTOP):
            this.logger.info("Nuimo Long touched top"); break;
        case (Nuimo.Area.LONGBOTTOM):
            this.logger.info("Nuimo Long touched bottom"); break;
        }
    });

    device.on("rotate", (amount) => {
        this.logger.info("Nuimo rotation " + amount);
    this.rotationAction(amount, device);
});

    device.on("fly", (direction, speed) => {
        switch (direction) {
        case (Nuimo.Fly.LEFT):
            this.logger.info(`Nuimo Flew left by speed ${speed}`); break;
        case (Nuimo.Fly.RIGHT):
            this.logger.info(`Nuimo Flew right by speed ${speed}`); break;
        }
    });

    device.on("detect", (distance) => {
        this.logger.info(`Detected hand at distance ${distance}`);
});

    device.connect();
});
};

controllerNuimo.prototype.buttonAction = function(action, device) {
    var self = this;

    var buttonTimeout;
    if (action === 'press') {
        buttonPress = true;
        lastButtonPressTime = new Date;
        buttonTimeout = setTimeout(()=>{
                if (buttonPress) {
                    this.logger.info('Nuimo Long Press');
                    self.executeToggleMute(device);
                    clearTimeout(buttonTimeout);
                }
            }, buttonPressMuteDuration)
    }

    if (action === 'release') {
        buttonPress = false;
        var deltaPressTime = new Date - lastButtonPressTime;
        if (deltaPressTime < buttonPressMuteDuration) {
            this.logger.info('Nuimo Short Press');
            var currentStatus = this.commandRouter.stateMachine.currentStatus;
            if (currentStatus === 'play') {
                device.setLEDMatrix(matrixPause, 255, 2000);
            } else {
                device.setLEDMatrix(matrixPlay, 255, 2000);
            }
            self.executeTogglePlay();
        }
    }
}

controllerNuimo.prototype.rotationAction = function(amount, device) {
    var self = this;
    var currentVolume = this.commandRouter.stateMachine.currentVolume;

    var delta;
    var absolute = Math.abs(amount)
    if (absolute <= 50) {
        delta = 1;
    } else if (absolute > 50 && absolute <= 150) {
        delta = 5;
    } else if (absolute > 150) {
        delta = 100
    }

    if (amount > 0) {
        if (currentVolume === 100) {
            device.setLEDMatrix(matrix100, 255, 2000);
        } else {
            this.commandRouter.volumiosetvolume(currentVolume + delta);
            device.setLEDMatrix(matrixPlus, 255, 2000);
        }
    } else {
        if (currentVolume === 0) {
            device.setLEDMatrix(matrix0, 255, 2000);
        } else {
            this.commandRouter.volumiosetvolume(currentVolume - delta);
            device.setLEDMatrix(matrixMinus, 255, 2000);
        }
    }
}

controllerNuimo.prototype.executeNext = function(device) {
    var self = this;

    device.setLEDMatrix(matrixNext, 255, 2000);
    this.commandRouter.volumioNext();
}

controllerNuimo.prototype.executePrevious = function(device) {
    var self = this;

    device.setLEDMatrix(matrixPrevious, 255, 2000);
    this.commandRouter.volumioPrevious();
}

controllerNuimo.prototype.executeTogglePlay = function() {
    var self = this;

    this.commandRouter.volumioToggle();
}

controllerNuimo.prototype.executeToggleMute = function(device) {
    var self = this;

    var currentMute = this.commandRouter.stateMachine.currentMute;
    var currentVolume = this.commandRouter.stateMachine.currentVolume;

    if (currentMute === true || currentVolume === 0) {
        device.setLEDMatrix(matrixUnmute, 255, 2000);
    } else {
        device.setLEDMatrix(matrixMute, 255, 2000);
    }

    this.commandRouter.volumiosetvolume('toggle');
}

controllerNuimo.prototype.executeMute = function() {
    var self = this;

    this.commandRouter.volumiosetvolume('mute');
}

// MATRIX IMAGES

var matrixPlus = [
    0, 0, 0, 0, 1, 0, 0, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0, 0,
    1, 1, 1, 1, 1, 1, 1, 1, 1,
    0, 0, 0, 0, 1, 0, 0, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0, 0,
    0, 0, 0, 0, 1, 0, 0, 0, 0
];

var matrixMinus = [
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    1, 1, 1, 1, 1, 1, 1, 1, 1,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0
];

var matrixMute = [
    1, 0, 0, 0, 0, 0, 1, 0, 0,
    0, 1, 0, 0, 0, 1, 1, 0, 0,
    0, 0, 1, 0, 1, 1, 1, 0, 0,
    0, 0, 1, 1, 1, 1, 1, 0, 0,
    0, 0, 1, 1, 1, 1, 1, 0, 0,
    0, 0, 1, 1, 1, 1, 1, 0, 0,
    0, 0, 0, 0, 1, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 1, 1, 1, 0,
    0, 0, 0, 0, 0, 0, 1, 0, 1
];

var matrixUnmute = [
    0, 0, 0, 0, 0, 0, 1, 0, 0,
    0, 0, 0, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 1, 1, 1, 0, 0,
    0, 0, 1, 1, 1, 1, 1, 0, 0,
    0, 0, 1, 1, 1, 1, 1, 0, 0,
    0, 0, 1, 1, 1, 1, 1, 0, 0,
    0, 0, 0, 0, 1, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 1, 1, 0, 0,
    0, 0, 0, 0, 0, 0, 1, 0, 0
];

var matrixPlay = [
    0, 0, 1, 0, 0, 0, 0, 0, 0,
    0, 0, 1, 1, 0, 0, 0, 0, 0,
    0, 0, 1, 1, 1, 0, 0, 0, 0,
    0, 0, 1, 1, 1, 1, 0, 0, 0,
    0, 0, 1, 1, 1, 1, 1, 0, 0,
    0, 0, 1, 1, 1, 1, 0, 0, 0,
    0, 0, 1, 1, 1, 0, 0, 0, 0,
    0, 0, 1, 1, 0, 0, 0, 0, 0,
    0, 0, 1, 0, 0, 0, 0, 0, 0
];

var matrixPause = [
    0, 1, 1, 1, 0, 1, 1, 1, 0,
    0, 1, 1, 1, 0, 1, 1, 1, 0,
    0, 1, 1, 1, 0, 1, 1, 1, 0,
    0, 1, 1, 1, 0, 1, 1, 1, 0,
    0, 1, 1, 1, 0, 1, 1, 1, 0,
    0, 1, 1, 1, 0, 1, 1, 1, 0,
    0, 1, 1, 1, 0, 1, 1, 1, 0,
    0, 1, 1, 1, 0, 1, 1, 1, 0,
    0, 1, 1, 1, 0, 1, 1, 1, 0
];

var matrixNext = [
    0, 0, 1, 0, 0, 0, 0, 1, 0,
    0, 0, 1, 1, 0, 0, 0, 1, 0,
    0, 0, 1, 1, 1, 0, 0, 1, 0,
    0, 0, 1, 1, 1, 1, 0, 1, 0,
    0, 0, 1, 1, 1, 1, 1, 1, 0,
    0, 0, 1, 1, 1, 1, 0, 1, 0,
    0, 0, 1, 1, 1, 0, 0, 1, 0,
    0, 0, 1, 1, 0, 0, 0, 1, 0,
    0, 0, 1, 0, 0, 0, 0, 1, 0
];

var matrixPrevious = [
    0, 1, 0, 0, 0, 0, 1, 0, 0,
    0, 1, 0, 0, 0, 1, 1, 0, 0,
    0, 1, 0, 0, 1, 1, 1, 0, 0,
    0, 1, 0, 1, 1, 1, 1, 0, 0,
    0, 1, 1, 1, 1, 1, 1, 0, 0,
    0, 1, 0, 1, 1, 1, 1, 0, 0,
    0, 1, 0, 0, 1, 1, 1, 0, 0,
    0, 1, 0, 0, 0, 1, 1, 0, 0,
    0, 1, 0, 0, 0, 0, 1, 0, 0
];

var matrix100 = [
    1, 0, 1, 1, 1, 0, 1, 1, 1,
    1, 0, 1, 0, 1, 0, 1, 0, 1,
    1, 0, 1, 0, 1, 0, 1, 0, 1,
    1, 0, 1, 0, 1, 0, 1, 0, 1,
    1, 0, 1, 0, 1, 0, 1, 0, 1,
    1, 0, 1, 0, 1, 0, 1, 0, 1,
    1, 0, 1, 0, 1, 0, 1, 0, 1,
    1, 0, 1, 0, 1, 0, 1, 0, 1,
    1, 0, 1, 1, 1, 0, 1, 1, 1
];

var matrix0 = [
    0, 0, 1, 1, 1, 1, 1, 0, 0,
    0, 0, 1, 0, 0, 0, 1, 0, 0,
    0, 0, 1, 0, 0, 0, 1, 0, 0,
    0, 0, 1, 0, 0, 0, 1, 0, 0,
    0, 0, 1, 0, 0, 0, 1, 0, 0,
    0, 0, 1, 0, 0, 0, 1, 0, 0,
    0, 0, 1, 0, 0, 0, 1, 0, 0,
    0, 0, 1, 0, 0, 0, 1, 0, 0,
    0, 0, 1, 1, 1, 1, 1, 0, 0
];