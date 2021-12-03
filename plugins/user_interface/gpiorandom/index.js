'use strict';
var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var Gpio = require('onoff').Gpio;

var button = null;          // gpio mapped button
var nbsongs = null;         // number of songs to randomly put in the queue
var clicktimeout = null;    // number of milisec to read for clicks before triggering actions
var nbclick = 0;            // number of clicks that have been counted during clicktimeout
var timeout = null;         // timeout handler used to match the number of click on the button
var debounceTimeout = null; // timeout used before accepting new interrupt on GPIO
var activeLow = null;       // tell weither active GPIO state is low
var edge = null;            // set IRQ trigger event (none, falling, rising, both)

var favouritesRadios = null;    // list of favourites radios, loaded when plugin is started

// map action combobox item ID
const OPTION_RANDOM     = 0;
const OPTION_PLAYPAUSE  = 1;
const OPTION_PLAYURI    = 2;
const OPTION_PLAYRADIO  = 3;

const OPTION_TRUE       = 1;
const OPTION_FALSE      = 0;

const OPTION_FALLING    = 0;
const OPTION_RISING     = 1;
const OPTION_BOTH       = 2;
const OPTION_NONE       = 3;
const EDGE_VALUES = ["falling", "rising", "both", "none"];


module.exports = gpiorandom;
function gpiorandom(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
}


gpiorandom.prototype.onVolumioStart = function() {
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
};


gpiorandom.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();

    self.load18nStrings();

    // init mandatory values but do nothing if no gpio is set
    var gpionum = self.config.get('gpionum');
    if (isNaN(gpionum) || gpionum == 0) {
        self.logger.info("gpioRandom : doing nothing until a gpio is set");
    } else {

        self.nbsongs = self.config.get('nbsongs');
        if (isNaN(self.nbsongs)) self.nbsongs = 20;

        self.clicktimeout = self.config.get('clicktimeout');
        if (isNaN(self.clicktimeout)) self.clicktimeout = 800;

        self.debounceTimeout = self.config.get('debounceTimeout');
        if (isNaN(self.debounceTimeout)) self.debounceTimeout = 5;

        var activeLowConfig = self.config.get('activeLow');
        if (activeLowConfig == "true")
            self.activeLow = true;
        else
            self.activeLow = false;

	var edgePosition = self.config.get('edge');
        if (isNaN(edgePosition)) self.edge = "falling";
        else self.edge = EDGE_VALUES[edgePosition];

        // init GPIO for button press detection (it should be IRQ backed, thus activeLow: true)
        self.logger.info("gpioRandom : init GPIO, edge = " + self.edge +" debounceTimeout = " + self.debounceTimeout + " activeLow = " + self.activeLow);
        self.button  = new Gpio(gpionum, 'in', self.edge, {debounceTimeout: self.debounceTimeout, activeLow: self.activeLow});
        self.nbclick = 0;
        self.timeout = null;

        // listen to pushed button and trigger the assigned action depending on number of detected clicks
        self.button.watch((err, value) => {
            if (value == 0 && self.activeLow == false) return;

            self.logger.info("gpioRandom : pressed button nbclick = " + self.nbclick);
            self.nbclick++;
            clearTimeout(self.timeout);

            // click timeout has passed : it's time to check how many time the button has been pressed
            self.timeout = setTimeout(function() {
                    switch (self.nbclick) {
                        case 1 :
                            self.logger.info("gpioRandom : single click");
                            self.handleAction('single');
                            break;
                        case 2 :
                            self.logger.info("gpioRandom : double click");
                            self.handleAction('double');
                            break;
                        case 3 :
                            self.logger.info("gpioRandom : tripple click");
                            self.handleAction('triple');
                            break;
                    }
                    self.nbclick = 0;
            },self.clicktimeout);

            if (err) {
                self.logger.info("gpioRandom : error - " + err);
            }
        });
    }

    // load favourites radios to build the list for settings
    self.loadRadiosList();

    // Once the Plugin has successfull started resolve the promise
    defer.resolve();

    return defer.promise;
};


gpiorandom.prototype.rand = function(max, min) {
    return Math.floor(Math.random() * (+max - +min)) + min;
}


gpiorandom.prototype.createPlaylist = function() {
    var self = this;
    var defer=libQ.defer();

    // stop before anything
    socket.emit('stop');

    // clear play list
    self.logger.info("gpioRandom : clear queue");
    socket.emit('clearQueue');

    // get random song from collection and add them to play list
    self.logger.info("gpioRandom : start to browse library...");
    socket.emit('browseLibrary', {'uri':'albums://'});

    // start browsing album and adding song to queue
    socket.on('pushBrowseLibrary',function(data) {
        var item = data.navigation.lists[0].items[0];

        // whlie browsing, we encounter either songs : we add it to playlist...
        if (item.type == 'song') {
            self.logger.info("gpioRandom : add to queue - " + item.title);
            socket.emit('addToQueue', {'uri':item.uri});
        } else { // ... or folders : we scan them for songs
            var list = data.navigation.lists[0].items;
            var random = self.rand(list.length - 1, 0);
            var select = list[random];

            //self.logger.info("gpioRandom : browse into " + item.title);
            socket.emit('browseLibrary', {'uri':select.uri});
        }
    });

    // as soon as maximum songs are in queue, stop listening to changes and start playing
    socket.on('pushQueue', function(data) {
        if (data.length >= self.nbsongs) {
            self.logger.info("gpioRandom : added "+self.nbsongs+ " - unregister library and queue event");
            socket.off('pushBrowseLibrary');
            socket.off('pushQueue');

            self.logger.info("gpioRandom : now start playing");
            socket.emit('play',{'value':0});
        } else {
            socket.emit('browseLibrary', {'uri':'albums://'});
        }
    });

    // Once the Plugin has successfully started resolve the promise
    defer.resolve();
    return libQ.resolve();
}


gpiorandom.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    self.logger.info("gpioRandom : stopping the plugin");

    // free up the GPIO
    self.logger.info("gpioRandom : free GPIO");
    if(typeof(self.button) == 'object') self.button.unexport();

    self.logger.info("gpioRandom : clear timeout");
    if(self.timeout != null) clearTimeout(self.timeout);

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};


gpiorandom.prototype.onRestart = function() {
    var self = this;
    self.onStop();
    self.onStart();
};


gpiorandom.prototype.saveMainSettings = function (data) {
    var self = this;
    var defer = libQ.defer();
    var error = false;

    //self.logger.info("gpioRandom : save setting" + JSON.stringify(data));

    self.logger.info("gpioRandom : settings => check for NaN ");
    if(isNaN(data['gpionum']))          data['gpionum']         = -1; 
    if(isNaN(data['debounceTimeout']))  data['debounceTimeout'] = -1;
    if(isNaN(data['clicktimeout']))     data['clicktimeout']    = -1;


    // do some quality check
    self.logger.info("gpioRandom : settings => check for validity ");
    if(data['gpionum'] <= 0) {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_NOT_A_NUMBER_TITLE"), self.getI18nString("ERROR_NOT_A_NUMBER_MESSAGE"));
        error = true;
    }

    if(data['debounceTimeout'] < 0) {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_NOT_A_NUMBER_TITLE"), self.getI18nString("ERROR_NOT_A_NUMBER_MESSAGE"));
        error = true;
    }

    if(data['clicktimeout'] <= 0) {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_NOT_A_NUMBER_TITLE"), self.getI18nString("ERROR_NOT_A_NUMBER_MESSAGE"));
        error = true;
    }

    self.logger.info("gpioRandom : settings => save values");

    // save numerical values from user input
    self.config.set('gpionum'           , parseInt(data['gpionum']),10);
    self.config.set('debounceTimeout'   , parseInt(data['debounceTimeout']),10);
    self.config.set('clicktimeout'      , parseInt(data['clicktimeout']),10);
    // save combobox
    self.config.set('activeLow'    , data['activeLow'].value);
    self.config.set('edge'         , data['edge'].value);

    if(!error) {
        self.commandRouter.pushToastMessage('success', self.getI18nString("SUCCESS_TITLE"), self.getI18nString("SUCCESS_MESSAGE"));
    }

    defer.resolve();
    return defer.promise;
};

gpiorandom.prototype.saveActionSettings = function (data) {
    var self = this;
    var defer = libQ.defer();
    var error = false;

    //self.logger.info("gpioRandom : save setting" + JSON.stringify(data));

    self.logger.info("gpioRandom : settings => check for NaN ");
    if(isNaN(data['nbsongs'])) data['nbsongs'] = -1;


    // do some quality check
    if(data['nbsongs'] <= 0) {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_NOT_A_NUMBER_TITLE"), self.getI18nString("ERROR_NOT_A_NUMBER_MESSAGE"));
        error = true;
    }

    if(data['singleclick'] == true && data['singleclickAction'].value == OPTION_PLAYURI && data['singleuri'] == "") {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_EMPTY_URI_TITLE"), self.getI18nString("ERROR_EMPTY_URI_MESSAGE"));
        error = true;
    }

    if(data['doubleclick'] == true && data['doubleclickAction'].value == OPTION_PLAYURI && data['doubleuri'] == "") {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_EMPTY_URI_TITLE"), self.getI18nString("ERROR_EMPTY_URI_MESSAGE"));
        error = true;
    }

    if(data['tripleclick'] == true && data['tripleclickAction'].value == OPTION_PLAYURI && data['tripleuri'] == "") {
        self.commandRouter.pushToastMessage('error', self.getI18nString("ERROR_EMPTY_URI_TITLE"), self.getI18nString("ERROR_EMPTY_URI_MESSAGE"));
        error = true;
    }

    self.logger.info("gpioRandom : settings => save values");

    // save numerical values from user input
    self.config.set('nbsongs', parseInt(data['nbsongs']),10);

    // save single click comboboxes values
    self.saveSettingsHelper('single', data);
    self.saveSettingsHelper('double', data);
    self.saveSettingsHelper('triple', data);

    if(!error) {
        self.commandRouter.pushToastMessage('success', self.getI18nString("SUCCESS_TITLE"), self.getI18nString("SUCCESS_MESSAGE"));
    }

    defer.resolve();
    return defer.promise;
};

gpiorandom.prototype.saveSettingsHelper = function (type, data) {
    var self = this;

    self.logger.info("gpioRandom : settings => save "+type+" click");
    self.config.set(type+'click'       , data[type+'click']);

    if(data[type+'click']) {
        self.config.set(type+'clickAction' , data[type+'clickAction'].value);
    } else {
        self.config.set(type+'clickAction' , 0); // reset combo if detection is disabled
    }

    if(data[type+'clickAction'].value == OPTION_PLAYURI) {
        self.config.set(type+'uri'         , data[type+'uri']);
    }

    if(data[type+'clickAction'].value == OPTION_PLAYRADIO) {
        self.logger.info("gpioRandom : "+type+" clickAction is PLAYRADIO");
        self.logger.info("gpioRandom : "+type+" radioValue saved to " + data[type+'radio'].value);
        self.logger.info("gpioRandom : "+type+" radioLabel saved to " + data[type+'radio'].label);
        self.config.set(type+'radioValue'  , data[type+'radio'].value);
        self.config.set(type+'radioLabel'  , data[type+'radio'].label);
    }
};


// generic action handling depending on type which should be one of 'single', 'double' or 'triple'
gpiorandom.prototype.handleAction = function (type) {
    var self = this;
    var active = self.config.get(type + 'click');
    var action = self.config.get(type + 'clickAction');

    // do nothing if action not activated
    if(!active) return;

    self.logger.info('gpioRandom : doing action for ' + type + 'click');

    switch(action) {
        case OPTION_RANDOM:
            self.logger.info("gpioRandom : action for " + type + "click is play random playlist");
            self.createPlaylist();
            break;

        case OPTION_PLAYPAUSE:
            self.logger.info("gpioRandom : action for " + type + "click is toggle play/pause");
            socket.emit('toggle');
            break;

        case OPTION_PLAYURI:
            var uri = self.config.get(type + 'uri');
            self.logger.info("gpioRandom : action for " + type + "click is play URI. URI = " + uri);
            socket.emit('replaceAndPlay', {'type': 'webradio', 'service':'webradio', "uri": uri});
            break;

        case OPTION_PLAYRADIO:
            var uri = self.config.get(type + 'radioValue');
            self.logger.info("gpioRandom : action for " + type + "click is play RADIO. RADIO URI = " + uri);
            socket.emit('replaceAndPlay', {'type': 'webradio', 'service':'webradio', "uri": uri});
            break;
    }
}


gpiorandom.prototype.load18nStrings = function () {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
    } catch (e) {
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};


gpiorandom.prototype.getI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined)
        return self.i18nStrings[key];
    else
        return self.i18nStringsDefaults[key];
};


gpiorandom.prototype.loadRadiosList = function (userCallback) {
    var self = this;

    // browser for favourites radios and keep the list cached to use it in settings page
    socket.emit('browseLibrary', {'uri':'radio/favourites'});
    socket.on('pushBrowseLibrary',function(data) {
        self.favouritesRadios = Array();
        for(var item in data.navigation.lists[0].items) {
            //self.logger.info("gpioRandom : loadRadiosList - radio " + JSON.stringify(data.navigation.lists[0].items[item]));
            self.favouritesRadios.push({'value':data.navigation.lists[0].items[item].uri,'label':data.navigation.lists[0].items[item].title});
        }

        self.logger.info("gpioRandom : loadRadiosList - list done - unregister browseLibrary event");
        socket.off('pushBrowseLibrary');
        //self.logger.info("gpioRandom : loadRadiosList - radio list = " + JSON.stringify(self.favouritesRadios));
    });
}


// Configuration Methods -----------------------------------------------------------------------------

gpiorandom.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            //self.logger.info("gpioRandom : load setting - uiconf = " + JSON.stringify(uiconf));

            // Load base settings
            self.logger.info("gpioRandom : load setting - base conf");
            uiconf.sections[0].content[0].value = self.config.get('gpionum');
            uiconf.sections[0].content[1].value = self.config.get('debounceTimeout');
            self.getUIConfigComboBox('activeLow'  , 2, uiconf);
            self.getUIConfigComboBox('edge'       , 3, uiconf);
            uiconf.sections[0].content[4].value = self.config.get('clicktimeout');


            // load click settings
            uiconf.sections[1].content[0].value = self.config.get('nbsongs');
            self.getUIConfigHelper('single', 1, 2, 3, 4, uiconf);
            self.getUIConfigHelper('double', 5, 6, 7, 8, uiconf);
            self.getUIConfigHelper('triple', 9,10,11,12, uiconf);

            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

gpiorandom.prototype.getUIConfigHelper = function(type, index1, index2, index3, index4, uiconf) {
    var self = this

    self.logger.info("gpioRandom : load setting - "+type+" + click");
    uiconf.sections[1].content[index1].value = self.config.get(type+'click') == 1 ? true:false;
    if(typeof self.config.get(type+'clickAction') != 'undefined') {
        uiconf.sections[1].content[index2].value.value = self.config.get(type+'clickAction');
        uiconf.sections[1].content[index2].value.label = uiconf.sections[1].content[index2].options[self.config.get(type+'clickAction')].label;
    }
    uiconf.sections[1].content[index3].value = self.config.get(type+'uri');

    uiconf.sections[1].content[index4].options = self.favouritesRadios;
    if(typeof self.config.get(type+'radioValue') != 'undefined') {
        uiconf.sections[1].content[index4].value.value = self.config.get(type+'radioValue');
        uiconf.sections[1].content[index4].value.label = self.config.get(type+'radioLabel');
    }
}

gpiorandom.prototype.getUIConfigComboBox = function(name, index, uiconf) {
    var self = this

    self.logger.info("gpioRandom : load combobox setting - "+name + " / value = " +self.config.get(name) );

    if(typeof self.config.get(name) != 'undefined') {
        uiconf.sections[0].content[index].value.value = self.config.get(name);
        uiconf.sections[0].content[index].value.label = uiconf.sections[0].content[index].options[self.config.get(name)].label;
    }
}


gpiorandom.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

gpiorandom.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

gpiorandom.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

gpiorandom.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};
