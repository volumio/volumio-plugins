
var libQ = require('kew');
var fs=require('fs-extra');
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



onkyoControl.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

onkyoControl.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();


    // Once the Plugin has successfull started resolve the promise
    defer.resolve();


     eiscp.on('connect', function () {
	if (self.currentState === 'play') {
		self.logger.info("ONKYO-CONTROL:  eiscp.command('system-power=on')");
	        eiscp.command('system-power=on', function () {
			self.logger.info("ONKYO-CONTROL:  eiscp.disconnect()");
                        eiscp.disconnect();
			 self.logger.info("ONKYO-CONTROL:  eiscp.disconnect() finished");
                });
      	} else if (self.currentState === 'stop') {
                self.logger.info("ONKYO-CONTROL:  eiscp.command('system-power=standby')");
                eiscp.command('system-power=standby', function () {
                        self.logger.info("ONKYO-CONTROL:  eiscp.disconnect()");
                        eiscp.disconnect();
                         self.logger.info("ONKYO-CONTROL:  eiscp.disconnect() finished");
                });
	}
    });









    socket.on('pushState', function (state) {

	if (self.currentState && state.status !== self.currentState && !eiscp.is_connected) {
		self.logger.info("ONKYO-CONTROL: *********** ONKYO PLUGIN STATE CHANGE ********");
		self.logger.info("ONKYO-CONTROL: New state: " + JSON.stringify(state));
		self.logger.info("ONKYO-CONTROL: eiscp not connected. Connecting... ");
		eiscp.connect({ port: 60128, reconnect: false, reconnect_sleep: 5, modelsets: [], send_delay: 500, verify_commands: false });
	}
	self.currentState = state.status;

    });

    self.logger.info("ONKYO-CONTROL: *********** ONKYO PLUGIN STARTED ********");

    return defer.promise;
};

onkyoControl.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

onkyoControl.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

onkyoControl.prototype.getUIConfig = function() {
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


onkyoControl.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

onkyoControl.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

onkyoControl.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};
