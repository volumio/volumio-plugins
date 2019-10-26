'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;


module.exports = ambx;
function ambx(context) {
	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
}

ambx.prototype.onVolumioStart = function()
{
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

ambx.prototype.updateColor = function() {
    var self = this;
    if (self.config.get('sync')) {
        var config = self.config.get('colorMain');
        self.logger.info("Updating color");
        if (typeof config !== 'undefined') {
            var color = config.match(/[A-Za-z0-9]{2}/g).map(function(v) { return parseInt(v, 16) });

            exec("ambx_set_color -r " + color[0] + " -g " + color[1] + " -b " + color[2], function (error, stdout, stderr) {
                if(error){
                    return false;
                }
            });
        }
    } else {
        var configs = [self.config.get('colorLeft'),
                       self.config.get('colorLeftCenter'),
                       self.config.get('colorCenter'),
                       self.config.get('colorRightCenter'),
                       self.config.get('colorRight')];

        self.logger.info("Updating color");
        for (var i = 0; i < 5; i++) {
            if (typeof configs[i] !== 'undefined') {
                var color = configs[i].match(/[A-Za-z0-9]{2}/g).map(function(v) { return parseInt(v, 16) });

                exec("ambx_set_color -l " + (i+1) + " -r " + color[0] + " -g " + color[1] + " -b " + color[2], function (error, stdout, stderr) {
                    if(error){
                        return false;
                    }
                });
            }
        }
    }
    return true;
}

ambx.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();

    if(self.updateColor()){
        defer.resolve();
    } else {
        self.logger.info('No control on AmbX');
        defer.reject(new Error());
    }

    return defer.promise;
};

ambx.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    exec("ambx_set_color", function (error, stdout, stderr) {
        if(error){
            self.logger.info('No control on AmbX');
            defer.reject(new Error());
        } else {
            // Once the Plugin has successfull stopped resolve the promise
            defer.resolve();
        }
    });

    return defer.promise;
};

ambx.prototype.onRestart = function() {
};


// Configuration Methods -----------------------------------------------------------------------------

ambx.prototype.getUIConfig = function() {
    var self = this;
    var defer = libQ.defer();

    var lang_code = self.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            uiconf.sections[0].content[0].value = self.config.get('sync');
            uiconf.sections[0].content[1].value = self.config.get('colorLeft');
            uiconf.sections[0].content[2].value = self.config.get('colorLeftCenter');
            uiconf.sections[0].content[3].value = self.config.get('colorCenter');
            uiconf.sections[0].content[4].value = self.config.get('colorRightCenter');
            uiconf.sections[0].content[5].value = self.config.get('colorRight');
            uiconf.sections[0].content[6].value = self.config.get('colorMain');
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

ambx.prototype.setColor = function(data) {
    var self = this;

    var defer = libQ.defer();

    for (var key in data) {
        self.config.set(key, data[key]);
    }

    if(self.updateColor()){
        self.commandRouter.pushToastMessage('success', "Set Color", "Set color was successful");
        defer.resolve({});
    } else {
        self.commandRouter.pushToastMessage('error', "Set Color", "No connection to AmbX");
        defer.reject(new Error());
    }

    return defer.promise;
}

ambx.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

ambx.prototype.setUIConfig = function(data) {
};

ambx.prototype.getConf = function(varName) {
};

ambx.prototype.setConf = function(varName, varValue) {
};
