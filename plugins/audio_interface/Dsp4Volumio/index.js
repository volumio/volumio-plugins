/*--------------------
Dsp4Volumio plugin for volumio2. By balbuze March 22th 2021
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


// Define the Dsp4Volumio class
module.exports = Dsp4Volumio;

function Dsp4Volumio(context) {
  const self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;
  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
};

Dsp4Volumio.prototype.onVolumioStart = function () {
  const self = this;
  let configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  this.config = new (require('v-conf'))();
  this.config.loadFile(configFile);
  return libQ.resolve();
};

Dsp4Volumio.prototype.onStart = function () {
  const self = this;
  let defer = libQ.defer();
  self.commandRouter.loadI18nStrings();
  self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'updateALSAConfigFile');
  self.hwinfo();
  //socket.emit('getState', '');
  setTimeout(function () {
    self.createCamilladspfile()

  }, 4000);
  defer.resolve();
  return defer.promise;
};

Dsp4Volumio.prototype.onStop = function () {
  const self = this;
  let defer = libQ.defer();
  self.logger.info("Stopping Dsp4Volumio plugin");
  socket.off();
  defer.resolve();
  return libQ.resolve();
};

Dsp4Volumio.prototype.onRestart = function () {
  const self = this;
};

Dsp4Volumio.prototype.onInstall = function () {
  const self = this;
};

Dsp4Volumio.prototype.onUninstall = function () {
  const self = this;
};

Dsp4Volumio.prototype.getI18nFile = function (langCode) {
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

Dsp4Volumio.prototype.getUIConfig = function () {
  const self = this;
  let defer = libQ.defer();

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
      var effect = self.config.get('effect')


      //-----------------------------------

      valuestoredl = self.config.get('leftfilter');
      let valuestoredllabel = valuestoredl.replace("$samplerate$", "variable samplerate")
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', valuestoredl);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label', valuestoredllabel);

      value = self.config.get('attenuationl');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label', value);

      uiconf.sections[0].content[2].hidden = true;
      uiconf.sections[0].content[2].value = self.config.get('lc1delay');

      valuestoredr = self.config.get('rightfilter');
      let valuestoredrlabel = valuestoredr.replace("$samplerate$", "variable samplerate")
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[3].value.value', valuestoredr);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[3].value.label', valuestoredrlabel);

      value = self.config.get('attenuationr');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.label', value);

      uiconf.sections[0].content[5].hidden = true;
      uiconf.sections[0].content[5].value = self.config.get('rc1delay');


      if ((valuestoredl == 'None') && (valuestoredr == 'None')) {
        uiconf.sections[0].content[11].hidden = true;
        uiconf.sections[0].content[10].hidden = true;
      } else {
        if (effect == true) {
          uiconf.sections[0].content[11].hidden = true;
          uiconf.sections[0].content[10].hidden = false;

        } else if (effect == false) {
          uiconf.sections[0].content[10].hidden = true;
          uiconf.sections[0].content[11].hidden = false;

        }
      }


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

      let autoswitchsamplerate = self.config.get('autoswitchsamplerate');
      if (autoswitchsamplerate) {
        uiconf.sections[0].content[6].hidden = true;
      }
      value = self.config.get('smpl_rate');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[6].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[6].value.label', value);
      let probesmpleratehw = self.config.get('probesmplerate').slice(1).split(' ');

      for (let i in probesmpleratehw) {
        self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[6].options', {
          value: probesmpleratehw[i],
          label: probesmpleratehw[i]
        });
        self.logger.info('HW sample rate detected:' + probesmpleratehw[i]);
      }


      uiconf.sections[0].content[7].value = self.config.get('enableclipdetect');

      let filterswap = self.config.get('arefilterswap');
      if (filterswap == false) {
        uiconf.sections[0].content[8].hidden = true;
        uiconf.sections[0].content[9].hidden = true;

      }

      uiconf.sections[0].content[8].value = self.config.get('displayednameofset');


      try {
        filetoconvertl = self.config.get('filetoconvert');
        self.configManager.setUIConfigParam(uiconf, 'sections[2].content[0].value.value', filetoconvertl);
        self.configManager.setUIConfigParam(uiconf, 'sections[2].content[0].value.label', filetoconvertl);

        fs.readdir(filtersource, function (err, fitem) {
          let fitems;
          let filetoconvert = '' + fitem;
          fitems = filetoconvert.split(',');
          // console.log(fitems)
          for (let i in fitems) {
            self.configManager.pushUIConfigParam(uiconf, 'sections[2].content[0].options', {
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
      self.configManager.setUIConfigParam(uiconf, 'sections[2].content[1].value.value', tc);
      self.configManager.setUIConfigParam(uiconf, 'sections[2].content[1].value.label', tc);
      try {
        fs.readdir(tccurvepath, function (err, bitem) {
          let bitems;
          let filetoconvert = '' + bitem;
          bitems = filetoconvert.split(',');
          //console.log(bitems)
          for (let i in bitems) {
            self.configManager.pushUIConfigParam(uiconf, 'sections[2].content[1].options', {
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
      self.configManager.setUIConfigParam(uiconf, 'sections[2].content[2].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[2].content[2].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[2].content[2].options'), value));
      uiconf.sections[2].content[3].value = self.config.get('outputfilename');

      //--------Tools section------------------------------------------------

      let ttools = self.config.get('toolsinstalled');

      let toolsfiletoplay = self.config.get('toolsfiletoplay');
      self.configManager.setUIConfigParam(uiconf, 'sections[3].content[0].value.value', toolsfiletoplay);
      self.configManager.setUIConfigParam(uiconf, 'sections[3].content[0].value.label', toolsfiletoplay);

      try {
        fs.readdir(toolspath, function (err, bitem) {
          let filetools = '' + bitem;

          let bitems = filetools.split(',');

          //console.log(bitems)
          for (let i in bitems) {
            self.configManager.pushUIConfigParam(uiconf, 'sections[3].content[0].options', {
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
        uiconf.sections[3].content[0].hidden = true;

        uiconf.sections[3].content[1].hidden = true;
        uiconf.sections[3].content[2].hidden = false;

      } else {
        uiconf.sections[3].content[1].hidden = false;
        uiconf.sections[3].content[2].hidden = true;

      }

      //--------VoBAF section----------------------------------------------------------
      uiconf.sections[1].hidden = true;
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

Dsp4Volumio.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

Dsp4Volumio.prototype.setUIConfig = function (data) {
  const self = this;
};

Dsp4Volumio.prototype.getConf = function (varName) {
  const self = this;
  //Perform your installation tasks here
};

Dsp4Volumio.prototype.setConf = function (varName, varValue) {
  const self = this;
  //Perform your installation tasks here
};

Dsp4Volumio.prototype.getLabelForSelect = function (options, key) {
  let n = options.length;
  for (let i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

Dsp4Volumio.prototype.getAdditionalConf = function (type, controller, data) {
  const self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
}
// Plugin methods -----------------------------------------------------------------------------
//here we detect hw info
Dsp4Volumio.prototype.hwinfo = function () {
  const self = this;
  let defer = libQ.defer();

  let output_device = this.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevice');
  let nchannels;
  let formats;
  let hwinfo;
  let samplerates;
  try {
    execSync('/data/plugins/audio_interface/Dsp4Volumio/hw_params volumioDsp >/data/configuration/audio_interface/Dsp4Volumio/hwinfo.json ', {
      uid: 1000,
      gid: 1000
    });
    hwinfo = fs.readFileSync('/data/configuration/audio_interface/Dsp4Volumio/hwinfo.json');
    try {
      const hwinfoJSON = JSON.parse(hwinfo);
      nchannels = hwinfoJSON.channels.value;
      formats = hwinfoJSON.formats.value.replace(' SPECIAL', '').replace(', ,', '').replace(',,', '');
      samplerates = hwinfoJSON.samplerates.value;
      self.logger.info('AAAAAAAAAAAAAAAAAAAA-> ' + nchannels + ' <-AAAAAAAAAAAAA');
      self.logger.info('AAAAAAAAAAAAAAAAAAAA-> ' + formats + ' <-AAAAAAAAAAAAA');
      self.logger.info('AAAAAAAAAAAAAAAAAAAA-> ' + samplerates + ' <-AAAAAAAAAAAAA');
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



Dsp4Volumio.prototype.disableeffect = function () {
  const self = this;
  self.config.set('effect', false)
  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  self.refreshUI();

};

Dsp4Volumio.prototype.enableeffect = function () {
  const self = this;
  self.config.set('effect', true)
  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  self.refreshUI();

};

Dsp4Volumio.prototype.refreshUI = function () {
  const self = this;

  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Dsp4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
  }, 100);
}

//------------Here we define a function to send a command to CamillaDsp through websocket---------------------
Dsp4Volumio.prototype.sendCommandToCamilla = function () {
  const self = this;
  const url = 'ws://localhost:9877'
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
Dsp4Volumio.prototype.testclipping = function () {
  const self = this;
  //socket.emit('mute', '');
  self.commandRouter.closeModals();
  let messageDisplayed;
  socket.emit('stop');
  let arrreduced;
  let filelength = self.config.get('filter_size');
  setTimeout(function () {
    self.config.set('attenuationl', 0);
    self.config.set('attenuationr', 0);
    self.config.set('testclipping', true)
    self.createCamilladspfile();
  }, 300);

  setTimeout(function () {

    let track = '/data/plugins/audio_interface/Dsp4Volumio/testclipping/testclipping.wav';
    try {
      let cmd = ('/usr/bin/aplay --device=volumioDsp ' + track);
      self.commandRouter.pushToastMessage('info', 'Clipping detection in progress...');

      // exec('/usr/bin/killall aplay');
      setTimeout(function () {
        execSync(cmd);
      }, 50);
      // socket.emit('unmute', '')
    } catch (e) {
      console.log(cmd);
    };
  }, 500);

  let arr = [];
  let opts = {
    unit: ''
  }
  const journalctl = new Journalctl(opts);
  journalctl.on('event', (event) => {
    let pevent = event.MESSAGE.indexOf("Clipping detected");
    if (pevent != -1) {
      let filteredMessage = event.MESSAGE.split(',').pop().replace("peak ", "").slice(0, -1);
      self.logger.info('filteredMessage ' + filteredMessage)
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
    let offset = 3;
    let arrreducedr = ((arr.toString().split(',')).pop());
    arrreduced = +arrreducedr + offset;
  });
  setTimeout(function () {
    self.logger.info('arrreduced  ' + arrreduced);
    self.config.set('attenuationl', arrreduced);
    self.config.set('attenuationr', arrreduced);
    self.config.set('testclipping', false)
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('FILTER_LENGTH') + filelength, self.commandRouter.getI18nString('AUTO_ATTENUATION_SET') + messageDisplayed + ' dB');
 //   self.commandRouter.pushToastMessage('info', 'Attenuation set to: ' + arrreduced + ' dB');
    self.createCamilladspfile();
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Dsp4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });

    journalctl.stop();
  }, 5510);
};

//here we determine filter type and apply skip value if needed
Dsp4Volumio.prototype.dfiltertype = function (data) {
  const self = this;
  let skipvalue = '';
  let filtername = self.config.get('leftfilterlabel');
  var auto_filter_format;
  let filext = self.config.get('leftfilterlabel').split('.').pop().toString();
  var wavetype;
  let filelength;

  if (filext == 'pcm') {
    try {
      filelength = (execSync('/usr/bin/stat -c%s ' + filterfolder + filtername).slice(0, -1) / 4);
      self.logger.info('filelength ' + filelength)
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
    auto_filter_format = 'TEXT';
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

    auto_filter_format = 'TEXT';
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
    /*   let modalData = {
         title: self.commandRouter.getI18nString('FILTER_LENGTH_TITLE'),
         message: self.commandRouter.getI18nString('FILTER_LENGTH_MESS'),
         size: 'lg',
         buttons: [{
           name: 'Close',
           class: 'btn btn-warning'
         },]
       };
       self.commandRouter.broadcastMessage("openModal", modalData)
      */
    self.logger.error('File size not found in array!');
  };

  var obj = {
    skipvalue: skipvalue,
    valfound: valfound
  };
  return obj;

  //return (skipvalue,valfound);
};

//---------------------------------------------------------------

Dsp4Volumio.prototype.createCamilladspfile = function (obj) {
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
      var effect = self.config.get('effect')
      var filter1 = self.config.get('leftfilter');
      var filter2 = self.config.get('rightfilter');
      var attenuation = self.config.get('attenuationl');
      var testclipping = self.config.get('testclipping')
      var smpl_rate = self.config.get('smpl_rate')
      var filter_format = self.config.get('filter_format')
      let val = self.dfiltertype(obj);
      let skipval = val.skipvalue
      var composedeq = '';
      var channels = 2;
      var pipeline1, pipeline2, pipeline;
      var filterr;
      if (effect == false) {
        var composedeq = '';
        composedeq += '  nulleq:' + '\n';
        composedeq += '    type: Conv' + '\n';
        pipeline1 = pipeline2 = 'nulleq';
        result += composedeq
        var composeout = ''
        composeout += '  playback:' + '\n';
        composeout += '    type: Alsa' + '\n';
        composeout += '    channels: 2' + '\n';
        composeout += '    device: "fromDsp1"' + '\n';
        composeout += '    format: S24LE3' + '\n';
      } else {
        if (testclipping) {
          var composeout = ''
          composeout += '  playback:' + '\n';
          composeout += '    type: File' + '\n';
          composeout += '    channels: 2' + '\n';
          composeout += '    filename: "/dev/null"' + '\n';
          composeout += '    format: S24LE3' + '\n';
          self.logger.info('aaaaaaaaaaaaaaaaaaaa ')

        } else if (testclipping == false) {
          var composeout = ''
          composeout += '  playback:' + '\n';
          composeout += '    type: Alsa' + '\n';
          composeout += '    channels: 2' + '\n';
          composeout += '    device: "fromDsp1"' + '\n';
          composeout += '    format: S24LE3' + '\n';
        }

        for (let a = 1; a <= (channels); a++) {
          filterr = eval('filter' + a)
          //  self.logger.info('aaaaaaaaaaaaaaaaaaaa ' + filterr + '  ' + a)

          var composedeq = '';
          composedeq += '  conv' + [a] + ':\n';
          composedeq += '    type: Conv' + '\n';
          composedeq += '    parameters:' + '\n';
          composedeq += '      type: File' + '\n';
          composedeq += '      filename: ' + filterfolder + filterr + '\n';
          composedeq += '      format: ' + filter_format + '\n';
          composedeq += '      ' + skipval + '\n';
          composedeq += '' + '\n';
          //  self.logger.info('aaaaaaaaaaaaaaaaaaaa ' + filterr)

          if (a == 1) {
            pipeline1 = 'conv1'
          }
          if (a == 2) {
            pipeline2 = 'conv2'
          }

          result += composedeq
        }
      }


      let conf = data.replace("${resulteq}", result)
        .replace("${composeout}", (composeout))
        .replace("${smpl_rate}", (smpl_rate))
        .replace("${gain}", ('-' + attenuation))
        .replace("${gain}", ('-' + attenuation))
        .replace("${pipelineL}", pipeline1)
        .replace("${pipelineR}", pipeline2)
        ;
      fs.writeFile("/data/configuration/audio_interface/Dsp4Volumio/camilladsp.yml", conf, 'utf8', function (err) {
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


//here we save the config.json
Dsp4Volumio.prototype.saveDsp4VolumioAccount2 = function (data, obj) {
  const self = this;
  let defer = libQ.defer();
  let attenuationl = (data['attenuationl'].value);
  let attenuationr = (data['attenuationr'].value);
  let leftfilter = (data['leftfilter'].value);
  let rightfilter = (data['rightfilter'].value);
  self.logger.error('Sxxxxxxxxxxxxxxxxxxxxxxxxxxxx' + leftfilter);
  self.config.set('leftfilterlabel', leftfilter);

  if ((leftfilter == 'None') && (rightfilter == 'None')) {
    attenuationl = attenuationr = 0
    self.config.set('effect', false)
  } else {
    self.config.set('effect', true)
  }

  if ((leftfilter.split('.').pop().toString()) != (rightfilter.split('.').pop().toString())) {

    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('DIFF_FILTER_TYPE_MESS'));
    self.logger.error('All filter must be of the same type')
    return;
  }
  if (((data['leftfilter'].value).includes(' ')) || ((data['rightfilter'].value).includes(' '))) {
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('WARN_SPACE_INFILTER'));
    self.logger.error('SPACE NOT ALLOWED in file name')
    return;

  } else {
    setTimeout(function () {

      self.dfiltertype(data);
      // self.areSwapFilters();
      self.createCamilladspfile()


        .then(function (e) {
          self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
          defer.resolve({});
        })
        .fail(function (e) {
          defer.reject(new Error('Camilladsp failed to start. Check your config !'));
          self.commandRouter.pushToastMessage('error', 'camilladsp failed to start. Check your config !');
        })

    }, 100);//2500

    self.config.set('leftfilter', leftfilter);
    self.config.set('lc1delay', data['lc1delay']);
    self.config.set('attenuationl', attenuationl);
    self.config.set('rightfilter', rightfilter);
    self.config.set('attenuationr', attenuationr);
    self.config.set('rc1delay', data['rc1delay']);
    self.config.set('enableclipdetect', data['enableclipdetect']);
    self.config.set('smpl_rate', data['smpl_rate'].value);
    self.refreshUI();


    let enableclipdetect = self.config.get('enableclipdetect');

    let val = self.dfiltertype(obj);
    let valfound = val.valfound
    // if ((enableclipdetect) && (valfound) && ((rightfilter != 'None') || (leftfilter != 'None'))) {
    if (enableclipdetect && ((rightfilter != 'None') || (leftfilter != 'None'))) {

      setTimeout(function () {
        var responseData = {
          title: self.commandRouter.getI18nString('CLIPPING_DETECT_TITLE'),
          message: self.commandRouter.getI18nString('CLIPPING_DETECT_MESS'),
          size: 'lg',
          buttons: [
            {
              name: self.commandRouter.getI18nString('CLIPPING_DETECT_EXIT'),
              class: 'btn btn-cancel',
              emit: 'closeModals',
              payload: ''
            },
            {
              name: self.commandRouter.getI18nString('CLIPPING_DETECT_TEST'),
              class: 'btn btn-info',
              emit: 'callMethod',
              payload: { 'endpoint': 'audio_interface/Dsp4Volumio', 'method': 'testclipping', 'data': '' },
              //     emit: 'closeModals'

            }
          ]
        }
        self.commandRouter.broadcastMessage("openModal", responseData);
      }, 500);

    };
    setTimeout(function () {

      self.areSampleswitch();
    }, 1500);

  };


  return defer.promise;
};

//------------VoBAf here we switch roomEQ filters depending on volume level and send cmd to brutefir using its CLI-----
Dsp4Volumio.prototype.sendvolumelevel = function () {
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

Dsp4Volumio.prototype.areSwapFilters = function () {
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

//-----------here we define how to swap filters----------------------

Dsp4Volumio.prototype.areSampleswitch = function () {
  const self = this;
  let leftFilter1 = self.config.get('leftfilter');
  let rightFilter1 = self.config.get('rightfilter');

  // check if filter naming is ok with 44100 in name
  const isFilterSwappable = (filterName, swapWord) => {
    let threeLastChar = filterName.slice(-9, -4);
    if (threeLastChar == swapWord) {
      return true
    }
    else {
      return false
    }
  };
  let leftResult = isFilterSwappable(leftFilter1, '44100');
  let rightResult = isFilterSwappable(rightFilter1, '44100');

  console.log(leftResult + ' + ' + rightResult);

  // check if secoond filter with 96000 in name
  const isFileExist = (filterName, swapWord) => {
    let fileExt = filterName.slice(-4);
    let filterNameShort = filterName.slice(0, -9);
    let filterNameForSwapc = filterNameShort + swapWord + fileExt;
    let filterNameForSwap = filterNameShort + "$samplerate$" + fileExt;

    if (fs.exists(filterfolder + filterNameForSwap)) {
      return [true, filterNameForSwap]
    } else {
      return false
    }
  };
  let leftResultExist = isFileExist(leftFilter1, '96000');
  let toSaveLeftResult = leftResultExist[1];
  let rightResultExist = isFileExist(rightFilter1, '96000');
  let toSaveRightResult = rightResultExist[1];

  // if conditions are true, switching possible
  if (leftResult & rightResult & leftResultExist[0] & rightResultExist[0]) {
    console.log('sample switch possible !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    self.config.set('leftfilter', toSaveLeftResult);
    self.config.set('rightfilter', toSaveRightResult);
    self.config.set('autoswitchsamplerate', true);
  } else {
    self.config.set('autoswitchsamplerate', false);


  };
  /*
  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Dsp4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    }, 500);
  */
  //});
};

//-------------here we define action if filters swappable when the button is pressed-----
Dsp4Volumio.prototype.SwapFilters = function () {
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

  //  self.sendCommandToBrutefir(brutefircmd);

  var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Dsp4Volumio', {});
  respconfig.then(function (config) {
    self.commandRouter.broadcastMessage('pushUiConfig', config);
  });
};
//-----------here we save VoBAf parameters
Dsp4Volumio.prototype.saveVoBAF = function (data) {
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

//--------------Tools Section----------------

//here we download and install tools
Dsp4Volumio.prototype.installtools = function (data) {
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
Dsp4Volumio.prototype.removetools = function (data) {
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

Dsp4Volumio.prototype.playToolsFile = function (data) {
  const self = this;
  self.config.set('toolsfiletoplay', data['toolsfiletoplay'].value);
  let toolsfile = self.config.get("toolsfiletoplay");
  let track = "INTERNAL/Dsp/tools/" + toolsfile;
  self.commandRouter.replaceAndPlay({ uri: track });
  self.commandRouter.volumioClearQueue();
};
//-----------DRC-FIR section----------------

//here we save value for converted file
Dsp4Volumio.prototype.fileconvert = function (data) {
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
Dsp4Volumio.prototype.convert = function (data) {
  const self = this;
  //let defer = libQ.defer();
  let drcconfig = self.config.get('drcconfig');
  let infile = self.config.get('filetoconvert');
  let sr;
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
          curve = '44.1'
          sr = '44100';
        } else if (outsample == 48000) {
          ftargetcurve = '48.0\\ kHz/';
          curve = '48.0';
          sr = '48000';
        } else if (outsample == 88200) {
          ftargetcurve = '88.2\\ kHz/';
          curve = '88.2';
          sr = '88200';
        } else if (outsample == 96000) {
          ftargetcurve = '96.0\\ kHz/';
          curve = '96.0';
          sr = '96000';
        };

        let destfile = (filterfolder + outfile + "-" + drcconfig + "-" + tcsimplified + "-" + sr + ".pcm");
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





