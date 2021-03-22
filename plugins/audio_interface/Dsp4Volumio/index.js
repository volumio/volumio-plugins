/*--------------------
Dsp4Volumio plugin for volumio2. By balbuze April 13th 2020
----------------------
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
const WebSocket = require('ws')

//---global Variables
const filterfolder = "/data/INTERNAL/Dsp/filters/";
const filtersource = "/data/INTERNAL/Dsp/filter-sources/";
const tccurvepath = "/data/INTERNAL/Dsp/target-curves/";
const toolspath = "/data/INTERNAL/Dsp/tools/";


// Define the ControllerDsp4Volumio class
module.exports = ControllerDsp4Volumio;

function ControllerDsp4Volumio(context) {
  const self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;
  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
};

ControllerDsp4Volumio.prototype.onVolumioStart = function () {
  const self = this;
  let configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  this.config = new (require('v-conf'))();
  this.config.loadFile(configFile);
  return libQ.resolve();
};

ControllerDsp4Volumio.prototype.onStart = function () {
  const self = this;
  let defer = libQ.defer();
  self.commandRouter.loadI18nStrings();
  self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'updateALSAConfigFile');

  setTimeout(function () {
    self.createCamilladspfile()

  }, 2000);
  defer.resolve();
  return defer.promise;
};

ControllerDsp4Volumio.prototype.onStop = function () {
  const self = this;
  let defer = libQ.defer();
  self.logger.info("Stopping camilladsp service");
  defer.resolve();
  return libQ.resolve();
};

ControllerDsp4Volumio.prototype.onRestart = function () {
  const self = this;
};

ControllerDsp4Volumio.prototype.onInstall = function () {
  const self = this;
};

ControllerDsp4Volumio.prototype.onUninstall = function () {
  const self = this;
};

ControllerDsp4Volumio.prototype.getI18nFile = function (langCode) {
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

ControllerDsp4Volumio.prototype.getUIConfig = function () {
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
        
      }
      try {

        fs.readdir(filterfolder, function (err, item) {
          let allfilter = 'None,' + item;
          let items = allfilter.split(',');

          for (let i in items) {
            self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[0].options', {
              value: items[i],
              label: items[i]
            });
            self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[3].options', {
              value: items[i],
              label: items[i]
            });
         
            self.logger.info('list of available filters UI :' + items[i]);
          }

        });
      } catch (e) {
        self.logger.error('Could not read file: ' + e)
      }

      uiconf.sections[0].content[22].hidden = true;
      value = self.config.get('filter_format');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[22].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[22].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[22].options'), value));

      value = self.config.get('filter_size');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[23].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[23].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[23].options'), value));
      value = self.config.get('smpl_rate');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[24].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[24].value.label', value);

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
        let sampleformatf = (', Factory_S16LE, Factory_S24LE, Factory_S24_3LE, Factory_S24_4LE, Factory_S32LE, ');
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
        self.logger.info('result formats ' + result);
        let str1 = result.replace(/\s/g, '');
        let str = str1.substring(0, str1.length - 1);

        sitems = str.split(',');
        sitems.shift();
        for (let i in sitems) {
          self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[25].options', {
            value: sitems[i],
            label: sitems[i]
          });
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

ControllerDsp4Volumio.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

ControllerDsp4Volumio.prototype.setUIConfig = function (data) {
  const self = this;
};

ControllerDsp4Volumio.prototype.getConf = function (varName) {
  const self = this;
  //Perform your installation tasks here
};

ControllerDsp4Volumio.prototype.setConf = function (varName, varValue) {
  const self = this;
  //Perform your installation tasks here
};

ControllerDsp4Volumio.prototype.getLabelForSelect = function (options, key) {
  let n = options.length;
  for (let i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

ControllerDsp4Volumio.prototype.getAdditionalConf = function (type, controller, data) {
  const self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
}
// Plugin methods -----------------------------------------------------------------------------


//------------Here we define a function to send a command to CamillaDsp through websocket---------------------
ControllerDsp4Volumio.prototype.sendCommandToCamilla = function () {
  const self = this;
  const url = 'ws://localhost:9876'
  const command = ('\"Reload\"');
  const connection = new WebSocket(url)

  connection.onopen = () => {
    connection.send(command)
  }

  connection.onerror = (error) => {
    console.log(`WebSocket error: ${error}`)
  }

  connection.onmessage = (e) => {
    console.log(e.data)
    self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('CONFIG_UPDATED'));
  }

};

//------------Here we detect if clipping occurs while playing and gives a suggestion of setting...------
ControllerDsp4Volumio.prototype.testclipping = function () {
  const self = this;
  self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerDsp4Volumio::clearAddPlayTrack');
  let messageDisplayed;
  let arrreduced;
  let firstPeak = 0;
  let secondPeak = 0;
  let camilladspcmd = ('cfoa "l_out" "l_out" 0 ;cfoa "r_out" "r_out"  0');
  //self.sendCommandToBrutefir(brutefircmd);
  //console.log('Cmd sent to brutefir' + camilladspcmd);
  let ititle = 'Detecting clipping';
  let imessage = 'Please wait (10sec)';
  let track = '/data/plugins/audio_interface/Dsp4Volumio/testclipping/testclipping.wav';
  let outsample = self.config.get('smpl_rate');
  socket.emit('mute', '')
  if (outsample == '44100') {
    try {

      exec('/usr/bin/killall aplay');
      setTimeout(function () {
        execSync('/usr/bin/aplay --device=volumio ' + track);
      }, 500);//2000
      socket.emit('unmute', '')
    } catch (e) {
      console.log('/usr/bin/aplay --device=volumio ' + track);
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
    self.commandRouter.broadcastMessage("openModal", modalData);
  }
  let arr = [];


  let opts = {
    unit: 'camilladsp'
  }

  const journalctl = new Journalctl(opts);
  journalctl.on('event', (event) => {
    let pevent = event.MESSAGE.indexOf("peak");
    if (pevent != -1) {
      let filteredMessage = event.MESSAGE.split(',').pop().replace("peak ", "").slice(0, -1);
      let attcalculated = Math.round(Math.abs(20 * Math.log10(100 / filteredMessage)));

      messageDisplayed = attcalculated;
    } else {
      messageDisplayed = 0;
    }
    arr.push(messageDisplayed);
    arr.sort((a, b) => {
      if (a > b) return 1;
      if (a < b) return -1;
      return 0;
    });
    arrreduced = (arr.toString().split(','));
    self.logger.info('GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG ' + arrreduced.pop());
    self.config.set('attenuationl', arrreduced.pop());
    self.config.set('attenuationr', arrreduced.pop());
  });
  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Dsp4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
    self.commandRouter.pushToastMessage('info', 'Attenuation set to: ' + arrreduced.pop() + ' dB');
    self.rebuildcamilladspRestartDaemon();
    journalctl.stop();
  }, 550);
};

//here we determine filter type and apply skip value if needed
ControllerDsp4Volumio.prototype.dfiltertype = function () {
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
    auto_filter_format = 'FLOAT32LE';
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
    auto_filter_format = 'FLOAT64LE';
  }
  else if (filext == 'None') {

    auto_filter_format = 'text';
  }
  else if (filext == 'wav') {
    let SampleFormat;
    try {
      execSync('/usr/bin/python /data/plugins/audio_interface/Dsp4Volumio/test.py ' + filterfolder + filtername + ' >/tmp/test.result');
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

            filelength = DataLength / BytesPerFrame;
            skipvalue = ('skip_bytes_lines: ' + (8 + (+DataStart)));

            self.config.set('filter_size', filelength);
            self.config.set('skipvalue', skipvalue);
            self.config.set('wavetype', SampleFormat);

          }
        });
      }, 50);

      auto_filter_format = self.config.get('wavetype').replace('_', '');
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

ControllerDsp4Volumio.prototype.createCamilladspfile = function (obj) {
  const self = this;
  let defer = libQ.defer();

  try {
    fs.readFile(__dirname + "/camilladsp.conf.yml", 'utf8', function (err, data) {
      if (err) {
        defer.reject(new Error(err));
        return console.log(err);
      }
      var pipeliner, pipelines, pipelinelr, pipelinerr = '';
     
      var result = '';
      var gainmaxused = [];
      var effect = self.config.get('effect')
      var leftfilter = self.config.get('leftfilter');
      var rightfilter = self.config.get('rightfilter');
      var attenuationl = self.config.get('attenuationl');
      var attenuationlr = self.config.get('attenuationr');
      var gain = self.config.get('attenuationl')

      var gainresult;


      if (effect == false) {
        var composedeq = '';
        composedeq += '  :' + '\n';
        composedeq += '    type: Conv' + '\n';
        pipeliner = '      - nulleq';
        result += composedeq
        pipelinelr = pipeliner.slice(8)
        pipelinerr = pipeliner.slice(8)

        self.logger.info('Effects disabled, Nulleq applied')
        gainresult = 0
        gainclipfree = self.config.get('gainapplied')

      } else {
        var composedeq = '';
        composedeq += '  :' + '\n';
        composedeq += '    type: Conv' + '\n';
        pipeliner = '      - nulleq';
        result += composedeq
        pipelinelr = pipeliner.slice(8)
        pipelinerr = pipeliner.slice(8)

        self.logger.info('Effects disabled, Nulleq applied')
        gainresult = 0
        gainclipfree = self.config.get('gainapplied')
      }
     
        var outlpipeline, outrpipeline;
        result += composedeq
        outlpipeline += pipelineL
        outrpipeline += pipelineR
        pipelinelr = outlpipeline.slice(17)
        pipelinerr = outrpipeline.slice(17)
        if (pipelinelr == '') {
          pipelinelr = 'nulleq2'

        }
        if (pipelinerr == '') {
          pipelinerr = 'nulleq2'
        }
        gainmaxused += gainmax

      
      var gainclipfree
      if ((pipelinelr != 'nulleq2' || pipelinerr != 'nulleq2') || ((pipelinelr != '      - nulleq' && pipelinerr != '      - nulleq'))) {
        gainresult = (gainmaxused.toString().split(',').slice(1).sort((a, b) => a - b)).pop();
        self.logger.info('gainresult ' + gainresult)
        if (gainresult < 0) {
          gainclipfree = -2
        } else {
          gainclipfree = ('-' + (parseInt(gainresult) + 2))

          //else
        }
        self.config.set('gainapplied', gainclipfree)
      }
    

      self.logger.info(result)

      self.logger.info('gain applied ' + gainclipfree)

      let conf = data.replace("${resulteq}", result)
        .replace("${gain}", (gainclipfree))
        .replace("${gain}", (gainclipfree))
        .replace("${pipelineL}", pipelinelr)
        .replace("${pipelineR}", pipelinerr)
        ;
      fs.writeFile("/data/configuration/audio_interface/Parameq4Volumio/camilladsp.yml", conf, 'utf8', function (err) {
        if (err)
          defer.reject(new Error(err));
        else defer.resolve();
      });
      self.sendCommandToCamilla();
    });

  } catch (err) {

  }

  return defer.promise;


};


//here we save the brutefir config.json
ControllerDsp4Volumio.prototype.saveDsp4VolumioAccount2 = function (data, obj) {
  const self = this;
  let output_device
  let input_device = "Loopback,1";

  let numb_part = 8;
  output_device = self.config.get('alsa_device');
  let defer = libQ.defer();
  try {
    let cp3 = execSync('/bin/cp /data/configuration/audio_interface/Dsp4Volumio/config.json /data/configuration/audio_interface/Dsp4Volumio/config.json-save');

  } catch (err) {
    self.logger.info('/data/configuration/audio_interface/Dsp4Volumio/config.json does not exist');
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
    let cp2 = execSync('/bin/rm /data/configuration/audio_interface/Dsp4Volumio/config.json')
    let cp3 = exec('/bin/cp /data/configuration/Dsp4Volumio/config.json-save /data/configurDsp4Volumio/config.json');
    self.logger.info('/data/configuration/Dsp4Volumio/config.json restored!');

  } else {
    setTimeout(function () {

      self.dfiltertype();
      // self.areSwapFilters();
      self.rebuildcamilladspRestartDaemon()


        .then(function (e) {
          self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
          defer.resolve({});
        })
        .fail(function (e) {
          defer.reject(new Error('Camilladsp failed to start. Check your config !'));
          self.commandRouter.pushToastMessage('error', 'camilladsp failed to start. Check your config !');
        })

    }, 1500);//2500
    // }
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
              payload: { 'endpoint': 'audio_interface/Dsp4Volumio', 'method': 'testclipping' }
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
ControllerDsp4Volumio.prototype.sendvolumelevel = function () {
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
      camilladspcmd = ('cfc "lVoBAF" "' + lVoBAF + '" ;cfc "rVoBAF" "' + rVoBAF + '"');
      if (self.config.get('messon') == true) {
        setTimeout(function () {
          self.commandRouter.pushToastMessage('info', "VoBAF filter used :" + filmess);
        }, 500);
      };
      self.sendCommandcamilladsp(camilladspcmd);
    };
  });
};

//-----------here we define how to swap filters----------------------

ControllerDsp4Volumio.prototype.areSwapFilters = function () {
  const self = this;
  let leftFilter1 = self.config.get('leftfilter');
  let rightFilter1 = self.config.get('rightfilter');
  // let filterfolder = "/data/INTERNAL/Dsp4Volumiofilters/";

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
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Dsp4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    }, 500);
  });
};

//-------------here we define action if filters swappable when the button is pressed-----
ControllerDsp4Volumio.prototype.SwapFilters = function () {
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
ControllerDsp4Volumio.prototype.saveVoBAF = function (data) {
  const self = this;
  let defer = libQ.defer();
  let vf_ext;

  if (self.config.get('vobaf_format') == "text") {
    vf_ext = ".txt";
  } else if (self.config.get('vobaf_format') == "FLOAT32LE") {
    vf_ext = ".pcm";
  } else if (self.config.get('vobaf_format') == "FLOAT64LE") {
    vf_ext = ".dbl";
  } else if ((self.config.get('vobaf_format') == "S16LE") || (self.config.get('vobaf_format') == "S24LE") || (self.config.get('vobaf_format') == "S32LE")) {
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
    } else if ((Lowsw == true) && (fs.existsSync('/data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters/Low' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! Low' + vf_ext + ' Must exist in /data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters if you want to use Low filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((LM1sw == true) && (fs.existsSync('/data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters/LM1' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM1' + vf_ext + ' Must exist in /data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters if you want to use LM1 filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((LM2sw == true) && (fs.existsSync('/data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters/LM2' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM2' + vf_ext + ' Must exist in /data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters if you want to use LM2 filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((LM3sw == true) && (fs.existsSync('/data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters/LM3' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! LM3' + vf_ext + ' Must exist in /data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters if you want to use LM3 filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if (fs.existsSync('/data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters/M' + vf_ext) == !true) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! M' + vf_ext + ' Must exist in /data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters if you want to use VoBAF',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((HMsw == true) && (fs.existsSync('/data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters/HM' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! HM' + vf_ext + ' Must exist in /data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters if you want to use HM filter',
        size: 'lg',
        buttons: [{
          name: 'Close',
          class: 'btn btn-warning'
        },]
      };
      self.commandRouter.broadcastMessage("openModal", modalData);
    } else if ((Highsw == true) && (fs.existsSync('/data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters/High' + vf_ext) == !true)) {
      let modalData = {
        title: 'VoBAF filters activation',
        message: 'Warning !! High' + vf_ext + ' Must exist in /data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters if you want to use High filter',
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
ControllerDsp4Volumio.prototype.saveBrutefirconfigroom = function (data) {
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
ControllerDsp4Volumio.prototype.installtools = function (data) {
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

      var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Dsp4Volumio', {});
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
ControllerDsp4Volumio.prototype.removetools = function (data) {
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
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Dsp4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
    socket.emit('updateDb');

    //   return self.commandRouter.reloadUi();
  });
};

//------ actions tools------------

ControllerDsp4Volumio.prototype.playToolsFile = function (data) {
  const self = this;
  self.config.set('toolsfiletoplay', data['toolsfiletoplay'].value);
  let toolsfile = self.config.get("toolsfiletoplay");
  let track = "INTERNAL/Dsp/tools/" + toolsfile;
  self.commandRouter.replaceAndPlay({ uri: track });
  self.commandRouter.volumioClearQueue();
};
//-----------DRC-FIR section----------------

//here we save value for converted file
ControllerDsp4Volumio.prototype.fileconvert = function (data) {
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
ControllerDsp4Volumio.prototype.convert = function (data) {
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





