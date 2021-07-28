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
    
    defer.resolve();

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
    self.logger.info(`${this.loggerLabel} User clicked on the Pair Button.`);
    self.btSurfaceDial.scanAndPairSurfaceDial();
}

msSurfaceDial.prototype.onRequestStopPair = function() {
    var self = this;
    self.logger.info(`${this.loggerLabel} User clicked on the Cancel-Pairing Button.`);
    self.btSurfaceDial.cancelPairSurfaceDial();
}

msSurfaceDial.prototype.onRequestUnpair = function() {
    var self = this;
    self.logger.info(`${this.loggerLabel} User clicked on the Un-Pair Button.`);
    self.btSurfaceDial.unpairSurfaceDial();
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

    self.btSurfaceDial.on('ready', () => {
        self.logger.info(`${this.loggerLabel} BluetoothSurfaceDial init() - ready!`);
        self.commandRouter.reloadUi();
        if (self.btSurfaceDial.surfaceDialConnected) {
            self.scheduleOpenEventStream();
        }   
    });
    self.btSurfaceDial.on('sdial_pair_failed', (err) => {
        self.commandRouter.pushToastMessage('error', 'Pairing', err.message);
    });
    self.btSurfaceDial.on('sdial_pair_completed', () => {
        self.commandRouter.pushToastMessage('success', 'Pairing', 'Surface Dial paired and trusted.');
    });
    self.btSurfaceDial.on('sdial_cancel_pair_failed', (err) => {
        self.commandRouter.pushToastMessage('error', 'Stop-Pairing', err.message);
    });
    self.btSurfaceDial.on('sdial_cancel_pair_completed', () => {
        self.commandRouter.pushToastMessage('success', 'Stop-Pairing', 'Scanning/Pairing stopped successfully.');
    });
    self.btSurfaceDial.on('sdial_paired', () => {
        self.commandRouter.reloadUi();
    });
    self.btSurfaceDial.on('sdial_unpaired', () => {
        self.commandRouter.reloadUi();
    });
    self.btSurfaceDial.on('sdial_removed', () => {
        self.commandRouter.reloadUi();
    });
    self.btSurfaceDial.on('sdial_connected', () => {
        self.commandRouter.reloadUi();
        self.scheduleOpenEventStream();
    });
    self.btSurfaceDial.on('sdial_disconnected', () => {
        self.commandRouter.reloadUi();
        if (self.retryOpenEventTimer) {
            clearInterval(self.retryOpenEventTimer);
            self.retryOpenEventTimer = null;
        }
        self.closeEventStream();
    });
    self.btSurfaceDial.on('bt_adapter_on', () => {
        self.commandRouter.reloadUi();
    });
    self.btSurfaceDial.on('bt_adapter_off', () => {
        self.commandRouter.reloadUi();
    });
    self.btSurfaceDial.on('bt_adapter_available', () => {
        self.commandRouter.reloadUi();
    });
    self.btSurfaceDial.on('bt_adapter_removed', () => {
        self.commandRouter.reloadUi();
    });
}


// Input Event Handling

//
// The availability of the event stream could lag the 
// surface-dial 'connected' event by something between
// 10 to 20 seconds. This always happens when it is 
// is successfully-paired the first-time.
//
msSurfaceDial.prototype.scheduleOpenEventStream = function() {
    var self = this;
   
    if (self.retryOpenEventTimer == null)
        self.retryOpenEventTimer = setInterval(self.openEventStream, 1000, self);
    else
        self.logger.warn(`${self.loggerLabel} not calling interval timer to open stream - it's already running.`);
}


msSurfaceDial.prototype.openEventStream = function(obj) {
    var self = obj;
    self.logger.info(`${self.loggerLabel} calling findSurfaceDialInputEventPath()`);
    self.findSurfaceDialInputEventPath()
    .then((eventName) => {
        if (eventName) {
            const eventDevPath = `/dev/input/${eventName}`;
            const rdStreamOpts = {
                flags: 'r',
                encoding: null,
            };
            self.logger.info(`${self.loggerLabel} opening ${eventDevPath}`);
            self.eventStream = fs.createReadStream(eventDevPath, rdStreamOpts);
            if (self.eventStream) {
                if (self.retryOpenEventTimer) {
                    clearInterval(self.retryOpenEventTimer);
                    self.retryOpenEventTimer = null;
                }
                self.eventStream.on('data', (chunk) => {
                    self.logger.debug(`${self.loggerLabel} ${chunk.length} bytes read`);
                    self.handleInputEvent(chunk);
                });
                
                self.eventStream.on('close', () => {
                    self.logger.info(`${self.loggerLabel} event stream is closed`);
                    // Is this voluntary close?
                })
                self.eventStream.on('end', () => {
                    self.logger.debug(`${self.loggerLabel} There will be no more data`);
                });
                
                //
                // 'error' could occur when
                // 1. the stream is called destroyed()
                // 2. [ENOENT] when the input-event is first opened after connection. Case-in-point: pairing
                // 3. [ENODEV] the /dev/input/event nodes are removed by system because the corresponding
                //    surface dial is unpaired. (while it is still 'connected' according to BluetoothSurfaceDial)
                // 4. [EACCESS] when the input-event is first opened after connection. This error should be momentary.
                // Pay Attention to the difference in errno in #2 and #3.
                //
                self.eventStream.on('error', (err) => {
                    self.logger.error(`${self.loggerLabel} Error received. ${err}`);
                    // TBD: assuming the stream is closed. Do we attempt to open it periodically as long as the plugin is enabled?
                    self.eventStream = null;
                    // Case #2
                    if (self.btSurfaceDial.surfaceDialConnected) {
                        // try open again
                        if ('errno' in err) {
                            self.logger.error(`${self.loggerLabel} Actual error code is: ${err.errno}`);
                            if (err.errno == -2 || err.errno == -13) // ENOENT or EACCESS
                                self.scheduleOpenEventStream();
                            else
                                self.logger.warn(`${self.loggerLabel} The 'errno' is not ENOENT`);
                        }
                        else {
                            self.logger.warn(`${self.loggerLabel} The 'errno' field not available in Error`);
                        }
                        
                    }
                });
                
                self.eventStream.on('pause', () => {
                    self.logger.debug(`${self.loggerLabel} Pause is called`);
                });
                /*
                rs.on('readable', () => {
                    console.log('Readable event received');
                });
                */
                self.eventStream.on('resume', () => {
                    self.logger.debug(`${self.loggerLabel} Resume is called`);
                });
            }
            else {
                self.logger.error(`${self.loggerLabel} fs.createReadStream() returns null`);
            }
        }
        else {
            self.logger.warn(`${self.loggerLabel} Cannot find Surface-Dial input-event-path`);
        }
    })
    .catch((err) => {
        self.commandRouter.pushToastMessage('error', 'Input Event', err.message);
        this.logger.error(`${self.loggerLabel} Error looking up input-event-path. ${err}`);
    });
}

msSurfaceDial.prototype.closeEventStream = function() {
    if (this.eventStream) {
        this.logger.info(`${this.loggerLabel} Closing event stream`);
        this.eventStream.destroy();
    }
    else {
        this.logger.info(`${this.loggerLabel} Cannot close event stream - it is null`);
    }
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

//
// Look for the /dev/input/eventX path
// Method
// open /proc/bus/input/devices to read
//
// Identify Surface Dial by Look for I: with Vendor=045e and Product=091b
//  e.g. I: Bus=0005 Vendor=045e Product=091b Version=0108
// Identify the endpoint with Key and Rel events
//   B: line with KEY and non-zero on the right side
//  e.g. B: KEY=400 0 1 0 0 0 0 0 0 0 0
//   B: line with REL and non-zero value on the right side
//  .e.g B: REL=80
// Each section is delimited by empty line
//   
// the eventX is specified in the H row
//   e.g. H: Handlers=event1
// the right-hand side can have multiple values, delimited by 'space'
//

msSurfaceDial.prototype.findSurfaceDialInputEventPath = function() {
    const procPath = '/proc/bus/input/devices';
    return new Promise((resolve, reject) => {
        fs.readFile(procPath, {encoding: 'latin1'}, (err, data) => {
            if (err) {
                this.logger.error(`${this.loggerLabel} Error reading ${procPath}. ${err}`);
                reject(err);
            }
            else {
                let isSDial = false;
                let inSection = false;
                let supportKeyEvt = false;
                let supportRelEvt = false;
                let handler = null; // string of 'eventX'
                // process line-by-line
                const lines = data.split("\n");
                for (const l of lines) {
                    if (inSection) {
                        if (l.length == 0) {
                            this.logger.debug(`${this.loggerLabel} Empty Line`);
                            // decide whether this is Surface Dial input event we are looking for
                            if (isSDial) {
                                this.logger.debug(`${this.loggerLabel} Previous section is Surface Dial`);
                                if (supportKeyEvt && supportRelEvt && handler != null) {
                                    this.logger.debug(`${this.loggerLabel} Support both Key and Rel events. Handler not null.`);
                                    resolve(handler);
                                    return;
                                }
                            }
                            inSection = false;
                        }
                        else if (isSDial) {
                            if (l.startsWith('H:')) {
                                this.logger.debug(`${this.loggerLabel} Looking for 'Handlers' ${l}.`);
                                let attrs = l.slice(2).trim().split('=');
                                if ((attrs.length == 2) && (attrs[0]).toLowerCase() == 'handlers') {
                                    let handlers=attrs[1].split(' ');
                                    // look for the first one that starts with 'eventX''
                                    for (const h of handlers)
                                        if (h.startsWith('event'))
                                            handler = h.trim();
                                }
                            }
                            else if (l.startsWith('B:')) {
                                this.logger.debug(`${this.loggerLabel} Looking for 'Key or Rel' ${l}.`);
                                let attrs = l.slice(2).trim().split('=');
                                if ((attrs.length == 2) && (attrs[0]).toLowerCase() == 'key') {
                                    let keyEvtProps=attrs[1].split(' ');
                                    if (keyEvtProps.length > 0) {
                                        this.logger.debug(`${this.loggerLabel} Key event support found.`);
                                        supportKeyEvt = true;
                                    }
                                }
                                else if ((attrs.length == 2) && (attrs[0]).toLowerCase() == 'rel') {
                                    let relEvtProps=attrs[1].split(' ');
                                    if (relEvtProps.length > 0) {
                                        this.logger.debug(`${this.loggerLabel} Rel event support found.`);
                                        supportRelEvt = true;
                                    }
                                }
                            }
                        }
                    }
                    else {
                        if (l.startsWith('I:')) {
                            this.logger.debug(`${this.loggerLabel} Looking for Vendor and Product in ${l}`);
                            inSection = true;
                            isSDial = false;
                            supportKeyEvt = false;
                            supportRelEvt = false;
                            handler = null;
                            let attrs = l.slice(2).trim().split(' ');
                            let VID = null;
                            let PID = null;
                            attrs.forEach(a => {
                                const kv = a.split('=');
                                if (kv.length == 2) {
                                    if (kv[0].toLowerCase() == 'vendor') {
                                        this.logger.debug(`${this.loggerLabel} Vender field found.`);
                                        VID = kv[1].toLowerCase();
                                    }
                                    else if (kv[0].toLowerCase() == 'product') {
                                        this.logger.debug(`${this.loggerLabel} Product field found.`);
                                        PID = kv[1].toLowerCase();
                                    }
                                }
                            });
                            if (VID === '045e' && PID === '091b') {
                                this.logger.debug(`${this.loggerLabel} Found Surface Dial UID and PID`);
                                isSDial = true;
                            }
                        }
                    }
                }
                // no trailing empty line
                if (inSection) {
                    if (isSDial) {
                        if (supportKeyEvt && supportRelEvt && handler != null) {
                            resolve(handler);
                            return;
                        }
                    }
                }
                resolve(handler);
            }
        });
    });
}