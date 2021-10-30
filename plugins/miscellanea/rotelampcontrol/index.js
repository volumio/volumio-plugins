//to do:
//- check if less requests necessary, because we receive events from amp anyway
//- implement volume mapto100
//- implementation for amps with less commands (e.g. missing mute)
//- saving of options
//- switching of input
//- pause on input change
//- pause on mute
//- powerdown on volumio shutdown
//- powerdown after time stopped

'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var spawn = require('child_process').spawn;
const EventEmitter = require('events').EventEmitter;

module.exports = rotelampcontrol;
function rotelampcontrol(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;

}

rotelampcontrol.prototype.onVolumioStart = function()
{
    var self = this;

    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);
    this.messageReceived = new EventEmitter();

    return libQ.resolve();
}

rotelampcontrol.prototype.onStart = function() {
    var self = this;
    var defer=libQ.defer();
    //set some important parameters
	self.debugLogging = (self.config.get('logging')==true);
    self.detectedModel = '';
    self.currentSource = '';
    self.currentPower = 'off';   
    self.selectedAmp ={} ;
	self.loadI18nStrings(); 
    self.objVolume = {};
    self.ampVolume = self.config.get('startupVolume');
    if (self.config.get('mapTo100')) {
        //calculate the equivalent volume on a 0...100 scale
        self.objVolume.vol = parseInt((self.config.get('startupVolume')-self.config.get('minVolume')/(self.config.get('maxVolume')-self.config.get('minVolume'))*100))
    } else {
        self.objVolume.vol = self.config.get('startupVolume');        
    }
    self.objVolume.mute = false;
    self.objVolume.premutevolume = self.objVolume.vol;
    self.objVolume.disableVolumeControl = false;
    //load amp definitions from file
    self.loadAmpDefinitions()
    //initialize list of serial devices available to the system
    .then(_=> self.listSerialDevices())
    //set the active amp
    .then(_ => self.setActiveAmp())
    //configure the serial interface
    .then(_ => self.configSerialInterface())
    //attach listener to handle messages from the amp
    .then(serialDev => self.attachListener(serialDev))
    //determine the current settings of the amp
    .then(_ => self.getAmpStatus())
    .then(_ => self.updateVolumeSettings())
    // .then(function(){

    // })
    .then(function(){
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] onStart: successfully started plugin');
            defer.resolve();
    });
    
    return defer.promise;
};

rotelampcontrol.prototype.loadAmpDefinitions = function() {
    var self = this;

    var ampDefinitionFile = this.commandRouter.pluginManager.getConfigurationFile(this.context,'ampCommands.json')
    self.ampDefinitions = new(require('v-conf'))();
    self.ampDefinitions.loadFile(ampDefinitionFile);
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] loadAmpDefinitions: loaded AmpDefinitions: ' + JSON.stringify(self.ampDefinitions.data));
    //Generate list of Amp Names as combination of Vendor + Model
    self.ampVendorModelList = [];
    for (var n = 0; n < self.ampDefinitions.data.amps.length; n++)
    {
        self.ampVendorModelList.push(self.ampDefinitions.data.amps[n].vendor + ' - ' + self.ampDefinitions.data.amps[n].model);
    };
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] loadAmpDefinitions: loaded AmpDefinitions for ' + self.ampVendorModelList.length + ' Amplifiers.');
    return libQ.resolve();
};

rotelampcontrol.prototype.getAmpStatus = function() {
    var self = this;
    var defer = libQ.defer();

    //send some requests to determine the current settings of the amp
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] getAmpStatus: sending status requests to Amp');
    self.sendStatusRequest('reqModel')
    .then(_ => self.sendStatusRequest('reqPower'))
    .then(_ => self.sendStatusRequest('reqVolume'))
    .then(_ => self.sendStatusRequest('reqMute'))
    .then(_ => self.sendStatusRequest('reqSource'))
    .then(_ => {
        defer.resolve();
    })
    return defer.promise;
}

rotelampcontrol.prototype.setActiveAmp = function() {
    var self = this;

    if ((self.config.get('ampType')!==undefined)&&(self.config.get('ampType')!=='...'))  {
        var selectedAmpIdx = self.ampVendorModelList.indexOf(self.config.get('ampType'));
        self.selectedAmp = self.ampDefinitions.data.amps[selectedAmpIdx];
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] setActiveAmp: ' + JSON.stringify(self.selectedAmp));
    } else {
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] setActiveAmp: not yet configured');
        self.selectedAmp = {};
    }
    return libQ.resolve();
}

rotelampcontrol.prototype.getConfigurationFiles = function() {
    return ['config.json','ampCommands.json'];
}

rotelampcontrol.prototype.onStop = function() {
    var self = this;

    self.detachListener();
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] onStop: successfully stopped plugin');

    return libQ.resolve();
};

rotelampcontrol.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

rotelampcontrol.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;
    var selected = 0;
    var lbl = "";

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            //serial_interface section
            var serialFromConfig = self.config.get('serialInterfaceDev')
            selected = 0;
            for (var n = 0; n < self.serialDevices.length; n++)
            {
                self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[0].options', {
                    value: n+1,
                    label: self.serialDevices[n]
                });
                if (self.serialDevices[n] == serialFromConfig) {
                    selected = n+1;
                }
            };
            if (selected > 0) {
                uiconf.sections[0].content[0].value.value = selected;
                uiconf.sections[0].content[0].value.label = serialFromConfig;                
            }

            // amp_settings section
            var ampFromConfig = self.config.get('ampType');
            selected = 0;
            for (var n = 0; n < self.ampVendorModelList.length; n++)
            {
                self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[0].options', {
                    value: n+1,
                    label: self.ampVendorModelList[n]
                });
                if (self.ampVendorModelList[n] == ampFromConfig) {
                    selected = n+1
                }
            };
            if (selected > 0) {
                uiconf.sections[1].content[0].value.value = selected;
                uiconf.sections[1].content[0].value.label = ampFromConfig;                
            }
            //populate input selector drop-down
            if (ampFromConfig != "...") {
                for (var n = 0; n < self.ampDefinitions.data.amps[0].sources.length; n++)
                {
                    self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[1].options', {
                        value: n+1,
                        label: self.ampDefinitions.data.amps[0].sources[n]
                    });
                };                
            } else {
                //deactivate
            }
            // uiconf.sections[1].content[2].
			uiconf.sections[2].content[0].value = (self.config.get('logging')==true)
            // debug_settings section
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            self.logger.error('[ROTELAMPCONTROL] getUIConfig: failed');
            defer.reject(new Error());
        });

    return defer.promise;
};

rotelampcontrol.prototype.setUIConfig = function(data) {
    var self = this;
    //Perform your installation tasks here
};

rotelampcontrol.prototype.getConf = function(varName) {
    var self = this;
    //Perform your installation tasks here
};

rotelampcontrol.prototype.setConf = function(varName, varValue) {
    var self = this;
    //Perform your installation tasks here
};

//configure serial interface according to ampDefinition file
rotelampcontrol.prototype.configSerialInterface = function (){
    var self = this;
    var defer = libQ.defer();
    if ((self.config.get('serialInterfaceDev')!==undefined) && 
        (self.config.get('serialInterfaceDev')!=='...') &&
        (Object.keys(self.selectedAmp).length > 0))  {
            //define the configuration of the serial interface
            const bits = parseInt(self.selectedAmp.dataBits);
            self.serialOptions = ''
            if ((bits > 4) && (bits <9)) {
                self.serialOptions = ' cs'+bits;
            };
            switch (self.selectedAmp.handshaking) {
                case 'RTS/CTS':
                    self.serialOptions = self.serialOptions + ' crtscts';
                    break;
                case 'DTR/DSR':
                    self.serialOptions = self.serialOptions + ' cdtrdsr';
                    break;
                default:
                    break;
            };
            switch (parseInt(self.selectedAmp.stopBit)) {
                case 1:
                    self.serialOptions = self.serialOptions + ' -cstopb';
                    break;
                case 2:
                    self.serialOptions = self.serialOptions + ' cstopb';
                    break;
                default:
                    break;
            };
            switch (self.selectedAmp.parity) {
                case 'no':
                    self.serialOptions = self.serialOptions + ' -parenb';
                    break;
                case 'odd':
                    self.serialOptions = self.serialOptions + ' parenb parodd';
                    break;
                case 'even':
                    self.serialOptions = self.serialOptions + ' parenb -parodd';
                    break;
                default:
                    break;
            }
            if (self.selectedAmp.ttyOptions != undefined) {
                self.serialOptions = self.serialOptions + ' ' + self.selectedAmp.ttyOptions;        
            }
            //construct the path to the device
            self.serialInterfaceDev = "/dev/serial/by-id/" + self.config.get('serialInterfaceDev');
            //construct the command for configuring the serial interface
            const cmdString = "/bin/stty -F " + self.serialInterfaceDev + ' ' + self.selectedAmp.baudRate + self.serialOptions;
            exec(cmdString, {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
                if (error !== null) {
                    self.logger.error('[ROTELAMPCONTROL] configSerialInterface: Error, cannot configure serial interface with "' + cmdString + '" ' + error)
                    defer.reject()
                } else {
                    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] configSerialInterface: Serial Interface configured with "' + cmdString +'"');
                    defer.resolve(self.serialInterfaceDev);
                }
            });
    } else {
        self.serialInterfaceDev = '';
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] configSerialInterface: Configuration still incomplete. Settings need to be completed.');
        defer.resolve('');
    }
    return defer.promise;
};

//read and return devices connected to RPi
rotelampcontrol.prototype.listSerialDevices = function() {
    var self = this;
    var defer = libQ.defer();

    self.commandRouter.logger.info('[ROTELAMPCONTROL] listSerialDevices');
    exec("/bin/ls /dev/serial/by-id", {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
        if (error !== null) {
            self.logger.error('[ROTELAMPCONTROL] listSerialDevices: Cannot list serial devices - ' + error)
            defer.reject();
        } else {
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] listSerialDevices: ' + stdout);
            self.serialDevices = stdout.split(/[\r\n|\n|\r]/).filter(String);
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] listSerialDevices: found ' + self.serialDevices.length + ' devices.');
            defer.resolve();
        }
    });
    return defer.promise;
}

//send commands to the amp
rotelampcontrol.prototype.sendCommand  = function(...cmd) {
    var self = this;
    var defer = libQ.defer();

    if (self.debugLogging) self.logger.info("[ROTELAMPCONTORL] sendCommand: send " + cmd);
    var cmdString = "/bin/echo -e -n ";
    switch (cmd[0]) {
        case  "powerOn": 
            break;
        case  "powerToggle": 
            break;
        case  "volUp": 
            cmdString = cmdString + self.selectedAmp.commands.volUp;
            break;
        case  "volDown": 
            cmdString = cmdString + self.selectedAmp.commands.volDown;
            break;
        case  "volValue": 
            cmdString = cmdString + self.selectedAmp.commands.volValue;
            var count = (cmdString.match(/#/g) || []).length;
            if (count > 0) {
                var re = new RegExp("#".repeat(count));
                cmdString = cmdString.replace(re,cmd[1].toString().padStart(count,"0"));
            } else {
                self.logger.error('[ROTELAMPCONTROL] sendCommand: volValue command string has no ## characters. Do not know how to send volume value.')
                defer.reject()
            }
            break;
        case  "mute": 
            cmdString = cmdString + self.selectedAmp.commands.mute;
            break;
        case  "muteOn": 
            cmdString = cmdString + self.selectedAmp.commands.muteOn;
            break;
        case  "muteOff": 
            cmdString = cmdString + self.selectedAmp.commands.muteOff;
            break;
        case  "source": 
            break;
        default:
            break;
    }
    cmdString = cmdString + ' > ' + self.serialInterfaceDev;    
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTORL] sendCommand: Send "' + cmdString +'"');
    exec(cmdString, {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
    if (error !== null) {
        self.logger.error('[ROTELAMPCONTROL] sendCommand: Could not send command to serial interface "' + cmdString + '" ' + error)
        defer.reject()
    } else {
        defer.resolve();
    }});

    return defer.promise;
}

//Rotel amps are not sending EOL characters, so we need to chop up the serial input
//at every separator and parse the resulting pieces
rotelampcontrol.prototype.chopResponse = function(data) {
    //first, chop up responses, if they do not arrive line by line
    var self = this;
    self.ampResponses += data.toString();
    var responses = self.ampResponses.split(self.selectedAmp.responses.separator);
    for (let i = 0; i < responses.length - 1; i++) {
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] chopResponse: ' + responses[i]);
        self.parseResponse(responses[i]);
    }
    self.ampResponses = responses[responses.length - 1];                
}

//interpret the responses received from the amp
rotelampcontrol.prototype.parseResponse = function(data) {
    //interpret and react on messages from amp
    var self = this;
    var vol = NaN;
    var source = NaN;
    var match = data.match(new RegExp(self.selectedAmp.responses.respVolume,'i'));
    if (match !== null) {
        vol = parseInt(match[1]);
        var response = 'volumeVal';
    } else {
        match = data.match(new RegExp(self.selectedAmp.responses.respSource,'i'));
        if (match !== null) {
            source = match[1];
            var response = 'sourceVal';
        } else {
            var response = data;
        }       
    } 
    switch (response) {
        case self.selectedAmp.responses.respPowerOn:
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled PowerOn');
            self.currentPower = 'on';
            self.messageReceived.emit('power', 'on');
            break;
        case self.selectedAmp.responses.respPowerOff:
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled PowerOff');            
            self.currentPower = 'standby';
            self.messageReceived.emit('power', 'standby');
            break;
        case self.selectedAmp.responses.respMuteOff:
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled MuteOff');            
            self.currentMute = false;
            self.objVolume.mute = false;
            self.messageReceived.emit('mute', false);
            self.commandRouter.volumioupdatevolume(self.objVolume);
            break;
        case self.selectedAmp.responses.respMuteOn:
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled MuteOn');            
            self.objVolume.mute = true;
            self.messageReceived.emit('mute', true);
            self.commandRouter.volumioupdatevolume(self.objVolume);
            break;
        case 'volumeVal':
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled volume is ' + vol);
            self.messageReceived.emit('volume', vol);
            self.ampVolume = parseInt(vol);
            if (self.config.get('mapTo100')) {
                //calculate the equivalent volume on a 0...100 scale
                self.objVolume.vol = parseInt((vol-self.config.get('minVolume')/(self.config.get('maxVolume')-self.config.get('minVolume'))*100))
            } else {
                self.objVolume.vol = vol;        
            }
            self.commandRouter.volumioupdatevolume(self.objVolume);
            break;
        case 'sourceVal':
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: Amp signaled source is ' + source);            
            self.messageReceived.emit('source', source);
            self.currentSource = source;
            break;
        default:
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] parseResponse: unhandled response "' + response +'"');
            break;
    }
};

//update the volumio Volume Settings, mainly make this an Override plugin
rotelampcontrol.prototype.updateVolumeSettings = function() {
	var self = this;

    //Prepare the data for updating the Volume Settings
    //first read the audio-device information, since we won't configure this 
    if (self.debugLogging) self.logger.info("[ROTELAMPCONTORL] updateVolumeSettings: Starting");
    var volSettingsData = {
	    'devicename': 'Rotel A12',
		'pluginType': 'miscellanea',
		'pluginName': 'rotelampcontrol',
        'volumeOverride': true
    };
    volSettingsData.device = self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getConfigParam', 'outputdevice');
    volSettingsData.name = self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'getAlsaCards', '')[volSettingsData.device].name;
    volSettingsData.mixer = self.config.get('ampType');
    volSettingsData.maxvolume = self.config.get('maxVolume');
    volSettingsData.volumecurve = '';
    volSettingsData.volumesteps = self.config.get('volumeSteps');
    volSettingsData.currentmute = self.objVolume.mute;
    if (self.debugLogging) self.logger.info("[ROTELAMPCONTORL] updateVolumeSettings: " + JSON.stringify(volSettingsData));
    self.commandRouter.volumioUpdateVolumeSettings(volSettingsData);
    return libQ.resolve();
};

//used to send status requests to the amp.
rotelampcontrol.prototype.sendStatusRequest = function(messageType) {
    var self = this;
    var defer = libQ.defer();

    var cmdString = '/bin/echo -e -n '
    switch (messageType) {
        case "reqPower":
            cmdString = cmdString + self.selectedAmp.statusRequests.reqPower;
            break;
        case "reqSource":
            cmdString = cmdString + self.selectedAmp.statusRequests.reqSource;
            break;
        case "reqVolume":
            cmdString = cmdString + self.selectedAmp.statusRequests.reqVolume;
            break;
        case "reqMute":
            cmdString = cmdString + self.selectedAmp.statusRequests.reqMute;
            break;
        case "reqModel":
            cmdString = cmdString + self.selectedAmp.statusRequests.reqModel;
            break;    
        default:
            break;
    };
    cmdString = cmdString + ' > ' + self.serialInterfaceDev;
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTORL] sendStatusRequest: Send "' + cmdString +'"');

    exec(cmdString, {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
    if (error !== null) {
        self.logger.error('[ROTELAMPCONTROL] sendStatusRequest: Could not send command to serial interface "' + cmdString + '" ' + error)
        defer.reject()
    } else {
        defer.resolve();
    }});
    return defer.promise;
}

//override the alsavolume function to send volume commands to the amp
rotelampcontrol.prototype.alsavolume = function (VolumeInteger) {
	var self = this;
    var defer = libQ.defer();
    
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: Set volume "' + VolumeInteger + '"')
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: selectedAmp' + JSON.stringify(self.selectedAmp));

    self.retrievevolume()
    .then(Volume => {
        switch (VolumeInteger) {
        case 'mute':
        // Mute
        if (self.selectedAmp.commands.muteOn != undefined) {
                //amp supports dedicated mute on command
                if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: send dedicated muteOn.');
                self.sendCommand('muteOn')
                .then(_ => retrievevolume())
                .then(Volume => defer.resolve(Volume))
            } else if (self.selectedAmp.commands.mute != undefined) {
                //amp only supports toggle mute command
                if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: send toggle mute.');
                if (!Volume.mute) {
                    self.sendCommand('mute')
                    .then(_ => retrievevolume())
                    .then(Volume => defer.resolve(Volume))                    
                }
            } else {
                //amp supports no mute command so we just put volume to defined min Vol
                if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: send Volume=0 to mute.');
                self.objVolume.premutevolume = self.objVolume.vol;
                self.sendCommand('volValue',self.config.get('minVolume'))
                .then(_ => retrievevolume())
                .then(Volume => defer.resolve(Volume))
            }
            break;
        case 'unmute':
        // Unmute (inverse of mute)
            if (self.selectedAmp.commands.muteOn != undefined) {
                if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: send dedicated muteOff.');
                self.sendCommand('muteOff')
                .then(_ => retrievevolume())
                .then(Volume => defer.resolve(Volume))
            } else if (self.selectedAmp.commands.mute != undefined) {
                if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: send toggle mute.');
                if (Volume.mute) {
                    self.sendCommand('mute')
                    .then(_ => retrievevolume())
                    .then(Volume => defer.resolve(Volume))
                }
            } else {
                if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: set Volume to premute value.');
                self.objVolume.vol = self.objVolume.premutevolume;
                if (self.config.get('mapTo100')) {
                    //calculate the equivalent volume on a 0...100 scale
                    self.ampVolume = parseInt(self.objVolume.vol * (self.config.get('maxVolume')-self.config.get('minVolume'))/100+self.config.get('minVolume'));
                } else {
                    self.ampVolume = self.objVolume.vol;
                }
                self.sendCommand('volValue',self.ampVolume)
                .then(_ => retrievevolume())
                .then(Volume => defer.resolve(Volume))
            }
            break;
        case 'toggle':
        // Toggle mute
            if (self.selectedAmp.commands.mute != undefined) {
                //amp supports toggle function
                if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: send toggle mute.');
                self.sendCommand('mute')
                .then(_ => retrievevolume())
                .then(Volume => defer.resolve(Volume))
            } else if (self.selectedAmp.commands.muteOn != undefined) {
                //amp only supports dedicated mute and off functions
                if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: send dedicated muteOn/Off base on current state.');
                if (Volume.mute) {
                    self.sendCommand('muteOff')
                    .then(_ => retrievevolume())
                    .then(Volume => defer.resolve(Volume))
                } else {
                    self.sendCommand('muteOn')
                    .then(_ => retrievevolume())
                    .then(Volume => defer.resolve(Volume))
                }
            } else {
                //amp supports no mute function
                if (Volume.mute) {
                    if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: set volume to 0 or premute value, depending on state.');
                    self.objVolume.vol = self.objVolume.premutevolume;
                    if (self.config.get('mapTo100')) {
                        //calculate the equivalent volume on a 0...100 scale
                        self.ampVolume = parseInt(self.objVolume.vol * (self.config.get('maxVolume')-self.config.get('minVolume'))/100+self.config.get('minVolume'));
                    } else {
                        self.ampVolume = self.objVolume.vol;
                    }
                    self.sendCommand('volValue',self.ampVolume)
                    .then(_ => retrievevolume())
                    .then(Volume => defer.resolve(Volume))
                } else {
                    self.objVolume.premutevolume = self.objVolume.vol;
                    self.sendCommand('volValue',self.config.get('minVolume'))
                    .then(_ => retrievevolume())
                    .then(Volume => defer.resolve(Volume))
                }
            }
            break;
        case '+':
        //increase volume by 1 step
            if (self.selectedAmp.commands.volUp != undefined) {
                if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: increase volume by single step.');
                //amp supports stepwise volume increase
                self.sendCommand('volUp')
                .then(_ => retrievevolume())
                .then(Volume => defer.resolve(Volume))
            } else {
                // if (self.config.get('mapTo100')) {
                //     //calculate the equivalent volume on a 0...100 scale
                //     self.ampVolume = parseInt(self.objVolume.vol * (self.config.get('maxVolume')-self.config.get('minVolume'))/100+self.config.get('minVolume'));
                // } else {
                //     self.ampVolume = self.objVolume.vol;
                // }
                // self.sendCommand('volValue',)
            }
            break;
        case '-':
        // decrease volume by 1 step
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: decrease volume by single step.');
            if (self.selectedAmp.commands.volDown != undefined) {
                //amp supports stepwise volume increase
                self.sendCommand('volDown')
                .then(_ => retrievevolume())
                .then(Volume => defer.resolve(Volume))
            } else {
            }
           break;
        default:
        //set volume to integer
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] alsavolume: set volume to integer value.');
            self.sendCommand('volValue',VolumeInteger)
            .then(_ => retrievevolume())
            .then(Volume => defer.resolve(Volume))
            break;   
    }})
    return defer.promise;

};

//overwrites the retrievevolume function, basically reads the current volume 
//from the amp and passes it back in an object together with mute info and
//boolean enable flag for vol control
//Other than original it does not call updateVolumeSettings, because that is already called from the
//response parsing function
rotelampcontrol.prototype.retrievevolume = function () {
    //override the retrievevolume function to read the volume from the amp
    var self = this;
    var defer = libQ.defer();    
    //request current volume
    self.messageReceived.once('volume',(vol) => {
        //check if muted
        self.objVolume.vol = vol;
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTORL] retrievevolume: vol:' + JSON.stringify(self.objVolume));
        self.messageReceived.once('mute',(muted) => {
            self.objVolume.mute = muted;
            self.objVolume.disableVolumeControl = false;
            if (self.debugLogging) self.logger.info('[ROTELAMPCONTORL] retrievevolume: returning:' + JSON.stringify(self.objVolume));
            defer.resolve(self.objVolume);
        })
        self.sendStatusRequest('reqMute');
    });
    self.sendStatusRequest('reqVolume');
    return defer.promise;
};

//get some additional parameters from Volumio 
rotelampcontrol.prototype.getAdditionalConf = function (type, controller, data) {
    var self = this;
    var confs = self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
    return confs;
};

//Gets called when user changes and saves debug settings
rotelampcontrol.prototype.updateDebugSettings = function (data) {
    var self = this;
    var defer = libQ.defer();
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTORL] updateDebugSettings: Saving Debug Settings:' + JSON.stringify(data));
    self.config.set('logging', (data['logging']))
    self.debugLogging = data['logging'];
    defer.resolve();
    self.commandRouter.pushToastMessage('success', self.getI18nString('TOAST_SAVE_SUCCESS'), self.getI18nString('TOAST_DEBUG_SAVE'));
    return defer.promise;
};

//Gets called when user changes and saves SerialDevice Settings
rotelampcontrol.prototype.updateSerialSettings = function (data) {
    var self = this;
    var defer = libQ.defer();
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTORL] updateSerialSettings: Saving Serial Settings:' + JSON.stringify(data));
    self.config.set('serialInterfaceDev', (data['serial_interface_dev'].label))
    defer.resolve();
    self.commandRouter.pushToastMessage('success', self.getI18nString('TOAST_SAVE_SUCCESS'), self.getI18nString('TOAST_SERIAL_SAVE'));
    return defer.promise;
};

//Gets called when user changes and saves AmpSettings
rotelampcontrol.prototype.updateAmpSettings = function (data) {
    var self = this;
    var defer = libQ.defer();
    if (self.debugLogging) self.logger.info('[ROTELAMPCONTORL] updateAmpSettings: Saving Amplifier Settings:' + JSON.stringify(data));
    self.config.set('ampType', data['amp_type'].label);
    self.config.set('volumioInput', data['volumio_input'].label);
    self.config.set('minVolume', parseInt(data['min_volume']));
    self.config.set('maxVolume', parseInt(data['max_volume']));
    self.config.set('startupVolume',  parseInt(data['startup_volume']));
    self.config.set('volumeSteps', parseInt(data['volume_steps']));
    self.config.set('mapTo100', (data['map_to_100']));
    self.config.set('pauseWhenMuted', (data['pause_when_muted']));
    self.config.set('pauseWhenInputChanged', (data['pause_when_input_changed']));
    defer.resolve();
    self.commandRouter.pushToastMessage('success', self.getI18nString('TOAST_SAVE_SUCCESS'), self.getI18nString('TOAST_AMP_SAVE'));
    return defer.promise;
};

// Retrieve a string
rotelampcontrol.prototype.getI18nString = function (key) {
    var self = this;

    if (self.i18nStrings[key] !== undefined) {
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] getI18nString("'+key+'"):'+ self.i18nStrings[key]);
        return self.i18nStrings[key];
    } else {
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] getI18nString("'+key+'")'+ self.i18nStringsDefaults[key]);
        return self.i18nStringsDefaults['ROTELAMPCONTROL'][key];
    };
}
// A method to get some language strings used by the plugin
rotelampcontrol.prototype.loadI18nStrings = function() {
    var self = this;

    try {
        var language_code = this.commandRouter.sharedVars.get('language_code');
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] loadI18nStrings: '+__dirname + '/i18n/strings_' + language_code + ".json");
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_' + language_code + ".json");
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] loadI18nStrings: loaded: '+JSON.stringify(self.i18nStrings));
    }
    catch (e) {
        if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] loadI18nStrings: ' + language_code + ' not found. Fallback to en');
        self.i18nStrings = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
    }

    self.i18nStringsDefaults = fs.readJsonSync(__dirname + '/i18n/strings_en.json');
};

rotelampcontrol.prototype.attachListener = function(devPath){
	var self = this;
	var defer = libQ.defer();

	if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] attachListener: ' + devPath);
    if (self.config.get('serialInterfaceDev') != "...") {
        try {
            self.handle = spawn("/bin/cat", [devPath]);
            self.ampResponses = "";
            self.handle.stdout.on('data', function(data){
                self.chopResponse(data);
            });
            self.handle.stdout.on('end', function(){
                if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] attachListener: Stream from Serial Interface ended.');
            });
            self.handle.stderr.on('data', (data) => {
                self.logger.error('[ROTELAMPCONTROL] attachListener: ' + `stderr: ${data}`);
            });

            self.handle.on('close', (code) => {
                if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] attachListener: ' + `child process exited with code ${code}`);
            });
        	if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] attachListener: attached and listening');
        	defer.resolve();
        } catch (error) {
            self.logger.error('[ROTELAMPCONTROL] attachListener: could not connect to device' + error);
            defer.reject();
        }
    }
	return defer.promise;
}

rotelampcontrol.prototype.detachListener = function (){
	var self = this;
	var defer = libQ.defer();
	if (self.debugLogging) self.logger.info('[ROTELAMPCONTROL] detachListener: ');
	self.handle.kill();
	defer.resolve();
	return defer.promise;
}