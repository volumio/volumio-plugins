/*DRC-FIR plugin for volumio2. By balbuze June 09th 2020
todo :
i2s dac settings
...
*/

'use strict';

const io = require('socket.io-client');
const fs = require('fs-extra');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const libQ = require('kew');
const net = require('net');
const socket = io.connect('http://localhost:3000');
//const wavFileInfo = require('wav-file-info');
const Journalctl = require('journalctl');
const path = require('path');
//const { readSync: readSyncBwf } = require('node-bwf-wav-file-reader');
//const { read: readBwf } = require('node-bwf-wav-file-reader');


//---global Variables
const filterfolder = "/data/INTERNAL/Dsp/filters/";
const filtersource = "/data/INTERNAL/Dsp/filter-sources/";
const tccurvepath = "/data/INTERNAL/Dsp/target-curves/";
const toolspath = "/data/INTERNAL/Dsp/tools/";
const vobaf_filterfolder = "/data/INTERNAL/Dsp/VoBAFfilters/";


// Define the ControllerBrutefir class
module.exports = ControllerBrutefir;

function ControllerBrutefir(context) {
  const self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;
  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
};

ControllerBrutefir.prototype.onVolumioStart = function () {
  const self = this;
  let configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.outputDeviceCallback.bind(this));
  this.config = new (require('v-conf'))();
  this.config.loadFile(configFile);
  // self.autoconfig

  return libQ.resolve();
};

ControllerBrutefir.prototype.onStart = function () {
  const self = this;
  let defer = libQ.defer();
  self.commandRouter.loadI18nStrings();
  socket.emit('getState', '');
  socket.emit('pause');
  self.sendvolumelevel();
  self.config.set('displayednameofset', "Set used is 1");
  self.config.set('setUsedOfFilters', "1");
  self.askForRebootFirstUse();
  self.autoconfig()

    .then(function (e) {
      setTimeout(function () {
        self.logger.info("Starting brutefir");
        // self.startBrutefirDaemon(defer);
        self.rebuildBRUTEFIRAndRestartDaemon(defer);

      }, 1000);
      defer.resolve();
    })
    .fail(function (e) {
      defer.reject(new Error());
    })
  return defer.promise;
  ;
};

ControllerBrutefir.prototype.onStop = function () {
  const self = this;
  let defer = libQ.defer();
  self.logger.info("Stopping Brutefir service");
  self.commandRouter.stateMachine.stop().then(function () {
    exec("/usr/bin/sudo /bin/systemctl stop brutefir.service", {
      uid: 1000,
      gid: 1000
    }, function (error, stdout, stderr) { })
    self.restoresettingwhendisabling()
    socket.off();
  });
  defer.resolve();
  return libQ.resolve();
};

ControllerBrutefir.prototype.onRestart = function () {
  const self = this;
};

ControllerBrutefir.prototype.onInstall = function () {
  const self = this;
};

ControllerBrutefir.prototype.onUninstall = function () {
  const self = this;
};

ControllerBrutefir.prototype.getI18nFile = function (langCode) {
  const i18nFiles = fs.readdirSync(path.join(__dirname, 'i18n'));
  const langFile = 'strings_' + langCode + '.json';

  // check for i18n file fitting the system language
  if (i18nFiles.some(function (i18nFile) { return i18nFile === langFile; })) {
    return path.join(__dirname, 'i18n', langFile);
  }
  // return default i18n file
  return path.join(__dirname, 'i18n', 'strings_en.json');
}

// Configuration methods------------------------------------------------------------------------

ControllerBrutefir.prototype.getUIConfig = function () {
  const self = this;
  let defer = libQ.defer();
  let output_device;
  output_device = self.config.get('output_device');

  let lang_code = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
    __dirname + '/i18n/strings_en.json',
    __dirname + '/UIConfig.json')

    .then(function (uiconf) {
      let value;
      let valuestoredl, valuestoredls;
      let valuestoredr, valuestoredrs;
      let valuestoredf;
      let allfilter;
      let filetoconvertl;
      let tc;

      //-----Room settings section
      uiconf.sections[2].hidden = true;
      uiconf.sections[2].content[0].value = self.config.get('ldistance');
      uiconf.sections[2].content[1].value = self.config.get('rdistance');
      // ------

      uiconf.sections[3].content[3].value = self.config.get('outputfilename');

      //-----------------------------------

      valuestoredl = self.config.get('leftfilter');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', valuestoredl);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label', valuestoredl);

      value = self.config.get('attenuationl');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label', value);

      uiconf.sections[0].content[2].value = self.config.get('lc1delay');

      valuestoredr = self.config.get('rightfilter');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[3].value.value', valuestoredr);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[3].value.label', valuestoredr);

      value = self.config.get('attenuationr');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.label', value);

      uiconf.sections[0].content[5].value = self.config.get('rc1delay');


      let nchannelssection = self.config.get('nchannels');
      self.logger.info('Number of channels detected : ----------->' + nchannelssection);
      if (nchannelssection == '2') {
        uiconf.sections[0].content[6].hidden = true;

      } else {
        uiconf.sections[0].content[6].hidden = false;
      }
      if (nchannelssection == '2') { //&& (addchannels == true)) {

        uiconf.sections[0].content[7].hidden = true;
        uiconf.sections[0].content[8].hidden = true;
        uiconf.sections[0].content[9].hidden = true;
        uiconf.sections[0].content[10].hidden = true;
        uiconf.sections[0].content[11].hidden = true;
        uiconf.sections[0].content[12].hidden = true;
        uiconf.sections[0].content[13].hidden = true;
        uiconf.sections[0].content[14].hidden = true;
        uiconf.sections[0].content[15].hidden = true;
        uiconf.sections[0].content[16].hidden = true;
        uiconf.sections[0].content[17].hidden = true;
        uiconf.sections[0].content[18].hidden = true;
        uiconf.sections[0].content[19].hidden = true;
        uiconf.sections[0].content[20].hidden = true;
        uiconf.sections[0].content[21].hidden = true;
      }
      /*
          if (nchannelssection == '3') { //&& (addchannels == true)) {
      
           uiconf.sections[0].content[9].hidden = true;
           uiconf.sections[0].content[10].hidden = true;
           uiconf.sections[0].content[11].hidden = true;
           uiconf.sections[0].content[12].hidden = true;
           uiconf.sections[0].content[13].hidden = true;
           uiconf.sections[0].content[14].hidden = true;
           uiconf.sections[0].content[15].hidden = true;
           uiconf.sections[0].content[16].hidden = true;
           uiconf.sections[0].content[17].hidden = true;
           uiconf.sections[0].content[18].hidden = true;
           uiconf.sections[0].content[19].hidden = true;
           uiconf.sections[0].content[20].hidden = true;
           uiconf.sections[0].content[21].hidden = true;
          }
      */
      if (nchannelssection == '4') { //&& (addchannels == true)) {

        uiconf.sections[0].content[11].hidden = false;
        uiconf.sections[0].content[12].hidden = true;
        uiconf.sections[0].content[13].hidden = true;
        uiconf.sections[0].content[14].hidden = true;
        uiconf.sections[0].content[15].hidden = true;
        uiconf.sections[0].content[16].hidden = true;
        uiconf.sections[0].content[17].hidden = true;
        uiconf.sections[0].content[18].hidden = true;
        uiconf.sections[0].content[19].hidden = true;
        uiconf.sections[0].content[20].hidden = true;
        uiconf.sections[0].content[21].hidden = true;
      }
      /*
          if (nchannelssection == '5') { //&& (addchannels == true)) {
           uiconf.sections[0].content[12].hidden = true;
           uiconf.sections[0].content[13].hidden = true;
           uiconf.sections[0].content[14].hidden = true;
           uiconf.sections[0].content[15].hidden = true;
           uiconf.sections[0].content[16].hidden = true;
           uiconf.sections[0].content[17].hidden = true;
           uiconf.sections[0].content[18].hidden = true;
           uiconf.sections[0].content[19].hidden = true;
           uiconf.sections[0].content[20].hidden = true;
           uiconf.sections[0].content[21].hidden = true;
          }
      */
      if (nchannelssection == '6') { //&& (addchannels == true)) {
        uiconf.sections[0].content[11].hidden = false;
        uiconf.sections[0].content[12].hidden = false;
        uiconf.sections[0].content[13].hidden = false;
        uiconf.sections[0].content[14].hidden = false;
        uiconf.sections[0].content[15].hidden = false;
        uiconf.sections[0].content[16].hidden = true;
        uiconf.sections[0].content[17].hidden = true;
        uiconf.sections[0].content[18].hidden = true;
        uiconf.sections[0].content[19].hidden = true;
        uiconf.sections[0].content[20].hidden = true;
        uiconf.sections[0].content[21].hidden = true;
      }
      /*
          if (nchannelssection == '7') { //&& (addchannels == true)) {
      
           uiconf.sections[0].content[17].hidden = false;
           uiconf.sections[0].content[18].hidden = true;
           uiconf.sections[0].content[19].hidden = true;
           uiconf.sections[0].content[20].hidden = true;
           uiconf.sections[0].content[21].hidden = true;
          }
      */
      if (nchannelssection == '8') { //&& (addchannels == true)) {
        uiconf.sections[0].content[11].hidden = false;
        uiconf.sections[0].content[12].hidden = false;
        uiconf.sections[0].content[13].hidden = false;
        uiconf.sections[0].content[14].hidden = false;
        uiconf.sections[0].content[15].hidden = false;
        uiconf.sections[0].content[16].hidden = false;
        uiconf.sections[0].content[17].hidden = false;
        uiconf.sections[0].content[18].hidden = false;
        uiconf.sections[0].content[19].hidden = false;
        uiconf.sections[0].content[20].hidden = false;
        uiconf.sections[0].content[21].hidden = false;
      }

      uiconf.sections[0].content[6].value = self.config.get('addchannels');

      valuestoredls = self.config.get('leftc2filter');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[7].value.value', valuestoredls);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[7].value.label', valuestoredls);

      uiconf.sections[0].content[8].value = self.config.get('lc2delay');

      valuestoredrs = self.config.get('rightc2filter');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[9].value.value', valuestoredrs);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[9].value.label', valuestoredrs);

      uiconf.sections[0].content[10].value = self.config.get('rc2delay');

      let attenuationlr2 = self.config.get('attenuationlr2');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[11].value.value', attenuationlr2);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[11].value.label', attenuationlr2);

      valuestoredls = self.config.get('leftc3filter');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[12].value.value', valuestoredls);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[12].value.label', valuestoredls);

      uiconf.sections[0].content[13].value = self.config.get('lc3delay');

      valuestoredrs = self.config.get('rightc3filter');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[14].value.value', valuestoredrs);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[14].value.label', valuestoredrs);

      uiconf.sections[0].content[15].value = self.config.get('rc3delay');

      let attenuationlr3 = self.config.get('attenuationlr3');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[16].value.value', attenuationlr3);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[16].value.label', attenuationlr3);

      valuestoredls = self.config.get('leftc4filter');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[17].value.value', valuestoredls);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[17].value.label', valuestoredls);

      uiconf.sections[0].content[18].value = self.config.get('lc4delay');

      valuestoredrs = self.config.get('rightc4filter');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[19].value.value', valuestoredrs);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[19].value.label', valuestoredrs);

      uiconf.sections[0].content[20].value = self.config.get('rc4delay');

      let attenuationlr4 = self.config.get('attenuationlr4');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[21].value.value', attenuationlr4);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[21].value.label', attenuationlr4);

      //	for (let n = 0; n < 22; n++) {
      for (let n = 0; n < 22; n = n + 0.5) {
        self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[1].options', {
          value: (n),
          label: (n)
        });
        self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[4].options', {
          value: (n),
          label: (n)
        });
        self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[11].options', {
          value: (n),
          label: (n)
        });
        self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[16].options', {
          value: (n),
          label: (n)
        });
        self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[21].options', {
          value: (n),
          label: (n)
        });
      }
      try {
        fs.readdir(filterfolder, function (err, item) {

          let allfilter = 'None,' + item;
          let items = allfilter.split(',');
          // items.pop();
          for (let i in items) {
            self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[0].options', {
              value: items[i],
              label: items[i]
            });
            self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[3].options', {
              value: items[i],
              label: items[i]
            });
            self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[7].options', {
              value: items[i],
              label: items[i]
            });
            self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[9].options', {
              value: items[i],
              label: items[i]
            });
            self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[12].options', {
              value: items[i],
              label: items[i]
            });
            self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[14].options', {
              value: items[i],
              label: items[i]
            });
            self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[17].options', {
              value: items[i],
              label: items[i]
            });
            self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[19].options', {
              value: items[i],
              label: items[i]
            });
            self.logger.info('available filters :' + items[i]);
          }

        });
      } catch (e) {
        self.logger.error('Could not read file: ' + e)
      }

      uiconf.sections[0].content[22].hidden = true;
      value = self.config.get('filter_format');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[22].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[22].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[22].options'), value));

      uiconf.sections[0].content[23].hidden = true;
      value = self.config.get('filter_size');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[23].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[23].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[23].options'), value));
      value = self.config.get('smpl_rate');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[24].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[24].value.label', value);

      //let probesmplerate;
      let probesmpleratehw = self.config.get('probesmplerate').slice(1).split(' ');

      for (let i in probesmpleratehw) {
        self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[24].options', {
          value: probesmpleratehw[i],
          label: probesmpleratehw[i]
        });
        self.logger.info('HW sample rate detected:' + probesmpleratehw[i]);
      }

      //-------------------------------------------------
      //here we read the content of the file sortsamplec.txt (it will be generated by a script to detect hw capabilities).

      uiconf.sections[0].content[24].hidden = false;
      valuestoredf = self.config.get('output_format');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[25].value.value', valuestoredf);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[25].value.label', valuestoredf);

      try {
        let sampleformat = self.config.get("formats").split(' ');
        let sampleformatf = (', Factory_S16_LE, Factory_S24_LE, Factory_S24_3LE, Factory_S24_4LE, Factory_S32_LE, ');
        let sampleformato;
        let sitems;
        let js;
        let str2;
        if (sampleformat == "") {
          sampleformato = sampleformatf;
        } else {
          let str22 = sampleformat.toString().replace(/S/g, "HW-Detected-S");
          str2 = str22.toString().replace(/\s/g, '');
          let str21 = str2.substring(0, str2.length - 1);
          js = str21
        }
        if (str2 == null) {
          str2 = "Detection\ fails.\ Reboot\ to\ retry, "
        }
        let result = str2 + sampleformatf
        let str1 = result.replace(/\s/g, '');
        let str = str1.substring(0, str1.length - 1);

        sitems = str.split(',');
        sitems.shift();
        for (let i in sitems) {
          self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[25].options', {
            value: sitems[i],
            label: sitems[i]
          });
          self.logger.info('hw format :' + sitems[i]);
        }
      } catch (e) {
        self.logger.error('Could not read file: ' + e)
        console.log(sampleformat)
      }
      uiconf.sections[0].content[26].value = self.config.get('enableclipdetect');

      let filterswap = self.config.get('arefilterswap');
      if (filterswap == false) {
        uiconf.sections[0].content[27].hidden = true;
        uiconf.sections[0].content[28].hidden = true;

      }
      uiconf.sections[0].content[27].hidden = true;

      uiconf.sections[0].content[27].value = self.config.get('displayednameofset');

      try {
        filetoconvertl = self.config.get('filetoconvert');
        self.configManager.setUIConfigParam(uiconf, 'sections[3].content[0].value.value', filetoconvertl);
        self.configManager.setUIConfigParam(uiconf, 'sections[3].content[0].value.label', filetoconvertl);

        fs.readdir(filtersource, function (err, fitem) {
          let fitems;
          let filetoconvert = '' + fitem;
          fitems = filetoconvert.split(',');
          // console.log(fitems)
          for (let i in fitems) {
            self.configManager.pushUIConfigParam(uiconf, 'sections[3].content[0].options', {
              value: fitems[i],
              label: fitems[i]
            });
            self.logger.info('available impulses to convert :' + fitems[i]);
          }
        });
      } catch (e) {
        self.logger.error('Could not read file: ' + e)
      }

      tc = self.config.get('tc');
      self.configManager.setUIConfigParam(uiconf, 'sections[3].content[1].value.value', tc);
      self.configManager.setUIConfigParam(uiconf, 'sections[3].content[1].value.label', tc);
      try {
        fs.readdir(tccurvepath, function (err, bitem) {
          let bitems;
          let filetoconvert = '' + bitem;
          bitems = filetoconvert.split(',');
          //console.log(bitems)
          for (let i in bitems) {
            self.configManager.pushUIConfigParam(uiconf, 'sections[3].content[1].options', {
              value: bitems[i],
              label: bitems[i]
            });
            self.logger.info('available target curve :' + bitems[i]);

          }
        });
      } catch (e) {
        self.logger.error('Could not read file: ' + e)
      }

      value = self.config.get('drcconfig');
      self.configManager.setUIConfigParam(uiconf, 'sections[3].content[2].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[3].content[2].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[3].content[2].options'), value));

      //--------Tools section------------------------------------------------

      let ttools = self.config.get('toolsinstalled');

      let toolsfiletoplay = self.config.get('toolsfiletoplay');
      self.configManager.setUIConfigParam(uiconf, 'sections[4].content[0].value.value', toolsfiletoplay);
      self.configManager.setUIConfigParam(uiconf, 'sections[4].content[0].value.label', toolsfiletoplay);

      try {
        fs.readdir(toolspath, function (err, bitem) {
          let filetools = '' + bitem;

          let bitems = filetools.split(',');

          //console.log(bitems)
          for (let i in bitems) {
            self.configManager.pushUIConfigParam(uiconf, 'sections[4].content[0].options', {
              value: bitems[i],
              label: bitems[i]
            });
            self.logger.info('tools file to play :' + bitems[i]);

          }
        });
      } catch (e) {
        self.logger.error('Could not read file: ' + e)
      }


      if (ttools == false) {
        uiconf.sections[4].content[1].hidden = true;
        uiconf.sections[4].content[2].hidden = false;

      } else {
        uiconf.sections[4].content[1].hidden = false;
        uiconf.sections[4].content[2].hidden = true;

      }

      //--------VoBAF section----------------------------------------------------------
      if (self.getAdditionalConf('audio_interface', 'alsa_controller', 'mixer_type') == 'None') {
        uiconf.sections[1].hidden = true;

      }
      uiconf.sections[1].content[0].value = self.config.get('vobaf');

      uiconf.sections[1].content[2].value = self.config.get('Lowsw');
      let Low = self.config.get('Low');
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[3].value.value', Low);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[3].value.label', Low);

      for (let i = 0; i < 50; i++) {

        //   self.logger.info('list of low values :' + (i));
        self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[3].options', {
          value: (i),
          label: (i)
        });
      }
      uiconf.sections[1].content[4].value = self.config.get('LM1sw');
      let LM1 = self.config.get('LM1');
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[5].value.value', LM1);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[5].value.label', LM1);

      for (let j = 0; j < 70; j++) {

        //   self.logger.info('list of LM1 values :' + (j));
        self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[5].options', {
          value: (j),
          label: (j)
        });
      }
      uiconf.sections[1].content[6].value = self.config.get('LM2sw');
      let LM2 = self.config.get('LM2');
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[7].value.value', LM2);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[7].value.label', LM2);

      for (let k = 0; k < 80; k++) {

        //  self.logger.info('list of LM2 values :' + (k));
        self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[7].options', {
          value: (k),
          label: (k)
        });
      }

      uiconf.sections[1].content[8].value = self.config.get('LM3sw');
      let LM3 = self.config.get('LM3');
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[9].value.value', LM3);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[9].value.label', LM3);

      for (let o = 0; o < 85; o++) {

        //  self.logger.info('list of LM3 values :' + (0));
        self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[9].options', {
          value: (o),
          label: (o)
        });
      }

      let M = self.config.get('M');
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[11].value.value', M);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[11].value.label', M);

      for (let l = 0; l < 100; l++) {

        //   self.logger.info('list of M values :' + (l));
        self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[11].options', {
          value: (l),
          label: (l)
        });
      }
      uiconf.sections[1].content[12].value = self.config.get('HMsw');
      let HM = self.config.get('HM');
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[13].value.value', HM);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[13].value.label', HM);

      for (let m = 30; m < 100; m++) {

        //  self.logger.info('list of HM values :' + (m));
        self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[13].options', {
          value: (m),
          label: (m)
        });
      }
      uiconf.sections[1].content[14].value = self.config.get('Highsw');

      let vatt = self.config.get('vatt');
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[16].value.value', vatt);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[16].value.label', vatt);

      for (let n = 0; n < 30; n++) {

        //  self.logger.info('list of HM values :' + (n));
        self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[16].options', {
          value: (n),
          label: (n)
        });
      }

      value = self.config.get('vobaf_format');
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[17].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[17].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[1].content[17].options'), value));

      uiconf.sections[1].content[18].value = self.config.get('messon');
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    })
  return defer.promise;
};

ControllerBrutefir.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

ControllerBrutefir.prototype.setUIConfig = function (data) {
  const self = this;
};

ControllerBrutefir.prototype.getConf = function (varName) {
  const self = this;
  //Perform your installation tasks here
};

ControllerBrutefir.prototype.setConf = function (varName, varValue) {
  const self = this;
  //Perform your installation tasks here
};

ControllerBrutefir.prototype.getLabelForSelect = function (options, key) {
  let n = options.length;
  for (let i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

ControllerBrutefir.prototype.getAdditionalConf = function (type, controller, data) {
  const self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
};

// Plugin methods -----------------------------------------------------------------------------

//------------Ask for reboot for first time 
ControllerBrutefir.prototype.askForRebootFirstUse = function () {
  const self = this;

  if (self.config.get('askForReboot')) {
    self.saveHardwareAudioParameters();
    var responseData = {
      title: self.commandRouter.getI18nString('FIRST_USE'),
      message: self.commandRouter.getI18nString('FIRST_USE_MESS'),
      size: 'lg',
      buttons: [
        {
          name: self.commandRouter.getI18nString('CONTINUE'),
          class: 'btn btn-cancel',
          emit: '',
          payload: ''
        },
        {
          name: 'Reboot',
          class: 'btn btn-info',
          emit: 'callMethod',
          payload: { 'endpoint': 'audio_interface/brutefir', 'method': 'setFalseReboot', 'data': '' }
        }
      ]
    }
    self.commandRouter.broadcastMessage("openModal", responseData);
  }
};

ControllerBrutefir.prototype.setFalseReboot = function () {
  const self = this;
  self.config.set('askForReboot', false);
  setTimeout(function () {
    console.log(self.config.get('askForReboot'));
    socket.emit('reboot');
  }, 500);
};

// 

//here we load snd_aloop module to provide a Loopback device
ControllerBrutefir.prototype.modprobeLoopBackDevice = function () {
  const self = this;
  let defer = libQ.defer();
  //self.hwinfo();
  try {
    execSync("/usr/bin/sudo /sbin/modprobe snd_aloop index=7 pcm_substreams=2", {
      uid: 1000,
      gid: 1000
    });
    self.commandRouter.pushConsoleMessage('snd_aloop loaded');
    defer.resolve();
  } catch (err) {
    self.logger.info('failed to load snd_aloop' + err);
  }
};

//here we detect hw info
ControllerBrutefir.prototype.hwinfo = function () {
  const self = this;
  let defer = libQ.defer();

  let output_device = self.config.get('alsa_device');
  let nchannels;
  let formats;
  let hwinfo;
  let samplerates;
  try {
    execSync('/data/plugins/audio_interface/brutefir/hw_params hw:' + output_device + ' >/data/configuration/audio_interface/brutefir/hwinfo.json ', {
      uid: 1000,
      gid: 1000
    });
    hwinfo = fs.readFileSync('/data/configuration/audio_interface/brutefir/hwinfo.json');
    try {
      const hwinfoJSON = JSON.parse(hwinfo);
      nchannels = hwinfoJSON.channels.value;
      formats = hwinfoJSON.formats.value.replace(' SPECIAL', '').replace(', ,', '').replace(',,', '');
      samplerates = hwinfoJSON.samplerates.value;
      console.log('AAAAAAAAAAAAAAAAAAAA-> ' + nchannels + ' <-AAAAAAAAAAAAA');
      console.log('AAAAAAAAAAAAAAAAAAAA-> ' + formats + ' <-AAAAAAAAAAAAA');
      console.log('AAAAAAAAAAAAAAAAAAAA-> ' + samplerates + ' <-AAAAAAAAAAAAA');
      self.config.set('nchannels', nchannels);
      self.config.set('formats', formats);
      self.config.set('probesmplerate', samplerates);
      let output_format = formats.split(" ").pop();

      var arr = ['S16_LE', 'S24_LE', 'S24_3LE', 'S32_LE'];
      var check = output_format;
      if (arr.indexOf(check) > -1) {
        let askForReboot = self.config.get('askForReboot');
        let firstOutputFormat = self.config.get('firstOutputFormat');
        console.log(askForReboot + " and " + firstOutputFormat)
        if ((askForReboot == false) && firstOutputFormat) {
          self.config.set('output_format', output_format);
          self.config.set('firstOutputFormat', false);
          self.logger.info('Auto set output format : ----->' + output_format);
        }
      } else {
        self.logger.info('Can\'t determine a compatible value for output format');
      }
    } catch (err) {
      self.logger.info('Error reading hwinfo.json, detection failed :', err);
    }

    defer.resolve();
  } catch (err) {
    self.logger.info('----Hw detection failed :' + err);
    defer.reject(err);
  }
};

//here we save the volumio config for the next plugin start
ControllerBrutefir.prototype.saveVolumioconfig = function () {
  const self = this;
  return new Promise(function (resolve, reject) {
    try {
      let cp = execSync('/bin/cp /data/configuration/audio_interface/alsa_controller/config.json /tmp/vconfig.json');
      let cp2 = execSync('/bin/cp /data/configuration/system_controller/i2s_dacs/config.json /tmp/i2sconfig.json');

      let cp3 = execSync('/bin/cp /boot/config.txt /tmp/config.txt');
    } catch (err) {
      self.logger.info('config.txt does not exist ' + err);
    }
    resolve();
  });
};

//here we define the volumio restore config
ControllerBrutefir.prototype.restoreVolumioconfig = function () {
  const self = this;
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      try {
        let cp = execSync('/bin/cp /tmp/vconfig.json /data/configuration/audio_interface/alsa_controller/config.json');
        let cp2 = execSync('/bin/cp /tmp/i2sconfig.json /data/configuration/system_controller/i2s_dacs/config.json');
        let cp3 = execSync('/bin/cp /tmp/config.txt /boot/config.txt');
      } catch (err) {
        self.logger.info('Error whie restoring config files  ' + err);
      }
    }, 8000)
    resolve();
  });
};

ControllerBrutefir.prototype.startBrutefirDaemon = function () {
  const self = this;
  let defer = libQ.defer();
  exec("/usr/bin/sudo /bin/systemctl start brutefir.service", {
    uid: 1000,
    gid: 1000
  }, function (error, stdout, stderr) {
    if (error) {
      self.logger.info('brutefir failed to start. Check your configuration ' + error);
    } else {
      self.commandRouter.pushConsoleMessage('Brutefir Daemon Started');
      self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('START_BRUTEFIR'));

      defer.resolve();
    }
  });
};

ControllerBrutefir.prototype.autoconfig = function () {
  const self = this;
  let defer = libQ.defer();
  self.saveVolumioconfig()
  self.hwinfo()
  self.modprobeLoopBackDevice()
  // self.saveHardwareAudioParameters()
  self.setLoopbackoutput()
  self.rebuildBRUTEFIRAndRestartDaemon() //no sure to keep it..
  //self.restoreVolumioconfig()
  // .catch(function (err) {
  //  console.log(err);
  //});
  defer.resolve()
  return defer.promise;
};

ControllerBrutefir.prototype.outputDeviceCallback = function () {
  const self = this;
  let defer = libQ.defer();
  setTimeout(function () {
    self.setVolumeParameters()
  }, 4500);
  self.restoreVolumioconfig()
  defer.resolve()
  return defer.promise;
};

//------------here we set the Loopback output and restore mixer and volume level
ControllerBrutefir.prototype.setLoopbackoutput = function () {
  const self = this;
  let defer = libQ.defer();
  let outputp
  outputp = self.config.get('alsa_outputdevicename')
  let stri = {
    "output_device": {
      "value": "Loopback",
      "label": ('Dsp -> ' + outputp)
    }
  }

  setTimeout(function () {
    console.log('XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX-restart mpd by Dsp--');
    self.commandRouter.executeOnPlugin('music_service', 'mpd', 'restartMpd', '');
    self.commandRouter.executeOnPlugin('system_controller', 'i2s_dacs', 'disableI2SDAC', '');
    self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'saveAlsaOptions', stri);
  }, 6500);
  /*
    let volumeval = self.config.get('alsa_volumestart')
    if (volumeval != 'disabled') {
      setTimeout(function () {
        exec('/volumio/app/plugins/system_controller/volumio_command_line_client/volumio.sh volume ' + volumeval, {
          uid: 1000,
          gid: 1000,
          encoding: 'utf8'
        }, function (error, stdout, stderr) {
          if (error) {
            self.logger.error('Cannot set startup volume: ' + error);
          } else {
            self.logger.info("Setting volume on startup at " + volumeval);
          }
        });
        var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'alsa_controller', {});
        respconfig.then(function (config) {
          self.commandRouter.broadcastMessage('pushUiConfig', config);
        });
      }, 12500);//13500
    }
    */
  return defer.promise;
};

//----------------we restart the daemon-------------------
ControllerBrutefir.prototype.rebuildBRUTEFIRAndRestartDaemon = function () {
  const self = this;
  let defer = libQ.defer();
  self.createBRUTEFIRFile()
    .then(function (e) {
      let edefer = libQ.defer();
      exec("/usr/bin/sudo /bin/systemctl restart brutefir.service", {
        uid: 1000,
        gid: 1000
      }, function (error, stdout, stderr) {
        if (error) {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('FAIL_TO_START_BRUTEFIR'));
        } else {
          // self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('START_BRUTEFIR'));
          setTimeout(function () {
            socket.emit('mute', '')
            setTimeout(function () {
              socket.emit('unmute', '');
            }, 100);
          }, 1500); //3500
          return defer.promise;
        }
        edefer.resolve();
      });

      return edefer.promise;
    })
    .then(self.startBrutefirDaemon.bind(self))
    .then(function (e) {
      setTimeout(function () {
        self.logger.info("Connecting to daemon");
      }, 2000)
        .fail(function (e) {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('FAIL_TO_START_BRUTEFIR'));
          self.logger.info("Brutefir failed to start. Check your config !");
        });
    });
  return defer.promise;
};

//-------------here we set the volume controller in /volumio/app/volumecontrol.js
ControllerBrutefir.prototype.setVolumeParameters = function () {
  const self = this;
  // we need to do it since it will be automatically set to the loopback device by alsa controller
  // to retrieve those values we need to save the configuration of the system, found in /data/configuration/audio_interface/alsa_controller/config.json
  // before enabling the loopback device. We do this in saveHardwareAudioParameters(), which needs to be invoked just before brutefir is enabled
  setTimeout(function () {
    //  return new Promise(function(resolve, reject) {
    //let defer = libQ.defer();
    const settings = {
      // need to set the device that brutefir wants to control volume to
      device: self.config.get('alsa_device'),
      // need to set the device name of the original device brutefir is controlling
      name: self.config.get('alsa_outputdevicename'),
      // Mixer name
      mixer: self.config.get('alsa_mixer'),
      // hardware, software, none
      mixertype: self.config.get('alsa_mixer_type'),
      // max volume setting
      maxvolume: self.config.get('alsa_volumemax'),
      // log or linear
      volumecurve: self.config.get('alsa_volumecurvemode'),
      //
      volumestart: self.config.get('alsa_volumestart'),
      //
      volumesteps: self.config.get('alsa_volumesteps'),
      //
      softvolumenumber: self.config.get('alsa_softvolumenumber')
    }
    console.log(settings)
    // once completed, uncomment
    return self.commandRouter.volumioUpdateVolumeSettings(settings)
  }, 2000);//8000
};

//----------- we save the alsa configuration for future needs here, note we prepend alsa_ to avoid confusion with other brutefir settings
ControllerBrutefir.prototype.saveHardwareAudioParameters = function () {
  const self = this;
  let defer = libQ.defer();
  let conf;
  //volumestart
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'volumestart');
  self.config.set('alsa_volumestart', conf);
  //maxvolume
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'volumemax');
  self.config.set('alsa_volumemax', conf);
  //volumecurve
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'volumecurvemode');
  self.config.set('alsa_volumecurvemode', conf);
  //device
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevice');
  self.config.set('alsa_device', conf);
  //mixer_type
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'mixer_type');
  self.config.set('alsa_mixer_type', conf);
  //mixer
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'mixer');
  self.config.set('alsa_mixer', conf);
  //volumesteps
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'volumesteps');
  self.config.set('alsa_volumesteps', conf);
  //name
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevicename');
  self.config.set('alsa_outputdevicename', conf);
  //softvolumenumber
  conf = self.getAdditionalConf('audio_interface', 'alsa_controller', 'softvolumenumber');
  self.config.set('alsa_softvolumenumber', conf);
  return defer.promise;
};

//------------here we restore config of volumio when the plugin is disabled-------------
ControllerBrutefir.prototype.restoresettingwhendisabling = function () {
  const self = this;
  let output_restored = self.config.get('alsa_device')
  let output_label = self.config.get('alsa_outputdevicename')
  let mixert = self.config.get('alsa_mixer')
  let mixerty = self.config.get('mixer_type')
  let str = {
    "output_device": {
      "value": output_restored,
      "label": output_label
    }
  }
  self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'saveAlsaOptions', str);

  // self.commandRouter.executeOnPlugin('system_controller', 'i2s_dacs', 'enableI2SDAC', '');
  /*
  let conf = self.config.get('alsa_mixer_type');
  console.log('rrrrrrrrrrrrrrrrrrrrr' + conf);
  //self.setAdditionalConf('audio_interface', 'alsa_controller', conf);
  self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'setConfigParam', conf);
  
   // return self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'saveAlsaOptions', str);
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'alsa_controller', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
    */
};

//------------Here we define a function to send a command to brutefir through its CLI---------------------
ControllerBrutefir.prototype.sendCommandToBrutefir = function (brutefircmd) {
  const self = this;
  let client = new net.Socket();

  client.connect(3002, '127.0.0.1', function (err) {
    client.write(brutefircmd);
    console.log('cmd sent to brutefir = ' + brutefircmd);
  });

  //error handling section
  client.on('error', function (e) {
    if (e.code == 'ECONNREFUSED') {
      console.log('Huumm, is brutefir running ?');
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('IS_BRUTEFIR_RUNNING'));
    }
  });
  client.on('data', function (data) {
    console.log('Received: ' + data);
    client.destroy(); // kill client after server's response
  });
};

//------------Here we detect if clipping occurs while playing and gives a suggestion of setting...------
ControllerBrutefir.prototype.testclipping = function () {
  const self = this;

  socket.emit('pause');
  let filelength = self.config.get('filter_size');

  let messageDisplayed;
  let firstPeak = 0;
  let secondPeak = 0;
  let brutefircmd = ('cfoa "l_out" "l_out" 0 ;cfoa "r_out" "r_out"  0');
  self.sendCommandToBrutefir(brutefircmd);
  console.log('Cmd sent to brutefir' + brutefircmd);
  let ititle = 'Detecting clipping';
  let imessage = 'Please wait (10sec)';
  let track = '/data/plugins/audio_interface/brutefir/testclipping/testclipping.wav';
  let outsample = self.config.get('smpl_rate');
  socket.emit('mute', '')
  if (outsample == '44100') {
    try {

      exec('/usr/bin/killall aplay');
      setTimeout(function () {
        execSync('/usr/bin/aplay --device=plughw:Loopback ' + track);
      }, 500);//2000
      socket.emit('unmute', '')
    } catch (e) {
      console.log('/usr/bin/aplay --device=plughw:Loopback ' + track);
    };
  } else {
    let modalData = {
      title: ititle,
      message: imessage,
      size: 'lg',
      buttons: [{
        name: 'Close',
        class: 'btn btn-warning'
      },]
    };
    // self.commandRouter.broadcastMessage("openModal", modalData);
  }

  let opts = {
    unit: 'brutefir'
  }
  const journalctl = new Journalctl(opts);
  journalctl.on('event', (event) => {

    let pevent = event.MESSAGE.indexOf("peak");
    if (pevent != -1) {
      let filteredMessage = event.MESSAGE.replace("peak: 0/", " ");
      let posFirstSlash = filteredMessage.indexOf("/");
      let posLastSlash = filteredMessage.lastIndexOf("/");
      secondPeak = filteredMessage.slice(posLastSlash + 2);
      firstPeak = filteredMessage.slice(posFirstSlash + 2, posFirstSlash + 6);
      let leftAttSet = 0;
      let rightAttSet = 0;
      let corr = 0.49;
      let leftSuggested = Math.round(Number(firstPeak) + Number(leftAttSet) + corr);
      let rightSuggested = Math.round(Number(secondPeak) + Number(rightAttSet) + corr);
      if (leftSuggested > rightSuggested) {
        messageDisplayed = leftSuggested
      } else {
        messageDisplayed = rightSuggested
      };
    } else {
      messageDisplayed = 0;

    }
    self.config.set('attenuationl', messageDisplayed);
    self.config.set('attenuationr', messageDisplayed);
  });
  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'brutefir', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('FILTER_LENGTH') + filelength, self.commandRouter.getI18nString('AUTO_ATTENUATION_SET') + messageDisplayed + ' dB');
    self.rebuildBRUTEFIRAndRestartDaemon();
    journalctl.stop();
  }, 1050);
};

//here we determine filter type and apply skip value if needed
ControllerBrutefir.prototype.dfiltertype = function () {
  const self = this;
  let skipvalue = '';
  let filtername = self.config.get('leftfilter');
  var auto_filter_format;
  let filext = self.config.get('leftfilter').split('.').pop().toString();
  var wavetype;
  let filelength;

  if (filext == 'pcm') {
    try {
      filelength = (execSync('/usr/bin/stat -c%s ' + filterfolder + filtername).slice(0, -1) / 4);
    } catch (err) {
      self.logger.info('An error occurs while reading file');
    }
    self.config.set('filter_size', filelength);
    auto_filter_format = 'FLOAT_LE';
  }
  else if (filext == 'txt') {
    let filelength;
    try {
      filelength = execSync('/bin/cat ' + filterfolder + filtername + ' |wc -l').slice(0, -1);
    } catch (err) {
      self.logger.info('An error occurs while reading file');
    }
    self.config.set('filter_size', filelength);
    auto_filter_format = 'text';
    self.logger.info('Filter length' + filelength);

  }
  else if (filext == 'dbl') {
    try {
      filelength = (execSync('/usr/bin/stat -c%s ' + filterfolder + filtername).slice(0, -1) / 8);
    } catch (err) {
      self.logger.info('An error occurs while reading file');
    }
    self.config.set('filter_size', filelength);
    auto_filter_format = 'FLOAT64_LE';
  }
  else if (filext == 'None') {

    auto_filter_format = 'text';
  }
  else if (filext == 'wav') {
    let SampleFormat;
    try {
      execSync('/usr/bin/python /data/plugins/audio_interface/brutefir/test.py ' + filterfolder + filtername + ' >/tmp/test.result');
      //   console.log('/usr/bin/python /data/plugins/audio_interface/brutefir/test.py ' + filterfolder + filtername)
      setTimeout(function () {

        fs.readFile('/tmp/test.result', 'utf8', function (err, result) {
          if (err) {
            self.logger.info('Error reading test.result', err);
          } else {
            var resultJSON = JSON.parse(result);
            var DataLength = resultJSON.DataLength;
            var DataStart = resultJSON.DataStart;
            var BytesPerFrame = resultJSON.BytesPerFrame;
            SampleFormat = resultJSON.SampleFormat;
            /*
                        console.log('NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNn ' + DataLength);
                        console.log('NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNn ' + DataStart);
                        console.log('NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNn ' + BytesPerFrame);
                        console.log('NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNn ' + SampleFormat);
                  //      console.log('NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNn ' + result);
              */
            filelength = DataLength / BytesPerFrame;
            skipvalue = ("skip:" + (8 + (+DataStart)) + ";");

            self.config.set('filter_size', filelength);
            self.config.set('skipvalue', skipvalue);
            self.config.set('wavetype', SampleFormat);

          }
        });
      }, 50);

      auto_filter_format = self.config.get('wavetype');
      filelength = self.config.get('filter_size');
      skipvalue = self.config.get('skipvalue');

    } catch (e) {
      self.logger.error('Could not read wav file: ' + e)
    }
  }
  else {
    let modalData = {
      title: self.commandRouter.getI18nString('FILTER_FORMAT_TITLE'),
      message: self.commandRouter.getI18nString('FILTER_FORMAT_MESS'),
      size: 'lg',
      buttons: [{
        name: 'Close',
        class: 'btn btn-warning'
      },]
    };
    self.commandRouter.broadcastMessage("openModal", modalData);
  }

  filelength = self.config.get('filter_size');

  self.config.set('filter_format', auto_filter_format);
  self.logger.info('--------->filter format ' + filext + ' ' + auto_filter_format);
  self.logger.info('--------->filter size ' + filelength);
  self.logger.info('--------->Skip value for wav :' + skipvalue);


  var arr = [2048, 4096, 8192, 16384, 32768, 65536, 131072, 262144];
  var check = Number(filelength);
  var valfound = false;
  if (arr.indexOf(check) > -1) {
    valfound = true;
  }
  if (valfound) {
    self.logger.info('File size found in array!');
  }
  if (valfound === false) {
    let modalData = {
      title: self.commandRouter.getI18nString('FILTER_LENGTH_TITLE'),
      message: self.commandRouter.getI18nString('FILTER_LENGTH_MESS'),
      size: 'lg',
      buttons: [{
        name: 'Close',
        class: 'btn btn-warning'
      },]
    };
    self.commandRouter.broadcastMessage("openModal", modalData)
    self.logger.error('File size not found in array!');

  };
  var obj = {
    skipvalue: skipvalue,
    valfound: valfound
  };

  return obj;

  // return (skipvalue,valfound);
};

//---------------------------------------------------------------

ControllerBrutefir.prototype.createBRUTEFIRFile = function (obj) {
  const self = this;
  let defer = libQ.defer();

  try {
    fs.readFile(__dirname + "/brutefir.conf.tmpl", 'utf8', function (err, data) {
      if (err) {
        defer.reject(new Error(err));
        return console.log(err);
      }
      let value;
      let devicevalue;
      let sbauer;
      let input_device = 'Loopback,1';
      //  let filterfolder = "/data/INTERNAL/brutefirfilters/";
      //let vobaf_filterfolder = "' + vobaf_filterfolder + '";
      let leftfilter, leftc2filter;
      let rightfilter, rightc2filter;
      let composeleftfilter = filterfolder + self.config.get('leftfilter');
      let composeleftfilter1, composeleftfilter2, composeleftfilter3, composeleftfilter4, composeleftfilter5, composeleftfilter6, composeleftfilter7, composeleftfilter8
      let composerightfilter = filterfolder + self.config.get('rightfilter');
      let composerightfilter1, composerightfilter2, composerightfilter3, composerightfilter4, composerightfilter5, composerightfilter6, composerightfilter7, composerightfilter8
      let lattenuation;
      let rattenuation;
      let f_ext;
      let vf_ext;
      /*
            if (self.config.get('vatt'))
              if (self.config.get('filter_format') == "text") {
                f_ext = ".txt";
              } else if (self.config.get('filter_format') == "FLOAT_LE") {
                f_ext = ".pcm";
              } else if (self.config.get('filter_format') == "FLOAT64_LE") {
                f_ext = ".dbl";
              } else if ((self.config.get('filter_format') == "S16_LE") || (self.config.get('filter_format') == "S24_LE") || (self.config.get('filter_format') == "S32_LE")) {
                f_ext = ".wav";
              }
              */
      if (self.config.get('vobaf_format') == "text") {
        vf_ext = ".txt";
      } else if (self.config.get('vobaf_format') == "FLOAT_LE") {
        vf_ext = ".pcm";
      } else if (self.config.get('vobaf_format') == "FLOAT64_LE") {
        f_ext = ".dbl";
      } else if ((self.config.get('vobaf_format') == "S16_LE") || (self.config.get('vobaf_format') == "S24_LE") || (self.config.get('vobaf_format') == "S32_LE")) {
        vf_ext = ".wav";
      }

      // delay calculation section for both channels NO MORE USED!!!!
      let delay
      let sldistance = self.config.get('ldistance');
      let srdistance = self.config.get('rdistance');
      let diff;
      let cdelay;
      let sample_rate = self.config.get('smpl_rate');
      let sv = 34300; // sound velocity cm/s

      if (sldistance > srdistance) {
        diff = sldistance - srdistance
        cdelay = (diff / sv * sample_rate)
        delay = ('0,' + Math.round(cdelay))
        self.logger.info('l>r ' + delay)
      }
      if (sldistance < srdistance) {
        diff = srdistance - sldistance
        cdelay = (diff / sv * sample_rate)
        delay = (Math.round(cdelay) + ',0')
        self.logger.info('l<r ' + delay)
      }
      if (sldistance == srdistance) {
        self.logger.info('no delay needed');
        delay = ('0,0')
      }
      //-----------------------------------------

      let n_part = self.config.get('numb_part');
      let num_part = parseInt(n_part);
      let f_size = self.config.get('filter_size');
      let filter_size = parseInt(f_size);
      let filtersizedivided = filter_size / num_part;
      let output_device;
      let skipfl;
      let skipfr;
      let vatt = self.config.get('vatt');

      let noldirac = self.config.get('leftfilter');
      let val = self.dfiltertype(obj);
      let skipval = val.skipvalue
      skipfl = skipfr = skipval;

      let routput_device = self.config.get('alsa_device');
      if (routput_device == 'softvolume') {
        output_device = 'softvolume';
      } else {
        output_device = 'hw:' + self.config.get('alsa_device');
      };
      console.log(self.config.get('output_format'));

      let output_formatx;
      output_formatx = self.config.get('output_format').replace(/HW-Detected-/g, "").replace(/Factory_/g, "");

      if ((self.config.get('leftfilter') == "Dirac pulse") || (self.config.get('leftfilter') == "None")) {
        composeleftfilter = composeleftfilter2 = composeleftfilter3 = composeleftfilter4 = composeleftfilter5 = composeleftfilter6 = composeleftfilter7 = composeleftfilter8 = "dirac pulse";
        self.config.set('attenuationl', '0');
      } else leftfilter = filterfolder + self.config.get('leftfilter');
      if ((self.config.get('rightfilter') == "Dirac pulse") || (self.config.get('rightfilter') == "None")) {
        composerightfilter = composerightfilter2 = composerightfilter3 = composerightfilter4 = composerightfilter5 = composerightfilter6 = composerightfilter7 = composerightfilter8 = "dirac pulse";
        self.config.set('attenuationr', '0');
      } else rightfilter = filterfolder + self.config.get('rightfilter');

      //--------second set of filters
      let arefilterswap = self.config.get('arefilterswap');
      let sndleftfilter;
      let sndrightfilter;
      let enableswap;
      if (arefilterswap) {
        sndleftfilter = filterfolder + self.config.get('sndleftfilter');
        sndrightfilter = filterfolder + self.config.get('sndrightfilter');
        enableswap = "";
      } else {
        sndleftfilter = "dirac pulse";
        sndrightfilter = "dirac pulse";
        enableswap = "#";
      }

      //--------VoBAF section
      let vobaf = self.config.get('vobaf');

      let skipflv;
      let skipfrv;
      if (vobaf == false) {
        composeleftfilter1 = composeleftfilter2 = composeleftfilter3 = composeleftfilter4 = composeleftfilter5 = composeleftfilter6 = composeleftfilter7 = composeleftfilter8 = composerightfilter1 = composerightfilter2 = composerightfilter3 = composerightfilter4 = composerightfilter5 = composerightfilter6 = composerightfilter7 = composerightfilter8 = "dirac pulse";

        skipflv = skipfrv = "";
        vatt = '0';
      } else {

        if (self.config.get('Lowsw') == true) {
          composeleftfilter2 = composerightfilter2 = vobaf_filterfolder + '/Low' + vf_ext;
          skipflv = skipfrv;
        } else {
          composeleftfilter2 = composerightfilter2 = "dirac pulse";
          skipflv = skipfrv = ""
        }

        if (self.config.get('LM1sw') == true) {
          composeleftfilter3 = composerightfilter3 = vobaf_filterfolder + '/LM1' + vf_ext;
          skipflv = skipfrv = skipfl;
        } else {
          composeleftfilter3 = composerightfilter3 = "dirac pulse";
          skipflv = skipfrv = ""
        }

        if (self.config.get('LM2sw') == true) {
          composeleftfilter4 = composerightfilter4 = vobaf_filterfolder + '/LM2' + vf_ext;
        } else {
          composeleftfilter4 = composerightfilter4 = "dirac pulse";
          skipflv = skipfrv = ""
        };

        if (self.config.get('LM3sw') == true) {
          composeleftfilter8 = composerightfilter8 = vobaf_filterfolder + '/LM3' + vf_ext;
        } else {
          composeleftfilter8 = composerightfilter8 = "dirac pulse";
          skipflv = skipfrv = ""
        };

        composeleftfilter5 = composerightfilter5 = vobaf_filterfolder + '/M' + vf_ext;


        if (self.config.get('HMsw') == true) {

          composeleftfilter6 = composerightfilter6 = vobaf_filterfolder + '/HM' + vf_ext;
          skipflv = skipfr;

        } else {
          composeleftfilter6 = composerightfilter6 = "dirac pulse";
          skipflv = skipfrv = "";
        }

        if (self.config.get('Highsw') == true) {
          composeleftfilter7 = composerightfilter7 = vobaf_filterfolder + '/High' + vf_ext;

        } else {
          composeleftfilter7 = composerightfilter7 = "dirac pulse";
          skipflv = skipfrv = "";
        }
      };

      //------ Multichannels section-------
      let tolfilters;
      let torfilters;
      let enablec2;
      let nchannels;
      let enablefc2, enablefc3, enablefc4, enablefc5, enablefc6, enablefc7;
      let lc1delay, rc1delay, lc2delay, rc2delay, lc3delay, rc3delay, lc4delay, rc4delay;
      let calc1delay, carc1delay, calc2delay, carc2delay, calc3delay, carc3delay, calc4delay, carc4delay;
      let tcdelay, tc2delay, tc3delay, tc4delay, tc5delay, tc6delay, tc7delay, tc8delay;
      let composeleftc2filter, composerightc2filter, composeleftc3filter, composerightc3filter, composeleftc4filter, composerightc4filter;

      calc1delay = (Math.round(self.config.get('lc1delay') / 1000 * sample_rate));
      carc1delay = (Math.round(self.config.get('rc1delay') / 1000 * sample_rate));
      calc2delay = (Math.round(self.config.get('lc2delay') / 1000 * sample_rate));
      carc2delay = (Math.round(self.config.get('rc2delay') / 1000 * sample_rate));
      calc3delay = (Math.round(self.config.get('lc3delay') / 1000 * sample_rate));
      carc3delay = (Math.round(self.config.get('rc3delay') / 1000 * sample_rate));
      calc4delay = (Math.round(self.config.get('lc4delay') / 1000 * sample_rate));
      carc4delay = (Math.round(self.config.get('rc4delay') / 1000 * sample_rate));

      tc2delay = 'delay:' + calc1delay + ',' + carc1delay;
      tc3delay = 'delay:' + calc1delay + ',' + carc1delay + ',' + calc2delay;
      tc4delay = 'delay:' + calc1delay + ',' + carc1delay + ',' + calc2delay + ',' + carc2delay;
      tc5delay = 'delay:' + calc1delay + ',' + carc1delay + ',' + calc2delay + ',' + carc2delay + ',' + calc3delay;
      tc6delay = 'delay:' + calc1delay + ',' + carc1delay + ',' + calc2delay + ',' + carc2delay + ',' + calc3delay + ',' + carc3delay;
      tc7delay = 'delay:' + calc1delay + ',' + carc1delay + ',' + calc2delay + ',' + carc2delay + ',' + calc3delay + ',' + carc3delay + ',' + calc4delay;
      tc8delay = 'delay:' + calc1delay + ',' + carc1delay + ',' + calc2delay + ',' + carc2delay + ',' + calc3delay + ',' + carc3delay + ',' + calc4delay + ',' + carc4delay;

      if ((self.config.get('addchannels') == true) && (self.config.get('nchannels') == '3')) {
        enablec2 = ',"l_c3_out" ';
        nchannels = "channels: 3/0,1,2;";
        enablefc2 = "";
        tcdelay = tc3delay;
        tolfilters = 'l_out","lc2_out';
        torfilters = 'r_out';
      }

      if ((self.config.get('addchannels') == true) && (self.config.get('nchannels') == '4')) {
        enablec2 = ',"l_c2_out","r_c2_out" ';
        nchannels = "channels: 4/0,1,2,3;";
        enablefc2 = enablefc3 = "";
        tcdelay = tc4delay
        tolfilters = 'l_out","l_c2_out';
        torfilters = 'r_out","r_c2_out';
      }
      if ((self.config.get('addchannels') == true) && (self.config.get('nchannels') == '5')) {
        enablec2 = ',"l_c2_out","r_c2_out","l_c3_out" ';
        nchannels = "channels: 5/0,1,2,3,4;";
        enablefc2 = enablefc3 = enablefc4 = "";
        tcdelay = tc5delay
        tolfilters = 'l_out","l_c2_out,"l_c3_out';
        torfilters = 'r_out","r_c2_out';
      }
      if ((self.config.get('addchannels') == true) && (self.config.get('nchannels') == '6')) {
        enablec2 = ',"l_c2_out","r_c2_out","l_c3_out","r_c3_out" ';
        nchannels = "channels: 6/0,1,2,3,4,5;";
        enablefc2 = enablefc3 = enablefc4 = enablefc5 = "";
        tcdelay = tc6delay
        tolfilters = 'l_out","l_c2_out","l_c3_out';
        torfilters = 'r_out","r_c2_out","r_c3_out';
      }
      if ((self.config.get('addchannels') == true) && (self.config.get('nchannels') == '7')) {
        enablec2 = ',"l_c2_out","r_c2_out","l_c3_out","r_c3_out","l_c4_out" ';
        nchannels = "channels: 7/0,1,2,3,4,5,6;";
        enablefc2 = enablefc3 = enablefc4 = enablefc5 = enablefc6 = "";
        tcdelay = tc7delay
        tolfilters = 'l_out","l_c2_out","l_c3_out","l_c4_out';
        torfilters = 'r_out","r_c2_out","r_c3_out';
      }
      if ((self.config.get('addchannels') == true) && (self.config.get('nchannels') == '8')) {
        enablec2 = ',"l_c2_out","r_c2_out","l_c3_out","r_c3_out","l_c4_out","r_c4_out" ';
        nchannels = "channels: 8/0,1,2,3,4,5,6,7;";
        enablefc2 = enablefc3 = enablefc4 = enablefc5 = enablefc6 = enablefc7 = "";
        tcdelay = tc8delay
        tolfilters = 'l_out","l_c2_out","l_c3_out","l_c4_out';
        torfilters = 'r_out","r_c2_out","r_c3_out","r_c4_out';
      } else {
        nchannels = "channels: 2;";
        enablefc2 = enablefc3 = enablefc4 = enablefc5 = enablefc6 = enablefc7 = "#";
        enablec2 = "";
        tcdelay = tc2delay
        tolfilters = 'l_out';
        torfilters = 'r_out';
      };

      if ((self.config.get('leftc2filter') == "Dirac pulse") || (self.config.get('leftc2filter') == "None")) {
        composeleftc2filter = "dirac pulse";
      } else composeleftc2filter = filterfolder + self.config.get('leftc2filter');

      if ((self.config.get('rightc2filter') == "Dirac pulse") || (self.config.get('rightc2filter') == "None")) {
        composerightc2filter = "dirac pulse";
      } else composerightc2filter = filterfolder + self.config.get('rightc2filter');

      if ((self.config.get('leftc3filter') == "Dirac pulse") || (self.config.get('leftc3filter') == "None")) {
        composeleftc3filter = "dirac pulse";
      } else composeleftc3filter = filterfolder + self.config.get('leftc3filter');

      if ((self.config.get('rightc3filter') == "Dirac pulse") || (self.config.get('rightc3filter') == "None")) {
        composerightc3filter = "dirac pulse";
      } else composerightc3filter = filterfolder + self.config.get('rightc3filter');

      if ((self.config.get('leftc4filter') == "Dirac pulse") || (self.config.get('leftc4filter') == "None")) {
        composeleftc4filter = "dirac pulse";
      } else composeleftc4filter = filterfolder + self.config.get('leftc4filter');

      if ((self.config.get('rightc4filter') == "Dirac pulse") || (self.config.get('rightc4filter') == "None")) {
        composerightc4filter = "dirac pulse";
      } else composerightc4filter = filterfolder + self.config.get('rightc4filter');

      //-----Brutefir config file generation----
      //-----not clean!!! need to be rewritten....
      let conf = data.replace("${smpl_rate}", self.config.get('smpl_rate'))
        .replace("${filter_size}", filtersizedivided)
        .replace("${numb_part}", num_part)
        .replace("${input_device}", input_device)
        .replace("${delay}", delay)
        .replace("${enablefc2}", enablefc2)
        .replace("${enablefc3}", enablefc3)
        .replace("${enablefc4}", enablefc4)
        .replace("${enablefc5}", enablefc5)
        .replace("${enablefc6}", enablefc6)
        .replace("${enablefc7}", enablefc7)
        .replace("${enablefc2}", enablefc2)
        .replace("${enablefc3}", enablefc3)
        .replace("${enablefc4}", enablefc4)
        .replace("${enablefc5}", enablefc5)
        .replace("${enablefc6}", enablefc6)
        .replace("${enablefc7}", enablefc7)
        .replace("${sndleftfilter}", sndleftfilter)
        .replace("${filter_format1}", self.config.get('filter_format'))
        .replace("${skip_1}", skipfl)
        .replace("${enableswap}", enableswap)
        .replace("${enableswap}", enableswap)
        .replace("${sndrightfilter}", sndrightfilter)
        .replace("${filter_format2}", self.config.get('filter_format'))
        .replace("${skip_2}", skipfl)
        .replace("${leftc2filter}", composeleftc2filter)
        .replace("${rightc2filter}", composerightc2filter)
        .replace("${leftc3filter}", composeleftc3filter)
        .replace("${rightc3filter}", composerightc3filter)
        .replace("${leftc4filter}", composeleftc4filter)
        .replace("${rightc4filter}", composerightc4filter)
        .replace("${attenuationlr2}", self.config.get('attenuationlr2'))
        .replace("${attenuationlr2}", self.config.get('attenuationlr2'))
        .replace("${attenuationlr3}", self.config.get('attenuationlr3'))
        .replace("${attenuationlr3}", self.config.get('attenuationlr3'))
        .replace("${attenuationlr4}", self.config.get('attenuationlr4'))
        .replace("${attenuationlr4}", self.config.get('attenuationlr4'))
        .replace("${filter_format1}", self.config.get('filter_format'))
        .replace("${filter_format1}", self.config.get('filter_format'))
        .replace("${filter_format1}", self.config.get('filter_format'))
        .replace("${filter_format1}", self.config.get('filter_format'))
        .replace("${filter_format1}", self.config.get('filter_format'))
        .replace("${filter_format1}", self.config.get('filter_format'))
        .replace("${skip_c2}", skipfr)
        .replace("${skip_c2}", skipfr)
        .replace("${skip_c2}", skipfr)
        .replace("${skip_c2}", skipfr)
        .replace("${skip_c2}", skipfr)
        .replace("${skip_c2}", skipfr)
        .replace("${tolfilters}", tolfilters)
        .replace("${torfilters}", torfilters)
        .replace("${leftfilter}", composeleftfilter)
        .replace("${filter_format1}", self.config.get('filter_format'))
        .replace("${skip_1}", skipfl)
        .replace("${lattenuation}", self.config.get('attenuationl'))
        .replace("${leftfilter}", composeleftfilter2)
        .replace("${filter_format1}", self.config.get('vobaf_format'))
        .replace("${skip_1}", skipflv)
        .replace("${lattenuation}", vatt)
        .replace("${leftfilter}", composeleftfilter3)
        .replace("${filter_format1}", self.config.get('vobaf_format'))
        .replace("${skip_1}", skipflv)
        .replace("${lattenuation}", vatt)
        .replace("${leftfilter}", composeleftfilter4)
        .replace("${filter_format1}", self.config.get('vobaf_format'))
        .replace("${skip_1}", skipflv)
        .replace("${lattenuation}", vatt)
        .replace("${leftfilter}", composeleftfilter8)
        .replace("${filter_format1}", self.config.get('vobaf_format'))
        .replace("${skip_1}", skipflv)
        .replace("${lattenuation}", vatt)
        .replace("${leftfilter}", composeleftfilter5)
        .replace("${filter_format1}", self.config.get('vobaf_format'))
        .replace("${skip_1}", skipflv)
        .replace("${lattenuation}", vatt)
        .replace("${leftfilter}", composeleftfilter6)
        .replace("${filter_format1}", self.config.get('vobaf_format'))
        .replace("${skip_1}", skipflv)
        .replace("${lattenuation}", vatt)
        .replace("${leftfilter}", composeleftfilter7)
        .replace("${filter_format1}", self.config.get('vobaf_format'))
        .replace("${skip_1}", skipflv)
        .replace("${lattenuation}", vatt)
        .replace("${rightfilter}", composerightfilter)
        .replace("${filter_format2}", self.config.get('filter_format'))
        .replace("${skip_2}", skipfr)
        .replace("${rattenuation}", self.config.get('attenuationr'))
        .replace("${rightfilter}", composerightfilter2)
        .replace("${filter_format2}", self.config.get('vobaf_format'))
        .replace("${skip_2}", skipfrv)
        .replace("${rattenuation}", vatt)
        .replace("${rightfilter}", composerightfilter3)
        .replace("${filter_format2}", self.config.get('vobaf_format'))
        .replace("${skip_2}", skipfrv)
        .replace("${rattenuation}", vatt)
        .replace("${rightfilter}", composerightfilter4)
        .replace("${filter_format2}", self.config.get('vobaf_format'))
        .replace("${skip_2}", skipfrv)
        .replace("${rattenuation}", vatt)
        .replace("${rightfilter}", composerightfilter8)
        .replace("${filter_format2}", self.config.get('vobaf_format'))
        .replace("${skip_2}", skipfrv)
        .replace("${rattenuation}", vatt)
        .replace("${rightfilter}", composerightfilter5)
        .replace("${filter_format2}", self.config.get('vobaf_format'))
        .replace("${skip_2}", skipfrv)
        .replace("${rattenuation}", vatt)
        .replace("${rightfilter}", composerightfilter6)
        .replace("${filter_format2}", self.config.get('vobaf_format'))
        .replace("${skip_2}", skipfrv)
        .replace("${rattenuation}", vatt)
        .replace("${rightfilter}", composerightfilter7)
        .replace("${filter_format2}", self.config.get('vobaf_format'))
        .replace("${skip_2}", skipfrv)
        .replace("${rattenuation}", vatt)
        .replace("${enablec2}", enablec2)
        .replace("${output_device}", output_device)
        .replace("${output_format}", output_formatx)
        .replace("${nchannels}", nchannels)
        .replace("${tdelay}", tcdelay);
      fs.writeFile("/data/configuration/audio_interface/brutefir/volumio-brutefir-config", conf, 'utf8', function (err) {
        if (err)
          defer.reject(new Error(err));
        else defer.resolve();
      });
    });

  } catch (err) {
  }
  return defer.promise;
};



//here we save the brutefir config.json
ControllerBrutefir.prototype.saveBrutefirconfigAccount2 = function (data, obj) {
  const self = this;
  let output_device
  let input_device = "Loopback,1";

  let numb_part = 8;
  output_device = self.config.get('alsa_device');
  let defer = libQ.defer();
  try {
    let cp3 = execSync('/bin/cp /data/configuration/audio_interface/brutefir/config.json /data/configuration/audio_interface/brutefir/config.json-save');

  } catch (err) {
    self.logger.info('/data/configuration/audio_interface/brutefir/config.json does not exist');
  }

  self.config.set('leftfilter', data['leftfilter'].value);
  self.config.set('lc1delay', data['lc1delay']);
  self.config.set('attenuationl', data['attenuationl'].value);
  self.config.set('rightfilter', data['rightfilter'].value);
  self.config.set('attenuationr', data['attenuationr'].value);
  self.config.set('rc1delay', data['rc1delay']);
  self.config.set('addchannels', data['addchannels']);
  self.config.set('leftc2filter', data['leftc2filter'].value);
  self.config.set('lc2delay', data['lc2delay']);
  self.config.set('rightc2filter', data['rightc2filter'].value);
  self.config.set('rc2delay', data['rc2delay']);
  self.config.set('attenuationlr2', data['attenuationlr2'].value);
  self.config.set('leftc3filter', data['leftc3filter'].value);
  self.config.set('lc3delay', data['lc3delay']);
  self.config.set('rightc3filter', data['rightc3filter'].value);
  self.config.set('rc3delay', data['rc3delay']);
  self.config.set('attenuationlr3', data['attenuationlr3'].value);
  self.config.set('leftc4filter', data['leftc4filter'].value);
  self.config.set('lc4delay', data['lc4delay']);
  self.config.set('rightc4filter', data['rightc4filter'].value);
  self.config.set('rc4delay', data['rc4delay']);
  self.config.set('attenuationlr4', data['attenuationlr4'].value);
  self.config.set('filter_size', data['filter_size'].value);
  //self.config.set('numb_part', data['numb_part']);
  //   self.config.set('numb_part', data['numb_part'].value);
  self.config.set('filter_format', data['filter_format'].value);
  self.config.set('smpl_rate', data['smpl_rate'].value);
  self.config.set('input_device', data['input_device']);
  self.config.set('output_device', data['output_device']);
  self.config.set('output_format', data['output_format'].value);
  self.config.set('enableclipdetect', data['enableclipdetect']);

  //setTimeout(function() {
  if (self.config.get('leftfilter').split('.').pop().toString() != self.config.get('rightfilter').split('.').pop().toString()) {
    let modalData = {
      title: self.commandRouter.getI18nString('DIFF_FILTER_TYPE_TITLE'),
      message: self.commandRouter.getI18nString('DIFF_FILTER_TYPE_MESS'),
      size: 'lg',
      buttons: [{
        name: 'Close',
        class: 'btn btn-warning'
      },]
    }
    self.commandRouter.broadcastMessage("openModal", modalData);
    //		try {
    let cp2 = execSync('/bin/rm /data/configuration/audio_interface/brutefir/config.json')
    let cp3 = exec('/bin/cp /data/configuration/audio_interface/brutefir/config.json-save /data/configuration/audio_interface/brutefir/config.json');
    self.logger.info('/data/configuration/audio_interface/brutefir/config.json restored!');

  } else {
    setTimeout(function () {
      self.dfiltertype();
      self.areSwapFilters();
      self.rebuildBRUTEFIRAndRestartDaemon()

        .then(function (e) {
          self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
          defer.resolve({});
        })
        .fail(function (e) {
          defer.reject(new Error('Brutefir failed to start. Check your config !'));
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('FAIL_TO_START_BRUTEFIR'));
        })

    }, 1500);//2500
    //  }
    let enableclipdetect = self.config.get('enableclipdetect');
    let leftfilter = self.config.get('leftfilter');
    let rightfilter = self.config.get('rightfilter');
    let val = self.dfiltertype(obj);
    let valfound = val.valfound
    if ((enableclipdetect) && (valfound) && ((rightfilter != 'None') || (leftfilter != 'None'))) {
      setTimeout(function () {
        var responseData = {
          title: self.commandRouter.getI18nString('CLIPPING_DETECT_TITLE'),
          message: self.commandRouter.getI18nString('CLIPPING_DETECT_MESS'),
          size: 'lg',
          buttons: [
            {
              name: self.commandRouter.getI18nString('CLIPPING_DETECT_EXIT'),
              class: 'btn btn-cancel',
              emit: '',
              payload: ''
            },
            {
              name: self.commandRouter.getI18nString('CLIPPING_DETECT_TEST'),
              class: 'btn btn-info',
              emit: 'callMethod',
              payload: { 'endpoint': 'audio_interface/brutefir', 'method': 'testclipping' }
            }
          ]
        }
        self.commandRouter.broadcastMessage("openModal", responseData);
      }, 3500);
    };
  };
  return defer.promise;
};

//------------VoBAf here we switch roomEQ filters depending on volume level and send cmd to brutefir using its CLI-----
ControllerBrutefir.prototype.sendvolumelevel = function () {
  const self = this;
  socket.on('pushState', function (data) {
    let vobaf = self.config.get('vobaf');
    if (vobaf == true) {
      let brutefircmd
      let Lowsw = self.config.get('Lowsw');
      let LM1sw = self.config.get('LM1sw');
      let LM2sw = self.config.get('LM2sw');
      let LM3sw = self.config.get('LM3sw');
      let HMsw = self.config.get('HMsw');
      let Highsw = self.config.get('Highsw');
      let Low = self.config.get('Low');
      let LM1 = self.config.get('LM1');
      let LM2 = self.config.get('LM2');
      let LM3 = self.config.get('LM3');
      let M = self.config.get('M');
      let HM = self.config.get('HM');
      let filmess;
      let lVoBAF, rVoBAF;

      //1-all filters enabled
      if (Lowsw == true && LM1sw == true && LM2sw == true && LM3sw == true && HMsw == true && Highsw == true) {
        if (data.volume < Low) {
          filmess = "Low"
          lVoBAF = "lLow"
          rVoBAF = "rLow"

        } else if (data.volume >= Low && data.volume < LM1) {
          filmess = "LM1"
          lVoBAF = "lLM1"
          rVoBAF = "rLM1"

        } else if (data.volume >= LM1 && data.volume < LM2) {
          filmess = "LM2"
          lVoBAF = "lLM2"
          rVoBAF = "rLM2"

        } else if (data.volume >= LM2 && data.volume < LM3) {
          filmess = "LM3"
          lVoBAF = "lLM3"
          rVoBAF = "rLM3"

        } else if (data.volume >= LM3 && data.volume < M) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"

        } else if (data.volume >= M && data.volume < HM) {
          filmess = "HM"
          lVoBAF = "lHM"
          rVoBAF = "rHM"

        } else if (data.volume >= HM) {
          filmess = "High"
          lVoBAF = "lHigh"
          rVoBAF = "rHigh"
        }
      }
      //2-Low not enabled
      if (Lowsw == false && LM1sw == true && LM2sw == true && LM3sw == true && HMsw == true && Highsw == true) {
        if (data.volume < LM1) {
          filmess = "LM1"
          lVoBAF = "lLM1"
          rVoBAF = "rLM1"

        } else if (data.volume >= LM1 && data.volume < LM2) {
          filmess = "LM2"
          lVoBAF = "lLM2"
          rVoBAF = "rLM2"

        } else if (data.volume >= LM2 && data.volume < LM3) {
          filmess = "LM3"
          lVoBAF = "lLM3"
          rVoBAF = "rLM3"

        } else if (data.volume >= LM3 && data.volume < M) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"

        } else if (data.volume >= M && data.volume < HM) {
          filmess = "HM"
          lVoBAF = "lHM"
          rVoBAF = "rHM"

        } else if (data.volume >= HM) {
          filmess = "High"
          lVoBAF = "lHigh"
          rVoBAF = "rHigh"
        }
      }
      //3-lOW,LM1 not enabled
      if (Lowsw == false && LM1sw == false && LM2sw == true && LM3sw == true && HMsw == true && Highsw == true) {
        if (data.volume < LM2) {
          filmess = "LM2"
          lVoBAF = "lLM2"
          rVoBAF = "rLM2"

        } else if (data.volume >= LM2 && data.volume < LM3) {
          filmess = "LM3"
          lVoBAF = "lLM3"
          rVoBAF = "rLM3"

        } else if (data.volume >= LM3 && data.volume < M) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"

        } else if (data.volume >= M && data.volume < HM) {
          filmess = "HM"
          lVoBAF = "lHM"
          rVoBAF = "rHM"

        } else if (data.volume >= HM) {
          filmess = "High"
          lVoBAF = "lHigh"
          rVoBAF = "rHigh"
        }
      }
      //4-lOW, LM1,LM2 not enabled
      if (Lowsw == false && LM1sw == false && LM2sw == false && LM3sw == true && HMsw == true && Highsw == true) {
        if (data.volume < LM3) {
          filmess = "LM3"
          lVoBAF = "lLM3"
          rVoBAF = "rLM3"

        } else if (data.volume >= LM3 && data.volume < M) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"

        } else if (data.volume >= M && data.volume < HM) {
          filmess = "HM"
          lVoBAF = "lHM"
          rVoBAF = "rHM"

        } else if (data.volume >= HM) {
          filmess = "High"
          lVoBAF = "lHigh"
          rVoBAF = "rHigh"
        }
      }
      //5-High not enabled
      if (Lowsw == true && LM1sw == true && LM2sw == true && LM3sw == true && HMsw == true && Highsw == false) {
        if (data.volume < Low) {
          filmess = "Low"
          lVoBAF = "lLow"
          rVoBAF = "rLow"

        } else if (data.volume >= Low && data.volume < LM1) {
          filmess = "LM1"
          lVoBAF = "lLM1"
          rVoBAF = "rLM1"

        } else if (data.volume >= LM1 && data.volume < LM2) {
          filmess = "LM2"
          lVoBAF = "lLM2"
          rVoBAF = "rLM2"

        } else if (data.volume >= LM2 && data.volume < LM3) {
          filmess = "LM3"
          lVoBAF = "lLM3"
          rVoBAF = "rLM3"

        } else if (data.volume >= LM3 && data.volume < M) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"

        } else if (data.volume >= M) {
          filmess = "HM"
          lVoBAF = "lHM"
          rVoBAF = "rHM"
        }
      }

      //6-HM and High not enabled
      if (Lowsw == true && LM1sw == true && LM2sw == true && LM3sw == true && HMsw == false && Highsw == false) {
        if (data.volume < Low) {
          filmess = "Low"
          lVoBAF = "lLow"
          rVoBAF = "rLow"

        } else if (data.volume >= Low && data.volume < LM1) {
          filmess = "LM1"
          lVoBAF = "lLM1"
          rVoBAF = "rLM1"

        } else if (data.volume >= LM1 && data.volume < LM2) {
          filmess = "LM2"
          lVoBAF = "lLM2"
          rVoBAF = "rLM2"

        } else if (data.volume >= LM2 && data.volume < LM3) {
          filmess = "LM3"
          lVoBAF = "lLM3"
          rVoBAF = "rLM3"

        } else if (data.volume >= LM3) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"
        }
      }

      //7-Low, HM and High not enabled
      if (Lowsw == false && LM1sw == true && LM2sw == true && LM3sw == true && HMsw == false && Highsw == false) {
        if (data.volume < LM1) {
          filmess = "LM1"
          lVoBAF = "lLM1"
          rVoBAF = "rLM1"

        } else if (data.volume >= LM1 && data.volume < LM2) {
          filmess = "LM2"
          lVoBAF = "lLM2"
          rVoBAF = "rLM2"

        } else if (data.volume >= LM2 && data.volume < LM3) {
          filmess = "LM3"
          lVoBAF = "lLM3"
          rVoBAF = "rLM3"

        } else if (data.volume >= LM3) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"
        }
      }

      //8-Low, LM1, HM and High not enabled
      if (Lowsw == false && LM1sw == false && LM2sw == true && LM3sw == true && HMsw == false && Highsw == false) {
        if (data.volume < LM2) {
          filmess = "LM2"
          lVoBAF = "lLM2"
          rVoBAF = "rLM2"

        } else if (data.volume >= LM2 && data.volume < LM3) {
          filmess = "LM3"
          lVoBAF = "lLM3"
          rVoBAF = "rLM3"

        } else if (data.volume >= LM3) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"
        }
      }

      //9-Low, LM1, LM2, LM3 and High not enabled
      if (Lowsw == false && LM1sw == false && LM2sw == false && LM3sw == false && HMsw == true && Highsw == false) {
        if (data.volume < M) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"

        } else if (data.volume >= M) {
          filmess = "HM"
          lVoBAF = "lHM"
          rVoBAF = "rHM"
        }
      }

      //10-Low and High not enabled
      if (Lowsw == false && LM1sw == true && LM2sw == true && LM3sw == true && HMsw == true && Highsw == false) {
        if (data.volume < LM1) {
          filmess = "LM1"
          lVoBAF = "lLM1"
          rVoBAF = "rLM1"

        } else if (data.volume >= LM1 && data.volume < LM2) {
          filmess = "LM2"
          lVoBAF = "lLM2"
          rVoBAF = "rLM2"

        } else if (data.volume >= LM2 && data.volume < LM3) {
          filmess = "LM3"
          lVoBAF = "lLM3"
          rVoBAF = "rLM3"

        } else if (data.volume >= LM3 && data.volume < M) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"

        } else if (data.volume >= M) {
          filmess = "HM"
          lVoBAF = "lHM"
          rVoBAF = "rHM"
        }
      }

      //11- Low, LM1 and High not enabled
      if (Lowsw == false && LM1sw == false && LM2sw == true && LM3sw == true && HMsw == true && Highsw == false) {
        if (data.volume < LM2) {
          filmess = "LM2"
          lVoBAF = "lLM2"
          rVoBAF = "rLM2"

        } else if (data.volume >= LM2 && data.volume < LM3) {
          filmess = "LM3"
          lVoBAF = "lLM3"
          rVoBAF = "rLM3"

        } else if (data.volume >= LM3 && data.volume < M) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"

        } else if (data.volume >= M) {
          filmess = "HM"
          lVoBAF = "lHM"
          rVoBAF = "rHM"
        }
      }

      //12- Low, LM1, LM2, LM3, HM and High not enabled
      if (Lowsw == false && LM1sw == false && LM2sw == false && LM3sw == false && HMsw == false && Highsw == false) {
        filmess = "M"
        lVoBAF = "lM"
        rVoBAF = "rM"

      }

      //13-Low, LM1, LM2, HM and High not enabled
      if (Lowsw == false && LM1sw == false && LM2sw == false && LM3sw == true && HMsw == false && Highsw == false) {
        if (data.volume < LM3) {
          filmess = "LM3"
          lVoBAF = "lLM3"
          rVoBAF = "rLM3"

        } else if (data.volume >= LM3) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"
        }
      }

      //14-Low, LM1, LM2 and LM3 not enabled
      if (Lowsw == false && LM1sw == false && LM2sw == false && LM3sw == false && HMsw == true && Highsw == true) {
        if (data.volume < M) {
          filmess = "M"
          lVoBAF = "lM"
          rVoBAF = "rM"

        } else if (data.volume >= M && data.volume < HM) {
          filmess = "HM"
          lVoBAF = "lHM"
          rVoBAF = "rHM"

        } else if (data.volume >= HM) {
          filmess = "High"
          lVoBAF = "lHigh"
          rVoBAF = "rHigh"
        }
      }

      //  here wend cmd to brutefir
      brutefircmd = ('cfc "lVoBAF" "' + lVoBAF + '" ;cfc "rVoBAF" "' + rVoBAF + '"');
      if (self.config.get('messon') == true) {
        setTimeout(function () {
          self.commandRouter.pushToastMessage('info', "VoBAF filter used :" + filmess);
        }, 500);
      };
      self.sendCommandToBrutefir(brutefircmd);
    };
  });
};

//-----------here we define how to swap filters----------------------

ControllerBrutefir.prototype.areSwapFilters = function () {
  const self = this;
  let leftFilter1 = self.config.get('leftfilter');
  let rightFilter1 = self.config.get('rightfilter');
  let filterfolder = "/data/INTERNAL/brutefirfilters/";

  // check if filter naming is ok with _1 in name
  const isFilterSwappable = (filterName, swapWord) => {
    let threeLastChar = filterName.slice(-6, -4);
    if (threeLastChar == swapWord) {
      return true
    }
    else {
      return false
    }
  };
  let leftResult = isFilterSwappable(leftFilter1, '_1');
  let rightResult = isFilterSwappable(rightFilter1, '_1');

  console.log(leftResult + ' + ' + rightResult);

  // check if secoond filter with _2 in name
  const isFileExist = (filterName, swapWord) => {
    let fileExt = filterName.slice(-4);
    let filterNameShort = filterName.slice(0, -6);
    let filterNameForSwap = filterNameShort + swapWord + fileExt;
    if (fs.exists(filterfolder + filterNameForSwap)) {
      return [true, filterNameForSwap]
    } else {
      return false
    }
  };
  let leftResultExist = isFileExist(leftFilter1, '_2');
  let toSaveLeftResult = leftResultExist[1];
  let rightResultExist = isFileExist(rightFilter1, '_2');
  let toSaveRightResult = rightResultExist[1];

  // if both condition are true, swapping possible
  if (leftResult & rightResult & leftResultExist[0] & rightResultExist[0]) {
    console.log('swap possible !!!!!!!')
    self.config.set('sndleftfilter', toSaveLeftResult);
    self.config.set('sndrightfilter', toSaveRightResult);
    self.config.set('arefilterswap', true);
  } else {
    self.config.set('sndleftfilter', 'Dirac pulse');
    self.config.set('sndrightfilter', 'Dirac pulse');
    self.config.set('arefilterswap', false);
  };
  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'brutefir', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
      //     return self.commandRouter.reloadUi();
    }, 500);
  });
};

//-------------here we define action if filters swappable when the button' is pressed-----
ControllerBrutefir.prototype.SwapFilters = function () {
  const self = this;
  let rsetUsedOfFilters = self.config.get('setUsedOfFilters');
  let brutefircmd;
  var leftfilter, rightfilter, sndleftfilter, sndrightfilter;
  if (rsetUsedOfFilters == '1') {
    self.config.set('setUsedOfFilters', 2);
    console.log('Swap to set 2 ');
    brutefircmd = ('cfc "l_out" "' + "2l_out" + '" ;cfc "r_out" "' + "2r_out" + '"');
    self.config.set('leftftosave', self.config.get('leftfilter'));
    self.config.set('rightftosave', self.config.get('rightfilter'));
    self.config.set('leftfilter', self.config.get('sndleftfilter'));
    self.config.set('rightfilter', self.config.get('sndrightfilter'));
    self.config.set('sndleftfilter', self.config.get('leftftosave'));
    self.config.set('sndrightfilter', self.config.get('rightftosave'));
    self.config.set('displayednameofset', "Set used is 2");

  } else if (rsetUsedOfFilters == '2') {
    self.config.set('setUsedOfFilters', 1);
    console.log('Swap to set 1 ');
    brutefircmd = ('cfc "l_out" "' + "l_out" + '" ;cfc "r_out" "' + "r_out" + '"');
    /* self.config.set('leftftosave', self.config.get('sndleftfilter'));
     self.config.set('rightftosave', self.config.get('sndrightfilter'));
     self.config.set('leftfilter', self.config.get('leftftosave'));
     self.config.set('rightfilter', self.config.get('rightftosave'));
     self.config.set('sndleftfilter', self.config.get('leftftosave'));
     self.config.set('sndrightfilter', self.config.get('rightftosave'));
     self.config.set('displayednameofset', "Set used is 1");
   */
    self.config.set('leftftosave', self.config.get('leftfilter'));
    self.config.set('rightftosave', self.config.get('rightfilter'));
    self.config.set('leftfilter', self.config.get('sndleftfilter'));
    self.config.set('rightfilter', self.config.get('sndrightfilter'));
    self.config.set('sndleftfilter', self.config.get('leftftosave'));
    self.config.set('sndrightfilter', self.config.get('rightftosave'));
    self.config.set('displayednameofset', "Set used is 1");

  };

  self.sendCommandToBrutefir(brutefircmd);

  var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'brutefir', {});
  respconfig.then(function (config) {
    self.commandRouter.broadcastMessage('pushUiConfig', config);
  });
};

//-----------here we save VoBAf parameters
ControllerBrutefir.prototype.saveVoBAF = function (data) {
  const self = this;
  let defer = libQ.defer();
  let vf_ext;

  if (self.config.get('vobaf_format') == "text") {
    vf_ext = ".txt";
  } else if (self.config.get('vobaf_format') == "FLOAT_LE") {
    vf_ext = ".pcm";
  } else if (self.config.get('vobaf_format') == "FLOAT64_LE") {
    vf_ext = ".dbl";
  } else if ((self.config.get('vobaf_format') == "S16_LE") || (self.config.get('vobaf_format') == "S24_LE") || (self.config.get('vobaf_format') == "S32_LE")) {
    vf_ext = ".wav";
  }

  self.config.set('vobaf', data['vobaf']);
  self.config.set('Lowsw', data['Lowsw']);
  self.config.set('Low', data['Low'].value);
  self.config.set('LM1sw', data['LM1sw']);
  self.config.set('LM1', data['LM1'].value);
  self.config.set('LM2sw', data['LM2sw']);
  self.config.set('LM2', data['LM2'].value);
  self.config.set('LM3sw', data['LM3sw']);
  self.config.set('LM3', data['LM3'].value);
  self.config.set('M', data['M'].value);
  self.config.set('HMsw', data['HMsw']);
  self.config.set('HM', data['HM'].value);
  self.config.set('Highsw', data['Highsw']);
  self.config.set('maxvolume', data['maxvolume'].value);
  self.config.set('vatt', data['vatt'].value);
  self.config.set('vobaf_format', data['vobaf_format'].value);
  self.config.set('messon', data['messon']);

  if (self.config.get('vobaf') == true) {

    let Lowsw = (self.config.get('Lowsw'))
    let LM1sw = (self.config.get('LM1sw'))
    let LM2sw = (self.config.get('LM2sw'))
    let LM3sw = (self.config.get('LM3sw'))
    let HMsw = (self.config.get('HMsw'))
    let Highsw = (self.config.get('Highsw'))

    let Low = (self.config.get('Low'))
    let LM1 = (self.config.get('LM1'))
    let LM2 = (self.config.get('LM2'))
    let LM3 = (self.config.get('LM3'))
    let HM = (self.config.get('HM'))
    let M = (self.config.get('M'))

    if ((Lowsw == true) && (LM1sw == false)) {
      console.log('ARCHTUNG !!!!!!!!!!!!!!!!!' + Lowsw + LM1sw);
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM1, LM2 and LM3 Must be enabled if you want to use Low filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((LM1sw == true) && (LM2sw == false)) {
      console.log('ARCHTUNG !!!!!!!!!!!!!!!!!' + LM1sw + LM2sw);
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM2 and LM3 Must be enabled if you want to use LM1 filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((LM2sw == true) && (LM3sw == false)) {
      console.log('ARCHTUNG !!!!!!!!!!!!!!!!!' + LM1sw + LM2sw);
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM3 Must be enabled if you want to use LM2 filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((Highsw == true) && (HMsw == false)) {
      console.log('ARCHTUNG !!!!!!!!!!!!!!!!!' + Highsw + HMsw);
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! HM Must be enabled if you want to use High filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((Lowsw == true) && (fs.existsSync(vobaf_filterfolder + '/Low' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! Low' + vf_ext + ' Must exist in ' + vobaf_filterfolder + ' if you want to use Low filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((LM1sw == true) && (fs.existsSync(vobaf_filterfolder + '/LM1' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM1' + vf_ext + ' Must exist in ' + vobaf_filterfolder + ' if you want to use LM1 filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((LM2sw == true) && (fs.existsSync(vobaf_filterfolder + '/LM2' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM2' + vf_ext + ' Must exist in ' + vobaf_filterfolder + ' if you want to use LM2 filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((LM3sw == true) && (fs.existsSync(vobaf_filterfolder + '/LM3' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM3' + vf_ext + ' Must exist in ' + vobaf_filterfolder + ' if you want to use LM3 filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if (fs.existsSync(vobaf_filterfolder + '/M' + vf_ext) == !true) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! M' + vf_ext + ' Must exist in ' + vobaf_filterfolder + ' if you want to use VoBAF',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((HMsw == true) && (fs.existsSync(vobaf_filterfolder + '/HM' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! HM' + vf_ext + ' Must exist in ' + vobaf_filterfolder + ' if you want to use HM filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((Highsw == true) && (fs.existsSync(vobaf_filterfolder + '/High' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! High' + vf_ext + ' Must exist in ' + vobaf_filterfolder + ' if you want to use High filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((Lowsw == true) && (parseInt(Low) >= parseInt(LM1))) {

      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! Low threshold must be less than LM1 threshold',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((LM1sw == true) && (parseInt(LM1) >= parseInt(LM2))) {

      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM1 threshold must be less than LM2 threshold',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((LM2sw == true) && (parseInt(LM2) >= parseInt(LM3))) {

      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM2 threshold must be less than LM3 threshold',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((LM3sw == true) && (parseInt(LM3) >= parseInt(M))) {

      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM3 threshold must be less than H threshold',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((HMsw == true) && (parseInt(M) >= parseInt(HM))) {

      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! M threshold must be less than HM threshold',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    }
  }
  setTimeout(function () {
    self.rebuildBRUTEFIRAndRestartDaemon()
      .then(function (e) {
        self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
        //self.sendvolumelevel();
        defer.resolve({});
      })
      .fail(function (e) {
        defer.reject(new Error('Brutefir failed to start. Check your config !'));
        self.commandRouter.pushToastMessage('error', 'Brutefir failed to start. Check your config !');
      })
  }, 500);
  return defer.promise;
};

//-----------here we save the brutefir delay calculation NOT MORE IN USE NOW!!!
ControllerBrutefir.prototype.saveBrutefirconfigroom = function (data) {
  const self = this;
  let defer = libQ.defer();
  self.config.set('ldistance', data['ldistance']);
  self.config.set('rdistance', data['rdistance']);
  self.rebuildBRUTEFIRAndRestartDaemon()
    .then(function (e) {
      self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
      defer.resolve({});
    })
    .fail(function (e) {
      defer.reject(new Error('Brutefir failed to start. Check your config !'));
      self.commandRouter.pushToastMessage('error', 'Brutefir failed to start. Check your config !');
    })
  return defer.promise;
};

//--------------Tools Section----------------

//here we download and install tools
ControllerBrutefir.prototype.installtools = function () {
  const self = this;

  return new Promise(function (resolve, reject) {
    try {
      let modalData = {
        title: self.commandRouter.getI18nString('TOOLS_INSTALL_TITLE'),
        message: self.commandRouter.getI18nString('TOOLS_INSTALL_WAIT'),
        size: 'lg'
      };
      //self.commandRouter.pushToastMessage('info', 'Please wait while installing ( up to 30 seconds)');
      self.commandRouter.broadcastMessage("openModal", modalData);

      // let cpz = execSync('/bin/rm /tmp/tools.tar.xz');
      let cp3 = execSync('/usr/bin/wget -P /tmp https://github.com/balbuze/volumio-plugins/raw/master/plugins/audio_interface/brutefir3/tools/tools.tar.xz');
      //  let cp4 = execSync('/bin/mkdir ' + toolspath);
      let cp5 = execSync('tar -xvf /tmp/tools.tar.xz -C ' + toolspath);
      let cp6 = execSync('/bin/rm /tmp/tools.tar.xz*');
      self.config.set('toolsfiletoplay', self.commandRouter.getI18nString('TOOLS_CHOOSE_FILE'));
      self.config.set('toolsinstalled', true);

      var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'brutefir', {});
      respconfig.then(function (config) {
        self.commandRouter.broadcastMessage('pushUiConfig', config);

      });

      socket.emit('updateDb');


    } catch (err) {
      self.logger.info('An error occurs while downloading or installing tools');
      self.commandRouter.pushToastMessage('error', 'An error occurs while downloading or installing tools');
    }

    resolve();
  });
};

//here we remove tools
ControllerBrutefir.prototype.removetools = function (data) {
  const self = this;
  self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOOLS_REMOVE'));
  return new Promise(function (resolve, reject) {

    try {

      let cp6 = execSync('/bin/rm ' + toolspath + "/*");
    } catch (err) {
      self.logger.info('An error occurs while removing tools');
      self.commandRouter.pushToastMessage('error', 'An error occurs while removing tools');
    }
    resolve();
    /*
    self.commandRouter.pushToastMessage('success', 'Tools succesfully Removed !', 'Refresh the page to see them');
    */
    self.config.set('toolsinstalled', false);
    self.config.set('toolsfiletoplay', self.commandRouter.getI18nString('TOOLS_NO_FILE'));
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'brutefir', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
    socket.emit('updateDb');

    //   return self.commandRouter.reloadUi();
  });
};

//------ actions tools------------

ControllerBrutefir.prototype.playToolsFile = function (data) {
  const self = this;
  self.config.set('toolsfiletoplay', data['toolsfiletoplay'].value);
  let toolsfile = self.config.get("toolsfiletoplay");
  let track = "INTERNAL/Dsp/tools/" + toolsfile;
  self.commandRouter.replaceAndPlay({ uri: track });
  self.commandRouter.volumioClearQueue();
};

//-----------DRC-FIR section----------------

//here we save value for converted file
ControllerBrutefir.prototype.fileconvert = function (data) {
  const self = this;
  let defer = libQ.defer();
  self.config.set('filetoconvert', data['filetoconvert'].value);
  self.config.set('tc', data['tc'].value);
  self.config.set('drcconfig', data['drcconfig'].value);
  self.config.set('outputfilename', data['outputfilename']);
  self.convert()
  return defer.promise;
};

//here we convert file using sox and generate filter with DRC-FIR
ControllerBrutefir.prototype.convert = function (data) {
  const self = this;
  //let defer = libQ.defer();
  //let filtersource = "/data/INTERNAL/brutefirfilters/filter-sources/";
  let drcconfig = self.config.get('drcconfig');
  // let filterfolder = "/data/INTERNAL/brutefirfilters/";
  let infile = self.config.get('filetoconvert');
  if (infile != 'choose a file') {

    let outfile = self.config.get('outputfilename').replace(/ /g, '-');
    if ((outfile == '') || (outfile == 'Empty=name-of-file-to-convert')) {
      outfile = infile.replace(/ /g, '-').replace('.wav', '');
    };
    let targetcurve = '\ /usr/share/drc/config/'
    let outsample = self.config.get('smpl_rate');
    let tc = self.config.get('tc');
    if (tc != 'choose a file') {
      let tcsimplified = tc.replace('.txt', '');
      let ftargetcurve
      let curve
      if ((outsample == 44100) || (outsample == 48000) || (outsample == 88200) || (outsample == 96000)) {
        if (outsample == 44100) {
          ftargetcurve = '44.1\\ kHz/';
          curve = '44.1';
        } else if (outsample == 48000) {
          ftargetcurve = '48.0\\ kHz/';
          curve = '48.0';
        } else if (outsample == 88200) {
          ftargetcurve = '88.2\\ kHz/';
          curve = '88.2';
        } else if (outsample == 96000) {
          ftargetcurve = '96.0\\ kHz/';
          curve = '96.0';
        };

        let destfile = (filterfolder + outfile + "-" + drcconfig + "-" + curve + "kHz-" + tcsimplified + ".pcm");
        self.commandRouter.loadI18nStrings();
        try {
          let cmdsox = ("/usr/bin/sox " + filtersource + infile + " -t f32 /tmp/tempofilter.pcm rate -v -s " + outsample);
          execSync(cmdsox);
          self.logger.info(cmdsox);
        } catch (e) {
          self.logger.info('input file does not exist ' + e);
          self.commandRouter.pushToastMessage('error', 'Sox fails to convert file' + e);
        };
        try {
          let title = self.commandRouter.getI18nString('FILTER_GENE_TITLE') + destfile;
          let mess = self.commandRouter.getI18nString('FILTER_GENE_MESS');
          let modalData = {
            title: title,
            message: mess,
            size: 'lg'
          };
          self.commandRouter.broadcastMessage("openModal", modalData);

          //here we compose cmde for drc
          //  let composedcmde = ("/usr/bin/drc --BCInFile=/tmp/tempofilter.pcm --PSNormType=E --PSNormFactor=1 --PTType=N --PSPointsFile=" + tccurvepath + tc + " --PSOutFile=" + destfile + targetcurve + ftargetcurve + drcconfig + "-" + curve + ".drc");
          let composedcmde = ("/usr/bin/drc --BCInFile=/tmp/tempofilter.pcm --PTType=N --PSPointsFile=" + tccurvepath + tc + " --PSOutFile=" + destfile + targetcurve + ftargetcurve + drcconfig + "-" + curve + ".drc");
          //and execute it...
          execSync(composedcmde, {
            uid: 1000,
            gid: 1000
          });
          self.logger.info(composedcmde);
          self.commandRouter.pushToastMessage('success', 'Filter ' + destfile + ' generated, Refresh the page to see it');
          var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'brutefir', {});
          respconfig.then(function (config) {
            self.commandRouter.broadcastMessage('pushUiConfig', config);
          });
          // return self.commandRouter.reloadUi();
        } catch (e) {
          self.logger.info('drc fails to create filter ' + e);
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('FILTER_GENE_FAIL') + e);
        };
      } else {
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('FILTER_GENE_FAIL_RATE'));
      };
    } else {
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('FILTER_GENE_FAIL_TC'));
    };
  } else {
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('FILTER_GENE_FAIL_FILE'));
  };
}





