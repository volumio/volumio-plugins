'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
const { BluetoothSurfaceDial } = require('./btSurfaceDial.js');

/**
 * Note: this module relies on 'music_service/input'. It makes use of the
 * 'alsavolume()' function provided by that plugin.
 */

module.exports = msSurfaceDial;
function msSurfaceDial(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

	this.loggerLabel = 'msSurfaceDial';
	this.eventStream = null;
	this.dialPressed = false;
	this.dialValue = 0; // debug purpose only

    this.btSurfaceDial = new BluetoothSurfaceDial(this.logger, this.loggerLabel);
}



msSurfaceDial.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();
}

msSurfaceDial.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();

    /** TBD: Failed Attempt to override the transport level so that debug() will appear
     *  in journalctl output.
     
    this.logger.info(`${this.loggerLabel} Transports: ${this.logger.transports}`);
    if (! Array.isArray(this.logger.transports)){
        this.logger.info(`${this.loggerLabel} more than one-transport - not overriding the logger level.`);
    }
    else {
        this.logger.info(`${this.loggerLabel} overriding the logger level to 'debug`);
        this.logger.transports.level = "debug";
    }
    */

    this.setupBtSurfaceDialEventListeners();
    this.btSurfaceDial.init();
    

	// Start handling input-events from connected Surface-Dial
	if (this.openEventStream(this.config.get('default.inputEventPath'))) {
		this.logger.info(`${this.loggerLabel} Started Successfully.`);
		// Once the Plugin has successfull started resolve the promise
		defer.resolve();
	}
	else {
		this.logger.error(`${this.loggerLabel} Start failed.`);
		defer.reject(new Error(`${this.loggerLabel} Failed to start`));
	}

    return defer.promise;
};

msSurfaceDial.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    this.btSurfaceDial.deInit();

	if (this.eventStream) {
		this.eventStream.destroy();
		this.eventStream = null;
	}
	this.logger.info(`${this.loggerLabel} Stopped.`);
    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

msSurfaceDial.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

msSurfaceDial.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    self.logger.info(`${this.loggerLabel} Loading SurfaceDial UI...`);
    
    var lang_code = this.commandRouter.sharedVars.get('language_code');

    const contentIdx = {
        BTStatus: 0,
        SDialStatus: 1,
        BTAvailOn: 2,
        BTAvailOff: 3,
        BTOnPaired: 4,
        BTOnNotPaired: 5,
        PairedConnected: 6,
        PairedNotConnected: 7
    };

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            fs.readJson(__dirname+'/i18n/strings_'+lang_code+'.json', null, (err, stringsLangObj) => {
                if (err) {
                    defer.reject(err)
                }
                else {
                    if (! self.btSurfaceDial.btAdapterAvailable) {
                        uiconf.sections[0].content[contentIdx.BTStatus].value = stringsLangObj.BT_STATUS.NO_ADAPTER;
                        uiconf.sections[0].content[contentIdx.SDialStatus].value = stringsLangObj.SDIAL_STATUS.UNCONNECTED;
                        uiconf.sections[0].content[contentIdx.BTAvailOn].value = false; // BT Avail and On
                        uiconf.sections[0].content[contentIdx.BTAvailOff].value = false; // BT Avail and Off
                        uiconf.sections[0].content[contentIdx.BTOnPaired].value = false; // BT On and Paired
                        uiconf.sections[0].content[contentIdx.BTOnNotPaired].value = false; // BT On and Not-Paired
                        uiconf.sections[0].content[contentIdx.PairedConnected].value = false; // paired_connected
                        uiconf.sections[0].content[contentIdx.PairedNotConnected].value = false; // paired_not_connected
                    }
                    else {
                        if (!self.btSurfaceDial.btAdapterTurnedOn) {
                            /* Adapter Available, BT Off */
                            uiconf.sections[0].content[contentIdx.BTStatus].value = stringsLangObj.BT_STATUS.POWERED_OFF;
                            uiconf.sections[0].content[contentIdx.SDialStatus].value = stringsLangObj.SDIAL_STATUS.UNCONNECTED;
                            uiconf.sections[0].content[contentIdx.BTAvailOn].value = false; // BT Avail and On
                            uiconf.sections[0].content[contentIdx.BTAvailOff].value = true; // BT Avail and Off
                            uiconf.sections[0].content[contentIdx.BTOnPaired].value = false; // BT On and Paired
                            uiconf.sections[0].content[contentIdx.BTOnNotPaired].value = false; // BT On and Not-Paired
                            uiconf.sections[0].content[contentIdx.PairedConnected].value = false; // paired_connected
                            uiconf.sections[0].content[contentIdx.PairedNotConnected].value = false; // paired_not_connected
                        }
                        else {
                            if (self.btSurfaceDial.surfaceDialPaired) {
                                if (self.btSurfaceDial.surfaceDialConnected) {
                                    /**  Paired, Connected */
                                    uiconf.sections[0].content[contentIdx.BTStatus].value = stringsLangObj.BT_STATUS.POWERED_ON;
                                    uiconf.sections[0].content[contentIdx.SDialStatus].value = stringsLangObj.SDIAL_STATUS.CONNECTED_IN_USE;
                                    uiconf.sections[0].content[contentIdx.BTAvailOn].value = true; // BT Avail and On
                                    uiconf.sections[0].content[contentIdx.BTAvailOff].value = false; // BT Avail and Off
                                    uiconf.sections[0].content[contentIdx.BTOnPaired].value = true; // BT On and Paired
                                    uiconf.sections[0].content[contentIdx.BTOnNotPaired].value = false; // BT On and Not-Paired
                                    uiconf.sections[0].content[contentIdx.PairedConnected].value = true; // paired_connected
                                    uiconf.sections[0].content[contentIdx.PairedNotConnected].value = false; // paired_not_connected
                                }
                                else {
                                    /*  Paired, Not connected */
                                    uiconf.sections[0].content[contentIdx.BTStatus].value = stringsLangObj.BT_STATUS.POWERED_ON;
                                    uiconf.sections[0].content[contentIdx.SDialStatus].value = stringsLangObj.SDIAL_STATUS.UNCONNECTED;
                                    uiconf.sections[0].content[contentIdx.BTAvailOn].value = true; // BT Avail and On
                                    uiconf.sections[0].content[contentIdx.BTAvailOff].value = false; // BT Avail and Off
                                    uiconf.sections[0].content[contentIdx.BTOnPaired].value = true; // BT On and Paired
                                    uiconf.sections[0].content[contentIdx.BTOnNotPaired].value = false; // BT On and Not-Paired
                                    uiconf.sections[0].content[contentIdx.PairedConnected].value = false; // paired_connected
                                    uiconf.sections[0].content[contentIdx.PairedNotConnected].value = true; // paired_not_connected
                                }
                            }
                            else {
                                    /**  Not Paired */
                                    uiconf.sections[0].content[contentIdx.BTStatus].value = stringsLangObj.BT_STATUS.POWERED_ON;
                                    uiconf.sections[0].content[contentIdx.SDialStatus].value = stringsLangObj.SDIAL_STATUS.NOT_CONFIGURED;
                                    uiconf.sections[0].content[contentIdx.BTAvailOn].value = true; // BT Avail and On
                                    uiconf.sections[0].content[contentIdx.BTAvailOff].value = false; // BT Avail and Off
                                    uiconf.sections[0].content[contentIdx.BTOnPaired].value = false; // BT On and Paired
                                    uiconf.sections[0].content[contentIdx.BTOnNotPaired].value = true; // BT On and Not-Paired
                                    uiconf.sections[0].content[contentIdx.PairedConnected].value = false; // paired_connected
                                    uiconf.sections[0].content[contentIdx.PairedNotConnected].value = false; // paired_not_connected
                            }       
                        }
                    }  
                    defer.resolve(uiconf);
                }
            });
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

msSurfaceDial.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

msSurfaceDial.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

msSurfaceDial.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

msSurfaceDial.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// Configuration UI Event Handling
msSurfaceDial.prototype.onRequestConnect = function() {
    var self = this;
    self.logger.info(`${this.loggerLabel} User clicked on the Connect Button.`);
    self.btSurfaceDial.connectSurfaceDial();
}

msSurfaceDial.prototype.onRequestDisconnect = function() {
    var self = this;
    self.logger.info(`${this.loggerLabel} User clicked on the Disconnect Button.`);
    self.btSurfaceDial.disconnectSurfaceDial();
}

msSurfaceDial.prototype.onRequestPair = function() {
    var self = this;
    self.logger.info(`${this.loggerLabel} User clicked on the Pair Button.`)
}

msSurfaceDial.prototype.onRequestUnpair = function() {
    var self = this;
    self.logger.info(`${this.loggerLabel} User clicked on the Un-Pair Button.`)
}

msSurfaceDial.prototype.onRequestTurnOnBT = function() {
    var self = this;
    self.logger.info(`${this.loggerLabel} User clicked on the Turn-On-Bluetooth Button.`);
    self.btSurfaceDial.turnOnBluetooth();
}

msSurfaceDial.prototype.onRequestTurnOffBT = function() {
    var self = this;
    self.logger.info(`${this.loggerLabel} User clicked on the Turn-Off-Bluetooth Button.`);
    self.btSurfaceDial.turnOffBluetooth();
}

msSurfaceDial.prototype.setupBtSurfaceDialEventListeners = function() {
    var self = this;

    this.btSurfaceDial.on('ready', () => {
        self.logger.info(`${this.loggerLabel} BluetoothSurfaceDial init() - ready!`);
        self.commandRouter.reloadUi();
    });
    this.btSurfaceDial.on('sdial_paired', () => {
        self.commandRouter.reloadUi();
    });
    this.btSurfaceDial.on('sdial_unpaired', () => {
        self.commandRouter.reloadUi();
    });
    this.btSurfaceDial.on('sdial_removed', () => {
        self.commandRouter.reloadUi();
    });
    this.btSurfaceDial.on('sdial_connected', () => {
        self.commandRouter.reloadUi();
    });
    this.btSurfaceDial.on('sdial_disconnected', () => {
        self.commandRouter.reloadUi();
    });
    this.btSurfaceDial.on('bt_adapter_on', () => {
        self.commandRouter.reloadUi();
    });
    this.btSurfaceDial.on('bt_adapter_off', () => {
        self.commandRouter.reloadUi();
    });
    this.btSurfaceDial.on('bt_adapter_available', () => {
        self.commandRouter.reloadUi();
    });
    this.btSurfaceDial.on('bt_adapter_removed', () => {
        self.commandRouter.reloadUi();
    });
}


// Input Event Handling
msSurfaceDial.prototype.openEventStream = function(eventDevPath) {
	
	const rdStreamOpts = {
		flags: 'r',
		encoding: null,
	};
	this.logger.info(`${this.loggerLabel} opening ${eventDevPath}`);
	this.eventStream = fs.createReadStream(eventDevPath, rdStreamOpts);
	if (this.eventStream) {
		this.eventStream.on('data', (chunk) => {
			this.logger.debug(`${this.loggerLabel} ${chunk.length} bytes read`);
			this.handleInputEvent(chunk);
		});
		
		this.eventStream.on('close', () => {
			this.logger.info(`${this.loggerLabel} event stream is closed`);
			// Is this voluntary close?
		})
		this.eventStream.on('end', () => {
			this.logger.debug(`${this.loggerLabel} There will be no more data`);
		});
		
		this.eventStream.on('error', (err) => {
			this.logger.error(`${this.loggerLabel} Error received. ${err}`);
			// TBD: assuming the stream is closed. Do we attempt to open it periodically as long as the plugin is enabled?
		});
		
		this.eventStream.on('pause', () => {
			this.logger.debug(`${this.loggerLabel} Pause is called`);
		});
		/*
		rs.on('readable', () => {
			console.log('Readable event received');
		});
		*/
		this.eventStream.on('resume', () => {
			this.logger.debug(`${this.loggerLabel} Resume is called`);
		});
	}
	else {
		this.logger.error(`${this.loggerLabel} fs.createReadStream() returns null`);
	}

	return (this.eventStream != null);
}

msSurfaceDial.prototype.handleInputEvent = function(streamBuf) {
    // 16-byte Structure
    /*  
        struct input_event {
            struct timeval time;
            unsigned short type;
            unsigned short code;
            unsigned int value;
        };
    */
   if ((streamBuf.length % 16) != 0) {
	   this.logger.error(`${this.loggerLabel} Unexpected buffer length: ${streamBuf.length}`);
       return;
   }
   let rdPos = 0;
   while ((streamBuf.length - rdPos) > 1) {
       const secsSinceEpoch = streamBuf.readUInt32LE(rdPos);
       rdPos += 8; // skip the micro-secs
       const evType = streamBuf.readUInt16LE(rdPos);
       rdPos += 2;
       const evCode = streamBuf.readUInt16LE(rdPos);
       rdPos += 2;
       const evValue = streamBuf.readInt32LE(rdPos);
       rdPos += 4;
       const evDate = new Date(secsSinceEpoch * 1000);// accepts milli-secs
       let evTypeStr = "UnknownType"
       let evMsgStr = "";
       switch (evType) {
        case 0:
            evTypeStr = "SYN";
            if (evCode != 0 || evValue != 0)
                evMsgStr = "Error: unexpected Code and Value";
            break;
        case 1:
            evTypeStr = "KEY";
            let evKeyStr = "";
            switch (evCode) {
                case 0x100:
                    evKeyStr = "BTN_0";
                    break;
                case 0x14a: 
                    evKeyStr = "BTN_TOUCH";
                    break;
                default:
                    "Unexpected Key";
                    break;
            }
            let keyActionStr = "Unexpected Action";
            switch (evValue) {
                case 0:
                    keyActionStr = " Released"
                    if (evCode == 0x100)
                        this.dialPressed = false;
                    break;
                case 1:
                    keyActionStr = " Pressed"
                    if (evCode == 0x100) {
                        this.dialPressed = true;
                        this.commandRouter.executeOnPlugin('music_service', 'inputs', 'toggleDeviceMute');
                    }
                    break;
            }
            evMsgStr = `${evKeyStr} ${keyActionStr}`
            break;
        case 2:
            evTypeStr = "REL";
            let evDialStr = (evCode == 7)? "Dial" : "Unexpected Relative-Events";
            let dialActionStr = "Unexpected Relative-Value";
            switch (evValue) {
                case -1:
                    dialActionStr = "CounterClockWise Turn"
                    if (evCode == 7) {
                        this.dialValue -= 1;
                        this.commandRouter.executeOnPlugin('music_service', 'inputs', 'decreaseDeviceVolume');
                    }
                        
                    break;
                case 1:
                    dialActionStr = "ClockWise Turn"
                    if (evCode == 7) {
                        this.dialValue += 1;
                        this.commandRouter.executeOnPlugin('music_service', 'inputs', 'increaseDeviceVolume');
                    }
                    break;
            }
            evMsgStr = `${evDialStr} ${dialActionStr}`
            break;
        case 4:
            evTypeStr = "MSC";
            let evMscStr = (evCode == 4)? "SCAN" : "Unexpected MSC Code";
            evMsgStr = `${evMscStr} ${evValue}`;
            break;
       }
       this.logger.debug(`${this.loggerLabel} ${evDate.toLocaleString('en-US', {timeZone: 'Asia/Hong_Kong'})}: ${evTypeStr} ${evMsgStr}`);
       if (evType == 1 || evType == 2) {
		this.logger.debug(`${this.loggerLabel} Dial-Value: ${this.dialValue}`);
       }
   }
}

// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


msSurfaceDial.prototype.addToBrowseSources = function () {

	// Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

msSurfaceDial.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    //self.commandRouter.logger.info(curUri);
    var response;


    return response;
};



// Define a method to clear, add, and play an array of tracks
msSurfaceDial.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'msSurfaceDial::clearAddPlayTrack');

	self.commandRouter.logger.info(JSON.stringify(track));

	return self.sendSpopCommand('uplay', [track.uri]);
};

msSurfaceDial.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'msSurfaceDial::seek to ' + timepos);

    return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
msSurfaceDial.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'msSurfaceDial::stop');


};

// Spop pause
msSurfaceDial.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'msSurfaceDial::pause');


};

// Get state
msSurfaceDial.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'msSurfaceDial::getState');


};

//Parse state
msSurfaceDial.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'msSurfaceDial::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
msSurfaceDial.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'msSurfaceDial::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};


msSurfaceDial.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();

	// Mandatory: retrieve all info for a given URI

	return defer.promise;
};

msSurfaceDial.prototype.getAlbumArt = function (data, path) {

	var artist, album;

	if (data != undefined && data.path != undefined) {
		path = data.path;
	}

	var web;

	if (data != undefined && data.artist != undefined) {
		artist = data.artist;
		if (data.album != undefined)
			album = data.album;
		else album = data.artist;

		web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large'
	}

	var url = '/albumart';

	if (web != undefined)
		url = url + web;

	if (web != undefined && path != undefined)
		url = url + '&';
	else if (path != undefined)
		url = url + '?';

	if (path != undefined)
		url = url + 'path=' + nodetools.urlEncode(path);

	return url;
};





msSurfaceDial.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

msSurfaceDial.prototype._searchArtists = function (results) {

};

msSurfaceDial.prototype._searchAlbums = function (results) {

};

msSurfaceDial.prototype._searchPlaylists = function (results) {


};

msSurfaceDial.prototype._searchTracks = function (results) {

};

msSurfaceDial.prototype.goto=function(data){
    var self=this
    var defer=libQ.defer()

// Handle go to artist and go to album function

     return defer.promise;
};

