'use strict';

var libQ = require('kew');
var io = require('socket.io-client');
var Gpio = require('onoff').Gpio;
var sleep = require('sleep');

module.exports = RFAmpSwitchController;

function RFAmpSwitchController(context) {

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
    this.status = undefined;
    this.pin = undefined;
    this.socket = undefined;
}

RFAmpSwitchController.prototype.onVolumioStart = function() {

    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);
    return libQ.resolve();
};

RFAmpSwitchController.prototype.getConfigurationFiles = function() {
    return ['config.json'];
};

RFAmpSwitchController.prototype.onStart = function() {

    this.logger.debug('RFAmpSwitchController::onStart');

    var defer = libQ.defer();

    try {
        this.gpio = new Gpio(this.config.get('gpio'), 'out');
        this.socket = io.connect('http://localhost:3000');
        this.socket.on('pushState', this.readState.bind(this));
        defer.resolve();

    } catch(err) {
        this.logger.error('RFAmpSwitchController::onStart: ' + err);
        defer.reject(err);
    }

    return defer.promise;
};

RFAmpSwitchController.prototype.onStop = function() {

    this.logger.debug('RFAmpSwitchController::onStop');

    var defer = libQ.defer();

    try {
        this.socket.off('pushState');
        this.socket.disconnect();
        this.gpio.unexport();
        this.status = undefined;
        this.gpio = undefined;
        defer.resolve();

    } catch(err) {
        this.logger.error('RFAmpSwitchController::onStart: ' + err);
        defer.reject(err);
    }

    return defer.promise;
};

RFAmpSwitchController.prototype.getUIConfig = function() {

    this.logger.debug('RFAmpSwitchController::getUIConfig');

    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    this.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code+'.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf) {
            uiconf.sections[0].content[0].value.value = self.config.get('gpio');
            uiconf.sections[0].content[0].value.label = 'GPIO' + self.config.get('gpio');
            uiconf.sections[0].content[1].value = self.config.get('on');
            uiconf.sections[0].content[2].value = self.config.get('off');
            uiconf.sections[0].content[3].value = self.config.get('dt1');
            uiconf.sections[0].content[4].value = self.config.get('dt2');
            uiconf.sections[0].content[5].value = self.config.get('dtp');
            uiconf.sections[0].content[6].value = self.config.get('attempts');
            defer.resolve(uiconf);
        })
        .fail(function(e) {
            defer.reject(e);
        });

    return defer.promise;
};

RFAmpSwitchController.prototype.readState = function(state) {

    this.logger.debug('RFAmpSwitchController::readState: ' + state);

    var self = this;

    if (state.status == 'play' && state.status != this.status) {
        this.status = state.status;
        this.transmit(this.config.get('on'));

    } else if (state.status != 'play' && state.status != this.status) {
        this.status = state.status;
        setTimeout(function () {
            if (self.status != 'play') {
                self.transmit(self.config.get('off'));
            }
        }, 5000);
    }
};

RFAmpSwitchController.prototype.transmit = function(code) {

    this.logger.info('RFAmpSwitchController::transmit: trasmitting ' + code + ' on GPIO' + this.gpio.gpio);

    for (var i = 0; i < this.config.get('attempts'); i++) {
        
        for (var j = 0; j < code.length; j++) {

             if (code.charAt(j) == '1') {
                this.gpio.writeSync(1);
                sleep.usleep(this.config.get('dt1'));
                this.gpio.writeSync(0);
                sleep.usleep(this.config.get('dt2'));

             } else if (code.charAt(j) == '0') {
                this.gpio.writeSync(1)
                sleep.usleep(this.config.get('dt2'));
                this.gpio.writeSync(0)
                sleep.usleep(this.config.get('dt1'));
             
             } else {
                this.logger.error('RFAmpSwitchController::transmit: ' + code + ' is not valid');
                throw new Error(code + ' is not valid');
             }
        }

        this.gpio.writeSync(0)
        sleep.usleep(this.config.get('dtp'));
    }
};

RFAmpSwitchController.prototype.saveOptions = function(data) {

    this.logger.info('RFAmpSwitchController::saveOptions');

    var successful = true;

    try {
        this.gpio.unexport();
        this.gpio = new Gpio(data['gpio']['value'], 'out');

    } catch(err) {
        this.commandRouter.pushToastMessage('error','GPIO not accessible', '');
        this.gpio = new Gpio(this.config.get('gpio'),' out');
        successful = false;
    }
    
    if (!data['on'].match(/^[01]+$/)) {
        this.commandRouter.pushToastMessage('error','ON code not valid', '');
        successful = false;
    }

    if (!data['off'].match(/^[01]+$/)) {
        this.commandRouter.pushToastMessage('error','OFF code not valid', '');
        successful = false;
    }

    if (data['dt1'] < 100) {
        this.commandRouter.pushToastMessage('error','dT1 must be greater than 100us', '');
        successful = false;
    }

    if (data['dt2'] < 100) {
        this.commandRouter.pushToastMessage('error','dT2 must be greater than 100us', '');
        successful = false;
    }

    if (data['dtp'] < 1000) {
        this.commandRouter.pushToastMessage('error','dT2 must be greater than 1000us', '');
        successful = false;
    }

    if (data['attempts'] < 1) {
        this.commandRouter.pushToastMessage('error','attempts must be greater than 0', '');
        successful = false;
    }

    if (successful) {
        this.config.set('gpio', data['gpio']['value']);
        this.config.set('on', data['on']);
        this.config.set('off', data['off']);
        this.config.set('dt1', data['dt1']);
        this.config.set('dt2', data['dt2']);
        this.config.set('dtp', data['dtp']);
        this.config.set('attempts', data['attempts']);
        this.commandRouter.pushToastMessage('success','Settings successsfully updated', '');
    }
};
