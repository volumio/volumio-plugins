'use strict';

// load external modules
var libQ = require('kew');
var io = require('socket.io-client');
var Gpio = require('onoff').Gpio;

var socket = io.connect('http://localhost:3000');


//declare global status variable
var status = 'na';

// Define the AmpSwitchController class
module.exports = AmpSwitchController;


function AmpSwitchController(context) {
	var self = this;

	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;
	this.configManager = this.context.configManager;

    //define shutdown variable
    self.shutdown;

}

// define behaviour on system start up. In our case just read config file
AmpSwitchController.prototype.onVolumioStart = function()
{
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

}

// Volumio needs this
AmpSwitchController.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

// define behaviour on plugin activation
AmpSwitchController.prototype.onStart = function() {
	var self = this;
	var defer=libQ.defer();

    // initialize output port
    self.ampGPIOInit();

    // read and parse status once
    socket.emit('getState','');
    socket.once('pushState', self.parseStatus.bind(self));

    // listen to every subsequent status report from Volumio
    // status is pushed after every playback action, so we will be
    // notified if the status changes
    socket.on('pushState', self.parseStatus.bind(self));

    defer.resolve();
	return defer.promise;
};

// define behaviour on plugin deactivation.
AmpSwitchController.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // we don't have to claim GPIOs any more
    self.freeGPIO();

    return defer.promise;
};

// initialize Plugin settings page
AmpSwitchController.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;
    self.logger.info('Port: ' + self.config.get('port'));
    self.logger.info('Inverted: ' + self.config.get('inverted'))

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
                                __dirname+'/i18n/strings_en.json',
                                __dirname + '/UIConfig.json')
    .then(function(uiconf)
          {
          uiconf.sections[0].content[0].value.value = self.config.get('port');
          uiconf.sections[0].content[0].value.label = self.config.get('port').toString();
          uiconf.sections[0].content[1].value = self.config.get('inverted');
          defer.resolve(uiconf);
          })
    .fail(function()
          {
          defer.reject(new Error());
          });
    
    return defer.promise;
};

// define what happens when the user clicks the 'save' button on the settings page
AmpSwitchController.prototype.saveOptions = function(data) {
    var self = this;
    var successful = true;
    var old_setting = self.config.get('port');

    // save port setting to our config
    self.logger.info('Set inverter to ' + data['inverted_setting'])
    self.config.set('port', data['port_setting']['value']);
    self.config.set('inverted', data['inverted_setting']);
    // unexport GPIOs before constructing new GPIO object
    self.freeGPIO();
    try{
        self.ampGPIOInit()
    } catch(err) {
        successful = false;
    }
    if(successful){
        // output message about successful saving to the UI
        self.commandRouter.pushToastMessage('Success','Settings', 'saved');
    } else {
        // save port setting to old config
        self.config.set('port', old_setting);
        self.commandRouter.pushToastMessage('Failure','Port not accessible', '');
    }

};

// initialize shutdown port to the one that we stored in the config
AmpSwitchController.prototype.ampGPIOInit = function() {
    var self = this;

    self.shutdown = new Gpio(self.config.get('port'),'out');
};

// a pushState event has happened. Check whether it differs from the last known status and
// switch output port on or off respectively
AmpSwitchController.prototype.parseStatus = function(state) {
    var self = this;

    if(state.status=='play' && state.status!=status){
        status=state.status;
        self.on();
    } else if((state.status=='pause' || state.status=='stop') && (status!='pause' && status!='stop')){
        status=state.status;
        self.off();
    }

};

// switch outport port on
AmpSwitchController.prototype.on = function() {
    var self = this;

    if(!self.config.get('inverted')){
        self.shutdown.writeSync(1);
    } else {
        self.shutdown.writeSync(0);
    }
};

//switch output port off
AmpSwitchController.prototype.off = function() {
    var self = this;

    if(!self.config.get('inverted')){
        self.shutdown.writeSync(0);
    } else {
        self.shutdown.writeSync(1);
    }
};

// stop claiming output port
AmpSwitchController.prototype.freeGPIO = function() {
    var self = this;

    self.shutdown.unexport();
};
