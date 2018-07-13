'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var config = require('v-conf');
var i2c = require('i2c');

module.exports = ControllerES9018K2M;

function ControllerES9018K2M(context) {
	var self = this;

  self.context = context;
  self.commandRouter = this.context.coreCommand;
  self.logger = this.context.logger;
  self.configManager = this.context.configManager;
  self.logger.info("ControllerES9018K2M::constructor");
}

ControllerES9018K2M.prototype.onVolumioStart = function()
{
  var self = this;

  this.configFile = this
      .commandRouter
      .pluginManager
      .getConfigurationFile(this.context,'config.json');
  self.getConf(this.configFile);

  return libQ.resolve();
};

ControllerES9018K2M.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

ControllerES9018K2M.prototype.onStart = function() {
  var self = this;
  
  self.loadI18nStrings();
  self.initVariables();
  self.initRegister();
  self.execDeviceCheckControl();
  self.loadConfig();

  self.serviceName = self.getI18nString('PLUGIN_NAME');

  if (self.es9018k2m) {
    self.initDevice();
    self.applyFunction();
  }

  return libQ.resolve();
};

ControllerES9018K2M.prototype.onStop = function() {
  var self = this;

  return libQ.resolve();
};

ControllerES9018K2M.prototype.onRestart = function() {
  var self = this;

  return libQ.resolve();
};

// Configuration Methods -----------------------------------------------------
ControllerES9018K2M.prototype.getConf = function(configFile) {
  var self = this;

  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
};

ControllerES9018K2M.prototype.setConf = function(varName, varValue) {
  var self = this;

  //Perform your installation tasks here
};

ControllerES9018K2M.prototype.setUIConfig = function(data) {
  var self = this;

  var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');

  return libQ.resolve();
};

ControllerES9018K2M.prototype.loadConfig = function() {
  var self = this;

  self.volumeLevel = self.config.get("volumeLevel");
  self.balance = self.config.get('balance');
  self.balanceNote = self.config.get('balanceNote');

  self.fir = self.config.get('fir');
  self.firLabel = self.config.get('firLabel');
  self.iir = self.config.get('iir');
  self.iirLabel = self.config.get('iirLabel');
  self.deemphasis = self.config.get('deemphasis');
  self.deemphasisLabel = self.config.get('deemphasisLabel');

  self.i2sDPLL = self.config.get('i2sDPLL');
  self.dsdDPLL = self.config.get('dsdDPLL');
  self.i2sLabelDPLL = self.config.get('i2sLabelDPLL');
  self.dsdLabelDPLL = self.config.get('dsdLabelDPLL');
};

ControllerES9018K2M.prototype.saveConfig = function() {
  var self = this;

  self.config.set('volumeLevel', self.volumeLevel);
  self.config.set('balance', self.balance);
  self.config.set('balanceNote', self.balanceNote);

  self.config.set('fir', self.fir);
  self.config.set('firLabel', self.firLabel);
  self.config.set('iir', self.iir);
  self.config.set('iirLabel', self.iirLabel);
  self.config.set('deemphasis', self.deemphasis);
  self.config.set('deemphasisLabel', self.deemphasisLabel);

  self.config.set('i2sDPLL', self.i2sDPLL);
  self.config.set('i2sLabelDPLL', self.i2sLabelDPLL);
  self.config.set('dsdDPLL', self.dsdDPLL);
  self.config.set('dsdLabelDPLL', self.dsdLabelDPLL);
};

ControllerES9018K2M.prototype.getUIConfig = function() {
  var self = this;
  var defer = libQ.defer();
  var lang_code = self.commandRouter.sharedVars.get('language_code');

  self.commandRouter.i18nJson(__dirname+'/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
  .then(function(uiconf)
  {
    uiconf.sections[0].description = self.deviceStatus;

    uiconf.sections[1].content[0].config.bars[0].value = self.volumeLevel;
    uiconf.sections[1].content[1].value = self.ready;

    uiconf.sections[2].content[0].config.bars[0].value = self.balance;
    uiconf.sections[2].content[0].description = self.balanceNote;
    uiconf.sections[2].content[1].value =
        {value: self.channel, label: self.channelLabel};

    uiconf.sections[3].content[0].value =
        {value: self.fir, label: self.firLabel};
    uiconf.sections[3].content[1].value =
        {value: self.iir, label: self.iirLabel};
    uiconf.sections[3].content[2].value =
        {value: self.deemphasis, label:  self.deemphasisLabel};

    uiconf.sections[4].content[0].value =
        {value: self.i2sDPLL, label: self.i2sLabelDPLL};
    uiconf.sections[4].content[1].value =
        {value: self.dsdDPLL, label: self.dsdLabelDPLL};

    defer.resolve(uiconf);

    // apply saved configuration data to es9018k2m
    self.applyFunction();
  })
  .fail(function()
  {
    defer.reject(new Error());
  });

  return defer.promise;
};

ControllerES9018K2M.prototype.updateUIConfig = function() {
  var self=this;

  var lang_code = self.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname+'/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
  .then(function(uiconf)
  {
    self.configManager.setUIConfigParam(
        uiconf, 'sections[0].description', self.deviceStatus
    );

    self.configManager.setUIConfigParam(
        uiconf, 'sections[1].content[0].config.bars[0].value', self.volumeLevel
    );
    self.configManager.setUIConfigParam(
      uiconf, 'sections[1].content[1].value', self.ready
    );

    self.configManager.setUIConfigParam(
        uiconf, 'sections[2].content[0].config.bars[0].value', self.balance
    );
    self.configManager.setUIConfigParam(
        uiconf, 'sections[2].content[0].description', self.balanceNote
    );
    self.configManager.setUIConfigParam(
        uiconf, 'sections[2].content[1].value', {value: self.channel, label: self.channelLabel}
    );

    self.configManager.setUIConfigParam(
        uiconf, 'sections[3].content[0].value', {label: self.firLabel, value: self.fir}
    );
    self.configManager.setUIConfigParam(
        uiconf, 'sections[3].content[1].value', {label: self.iirLabel, value: self.iir}
    );
    self.configManager.setUIConfigParam(
        uiconf, 'sections[3].content[2].value', {label: self.deemphasisLabel, value: self.deemphasis}
    );

    self.configManager.setUIConfigParam(
        uiconf, 'sections[4].content[0].value', {label: self.i2sLabelDPLL, value: self.i2sDPLL}
    );
    self.configManager.setUIConfigParam(
        uiconf, 'sections[4].content[1].value', {label: self.dsdLabelDPLL, value: self.dsdDPLL}
    );

    self.commandRouter.broadcastMessage('pushUiConfig', uiconf);
  })
  .fail(function()
  {
    new Error();
  });
};

ControllerES9018K2M.prototype.loadI18nStrings = function () {
  var self=this;
  var language_code = this.commandRouter.sharedVars.get('language_code');

  self.i18nStrings=fs.readJsonSync(__dirname+'/i18n/strings_'+language_code+".json");
  self.i18nStringsDefaults=fs.readJsonSync(__dirname+'/i18n/strings_en.json');
};

ControllerES9018K2M.prototype.getI18nString = function (key) {
  var self=this;

  if (self.i18nStrings[key] !== undefined)
    return self.i18nStrings[key];
  else
    return self.i18nStringsDefaults[key];
};

// es9018km Control Methods -------------------------------------------------
ControllerES9018K2M.prototype.initVariables = function() {
  var self=this;

  self.ready = true;
  self.volumeLevel = 90;
  self.channel = true;
  self.channelLabel = "Left/Right";

  self.fir = 1;
  self.firLabel = "Fast Roll Off";
  self.iir = 0;
  self.iirLabel = "47K";
  self.deemphasis = 66;
  self.deemphasisLabel = "Off";

  self.i2sDPLL = 80;
  self.i2sLabelDPLL = "05";
  self.dsdDPLL = 10;
  self.dsdLabelDPLL = "10";

  self.lBal = 0;
  self.rBal = 0;
  self.balance = 0;
  self.balanceNote = self.getI18nString('MID_BALANCE');
  self.centerBalance = 40;

  self.enableTHD = false;
};

ControllerES9018K2M.prototype.initRegister = function()
{
  var self = this;

  self.deviceAddress = 0x48;
  self.statusReg = 64;
  self.reg0=0x00;  // System settings. Default = 0
  self.reg4=0x00;  // Automute time. Default = disabled
  self.reg5=0x68;  // Automute level.
  self.reg7=0x80;  // General for fast/slow roll-off, iir and mute/unmute
  self.reg12=0x5A; // DPLL (i2s and DSD)
  self.reg21=0x00; // GPIO and OSF(Oversampling) Bypass
};

ControllerES9018K2M.prototype.initDevice = function() {
  var self = this;

  self.messageOn = false;
  self.muteES9018K2m();
  self.writeRegister(0, self.reg0);    // System Settings
  self.writeRegister(4, self.reg4);    // Automute
  self.writeRegister(5, self.reg5);    // Automute Level
  self.setVolume(self.volumeLevel);    // Startup volume level
  self.unmuteES9018K2m();
};

ControllerES9018K2M.prototype.execDeviceCheckControl = function() {
  var self=this;
  var revision, message, checkSampleRate=false;

  self.readRegister(self.statusReg).then (function(chipStatus) {
    if ((chipStatus !== null) && (chipStatus & 0x1C) === 16) {
      self.es9018k2m = true;
      if (chipStatus & 0x20)
        revision = 'revision V';
      else
        revision = 'revision W';

      // playing status
      if (chipStatus & 0x01)
        checkSampleRate = true;
      else
        checkSampleRate = false;
      message = self.getI18nString('FOUND_DEVICE') + '[' + revision + '] ';
      self.deviceStatus = self.getI18nString('DEVICE_DETECT_NOTE');
    }
    else {
      self.es9018k2m = false;
      message = self.getI18nString('NOT_FOUND_DEVICE');
      self.deviceStatus = self.getI18nString('DEVICE_NOT_DETECT_NOTE');
    }

    self.updateUIConfig();
    if (checkSampleRate) {
      self.parseSampleRate().then (function (sampleRate) {
        self.commandRouter.pushToastMessage('info', self.serviceName, message + sampleRate);
      });
    }
    else
      self.commandRouter.pushToastMessage('info', self.serviceName, message);
  });
};

ControllerES9018K2M.prototype.applyFunction = function() {
  var self = this;

  self.messageOn = false;
  self.setBalance(self.balance);

  self.setFirFilter({value: self.fir, label: self.firLabel});
  self.setIirFilter({value: self.iir, label: self.iirLabel});
  self.setDeemphasisFilter({value: self.deemphasis, label: self.deemphasisLabel});

  self.setI2sDPLL({value: self.i2sDPLL, label: self.i2sLabelDPLL});
  self.setDsdDPLL({value: self.dsdDPLL, label: self.dsdLabelDPLL});

  self.switchChannel();

  self.unmuteES9018K2m();
};

ControllerES9018K2M.prototype.execResetDeviceControl= function() {
  var self = this;

  if (!self.es9018k2m) {
    self.commandRouter.pushToastMessage('info', self.serviceName, self.getI18nString('NOT_FOUND_DEVICE'));
    return;
  }
  self.initVariables();
  self.initRegister();
  self.initDevice();
  self.applyFunction();
  self.updateUIConfig();
  self.saveConfig();
  self.commandRouter.pushToastMessage('info', self.serviceName, self.getI18nString('LOAD_DEFAULT'));
};

ControllerES9018K2M.prototype.execVolumeControl = function(data) {
  var self = this;

  if (!self.es9018k2m) {
    self.commandRouter.pushToastMessage('info', self.serviceName, self.getI18nString('NOT_FOUND_DEVICE'));
    return;
  }
  var volume = parseInt(data['volume_adjust']);
  var ready = data['ready'];

  self.setVolume(volume);
  if (self.ready !== ready) {
    self.ready = ready;
    if (ready)
      self.unmuteES9018K2m();
    else
      self.muteES9018K2m();
  };

  if (self.volumeLevel !== volume) {
    self.volumeLevel = volume;
    self.config.set('volumeLevel', volume);

    self.commandRouter.pushToastMessage('info', self.serviceName, self.getI18nString('UPDATE_VOLUME'));
  }
};

ControllerES9018K2M.prototype.execDpllControl = function (data) {
  var self = this;

  if (!self.es9018k2m) {
    self.commandRouter.pushToastMessage('info', self.serviceName, self.getI18nString('NOT_FOUND_DEVICE'));
    return;
  }
  var selectedI2sDpll = data['i2sDPLL'];
  var selectedDsdDpll = data['dsdDPLL'];

  self.messageOn = true;
  if (self.i2sDPLL !== selectedI2sDpll.value)
    self.setI2sDPLL(selectedI2sDpll);
  if (self.dsdDPLL !== selectedDsdDpll.value)
    self.setDsdDPLL(selectedDsdDpll);
};

// DPLL Mode for I2S
ControllerES9018K2M.prototype.setI2sDPLL = function (selected) {
  var self=this;
  var result;

  result = "i2s DPLL: " + selected.label;
  self.i2sDPLL = selected.value;
  self.i2sLabelDPLL = selected.label;
  self.reg12 &= 0x0F;
  self.reg12 |= selected.value;
  self.writeRegister(0x0C, self.reg12);

  if (self.messageOn)
    self.commandRouter.pushToastMessage('info', self.serviceName, result);

  self.config.set('i2sDPLL', self.i2sDPLL);
  self.config.set('i2sLabelDPLL', self.i2sLabelDPLL);
};

// DPLL Mode for DSD
ControllerES9018K2M.prototype.setDsdDPLL = function (selected) {
  var self=this;
  var result;

  result = "DSD DPLL: " + selected.label;
  self.dsdDPLL = selected.value;
  self.dsdLabelDPLL= selected.label;
  self.reg12 &= 0xF0;
  self.reg12 |= selected.value;
  self.writeRegister(0x0C, self.reg12);

  if (self.messageOn)
    self.commandRouter.pushToastMessage('info', self.serviceName, result);

  self.config.set('dsdDPLL', self.dsdDPLL);
  self.config.set('dsdLabelDPLL', self.dsdLabelDPLL);
};

ControllerES9018K2M.prototype.execDigitalFilterControl = function(data) {
  var self=this;

  if (!self.es9018k2m) {
    self.commandRouter.pushToastMessage('info', self.serviceName, self.getI18nString('NOT_FOUND_DEVICE'));
    return;
  }
  var selectedFir = data['fir_filter'];
  var selectedIir = data['iir_filter'];
  var selectedDeemphasis = data['deemphasis_filter'];

  self.messageOn = true;
  if (self.fir !== selectedFir.value) self.setFirFilter(selectedFir);
  if (self.iir !== selectedIir.value) self.setIirFilter(selectedIir);
  if (self.deemphasis !== selectedDeemphasis.value)
    self.setDeemphasisFilter(selectedDeemphasis);
};

ControllerES9018K2M.prototype.setFirFilter = function(selected){
  var self=this;
  var result;

  self.fir = selected.value;
  self.firLabel = selected.label;
  switch (selected.value) {
    case 0:   //  Slow Roll Off
      self.reg7=self.bitset(self.reg7,5);       // x 0 1 x x x x x
      self.reg7=self.bitclear(self.reg7,6);     // x 0 1 x x x x x
      self.reg21=self.bitclear(self.reg21,0);
      self.writeRegister(7, self.reg7);
      self.writeRegister(21, self.reg21);
      break;
    case 1:   // Fast Roll Off
      self.reg7=self.bitclear(self.reg7,5);     // x 0 0 x x x x x
      self.reg7=self.bitclear(self.reg7,6);     // x 0 0 x x x x x
      self.reg21=self.bitclear(self.reg21,0);
      self.writeRegister(7, self.reg7);
      self.writeRegister(21, self.reg21);
      break;
    case 2:   // Minimum phase
      self.reg7=self.bitclear(self.reg7,5);     // x 1 0 x x x x x
      self.reg7=self.bitset(self.reg7,6);       // x 1 0 x x x x x
      self.reg21=self.bitclear(self.reg21,0);
      self.writeRegister(7, self.reg7);
      self.writeRegister(21, self.reg21);
      break;
    case 3:   // Bypass oversampling
      self.reg21=self.bitset(self.reg21,0);
      self.writeRegister(0x15, self.reg21);
      break;
  }
  result = "FIR Filter: "+ selected.label;

  if (self.messageOn)
    self.commandRouter.pushToastMessage('info', self.serviceName, result);

  self.config.set('fir', self.fir);
  self.config.set('firLabel', self.firLabel);
};

ControllerES9018K2M.prototype.setIirFilter = function(selected) {
  var self=this;
  var result;

  self.iir = selected.value;
  self.iirLabel = selected.label;
  switch(selected) {
    case 0:                        // IIR Bandwidth: Normal 47K (for PCM)
      self.reg7=self.bitclear(self.reg7,2);     // x x x x 0 0 x x
      self.reg7=self.bitclear(self.reg7,3);
      self.reg21=self.bitclear(self.reg21,2);
      self.writeRegister(7, self.reg7);
      self.writeRegister(21, self.reg21);
      break;
    case 1:                        // IIR Bandwidth: 50k (for DSD)
      self.reg7=self.bitset(self.reg7,2);      // x x x x 0 1 x x
      self.reg7=self.bitclear(self.reg7,3);
      self.reg21=self.bitclear(self.reg21,2);
      self.writeRegister(7, self.reg7);
      self.writeRegister(21, self.reg21);
      break;
    case 2:                        // IIR Bandwidth: 60k (for DSD)
      self.reg7=self.bitset(self.reg7,3);     // x x x x 1 0 x x
      self.reg7=self.bitclear(self.reg7,2);
      self.reg21=self.bitclear(self.reg21,2);
      self.writeRegister(7, self.reg7);
      self.writeRegister(21, self.reg21);
      break;
    case 3:                        // IIR Bandwidth: 70k (for DSD)
      self.reg7=self.bitset(self.reg7,2);     // x x x x 1 1 x x
      self.reg7=self.bitset(self.reg7,3);
      self.reg21=self.bitclear(self.reg21,2);
      self.writeRegister(7, self.reg7);
      self.writeRegister(21, self.reg21);
      break;
    case 4:                        // IIR OFF (bypass IIR)
      self.reg21=self.bitset(self.reg21,2);
      self.writeRegister(21, self.reg21);
      break;
  }
  result = "IIR Filter: "+ selected.label;

  if (self.messageOn)
    self.commandRouter.pushToastMessage('info', self.serviceName, result);

  self.config.set('iir', self.iir);
  self.config.set('iirLabel', self.iirLabel);
};

ControllerES9018K2M.prototype.setDeemphasisFilter = function(selected) {
  var self=this;
  var result;

  self.deemphasis = selected.value;
  self.deemphasisLabel = selected.label;

  // off:0x4A, 32K:0x0A, 44k:0x1A, 48k:0x2a, reserved: 0x3A
  self.writeRegister(6, selected.value);

  result = "Deemphasis: " + selected.label;

  if (self.messageOn)
    self.commandRouter.pushToastMessage('info', self.serviceName, result);

  self.config.set('deemphasis', self.deemphasis);
  self.config.set('deemphasisLabel', self.deemphasisLabel);
};

// lBal and rBal are for adjusting for Balance for left and right channels
ControllerES9018K2M.prototype.setVolume = function(regVal) {
  var self=this;

  var value = 100 - regVal;
  self.writeRegister(15, value + self.lBal); // left channel
  self.writeRegister(16, value + self.rBal); // right channel

  if (self.messageOn)
    self.commandRouter.pushToastMessage('info', self.serviceName, self.getI18nString('APPLY_VOLUME'));
};

ControllerES9018K2M.prototype.muteES9018K2m  = function(){
  var self = this;

  self.reg7=self.bitset(self.reg7, 0);  // mute channel 1
  self.reg7=self.bitset(self.reg7, 1);  // mute channel 2
  self.writeRegister(7, self.reg7);
};

ControllerES9018K2M.prototype.unmuteES9018K2m  = function(){
  var self = this;

  self.reg7=self.bitclear(self.reg7, 0);  // unmute channel 1
  self.reg7=self.bitclear(self.reg7, 1);  // Unmute Channel 2
  self.writeRegister(7, self.reg7);
};

ControllerES9018K2M.prototype.execBalanceControl = function(data) {
  var self = this;

  if (!self.es9018k2m) {
    self.commandRouter.pushToastMessage('info', self.serviceName, self.getI18nString('NOT_FOUND_DEVICE'));
    return;
  }
  var balance = parseInt(data['balance_adjust']);
  var channel = data['channel_switch'];

  if (self.balance !== balance) {
    self.balance = balance;
    self.config.set('balance', self.balance);
    self.messageOn = true;
    self.setBalance(self.balance);
  }
  if (self.channel !== channel.value) {
    self.channel = channel.value;
    self.channelLabel = channel.label;
    self.config.set('channel', self.channel);
    self.switchChannel();
    self.messageOn = true;
    self.commandRouter.pushToastMessage('info', self.serviceName,
        self.getI18nString('SWITCH_CHANNEL') + channel.label);
  }
};

ControllerES9018K2M.prototype.switchChannel = function() {
  var self = this;

  if (self.channel)
    self.writeRegister(11, 0x02);
  else
    self.writeRegister(11, 0x01);
};

ControllerES9018K2M.prototype.setBalance = function(value){
  var self=this;
  var result;

  value += self.centerBalance;

  if (value === self.centerBalance) {         // balanced channel
    self.lBal=0;
    self.rBal=0;
    result = self.getI18nString('MID_BALANCE');
  }
  else {
    result = self.getI18nString('BALANCE') + ": ";
    if (value > self.centerBalance) {
      // adjusting balance to right channel
      self.rBal = 0;
      self.lBal = value - self.centerBalance;  // reduce left channel level
      result += (self.lBal/2).toString();
      result += "dB " + self.getI18nString('RIGHT');
    }
    else {
      // adjusting balance to left channel
      self.lBal = 0;
      self.rBal = self.centerBalance - value;    // reduce right channel level
      result += (self.rBal/2).toString();
      result += "dB "+ self.getI18nString('LEFT');
    }
  }
  self.balanceNote = result;

  // apply volume with balance
  self.setVolume(self.volumeLevel);
  self.updateUIConfig();

  if (self.messageOn)
    self.commandRouter.pushToastMessage('info', self.serviceName, result);
};

ControllerES9018K2M.prototype.execResetBalanceControl = function() {
  var self = this;

  if (!self.es9018k2m) {
    self.commandRouter.pushToastMessage('info', self.serviceName, self.getI18nString('NOT_FOUND_DEVICE'));
    return;
  }
  self.balance = 0;
  self.balanceNote = self.getI18nString('MID_BALANCE');
  self.setBalance(self.balance);
  self.config.set('balance', self.balance);
  self.updateUIConfig();
};

ControllerES9018K2M.prototype.getSampleRate = function() {
  var self=this;
  var defer = libQ.defer();
  var nDPLL=0;
  var reg66, reg67, reg68, reg69;

  // read DPLL registers(66~69) from LSB
  self.readRegister(66).then (function(value1) {
    reg66 = value1;
    self.readRegister(67).then (function(value2) {
      reg67 = value2;
      self.readRegister(68).then (function(value3) {
        reg68 = value3;
        self.readRegister(69).then (function(value4) {
          reg69 = value4;

          nDPLL |= reg69;
          nDPLL <<=8;
          nDPLL |= reg68;
          nDPLL <<=8;
          nDPLL |= reg67;
          nDPLL <<=8;
          nDPLL |= reg66;
          nDPLL >>= 1;    // remove LSB for avoiding overflow

          nDPLL *= 20;    // 100MHz crystal
          nDPLL /= 859;
          nDPLL *= 2;
          defer.resolve(nDPLL);
        });
      });
    });
  });

  return defer.promise;
};

ControllerES9018K2M.prototype.parseSampleRate = function() {
  var self = this;
  var mode;
  var defer = libQ.defer();

  self.getSampleRate().then(function (sampleRate) {
    if (sampleRate) {
      mode = self.getI18nString('PLAYING');
      if (sampleRate > 2822000)
        mode += "DSD ";
      else
        mode += "PCM ";

      switch (true) {
        case sampleRate > 6143000:
          mode += "6.1MHz";
          break;
        case sampleRate > 5644000:
          mode += "5.6MHz";
          break;
        case sampleRate > 3071000:
          mode += "3.0MHz";
          break;
        case sampleRate > 2822000:
          mode += "2.8MHz";
          break;
        case sampleRate > 383900:
          mode += "384KHz";
          break;
        case sampleRate > 352700:
          mode += "352KHz";
          break;
        case sampleRate > 191900:
          mode += "192KHz";
          break;
        case sampleRate > 176300:
          mode += "176KHz";
          break;
        case sampleRate > 95900:
          mode += "96.0KHz";
          break;
        case sampleRate > 88100:
          mode += "88.2KHz";
          break;
        case sampleRate > 47900:
          mode += "48.0KHz";
          break;
        case sampleRate > 44000:
          mode += "44.1KHz";
          break;
        default:
          mode += "UNKNOWN";
      }
      defer.resolve(mode);
    }
    else
      defer.resolve(null);
  });

  return defer.promise;
};

// es9018km i2c Control Methods ---------------------------------------------
ControllerES9018K2M.prototype.bitset = function(reg, value) {
  return reg |= (1 << value);
};

ControllerES9018K2M.prototype.bitclear = function(reg, value) {
  return reg &= ~(1 << value);
};

ControllerES9018K2M.prototype.readRegister = function(regAddr) {
  var self=this;
  var defer = libQ.defer();

  try {
    var wire = new i2c(self.deviceAddress, {device: '/dev/i2c-1'});
    wire.writeByte(regAddr, function(err) {
      self.logger.error("ControllerES9018K2M::readRegister:writeByte error:"+ JSON.stringify(err));
    });
    wire.readByte(function(err, result) {
      if (err)
        self.logger.error("ControllerES9018K2M::readRegister:readByte error:"+JSON.stringify(err));
      defer.resolve(result);
    });
  }
  catch (err) {
    self.logger.error("ControllerES9018K2M::readRegister error:"+ JSON.stringify(err));
    defer.resolve(null);
  }

  return defer.promise;
};

ControllerES9018K2M.prototype.writeRegister = function(regAddr, regVal) {
  var self=this;

  try {
    var wire = new i2c(self.deviceAddress, {device: '/dev/i2c-1'});
    wire.writeBytes(regAddr, [regVal], function(err) {
      if (err)
        self.logger.error("ControllerES9018K2M::writeRegister error:"+  JSON.stringify(err));
    });
  }
  catch (err) {
    self.logger.error("ControllerES9018K2M::writeRegister error:"+ JSON.stringify(err));
  }
};