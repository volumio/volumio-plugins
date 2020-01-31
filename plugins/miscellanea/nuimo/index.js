'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var Nuimo = require("nuimojs");
var nuimo = null;


module.exports = controllerNuimo;
function controllerNuimo(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



controllerNuimo.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
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

        console.log(`Discovered Nuimo (${device.uuid})`);

    device.on("connect", () => {
        console.log("Nuimo connected");
});

    device.on("disconnect", () => {
        console.log("Nuimo disconnected");
});

    device.on("press", () => {
        console.log("Button pressed");
});

    device.on("release", () => {
        console.log("Button released");
});

    device.on("swipe", (direction) => {
        switch (direction) {
        case (Nuimo.Swipe.LEFT):
            console.log("Swiped left"); break;
        case (Nuimo.Swipe.RIGHT):
            console.log("Swiped right"); break;
        case (Nuimo.Swipe.UP):
            console.log("Swiped up"); break;
        case (Nuimo.Swipe.DOWN):
            console.log("Swiped down"); break;
        }
    });

    device.on("touch", (direction) => {
        switch (direction) {
        case (Nuimo.Area.LEFT):
            console.log("Touched left"); break;
        case (Nuimo.Area.RIGHT):
            console.log("Touched right"); break;
        case (Nuimo.Area.TOP):
            console.log("Touched top"); break;
        case (Nuimo.Area.BOTTOM):
            console.log("Touched bottom"); break;
        case (Nuimo.Area.LONGLEFT):
            console.log("Long touched left"); break;
        case (Nuimo.Area.LONGRIGHT):
            console.log("Long touched right"); break;
        case (Nuimo.Area.LONGTOP):
            console.log("Long touched top"); break;
        case (Nuimo.Area.LONGBOTTOM):
            console.log("Long touched bottom"); break;
        }
    });

    device.on("rotate", (amount) => {
        console.log(`Rotated by ${amount}`);
});

    device.on("fly", (direction, speed) => {
        switch (direction) {
        case (Nuimo.Fly.LEFT):
            console.log(`Flew left by speed ${speed}`); break;
        case (Nuimo.Fly.RIGHT):
            console.log(`Flew right by speed ${speed}`); break;
        }
    });

    device.on("detect", (distance) => {
        console.log(`Detected hand at distance ${distance}`);
});

    device.connect();

});

};