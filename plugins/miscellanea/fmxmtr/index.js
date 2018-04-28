'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

var shell = require('shelljs');

// Define variables to hold register values read from transmitter module
var Reg0x00 = 0;
var Reg0x01 = 0;
var Reg0x02 = 0;
var Reg0x04 = 0;
var Reg0x0B = 0;
var Reg0x10 = 0;
var Reg0x12 = 0;
var Reg0x13 = 0;

// Define variables for decoded register values
var FreqRead = 0;
var BaseBoostRead = 0;
var RFGainRead = 0;
var MuteAudioRead = 0;
var MonoAudioRead = 0;
var PGAModRead = 0;
var PGAmpRead = 0;
var PltAdjRead = 0;
var PhTCnStRead = 0;
var PDPARead = false;

// Define variables for data read from conf.json
var FreqStored=0;
var BaseBoostStored=0;
var RFGainStored=0;
var MuteAudioStored=false;
var MonoAudioStored=false;
var PGAModStored=0;
var PGAmpStored=0;
var PltAdjStored=0;
var PhTCnstStored=0;
var PDPAStored=false;




module.exports = Controllerfmxmtr;
function Controllerfmxmtr(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}


Controllerfmxmtr.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

// Debug code - remove when done
    // For debugging purposes
    var keys=config.getKeys(configFile);
    self.logger.info("Config file: " + configFile);
    FreqStored=this.config.get('Freq');
    BaseBoostStored=this.config.get('BaseBoost');
    RFGainStored=this.config.get('RFGain');
    MuteAudioStored=this.config.get('MuteAudio');
    MonoAudioStored=this.config.get('MonoAudio');
    PGAModStored=this.config.get('PGAMod');
    PGAmpStored=this.config.get('PGAmp');
    PltAdjStored=this.config.get('PltAdj');
    PhTCnstStored=this.config.get('PhTCnst');
    PDPAStored=this.config.get('PDPA');

    return libQ.resolve();
}

Controllerfmxmtr.prototype.onStart = function() {
    var self = this;
	var defer=libQ.defer();


// Read registers starting values from module
    Reg0x00 = shell.exec('i2cget -y 1 0x3e 0x00');
    Reg0x01 = shell.exec('i2cget -y 1 0x3e 0x01');
    Reg0x02 = shell.exec('i2cget -y 1 0x3e 0x02');
    Reg0x04 = shell.exec('i2cget -y 1 0x3e 0x04');
    Reg0x0B = shell.exec('i2cget -y 1 0x3e 0x0B');
    Reg0x10 = shell.exec('i2cget -y 1 0x3e 0x10');
    Reg0x12 = shell.exec('i2cget -y 1 0x3e 0x12');
    Reg0x13 = shell.exec('i2cget -y 1 0x3e 0x13');

// Decode registers into working values
    FreqRead = ((Reg0x01 & 0x07) * 512) + (Reg0x00 * 2) + ((Reg0x02 & 0x80)/128);
    BaseBoostRead = (Reg0x04 & 0x03);
    RFGainRead = ((Reg0x02 & 0x40)/8) + ((Reg0x13 & 0x80)/32) + ((Reg0x01 & 0xc0)/64);
    MuteAudioRead = ((Reg0x02 & 0x08)/8);
    MonoAudioRead = ((Reg0x04 & 0x40)/64);
    PGAModRead = (Reg0x10 & 1);
    PGAmpRead = ((Reg0x01 & 0x38)/2) + ((Reg0x04 & 0x30)/16);
    PltAdjRead = ((Reg0x02 & 0x04)/4);
    PhTCnStRead = (Reg0x02 & 0x01);
    PDPARead = ((Reg0x0B & 0x20)/32);


	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

Controllerfmxmtr.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

Controllerfmxmtr.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it


};


// Configuration Methods -----------------------------------------------------------------------------

Controllerfmxmtr.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {

	uiconf.sections[0].content[0].value.value = self.config.get('I2C_BUS');
	uiconf.sections[0].content[0].value.label = self.config.get('I2C_BUS');

    uiconf.sections[0].content[1].value = self.config.get('I2C_ADDRESS');

	uiconf.sections[0].content[2].config.bars[0].value = self.config.get('Freq');

	uiconf.sections[0].content[3].value.value = self.config.get('BaseBoost');
	uiconf.sections[0].content[3].value.label = self.config.get('BaseBoost');

    uiconf.sections[0].content[4].value.value = self.config.get('RFGain');
    uiconf.sections[0].content[4].value.label = self.config.get('RFGain');

    uiconf.sections[0].content[5].value = self.config.get('MuteAudio');

    uiconf.sections[0].content[6].value = self.config.get('MonoAudio');

    uiconf.sections[0].content[7].value.value = self.config.get('PGAMod');
    uiconf.sections[0].content[7].value.label = self.config.get('PGAMod');

    if (self.config.get('PGAMod') == 0) {
        uiconf.sections[0].content[8].config.bars[0].value = (self.config.get('PGAmp') - (self.config.get('PGAmp') % 5));
        uiconf.sections[0].content[8].config.bars[0].step = 5;
        } else {
            uiconf.sections[0].content[8].config.bars[0].step = 1;
        uiconf.sections[0].content[8].config.bars[0].value = self.config.get('PGAmp');
        };

    uiconf.sections[0].content[9].value.value = self.config.get('PltAdj');
    uiconf.sections[0].content[9].value.label = self.config.get('PltAdj');

    uiconf.sections[0].content[10].value.value = self.config.get('PhTCnst');
    uiconf.sections[0].content[10].value.label = self.config.get('PhTCnst');

    uiconf.sections[0].content[11].value = self.config.get('PDPA');
        
            defer.resolve(uiconf);



            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};


Controllerfmxmtr.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here


};

Controllerfmxmtr.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

Controllerfmxmtr.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// define what happens when the user clicks the 'save' button on the settings page
// save new values and write them to the transmitter module
Controllerfmxmtr.prototype.SaveFMXmtrOptions = function(data) {
    var self = this;
    var successful = true;

// Save I2C_BUS
    var I2CBusSave = data.I2C_BUS.value;
    self.config.set('I2C_BUS',I2CBusSave);
    
// Save I2C_ADDRESS
    var I2CAddressSave = data.I2C_ADDRESS;
    self.config.set('I2C_ADDRESS',I2CAddressSave);

// Save Freq
    var FreqSave = data.Freq;
    self.config.set('Freq',FreqSave);
    FreqSave = (FreqSave * 1000)/50;

// Convert save values to register values
// Frequency is 12 bits divided over three registers
// Register 0x02 bit 0x07 = Freq bit 0x01
// Register 0x00 bits 0x07 to 0x00 = Freq bits 0x08 to 0x01
// Register 0x01 bits 0x02 to 0x00 = Freq bits 0x11 to 0x09
// Split Freq into three registers
    var Reg0x02Freq = (FreqSave & 0x0001) *8;
    var Reg0x00Freq = (FreqSave / 2) & 0x00ff;
    var Reg0x01Freq = ((FreqSave & 0x0600) / 512);
    
// Save BaseBoost
    var BaseBoostSave = data.BaseBoost.value;
    self.config.set('BaseBoost',BaseBoostSave);
    
// Convert save values to register values
// BaseBoost is two bits in one register
// Register 0x04 bits 0x01 to 0x00 = BaseBoost bits 0x01 to 0x00
    var Reg0x04BaseBoost = (BaseBoostSave & 0x03);

// Save RFGain
    var RFGainSave = data.RFGain.value;
    self.config.set('RFGain',RFGainSave);

// Convert save values to register values
// RFGain is 4 bits divided over tthree registers
// Register 0x02 bit 0x06 = RFGain bit 0x03
// Register 0x13 bit 0x07 = RFGain bit 0x02
// Register 0x01 bits 0x07 to 0x06 - RFGain bits 0x01 to 0x00
    var Reg0x02FRGain = (RFGainSave & 0x08) * 8;
    var Reg0x13FRGain = (RFGainSave & 0x04) * 32;
    var Reg0x01FRGain = (RFGainSave & 0x03) * 64;



// Save MuteAudio
    var MuteAudioSave = data.MuteAudio;
    self.config.set('MuteAudio',MuteAudioSave);

// Convert save values to register values
// MuteAudio is one bit in one register
// Register 0x02 bit 0x03 = MuteAudio logic state
        var Reg0x02MuteAudio = 0x00;
        if (MuteAudioSave){
            Reg0x02MuteAudio = 0x08;
        } else {
            Reg0x02MuteAudio = 0x00;
        };

// Save MonoAudio
    var MonoAudioSave = data.MonoAudio;
    self.config.set('MonoAudio',MonoAudioSave);

// Convert save values to register values
// MonoAudio is one bit in one register
// Register 0x04 bit 0x06 = MonoAudio logic state
        var Reg0x04MonoAudio = 0x00;
        if (MonoAudioSave){
            Reg0x04MonoAudio = 0x40;
        } else {
            Reg0x04MonoAudio = 0x00;
        };

// Save PGAMod
    var PGAModSave = data.PGAMod.value;
    self.config.set('PGAMod',PGAModSave);

// Convert save values to register values
// PGAMod is three bits in one register
// Register 0x10 bit 0x00 = PGAMod bit 0x00
    var Reg0x10PGAMod = PGAModSave

// Save PGAmp
    var PGAmpSave = data.PGAmp;
    self.config.set('PGAmp',PGAmpSave);

// Convert save values to register values
// PGAmp is 5 bits divided over two registers
// Register 0x01 bits 0x05 to 0x03 = PGAmp bits 0x04 to 0x02 
// Register 0x04 bits 0x05 to 0x04 - PGAmp bits 0x01 to 0x00
    if (PGAmpSave < 0){
            PGAmpSave = PGAmpSave * -1;
        }
        else{
            PGAmpSave = (PGAmpSave *1) + 16;
            };
    var Reg0x01PGAmp = (PGAmpSave & 0x1c) * 2;
    var Reg0x04PGAmp = (PGAmpSave & 0x03) * 16;

// Save PltAdj
    var PltAdjSave = data.PltAdj.value;
    self.config.set('PltAdj',PltAdjSave);

// Convert save values to register values
// PltAdj is one bit in one register
// Register 0x02 bit 0x02 = PltAdj bit 0x00
     var Reg0x02PltAdj = (PltAdjSave & 0x01) * 4;

// Save PhTCnst
    var PhTCnstSave = data.PhTCnst.value;
    self.config.set('PhTCnst',PhTCnstSave);

// Convert save values to register values
// PhTCnst is one bit in one register
// Register 0x02 bit 0x00 = PhTCnst bit 0x00
     var Reg0x02PhTCnst = (PhTCnstSave & 0x01);

// Save PDPA
    var PDPASave = data.PDPA;
    self.config.set('PDPA',PDPASave);

// Convert save values to register values
// PDPA is one bit in one register
// Register 0x0B bit 0x05 = PDPA logic state
        var Reg0x0BPDPA = 0x00;
        if (PDPASave){
            Reg0x0BPDPA = 0x20;
        } else {
            Reg0x0BPDPA = 0x00;
        };

// combine all bit per register
// Register 0x00 is made up of Reg0x00Freq only
    var Reg0x00Write = Reg0x00Freq;

// Register 0x01 is made up of Reg0x01FRGain, Reg0x01PGAmp and Reg0x01Freq
    var Reg0x01Write = (Reg0x01FRGain + Reg0x01PGAmp + Reg0x01Freq);

//Register 0x02 is made up of Reg0x02Freq, Reg0x02FRGain, Reg0x02MuteAudio, Reg0x02PltAdj and Reg0x02PhTCnst
    var Reg0x02Write = (Reg0x02 & 0x32) + (Reg0x02Freq + Reg0x02FRGain + Reg0x02MuteAudio + Reg0x02PltAdj + Reg0x02PhTCnst);

// Register 0x04 is made up of Reg0x04MonoAudio, Reg0x04PGAmp and Reg0x04BaseBoost
    var Reg0x04Write = (Reg0x04 & 0x8c) + (Reg0x04MonoAudio + Reg0x04PGAmp + Reg0x04BaseBoost);

// Register 0x0b is made up of Reg0x0BPDPA only
    var Reg0x0BWrite = (Reg0x0B & 0xdf) + Reg0x0BPDPA;

// Register 0x10 is made up of Reg0x10PGAMod only
    var Reg0x10Write = (Reg0x10 & 0xfe) + Reg0x10PGAMod;

// Register 0x13 is made up of  only Reg0x13FRGain
    var Reg0x13Write = (Reg0x13 & 0x7f) + Reg0x13FRGain;

// Write registers
    //shell.exec('i2cset -y 1 0x3e 0x00 0x00');
    var ShellCommand = '';
    ShellCommand = 'i2cset -y ' + I2CBusSave + ' 0x' + I2CAddressSave + ' 0x00 0x' + Reg0x00Write.toString(16);
    shell.exec(ShellCommand);
    
    ShellCommand = 'i2cset -y ' + I2CBusSave + ' 0x' + I2CAddressSave + ' 0x01 0x' + Reg0x01Write.toString(16);
    shell.exec(ShellCommand);
    
    ShellCommand = 'i2cset -y ' + I2CBusSave + ' 0x' + I2CAddressSave + ' 0x02 0x' + Reg0x02Write.toString(16);
    shell.exec(ShellCommand);
    
    ShellCommand = 'i2cset -y ' + I2CBusSave + ' 0x' + I2CAddressSave + ' 0x04 0x' + Reg0x04Write.toString(16);
    shell.exec(ShellCommand);
    
    ShellCommand = 'i2cset -y ' + I2CBusSave + ' 0x' + I2CAddressSave + ' 0x0B 0x' + Reg0x0BWrite.toString(16);
    shell.exec(ShellCommand);

    ShellCommand = 'i2cset -y ' + I2CBusSave + ' 0x' + I2CAddressSave + ' 0x10 0x' + Reg0x10Write.toString(16);
    shell.exec(ShellCommand);

    ShellCommand = 'i2cset -y ' + I2CBusSave + ' 0x' + I2CAddressSave + ' 0x13 0x' + Reg0x13Write.toString(16);
    shell.exec(ShellCommand);

};
