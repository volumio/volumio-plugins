'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var Gpio = require('onoff').Gpio;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var buttonCount = 5;

module.exports = gpioRadioButtons;

function gpioRadioButtons(context) {
    var self = this;

    self.context       = context;
    self.commandRouter = self.context.coreCommand;
    self.logger        = self.context.logger;
    self.triggers      = [];
}

gpioRadioButtons.prototype.onVolumioStart = function () {
    var self = this;

    var configFile = self.commandRouter.pluginManager.getConfigurationFile(self.context, 'config.json');
    self.logger.info("GPIO Radio Buttons: config file: " + configFile);
    
    self.config = new (require('v-conf'))();
    self.config.loadFile(configFile);

    self.logger.info("GPIO Radio Buttons: initialized");
    
    return libQ.resolve();	
};

gpioRadioButtons.prototype.getConfigurationFiles = function()
{
    return ['config.json'];
};

gpioRadioButtons.prototype.onStart = function() {
    var self  = this;
    var defer =libQ.defer();

    self.gpioPins = self.config.get("gpioPins");
    self.logger.info("GPIO Radio Buttons: Using gpio pins from config file: [" + self.gpioPins + "]");
    
    self.createTriggers()
        .then (function (result) {
            self.logger.info("GPIO Radio Buttons: Triggers installed");
            defer.resolve();
        });

    return defer.promise;
};

gpioRadioButtons.prototype.onStop = function() {
    var self  = this;
    var defer = libQ.defer();

    self.clearTriggers()
        .then (function (result) {
            self.logger.info("GPIO Radio Buttons: Triggers stopped");
            defer.resolve();
        });
    
    return defer.promise;
};


// Configuration Methods -----------------------------------------------------------------------------

gpioRadioButtons.prototype.getUIConfig = function () {
    var self  = this;
    var defer = libQ.defer();

    self.logger.info('GPIO Radio Buttons: Getting Web Radio Favourites');
    socket.emit('browseLibrary', { uri: 'radio/favourites' } );

    socket.once('pushBrowseLibrary', function(data) {

        // Set up option arrays
        var pinOptions = [];
        self.gpioPins.forEach(function(item){
            pinOptions.push({"value": item, "label": item.toString() });			
        })

        var stationOptions = [];
        data.navigation.lists[0].items.forEach(function(item, index, array){
            stationOptions.push({"value": { stationName: item.title, stationUri: item.uri }, "label": item.title});
        });
            
        self.logger.info('GPIO Radio Buttons: Getting UI config');

        var lang_code = 'en'; // self.commandRouter.sharedVars.get('language_code');
        
        self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json', 
                                    __dirname + '/i18n/strings_en.json', 
                                    __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            self.logger.info('GPIO Radio Buttons: Starting UI config build');

            if (stationOptions.length === 0) {
                uiconf.sections[0].label = 'Cannot set up GPIO Radio Buttons without at least one entry in Favourite Radios';
                uiconf.sections[0].icon = 'fa-exclamation-circle';
                delete uiconf.sections[0].onSave;
                delete uiconf.sections[0].saveButton;
                uiconf.sections[0].content.push(
                       {
                         "id": "warning",
                         "element": "section",
                         "label": "Configuration needed!",
                         "doc": "The GPIO Radio Buttons plugin works with radio stations in the 'Favourite Radios' section and there don't appear to be any. Please add one or more radio stations to 'Favourite Radios' and try again."
                       });
            
            } else {
            
                for (var index = 1; index <= buttonCount; index++) {

                    var button      = "button" + index.toString(); 
                    var isEnabled   = self.config.get(button + '.enabled', false);
                    var gpioPin     = self.config.get(button + '.pin', 0);
                    var stationName = self.config.get(button + '.stationName', "");
                    var stationUri  = self.config.get(button + '.stationUri', "");

                    var config = {
                        isEnabled  : isEnabled,
                        gpioPin    : gpioPin,
                        stationName: stationName,
                        stationUri : stationUri
                    };

                    self.logger.info('GPIO Radio Buttons: button: ' + button + ' enabled: ' + isEnabled.toString() + ' on pin ' + gpioPin.toString() + ' for station ' + stationName + ' with URI ' + stationUri);

                    self.buildUIConfig(uiconf, index, config, pinOptions, stationOptions);
                }
            }
            // console.log(JSON.stringify(uiconf));

            defer.resolve(uiconf);
        })
        .fail(function(err)
        {
            self.logger.error('GPIO Radio Buttons: Error building Radio Button UI ' + err.toString());
            defer.reject(new Error());
        });
    });

    return defer.promise;
};

// Dynamically build up a UI section for a given button
gpioRadioButtons.prototype.buildUIConfig = function(uiconf, index, config, pinOptions, stationOptions) {
    var buttonNumber = index.toString();
    var buttonName   = "button" + buttonNumber;

    var enabledFieldName = buttonName + "Enabled";
    var gpioPinFieldName = buttonName + "Pin";
    var stationFieldName = buttonName + "Station";

    uiconf.sections[0].content.push(
           {
             "id": enabledFieldName,
             "element": "switch",
             "label": "Enable Button " + buttonNumber,
             "value": config.isEnabled
           });

    uiconf.sections[0].content.push(
          {
            "id": gpioPinFieldName,
            "element": "select",
            "label": "GPIO Pin",
            "value": { "value": config.gpioPin, "label": config.gpioPin.toString() },
            "options": pinOptions,
            "visibleIf": {
              "field": enabledFieldName,
              "value": true
            }
          });

    uiconf.sections[0].content.push(
         {
            "id": stationFieldName,
            "element": "select",
            "label": "Radio Station (from Web Radio Favourites)",
            "value": { "value": { stationName: config.stationName, stationUri: config.stationUri }, "label": config.stationName },
            "options": stationOptions,
            "visibleIf": {
              "field": enabledFieldName,
              "value": true
            }
         });

    uiconf.sections[0].saveButton.data.push(enabledFieldName);
    uiconf.sections[0].saveButton.data.push(gpioPinFieldName);
    uiconf.sections[0].saveButton.data.push(stationFieldName);

}

gpioRadioButtons.prototype.saveConfig = function (data) {
    var self = this;

    //console.log(JSON.stringify(data));
    for (var index = 1; index <= buttonCount; index++) {
        var button = "button" + index.toString(); 

        var buttonEnabled = data[button + 'Enabled'];
        self.config.set(button + '.enabled', buttonEnabled);

        if (buttonEnabled) {
            self.config.set(button + '.pin',         data[button + 'Pin']['value']);
            self.config.set(button + '.stationName', data[button + 'Station']['value'].stationName);
            self.config.set(button + '.stationUri',  data[button + 'Station']['value'].stationUri);
        } else {
            self.config.set(button + '.pin',         0);
            self.config.set(button + '.stationName', "");
            self.config.set(button + '.stationUri',  "");		
        }
    }

    self.clearTriggers()
        .then(self.createTriggers());

    self.commandRouter.pushToastMessage('success',"GPIO Radio Buttons", "Configuration saved");
};

// Triggers ---------------------------------------------------------------------------------------------
gpioRadioButtons.prototype.createTriggers = function() {
    var self = this;

    self.logger.info('GPIO Radio Buttons: Reading config and creating triggers...');

    for (var index = 1; index <= buttonCount; index++) {
        var button      = "button" + index.toString(); 
        var isEnabled   = self.config.get(button + '.enabled');
        var gpioPin     = self.config.get(button + '.pin');
        var stationName = self.config.get(button + '.stationName', "");
        var stationUri  = self.config.get(button + '.stationUri', "");

        if (isEnabled === true) {
            self.logger.info('GPIO Radio Buttons: '+ button + ' on pin ' + gpioPin.toString() + ' tunes to ' + stationName + ' using uri ' + stationUri);
            var pin = new Gpio(gpioPin, 'in', 'rising', {debounceTimeout: 250});
            pin.watch(self.listener.bind(self, {stationName: stationName, stationUri: stationUri}));
            self.triggers.push(pin);
        }
    }
        
    return libQ.resolve();
};

gpioRadioButtons.prototype.clearTriggers = function() {
    var self = this;
    
    self.triggers.forEach(function(trigger, index, array) {
        self.logger.info("GPIO Radio Buttons: Destroying trigger " + index);

        trigger.unwatchAll();
        trigger.unexport();		
    });
    
    self.triggers = [];

    return libQ.resolve();	
};

gpioRadioButtons.prototype.listener = function(station, err, value) {
    var self = this;
    
    self.logger.info('GPIO Radio Buttons: Changing station to ' + station.stationName);
    self.changeStation(station);
};

gpioRadioButtons.prototype.changeStation = function(station) {
    var payload = {
                    "item": {
                               "title": station.stationName,
                               "uri": station.stationUri,
                               "service": "webradio"
                            }
                  };

   socket.emit('replaceAndPlay', payload);
}

// Unused methods
gpioRadioButtons.prototype.onRestart = function () {
    var self = this;
};

gpioRadioButtons.prototype.onInstall = function () {
    var self = this;
};

gpioRadioButtons.prototype.onUninstall = function () {
    var self = this;
};

gpioRadioButtons.prototype.getConf = function (varName) {
    var self = this;
};

gpioRadioButtons.prototype.setConf = function(varName, varValue) {
    var self = this;
};

gpioRadioButtons.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
};

gpioRadioButtons.prototype.setAdditionalConf = function () {
    var self = this;
};

gpioRadioButtons.prototype.setUIConfig = function (data) {
    var self = this;
};