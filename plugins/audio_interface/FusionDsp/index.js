/*--------------------
FusionDsp plugin for volumio3. By balbuze August 2021
Multi Dsp features
Based on CamillaDsp
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
const Journalctl = require('journalctl');
const path = require('path');
const WebSocket = require('ws')


//---global Eq Variables
const tnbreq = 50// Nbre total of Eq
const filterfolder = "/data/INTERNAL/FusionDsp/filters/";
const filtersource = "/data/INTERNAL/FusionDsp/filter-sources/";
const tccurvepath = "/data/INTERNAL/FusionDsp/target-curves/";
const toolspath = "INTERNAL/FusionDsp/tools/";
const wavfolder = "/data/INTERNAL/FusionDsp/wavfiles/";
const eq15range = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000]
const coefQ = 1.85//Q for graphic EQ


// Define the Parameq class
module.exports = FusionDsp;

function FusionDsp(context) {
  const self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;
  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
};

FusionDsp.prototype.onVolumioStart = function () {
  const self = this;
  let configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  this.config = new (require('v-conf'))();
  this.config.loadFile(configFile);
  return libQ.resolve();
};

FusionDsp.prototype.onStart = function () {
  const self = this;
  let defer = libQ.defer();
  self.commandRouter.loadI18nStrings();
  self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'updateALSAConfigFile');
  self.hwinfo();

  /*-----------Experimental CamillaGui

  try {
    exec("/usr/bin/python3 /data/plugins/audio_interface/fusiondsp/cgui/main.py", {
      uid: 1000,
      gid: 1000
    });
    self.commandRouter.pushConsoleMessage('CamillaGui loaded');
    defer.resolve();
  } catch (err) {
    self.logger.info('failed to load Camilla Gui' + err);
  }
*/

  // if mixer set to none, do not show loudness settings
  //this.commandRouter.sharedVars.registerCallback('alsa.mixertype',  this.refreshUI.bind(this));

  var mixt = this.getAdditionalConf('audio_interface', 'alsa_controller', 'mixer_type');

  self.logger.info('mixtype--------------------- ' + mixt)
  if (mixt == 'None') {
    self.config.set('loudness', false)
    self.config.set('showloudness', false)

  } else {
    self.config.set('showloudness', true)
  }
  //

  setTimeout(function () {
    self.createCamilladspfile()
    if (self.config.get('loudness')) {
      self.sendvolumelevel()
    }
  }, 2000);
  defer.resolve();
  return defer.promise;
};

FusionDsp.prototype.onStop = function () {
  const self = this;
  let defer = libQ.defer();
  socket.off()
  self.logger.info("Stopping camilladsp service");
  defer.resolve();
  return defer.promise;
};

FusionDsp.prototype.onRestart = function () {
  const self = this;
};

FusionDsp.prototype.onInstall = function () {
  const self = this;
};

FusionDsp.prototype.onUninstall = function () {
  const self = this;
};

FusionDsp.prototype.getI18nFile = function (langCode) {
  const i18nFiles = fs.readdirSync(path.join(__dirname, 'i18n'));
  const langFile = 'strings_' + langCode + '.json';

  // check for i18n file fitting the system language
  if (i18nFiles.some(function (i18nFile) { return i18nFile === langFile; })) {
    return path.join(__dirname, 'i18n', langFile);
  }
  // return default i18n file
  return path.join(__dirname, 'i18n', 'strings_en.json');
}


//------------------Hw detection--------------------

//here we detect hw info
FusionDsp.prototype.hwinfo = function () {
  const self = this;
  let defer = libQ.defer();

  let output_device = this.getAdditionalConf('audio_interface', 'alsa_controller', 'outputdevice');
  let nchannels;
  let formats;
  let hwinfo;
  let samplerates;
  try {
    execSync('/data/plugins/audio_interface/fusiondsp/hw_params hw:' + output_device + ' >/data/configuration/audio_interface/fusiondsp/hwinfo.json ', {
      uid: 1000,
      gid: 1000
    });
    hwinfo = fs.readFileSync('/data/configuration/audio_interface/fusiondsp/hwinfo.json');
    try {
      const hwinfoJSON = JSON.parse(hwinfo);
      //  nchannels = hwinfoJSON.channels.value;
      // formats = hwinfoJSON.formats.value.replace(' SPECIAL', '').replace(', ,', '').replace(',,', '');
      samplerates = hwinfoJSON.samplerates.value;
      //  self.logger.info('AAAAAAAAAAAAAAAAAAAA-> ' + nchannels + ' <-AAAAAAAAAAAAA');
      //   self.logger.info('AAAAAAAAAAAAAAAAAAAA-> ' + formats + ' <-AAAAAAAAAAAAA');
      self.logger.info('AAAAAAAAAAAAAA-> ' + samplerates + ' <-AAAAAAAAAAAAA');
      // self.config.set('nchannels', nchannels);
      // self.config.set('formats', formats);
      self.config.set('probesmplerate', samplerates);
      //    let output_format = formats.split(" ").pop();
      /*
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
            */
    } catch (err) {
      self.logger.info('Error reading hwinfo.json, detection failed :', err);
    }

    defer.resolve();
  } catch (err) {
    self.logger.info('----Hw detection failed :' + err);
    defer.reject(err);
  }
};

// Configuration methods------------------------------------------------------------------------

FusionDsp.prototype.getUIConfig = function () {
  const self = this;
  let defer = libQ.defer();

  let lang_code = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
    __dirname + '/i18n/strings_en.json',
    __dirname + '/UIConfig.json')

    .then(function (uiconf) {
      var value
      let ncontent = self.config.get('nbreq')
      var effect = self.config.get('effect')

      value = self.config.get('eqpresetsaved');

      //--------section 0-------------------

      let selectedsp = self.config.get('selectedsp');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', selectedsp);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[0].options'), selectedsp));

      //-------------section 1----------
      if (selectedsp == 'nothing') {
        //just to debug....


      } else if (selectedsp == 'PEQ') {
        //----------------PEQ section----------------------

        uiconf.sections[1].content[0].hidden = true;
        uiconf.sections[1].content[1].hidden = true;
        uiconf.sections[1].content[2].hidden = true;
        uiconf.sections[1].content[3].hidden = true;
        uiconf.sections[1].content[4].hidden = true;
        uiconf.sections[7].hidden = true;


        let n = 1
        let eqval = self.config.get('mergedeq')
        let subtypex = eqval.toString().split('|')


        for (n; n <= ncontent; n++) {


          let typeinui = subtypex[((n - 1) * 4) + 1]
          let peqlabel
          // if (typeinui == undefined) {
          // typeinui = 'None'
          switch (typeinui) {
            case ("undefined"):
              peqlabel = "None"
              typeinui = 'None'
              break;
            case ("None"):
              peqlabel = "None"
              break;
            case ("Peaking"):
              peqlabel = "Peaking Hz,dB,Q"
              break;
            case ("Peaking2"):
              peqlabel = "Peaking Hz,dB,Range"
              break;
            case ("Lowshelf"):
              peqlabel = "Lowshelf Hz,dB,slope dB/Octave"
              break;
            case ("Lowshelf2"):
              peqlabel = "Lowshelf Hz,dB,Q"
              break;
            case ("Highshelf"):
              peqlabel = "Highshelf Hz,dB,slope dB/Octave"
              break;
            case ("Highshelf2"):
              peqlabel = "Highshelf Hz,dB,Q"
              break;
            case ("Highpass"):
              peqlabel = "Highpass Hz,Q"
              break;
            case ("Highpass2"):
              peqlabel = "Highpass Hz,bandwidth Octave"
              break;
            case ("Lowpass"):
              peqlabel = "Lowpass Hz,Q"
              break;
            case ("Lowpass2"):
              peqlabel = "Lowpass Hz,bandwidth Octave"
              break;
            case ("Highpass"):
              peqlabel = "Highpass Hz,bandwidth Octave"
              break;
            case ("LowpassFO"):
              peqlabel = "LowpassFO Hz"
              break;
            case ("HighpassFO"):
              peqlabel = "HighpassFO Hz"
              break;
            case ("Notch"):
              peqlabel = "Notch Hz,Q"
              break;
            case ("Notch2"):
              peqlabel = "Notch Hz,bandwidth Octave"
              break;
            default: "None"
          }
          //}


          let scopeinui = subtypex[((n - 1) * 4) + 2]
          if (scopeinui == undefined) {
            scopeinui = 'L+R'
          }

          let eqinui = subtypex[((n - 1) * 4) + 3]
          if (eqinui == undefined) {
            eqinui = '0,0,0'
          }

          let options = [{ "value": "None", "label": "None" },
          { "value": "Peaking", "label": "Peaking Hz,dB,Q" },
          { "value": "Peaking2", "label": "Peaking Hz,dB,Range" },
          { "value": "Lowshelf", "label": "Lowshelf Hz,dB,slope dB/Octave" },
          { "value": "Lowshelf2", "label": "Lowshelf Hz,dB,Q" },
          { "value": "Highshelf", "label": "Highshelf Hz,dB,slope dB/Octave" },
          { "value": "Highshelf2", "label": "Highshelf Hz,dB,Q" },
          { "value": "Notch", "label": "Notch Hz,Q" },
          { "value": "Notch2", "label": "Notch Hz,bandwidth Octave" },
          { "value": "Highpass", "label": "Highpass Hz,Q" },
          { "value": "Highpass2", "label": "Highpass Hz,bandwidth Octave" },
          { "value": "Lowpass", "label": "Lowpass Hz,Q" },
          { "value": "Lowpass2", "label": "Lowpass Hz,bandwidth Octave" },
          { "value": "HighpassFO", "label": "HighpassFO Hz" },
          { "value": "LowpassFO", "label": "LowpassFO Hz" },
          { "value": "Remove", "label": "Remove" }]

          uiconf.sections[1].content.push(

            {
              "id": "type" + n,
              "element": "select",
              "label": "Type Eq" + n,
              "doc": self.commandRouter.getI18nString("TYPEEQ_DOC"),
              "value": { "value": typeinui, "label": peqlabel },
              "options": options,
              "visibleIf": {
                "field": "showeq",
                "value": true
              }
            }
          )

          uiconf.sections[1].content.push(
            {
              "id": "scope" + n,
              "element": "select",
              "doc": self.commandRouter.getI18nString('EQSCOPE_DOC'),
              "label": self.commandRouter.getI18nString('EQSCOPE') + n,
              "value": { "value": scopeinui, "label": scopeinui },
              "options": [{ "value": "L+R", "label": "L+R" }, { "value": "L", "label": "L" }, { "value": "R", "label": "R" }],
              "visibleIf": {
                "field": "showeq",
                "value": true
              }
            },
            {
              "id": "eq" + n,
              "element": "input",
              "doc": self.commandRouter.getI18nString("EQ_DOC"),
              "label": "Eq " + n,
              "value": eqinui,
              "visibleIf": {
                "field": "showeq",
                "value": true
              }
            }
          );


          var eqn = 'eq' + n;
          uiconf.sections[1].saveButton.data.push(eqn);
          uiconf.sections[1].saveButton.data.push('type' + n);
          uiconf.sections[1].saveButton.data.push('scope' + n);
          // uiconf.sections[1].removeeq.button.data.push(eqn);
        }


        if (ncontent <= tnbreq) {
          uiconf.sections[1].content.push(
            {
              "id": "addeq",
              "element": "button",
              "label": self.commandRouter.getI18nString('ADD_EQ'),
              "doc": self.commandRouter.getI18nString('ADD_EQ_DESC'),
              "onClick": {
                "type": "plugin",
                "endpoint": "audio_interface/fusiondsp",
                "method": "addeq",
                "data": []
              },
              "visibleIf": {
                "field": "showeq",
                "value": true
              }
            }
          )
        }
        if (ncontent > 1) {
          uiconf.sections[1].content.push(
            {
              "id": "removeeq",
              "element": "button",
              "label": self.commandRouter.getI18nString("REMOVE_EQ"),
              "doc": self.commandRouter.getI18nString('REMOVE_EQ_DESC'),
              "onClick": {
                "type": "plugin",
                "endpoint": "audio_interface/fusiondsp",
                "method": "removeeq",
                "data": []
              },
              "visibleIf": {
                "field": "showeq",
                "value": true
              }
            }
          )
        }



        //------end of PEQ section----------
      } else if ((selectedsp == 'EQ15') || (selectedsp == '2XEQ15')) {
        //------------EQ 15 section---------

        uiconf.sections[1].content[0].hidden = true;
        uiconf.sections[1].content[1].hidden = true;
        uiconf.sections[1].content[2].hidden = true;
        uiconf.sections[1].content[3].hidden = true;
        uiconf.sections[1].content[4].hidden = true;

        uiconf.sections[4].hidden = true;
        uiconf.sections[5].hidden = true;
        uiconf.sections[7].hidden = true;

        let listeq
        let eqtext
        if (selectedsp == 'EQ15') {
          listeq = ['geq15']
          eqtext = self.commandRouter.getI18nString('LANDRCHAN')
          //   self.logger.info('listeq ' + self.config.get('geq15'))

          // i = 1
        } if (selectedsp == '2XEQ15') {
          listeq = ['geq15', 'x2geq15']
          eqtext = (self.commandRouter.getI18nString('LEFTCHAN') + ',' + self.commandRouter.getI18nString('RIGHTCHAN'))
          //i = 2
          //     self.logger.info('listeq ' + self.config.get('x2geq15') + self.config.get('geq15'))


        }

        for (var i in listeq) {
          let neq = eqtext.split(',')[i]
          //self.logger.info('listeq ' + i)

          let geq15 = self.config.get(listeq[i])
          uiconf.sections[1].content.push(
            {
              "id": listeq[i],
              "element": "equalizer",
              "label": neq,
              "description": "",
              "doc": "Create your own equalizer",
              "visibleIf": {
                "field": "showeq",
                "value": true
              },
              "config": {
                "orientation": "vertical",
                "bars": [
                  {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[0],
                    "ticksLabels": [
                      eq15range[0]
                    ],
                    "tooltip": "show"
                  },
                  {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[1],
                    "ticksLabels": [
                      eq15range[1]
                    ],
                    "tooltip": "show"
                  }, {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[2],
                    "ticksLabels": [
                      eq15range[2]
                    ],
                    "tooltip": "show"
                  }, {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[3],
                    "ticksLabels": [
                      eq15range[3]
                    ],
                    "tooltip": "show"
                  }, {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[4],
                    "ticksLabels": [
                      eq15range[4]
                    ],
                    "tooltip": "show"
                  }, {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[5],
                    "ticksLabels": [
                      eq15range[5]
                    ],
                    "tooltip": "show"
                  },
                  {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[6],
                    "ticksLabels": [
                      eq15range[6]
                    ],
                    "tooltip": "show"
                  },
                  {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[7],
                    "ticksLabels": [
                      eq15range[7]
                    ],
                    "tooltip": "show"
                  },
                  {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[8],
                    "ticksLabels": [
                      eq15range[8]
                    ],
                    "tooltip": "show"
                  },
                  {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[9],
                    "ticksLabels": [
                      eq15range[9]
                    ],
                    "tooltip": "show"
                  },
                  {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[10],
                    "ticksLabels": [
                      eq15range[10]
                    ],
                    "tooltip": "show"
                  },
                  {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[11],
                    "ticksLabels": [
                      eq15range[11]
                    ],
                    "tooltip": "show"
                  },
                  {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[12],
                    "ticksLabels": [
                      eq15range[12]
                    ],
                    "tooltip": "show"
                  },
                  {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[13],
                    "ticksLabels": [
                      eq15range[13]
                    ],
                    "tooltip": "show"
                  },
                  {
                    "min": -10,
                    "max": 10,
                    "step": "0.5",
                    "value": geq15.split(',')[14],
                    "ticksLabels": [
                      eq15range[14]
                    ],
                    "tooltip": "show"
                  }
                ]
              }
            }
          )
          uiconf.sections[1].saveButton.data.push(listeq[i]);
        }

        //----End EQ15-------------
        //----------------------convfir section-------------------

      } else if (selectedsp == 'convfir') {
        self.logger.info('---------convfir selected-------------')
        uiconf.sections[2].hidden = true;
        uiconf.sections[3].hidden = true;
        uiconf.sections[4].hidden = true;
        uiconf.sections[5].hidden = true;
        var value
        var valuestored
        let valuestoredl
        let valuestoredr

        valuestoredl = self.config.get('leftfilter');
        var valuestoredllabel = valuestoredl.replace("$samplerate$", "variable samplerate")
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[0].value.value', valuestoredl);
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[0].value.label', valuestoredllabel);

        value = self.config.get('attenuationl');
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[1].value.value', value);
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[1].value.label', value);

        valuestoredr = self.config.get('rightfilter');
        var valuestoredrlabel = valuestoredr.replace("$samplerate$", "variable samplerate")
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[2].value.value', valuestoredr);
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[2].value.label', valuestoredrlabel);
        value = self.config.get('attenuationr');
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[3].value.value', value);
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[3].value.label', value);


        for (let n = 0; n < 22; n = n + 0.5) {
          self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[1].options', {
            value: (n),
            label: (n)
          });
          self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[3].options', {
            value: (n),
            label: (n)
          });
          //  self.logger.info('value attenuation value ' + n)

        }
        try {

          fs.readdir(filterfolder, function (err, item) {
            let allfilter = 'None,' + item;
            let litems = allfilter.split(',');
            for (let a in litems) {

              //  self.logger.info('litems ' + litems[a])

              self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[0].options', {
                value: litems[a],
                label: litems[a]
              });
              self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[2].options', {
                value: litems[a],
                label: litems[a]
              });
            }
          });
        } catch (e) {
          self.logger.error('CAN not read file: ' + e)
        }
        uiconf.sections[1].content[4].value = self.config.get('enableclipdetect');

        uiconf.sections[1].saveButton.data.push('leftfilter');
        uiconf.sections[1].saveButton.data.push('attenuationl');
        uiconf.sections[1].saveButton.data.push('rightfilter');
        uiconf.sections[1].saveButton.data.push('attenuationr');
        uiconf.sections[1].saveButton.data.push('enableclipdetect');
      }

      //----------------end of convfir section------------
      //---------------more settings---------------------
      var moresettings = self.config.get('moresettings')
      if (moresettings == false) {
        uiconf.sections[1].content.push(
          {
            "id": "moresettings",
            "element": "button",
            "label": self.commandRouter.getI18nString('MORE_SETTINGS'),
            "doc": self.commandRouter.getI18nString('MORE_SETTINGS_DOC'),
            "onClick": {
              "type": "plugin",
              "endpoint": "audio_interface/fusiondsp",
              "method": "moresettings",
              "data": [],

            },
            "visibleIf": {
              "field": "showeq",
              "value": true
            }
          }
        )
        // uiconf.sections[nsections].content[(+ncontent * 3)].hidden = false;
      } else if (moresettings) {
        uiconf.sections[1].content.push(
          {
            "id": "lesssettings",
            "element": "button",
            "label": self.commandRouter.getI18nString('LESS_SETTINGS'),
            "doc": self.commandRouter.getI18nString('LESS_SETTINGS_DOC'),
            "onClick": {
              "type": "plugin",
              "endpoint": "audio_interface/fusiondsp",
              "method": "lesssettings",
              "data": []
            },
            "visibleIf": {
              "field": "showeq",
              "value": true
            }
          }
        )
      }

      if (moresettings) {

        //-----------------crossfeed -------------
        var crossconfig = self.config.get('crossfeed')
        switch (crossconfig) {
          case ("None"):
            var crosslabel = 'None'
            break;
          case ("bauer"):
            var crosslabel = "Bauer 700Hz/4.5dB"
            break;
          case ("chumoy"):
            var crosslabel = "Chu Moy 700Hz/6dB"
            break;
          case ("jameier"):
            var crosslabel = "Jan Meier 650Hz/9.5dB"
            break;
          case ("linkwitz"):
            var crosslabel = "Linkwitz 700Hz/2dB"
            break;
          default: "None"
        }


        uiconf.sections[1].content.push(
          {
            "id": "crossfeed",
            "element": "select",
            "doc": self.commandRouter.getI18nString('CROSSFEED_DOC'),
            "label": self.commandRouter.getI18nString('CROSSFEED'),
            "value": { "value": self.config.get('crossfeed'), "label": crosslabel },
            "options": [{ "value": "None", "label": "None" }, { "value": "bauer", "label": "Bauer 700Hz/4.5dB" }, { "value": "chumoy", "label": "Chu Moy 700Hz/6dB" }, { "value": "jameier", "label": "Jan Meier 650Hz/9.5dB" }, { "value": "linkwitz", "label": "Linkwitz 700Hz/2dB" }],
            "visibleIf": {
              "field": "showeq",
              "value": true
            }
          },
          {
            "id": "monooutput",
            "element": "switch",
            "doc": self.commandRouter.getI18nString('MONOOUTPUT_DOC'),
            "label": self.commandRouter.getI18nString('MONOOUTPUT'),
            "value": self.config.get('monooutput'),
            "visibleIf": {
              "field": "showeq",
              "value": true
            }
          }
        )
        if (self.config.get('showloudness')) {
          uiconf.sections[1].content.push(

            {
              "id": "loudness",
              "element": "switch",
              "doc": self.commandRouter.getI18nString('LOUDNESS_DOC'),
              "label": self.commandRouter.getI18nString('LOUDNESS'),
              "value": self.config.get('loudness'),
              "visibleIf": {
                "field": "showeq",
                "value": true
              }
            },
            {
              "id": "loudnessthreshold",
              "element": "equalizer",
              "label": self.commandRouter.getI18nString("LOUDNESS_THRESHOLD"),
              "doc": self.commandRouter.getI18nString('LOUDNESS_THRESHOLD_DOC'),
              "visibleIf": {
                "field": "showeq",
                "value": true
              },
              "config": {
                "orientation": "horizontal",
                "bars": [
                  {
                    "min": "10",
                    "max": "100",
                    "step": "1",
                    "value": self.config.get('loudnessthreshold'),
                    "ticksLabels": [
                      "%"
                    ],
                    "tooltip": "always"
                  }
                ]
              }
            }
          )
        }
      }
      //------------experimental
      /*
     var devicename = self.commandRouter.sharedVars.get('system.name');
 
      {
        "id": "camillagui",
        "element": "button",
        "label": "CamillaGui (experimental)",
        "doc": "CamillaGui",
        "onClick": {
          "type": "openUrl",
          "url": "http://" + devicename + ".local:5011"
        },
        "visibleIf": {
          "field": "showeq",
          "value": true
        },
      } 
      */
      //-----------------

      // }
      self.logger.info('effect ' + effect)

      if (effect == true) {
        uiconf.sections[1].content.push(
          {
            "id": "disableeffect",
            "element": "button",
            "label": self.commandRouter.getI18nString('DISABLE_EFFECT'),
            "doc": self.commandRouter.getI18nString('DISABLE_EFFECT_DESC'),
            "onClick": {
              "type": "plugin",
              "endpoint": "audio_interface/fusiondsp",
              "method": "disableeffect",
              "data": []
            }
          }
        )
        // uiconf.sections[nsections].content[(+ncontent * 3)].hidden = false;
      } else if (effect == false) {
        uiconf.sections[1].content.push(
          {
            "id": "enableeffect",
            "element": "button",
            "label": self.commandRouter.getI18nString('ENABLE_EFFECT'),
            "doc": self.commandRouter.getI18nString('ENABLE_EFFECT_DESC'),
            "onClick": {
              "type": "plugin",
              "endpoint": "audio_interface/fusiondsp",
              "method": "enableeffect",
              "data": []
            }
          }
        )
      }
      if (moresettings) {

        uiconf.sections[1].content.push(
          {
            "id": "leftlevel",
            "element": "equalizer",
            "label": self.commandRouter.getI18nString("LEFTLEVEL"),
            "doc": self.commandRouter.getI18nString('LEFTLEVEL_DESC'),
            "visibleIf": {
              "field": "showeq",
              "value": true
            },
            "config": {
              "orientation": "horizontal",
              "bars": [
                {
                  "min": "-20",
                  "max": "0",
                  "step": "0.1",
                  "value": self.config.get('leftlevel'),
                  "ticksLabels": [
                    "dB"
                  ],
                  "tooltip": "always"
                }
              ]
            }
          },
          {
            "id": "rightlevel",
            "element": "equalizer",
            "label": self.commandRouter.getI18nString('RIGHTLEVEL'),
            "doc": self.commandRouter.getI18nString("RIGHTLEVEL_DESC"),
            "visibleIf": {
              "field": "showeq",
              "value": true
            },
            "config": {
              "orientation": "horizontal",
              "bars": [
                {
                  "min": "-20",
                  "max": "0",
                  "step": "0.1",
                  "value": self.config.get('rightlevel'),
                  "ticksLabels": [
                    "dB"
                  ],
                  "tooltip": "always"
                }
              ]
            }
          }

        )
      }

      uiconf.sections[1].content.push(
        {
          "id": "showeq",
          "element": "switch",
          "doc": self.commandRouter.getI18nString('SHOW_SETTINGS_DOC'),
          "label": self.commandRouter.getI18nString('SHOW_SETTINGS'),
          "value": self.config.get('showeq')
        }
      )

      // if (moresettings) {
      uiconf.sections[1].saveButton.data.push('leftlevel');
      uiconf.sections[1].saveButton.data.push('rightlevel');
      //}
      uiconf.sections[1].saveButton.data.push('crossfeed');
      uiconf.sections[1].saveButton.data.push('monooutput');
      if (self.config.get('showloudness')) {
        uiconf.sections[1].saveButton.data.push('loudness');
        uiconf.sections[1].saveButton.data.push('loudnessthreshold');
      }
      // }
      uiconf.sections[1].saveButton.data.push('showeq');

      // uiconf.sections[1].saveButton.data.push('moresettings');

      self.logger.info(' Dsp mode set is ' + selectedsp)


      //--------section 2-------------------

      value = self.config.get('usethispreset');
      switch (value) {
        case ("mypreset1"):
          plabel = self.config.get('renpreset1')
          break;
        case ("mypreset2"):
          plabel = self.config.get('renpreset2')
          break;
        case ("mypreset3"):
          plabel = self.config.get('renpreset3')
          break;
        case ("flat"):
          plabel = 'flat'
          break;
        case ("rock"):
          plabel = 'rock'
          break;
        case ("voice"):
          plabel = 'voice'
          break;
        case ("classic"):
          plabel = 'classic'
          break;
        case ("bass"):
          plabel = 'bass'
          break;
        case ("soundtrack"):
          plabel = 'soundtrack'
          break;
        default: plabel = self.commandRouter.getI18nString('NO_PRESET_USED')
      }

      //  self.configManager.setUIConfigParam(uiconf, 'sections[3].content[0].value.value', value);
      //self.configManager.setUIConfigParam(uiconf, 'sections[3].content[0].value.label', plabel);
      self.configManager.setUIConfigParam(uiconf, 'sections[2].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[2].content[0].value.label', plabel);

      let presetlist
      if (selectedsp == 'PEQ') {
        presetlist = ('mypreset1,mypreset2,mypreset3')
      } else if ((selectedsp == 'EQ15') || (selectedsp == '2XEQ15')) {
        presetlist = ('mypreset1,mypreset2,mypreset3,flat,rock,voice,classic,bass,soundtrack')
      } else {
        //     self.logger.info('No preset for FIR')
        presetlist = ('mypreset1,mypreset2,mypreset3')

      }


      let pitems = presetlist.split(',')
      for (let x in pitems) {

        switch (pitems[x]) {
          case ("mypreset1"):
            var plabel = self.config.get('renpreset1')
            break;
          case ("mypreset2"):
            var plabel = self.config.get('renpreset2')
            break;
          case ("mypreset3"):
            var plabel = self.config.get('renpreset3')
            break;
          case ("flat"):
            var plabel = 'flat'
            break;
          case ("rock"):
            var plabel = 'rock'
            break;
          case ("voice"):
            var plabel = 'voice'
            break;
          case ("classic"):
            var plabel = 'classic'
            break;
          case ("bass"):
            var plabel = 'bass'
            break;
          case ("soundtrack"):
            var plabel = 'soundtrack'
            break;
          default: plabel = self.commandRouter.getI18nString('NO_PRESET_USED')
        }
        //   self.logger.info('preset label' + plabel)
        self.configManager.pushUIConfigParam(uiconf, 'sections[2].content[0].options', {
          value: pitems[x],
          label: plabel
        });
      }


      //-------------section 3-----------
      let savepresetlist = ('mypreset1,mypreset2,mypreset3').split(',')

      for (let y in savepresetlist) {
        switch (savepresetlist[y]) {
          case ("mypreset1"):
            var plabel = self.config.get('renpreset1')
            break;
          case ("mypreset2"):
            var plabel = self.config.get('renpreset2')
            break;
          case ("mypreset3"):
            var plabel = self.config.get('renpreset3')
            break;
          default: plabel = self.commandRouter.getI18nString('NO_PRESET_USED')
        }
        self.configManager.pushUIConfigParam(uiconf, 'sections[3].content[0].options', {
          value: savepresetlist[y],
          label: plabel
        });
      }

      uiconf.sections[3].content[2].value = self.config.get('renpreset');


      //-----------section 4---------
      value = self.config.get('importeq');
      var label = self.commandRouter.getI18nString('CHOOSE_HEADPHONE')
      self.configManager.setUIConfigParam(uiconf, 'sections[4].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[4].content[0].value.label', label);


      try {
        let listf = fs.readFileSync('/data/plugins/audio_interface/fusiondsp/downloadedlist.txt', "utf8");
        var result = (listf.split('\n'));
        let i;

        for (i = 16; i < result.length; i++) {
          var preparedresult = result[i].replace(/- \[/g, "").replace("](.", ",").slice(0, -1);

          var param = preparedresult.split(',')
          var namel = (param[0])
          var linkl = param[1]

          self.configManager.pushUIConfigParam(uiconf, 'sections[4].content[0].options', {
            value: linkl,
            label: +i - 15 + "  " + namel
          });
        }


      } catch (err) {
        self.logger.info('failed to read downloadedlist.txt' + err);
      }

      //----------section 5------------
      value = self.config.get('importlocal');
      var label = self.commandRouter.getI18nString('CHOOSE_LOCALEQ')

      self.configManager.setUIConfigParam(uiconf, 'sections[5].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[5].content[0].value.label', label);


      var localEQfolder = '/data/INTERNAL/FusionDsp/peq'
      try {
        fs.readdir(localEQfolder, function (err, item) {

          let allfilter = '' + item;
          let items = allfilter.split(',');
          // items.pop();
          for (let i in items) {

            self.configManager.pushUIConfigParam(uiconf, 'sections[5].content[0].options', {
              value: items[i],
              label: items[i]
            });
          }

        });
      } catch (err) {
        self.logger.info('failed to read local file' + err);
      }

      value = self.config.get('localscope');
      self.configManager.setUIConfigParam(uiconf, 'sections[5].content[1].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[5].content[1].value.label', value);

      let sitemsl = ('L,R,L+R').split(',');
      for (let i in sitemsl) {
        self.configManager.pushUIConfigParam(uiconf, 'sections[5].content[1].options', {
          value: sitemsl[i],
          label: sitemsl[i]
        });
      }

      var addreplace = self.config.get('addreplace')
      uiconf.sections[5].content[2].value = addreplace;

      //-------------End section 5--------------


      //-------------Section 6--------------
      uiconf.sections[6].content[0].value = self.config.get('enableresampling');
      value = self.config.get('resamplingset');
      self.configManager.setUIConfigParam(uiconf, 'sections[6].content[1].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[6].content[1].value.label', value);

      let sampleratelist = self.config.get('probesmplerate')
      let samplerate = sampleratelist.split(' ')
      for (let n in samplerate) {
        self.configManager.pushUIConfigParam(uiconf, 'sections[6].content[1].options', {
          value: samplerate[n],
          label: samplerate[n]
        })
      }
      value = self.config.get('resamplingq');
      self.configManager.setUIConfigParam(uiconf, 'sections[6].content[2].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[6].content[2].value.label', value);

      let resamplingqlist = ('+,++,+++')
      let resamplingq = resamplingqlist.split(',')
      for (let n in samplerate) {
        self.configManager.pushUIConfigParam(uiconf, 'sections[6].content[2].options', {
          value: resamplingq[n],
          label: resamplingq[n]
        })
      }
      //-------------End section 6----------

      //--------------section 7-------------


      var filetoconvertl = self.config.get('filetoconvert');
      self.configManager.setUIConfigParam(uiconf, 'sections[7].content[0].value.value', filetoconvertl);
      self.configManager.setUIConfigParam(uiconf, 'sections[7].content[0].value.label', filetoconvertl);
      try {
        fs.readdir(filtersource, function (err, fitem) {
          let fitems;
          let filetoconvert = '' + fitem;
          fitems = filetoconvert.split(',');
          // console.log(fitems)
          for (let i in fitems) {
            self.configManager.pushUIConfigParam(uiconf, 'sections[7].content[0].options', {
              value: fitems[i],
              label: fitems[i]
            });
            //  self.logger.info('available impulses to convert :' + fitems[i]);
          }
        });
      } catch (e) {
        self.logger.error('Could not read file: ' + e)
      }

      var value = self.config.get('drc_sample_rate');
      self.configManager.setUIConfigParam(uiconf, 'sections[7].content[1].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[7].content[1].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[7].content[1].options'), value));


      var tc = self.config.get('tc');
      self.configManager.setUIConfigParam(uiconf, 'sections[7].content[2].value.value', tc);
      self.configManager.setUIConfigParam(uiconf, 'sections[7].content[2].value.label', tc);
      try {
        fs.readdir(tccurvepath, function (err, bitem) {
          let bitems;
          let filetoconvert = '' + bitem;
          bitems = filetoconvert.split(',');
          //console.log(bitems)
          for (let i in bitems) {
            self.configManager.pushUIConfigParam(uiconf, 'sections[7].content[2].options', {
              value: bitems[i],
              label: bitems[i]
            });
            //   self.logger.info('available target curve :' + bitems[i]);

          }
        });
      } catch (e) {
        self.logger.error('Could not read file: ' + e)
      }

      var value = self.config.get('drcconfig');
      self.configManager.setUIConfigParam(uiconf, 'sections[7].content[3].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[7].content[3].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[7].content[3].options'), value));
      uiconf.sections[7].content[4].value = self.config.get('outputfilename');
      //-------------end section 7----------

      //-------------section 8------------
      let ttools = self.config.get('toolsinstalled');

      let toolsfiletoplay = self.config.get('toolsfiletoplay');
      self.configManager.setUIConfigParam(uiconf, 'sections[8].content[0].value.value', toolsfiletoplay);
      self.configManager.setUIConfigParam(uiconf, 'sections[8].content[0].value.label', toolsfiletoplay);

      try {
        fs.readdir('/data/' + toolspath, function (err, bitem) {
          let filetools = '' + bitem;

          let bitems = filetools.split(',');

          //console.log(bitems)
          for (let i in bitems) {
            self.configManager.pushUIConfigParam(uiconf, 'sections[8].content[0].options', {
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
        uiconf.sections[8].content[0].hidden = true;

        uiconf.sections[8].content[1].hidden = true;
        uiconf.sections[8].content[2].hidden = false;

      } else {
        uiconf.sections[8].content[1].hidden = false;
        uiconf.sections[8].content[2].hidden = true;

      }
      //--------------end section 8----------
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    })
  return defer.promise;
};

FusionDsp.prototype.refreshUI = function () {
  const self = this;

  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'fusiondsp', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
    self.commandRouter.closeModals();
  }, 100);
}

FusionDsp.prototype.choosedsp = function (data) {
  const self = this;
  let selectedsp = (data['selectedsp'].value)
  if (selectedsp === 'EQ15') {
    self.config.set('nbreq', 15)
    self.config.set('mergedeq', self.config.get('savedmergedgeq15'))
    self.config.set('geq15', self.config.get('savedgeq15'))
  } else if (selectedsp === '2XEQ15') {
    self.config.set('nbreq', 30)
    self.config.set('geq15', self.config.get('savedx2geq15l'))
    self.config.set('mergedeq', self.config.get('savedmergedeqx2geq15'))
    self.config.set('x2geq15', self.config.get('savedx2geq15r'))
  } else if (selectedsp === 'PEQ') {
    self.config.set('nbreq', self.config.get('savednbreq'))
    self.config.set('mergedeq', self.config.get('savedmergedeq'))
  } else if (selectedsp === 'convfir') {
    self.config.set('nbreq', 2),
      self.config.set('mergedeq', self.config.get('savedmergedeqfir'))

  }

  self.config.set('effect', true)

  self.config.set('selectedsp', selectedsp)

  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);

  self.refreshUI();
};


FusionDsp.prototype.addeq = function (data) {
  const self = this;
  var n = self.config.get('nbreq')
  n = n + 1;
  if (n > tnbreq) {
    self.logger.info('Max eq reached!')
    return
  }
  self.config.set('nbreq', n)
  self.config.set('effect', true)
  self.logger.info('nbre eq ' + n)

  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  self.refreshUI();
};

FusionDsp.prototype.removeeq = function () {
  const self = this;
  var n = self.config.get('nbreq')
  n = n - 1;
  if (n < 1) {
    self.logger.info('Min eq reached!')
    return
  }
  self.config.set('effect', true)
  self.config.set('nbreq', n)

  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  self.refreshUI();
};


FusionDsp.prototype.moresettings = function () {
  const self = this;
  self.config.set('moresettings', true)
  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  self.refreshUI();

};

FusionDsp.prototype.lesssettings = function () {
  const self = this;
  self.config.set('moresettings', false)
  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  self.refreshUI();

};

FusionDsp.prototype.enableeffect = function () {
  const self = this;
  self.config.set('effect', true)
  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  self.refreshUI();

};

FusionDsp.prototype.disableeffect = function () {
  const self = this;
  self.config.set('effect', false)
  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  self.refreshUI();

};

FusionDsp.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

FusionDsp.prototype.setUIConfig = function (data) {
  const self = this;
};

FusionDsp.prototype.getConf = function (varName) {
  const self = this;
  //Perform your installation tasks here
};

FusionDsp.prototype.setConf = function (varName, varValue) {
  const self = this;
  //Perform your installation tasks here
};

FusionDsp.prototype.getLabelForSelect = function (options, key) {
  let n = options.length;
  for (let i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

FusionDsp.prototype.getAdditionalConf = function (type, controller, data) {
  const self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
}
// Plugin methods -----------------------------------------------------------------------------

//------------Here we define a function to send a command to CamillaDsp through websocket---------------------
FusionDsp.prototype.sendCommandToCamilla = function () {
  const self = this;
  const url = 'ws://localhost:9876'
  const ccmd = ('\"Reload\"');
  const connection = new WebSocket(url)

  connection.onopen = () => {
    connection.send(ccmd)
    //  self.logger.info('---------------- CamillaDsp reloaded')
  }

  connection.onerror = (error) => {
    console.log(`WebSocket error: ${error}`)
  }

  connection.onmessage = (e) => {
    console.log(e.data)
    // self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('CONFIG_UPDATED'));
  }
};

//------------Fir features----------------

//-----------here we define how to swap filters----------------------

FusionDsp.prototype.areSampleswitch = function () {
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
  self.refreshUI()
  /*
  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Dsp4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    }, 500);
  */
  //});
};


//------------Here we detect if clipping occurs while playing and gives a suggestion of setting...------
FusionDsp.prototype.testclipping = function () {
  const self = this;
  let defer = libQ.defer();

  //socket.emit('mute', '');
  self.commandRouter.closeModals();
  let messageDisplayed;
  socket.emit('stop');
  let arrreduced;
  let filelength = self.config.get('filter_size');
  setTimeout(function () {
    self.config.set('loudness', false);
    self.config.set('monooutput', false);
    self.config.set('crossfeed', 'None');
    self.config.set('attenuationl', 0);
    self.config.set('attenuationr', 0);
    self.config.set('testclipping', true)
    self.createCamilladspfile();
  }, 300);

  setTimeout(function () {

    let track = '/data/plugins/audio_interface/fusiondsp/testclipping/testclipping.wav';
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
      let filteredMessage = event.MESSAGE.split(',').slice(0, -1).pop().replace("peak ", "").slice(0, -1);
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
    let offset = 2;
    let arrreducedr = ((arr.toString().split(',')).pop());
    arrreduced = +arrreducedr + offset;
  });
  setTimeout(function () {
    self.logger.info('arrreduced  ' + arrreduced);
    self.config.set('attenuationl', arrreduced);
    self.config.set('attenuationr', arrreduced);
    self.config.set('testclipping', false)
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('FILTER_LENGTH') + filelength, self.commandRouter.getI18nString('AUTO_ATTENUATION_SET') + arrreduced + ' dB');
    self.commandRouter.pushToastMessage('info', 'Attenuation set to: ' + arrreduced + ' dB');
    //  self.saveparameq();
    // self.createCamilladspfile();
    let ltest, rtest, cleftfilter, crightfilter, test

    cleftfilter = filterfolder + self.config.get('leftfilter')
    crightfilter = filterfolder + self.config.get('rightfilter')

    ltest = ('Eq1' + '|' + 'Conv' + '|L' + cleftfilter + '|' + arrreduced + '|');
    rtest = ('Eq2' + '|' + 'Conv' + '|R' + crightfilter + '|' + arrreduced + '|');
    test = ltest + rtest
    self.logger.info('test ' + test)
    self.config.set('mergedeq', test);
    self.config.set('savedmergedeqfir', test)

    self.refreshUI();
    self.createCamilladspfile();

    journalctl.stop();
  }, 2810);
  return defer.promise;

};

//here we determine filter type and apply skip value if needed
FusionDsp.prototype.dfiltertype = function (data) {
  const self = this;
  let skipvalue = '';
  let filtername = self.config.get('leftfilterlabel');
  var auto_filter_format;
  let filext = self.config.get('leftfilterlabel').split('.').pop().toString();
  var wavetype;
  let filelength;

  if (filext == 'pcm') {
    try {
      filelength = (execSync('/usr/bin/stat -c%s ' + filterfolder + filtername, 'utf8').slice(0, -1) / 4);
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
  else if (filext == 'raw') {
    try {
      filelength = (execSync('/usr/bin/stat -c%s ' + filterfolder + filtername).slice(0, -1) / 4);
    } catch (err) {
      self.logger.info('An error occurs while reading file');
    }
    self.config.set('filter_size', filelength);
    auto_filter_format = 'FLOAT32LE';
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

    // return;

    /* try {
       execSync('/usr/bin/python /data/plugins/audio_interface/fusiondsp/test.py ' + filterfolder + filtername + ' >/tmp/test.result');
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
     */
  } else {
    let modalData = {
      title: self.commandRouter.getI18nString('FILTER_FORMAT_TITLE'),
      message: self.commandRouter.getI18nString('FILTER_FORMAT_MESS'),
      size: 'lg',
      buttons: [{
        name: 'CloseModals',
        class: 'btn btn-warning'
      },]
    };
    self.commandRouter.broadcastMessage("openModal", modalData);
  }

  filelength = self.config.get('filter_size');

  self.config.set('filter_format', auto_filter_format);
  self.logger.info('--------->filter format ' + filext + ' ' + auto_filter_format);
  self.logger.info('--------->filter size ' + filelength);
  // self.logger.info('--------->Skip value for wav :' + skipvalue);


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

//------------Here we build CmaillaDsp config file----------------------------------------------

FusionDsp.prototype.createCamilladspfile = function (obj) {
  const self = this;
  let defer = libQ.defer();

  try {
    fs.readFile(__dirname + "/camilladsp.conf.yml", 'utf8', function (err, data) {
      if (err) {
        defer.reject(new Error(err));
        return console.log(err);
      }
      var pipeliner, pipelines, pipelinelr, pipelinerr = '';
      var eqo, eqc, eqv, eqa
      var typec, typer;
      var result = '';
      var gainmaxused = [];
      let scopec, scoper;
      var nbreq = (self.config.get('nbreq'))
      var effect = self.config.get('effect')
      var leftlevel = self.config.get('leftlevel')
      var rightlevel = self.config.get('rightlevel')
      //----fIr VARIABLES----
      var filter1 = self.config.get('leftfilter');
      var filter2 = self.config.get('rightfilter');
      var attenuation = self.config.get('attenuationl');
      var testclipping = self.config.get('testclipping')
      // var smpl_rate = self.config.get('smpl_rate')
      var filter_format = self.config.get('filter_format')
      let val = self.dfiltertype(obj);
      let skipval = val.skipvalue
      var channels = 2;
      var filterr;
      let convatt
      var gainresult, gainclipfree
      let eqval = self.config.get('mergedeq')
      let subtypex = eqval.toString().split('|')
      let resulttype = ''
      let crossatt, crossfreq
      let loudnessGain = self.config.get('loudnessGain')

      let enableresampling = self.config.get('enableresampling')
      let resamplingq = self.config.get('resamplingq')
      let resamplingset = self.config.get('resamplingset')

      //----compose output----
      if (testclipping) {
        var composeout = ''
        composeout += '  playback:' + '\n';
        composeout += '    type: File' + '\n';
        composeout += '    channels: 2' + '\n';
        composeout += '    filename: "/dev/null"' + '\n';
        composeout += '    format: S24LE3' + '\n';

      } else if (testclipping == false) {
        var composeout = ''
        composeout += '  playback:' + '\n';
        composeout += '    type: Alsa' + '\n';
        composeout += '    channels: 2' + '\n';
        composeout += '    device: "fromDsp1"' + '\n';
        composeout += '    format: S24LE3' + '\n';
      }
      //------resampling section-----
      var composeddevice = '';
      let capturesamplerate = 44100
      if (enableresampling) {
        let type
        switch (resamplingq) {
          case ("+"):
            type = 'FastAsync'
            break;
          case ("++"):
            type = 'BalancedAsync'
            break;
          case ("+++"):
            type = 'AccurateAsync'
            break;
          default: "++"
        }
        capturesamplerate = resamplingset;
        composeddevice += '  enable_resampling: true\n';
        composeddevice += '  resampler_type: ' + type + '\n';
        composeddevice += '  capture_samplerate: ' + resamplingset;
      } else if (enableresampling == false) {
        composeddevice = '\n';
      }


      //------crossfeed section------

      var crossconfig = self.config.get('crossfeed')
      if ((crossconfig != 'None'))/* && (effect))*/ {
        var composedeq = '';

        self.logger.info('crossfeed  ' + (self.config.get('crossfeed')))
        switch (crossconfig) {
          case ("bauer"):
            crossfreq = 700
            crossatt = 4.5
            break;
          case ("chumoy"):
            crossfreq = 700
            crossatt = 6
            break;
          case ("jameier"):
            crossfreq = 650
            crossatt = 9.5
            break;
          case ("linkwitz"):
            crossfreq = 700
            crossatt = 2
            break;
          case ("None"):
            crossatt = 0
            //   composedeq += ''
            break;
          default: "None"

        }

        composedeq += '  highcross:\n'
        composedeq += '    type: Biquad\n'
        composedeq += '    parameters:\n'
        composedeq += '      type: Highshelf\n'
        composedeq += '      freq: ' + crossfreq + '\n'
        composedeq += '      slope: 6\n'
        composedeq += '      gain: ' + crossatt + '\n'
        composedeq += '\n'
        composedeq += '  lpcross:\n'
        composedeq += '    type: Biquad\n'
        composedeq += '    parameters:\n'
        composedeq += '      type: LowpassFO\n'
        composedeq += '      freq: ' + crossfreq + '\n'
        composedeq += '\n'
        composedeq += '  delay:\n'
        composedeq += '    type: Delay\n'
        composedeq += '    parameters:\n'
        composedeq += '      delay: 0.5\n'
        composedeq += '      unit: ms\n'
        composedeq += '      subsample: false\n'
        composedeq += '      \n'
        result += composedeq


      } else {
        crossatt = 0
        composedeq += ''
      }

      //------end crossfeed section
      //------volume loudness section---

      let loudness = self.config.get('loudness')
      if (loudness) {
        self.logger.info('Loudness is ON ' + loudness)
        var composedeq = '';
        var pipelineL = '';
        var pipelineR = '';
        composedeq += '  highshelf:\n'
        composedeq += '    type: Biquad\n'
        composedeq += '    parameters:\n'
        composedeq += '      type: Highshelf\n'
        composedeq += '      freq: 3600\n'
        composedeq += '      slope: 12\n'
        composedeq += '      gain: ' + (loudnessGain * 0.65).toFixed(2) + '\n'
        composedeq += '\n'
        // composedeq += '  lowshelf:\n'
        // composedeq += '    type: Biquad\n'
        // composedeq += '    parameters:\n'
        // composedeq += '      type: Lowshelf\n'
        // composedeq += '      freq: 70\n'
        // composedeq += '      slope: 12\n'
        // composedeq += '      gain: ' + loudnessGain + '\n'
        // composedeq += '\n'
        composedeq += '  lowshelf:\n';
        composedeq += '    type: Biquad' + '\n';
        composedeq += '    parameters:' + '\n';
        composedeq += '      type: LowshelfFO\n';
        composedeq += '      freq: 65\n';
        composedeq += '      gain: ' + loudnessGain + '\n';
        composedeq += '' + '\n';
        composedeq += '  peakloudness:\n';
        composedeq += '    type: Biquad' + '\n';
        composedeq += '    parameters:' + '\n';
        composedeq += '      type: Peaking\n';
        composedeq += '      freq: 1000\n';
        composedeq += '      q: 0.9\n';
        composedeq += '      gain: ' + (loudnessGain * 0.18).toFixed(2) + '\n';
        composedeq += '' + '\n';
        composedeq += '  peakloudness2:\n';
        composedeq += '    type: Biquad' + '\n';
        composedeq += '    parameters:' + '\n';
        composedeq += '      type: Peaking\n';
        composedeq += '      freq: 13000\n';
        composedeq += '      q: 0.7\n';
        composedeq += '      gain: ' + (loudnessGain * 0.08).toFixed(2) + '\n';
        composedeq += '' + '\n';
        result += composedeq
        //-----loudness pipeline

        // gainmaxused += loudnessGain
      }
      else {
        loudnessGain = 0
      }

      for (let o = 1; o < (nbreq + 1); o++) {

        typec = subtypex[((o - 1) * 4) + 1];
        resulttype += typec
      }
      if (resulttype.indexOf('None') == -1) {
        //self.logger.info('resultype dif from None ' + resulttype)
      } else {
        self.logger.info('Resultype only None ' + resulttype)
        var composedeq = '';
        composedeq += '  nulleq:' + '\n';
        composedeq += '    type: Conv' + '\n';
        pipeliner = '      - nulleq';
        result += composedeq
        pipelinelr = pipeliner.slice(8)
        pipelinerr = pipeliner.slice(8)

        self.logger.info('Nulleq applied')

        gainresult = 0
        gainclipfree = 0
      }


      if (effect == false) {
        var composedeq = '';
        composedeq += '  nulleq:' + '\n';
        composedeq += '    type: Conv' + '\n';
        /* pipeliner = '      - nulleq';
         result += composedeq
         pipelinelr = pipeliner.slice(8)
         pipelinerr = pipeliner.slice(8)
 */
        self.logger.info('Effects disabled, Nulleq applied')
        gainresult = 0
        gainclipfree = self.config.get('gainapplied')

      } else {

        for (let o = 1; o < (nbreq + 1); o++) {
          eqo = ("eq" + o + "c");
          eqa = subtypex[((o - 1) * 4) + 3]//("eq" + o);
          typec = subtypex[((o - 1) * 4) + 1];
          scoper = subtypex[((o - 1) * 4) + 2]//("scope" + o);
          convatt = subtypex[((o - 1) * 4) + 3]//("scope" + o);

          var composedeq = '';
          var gainmax;
          var pipelineL = '';
          var pipelineR = '';

          typer = typec//self.config.get(typec);
          if (eqa == undefined) {
            self.logger.info('Error in eqv! Cannot split values!')
            return;
          }
          eqv = eqa.split(',');
          var coef;
          var eqc = 'eq' + o;

          if ((typer == 'Highshelf' || typer == 'Lowshelf')) {

            composedeq += '  ' + eqc + ':\n';
            composedeq += '    type: Biquad' + '\n';
            composedeq += '    parameters:' + '\n';
            composedeq += '      type: ' + typer + '\n';
            composedeq += '      freq: ' + eqv[0] + '\n';
            composedeq += '      slope: ' + eqv[2] + '\n';
            composedeq += '      gain: ' + eqv[1] + '\n';
            composedeq += '' + '\n';
            gainmax = ',' + eqv[1];
            if (scoper == 'L') {
              pipelineL = '      - ' + eqc + '\n';

            } else if (scoper == 'R') {
              pipelineR = '      - ' + eqc + '\n';

            } else if (scoper == 'L+R') {
              pipelineL = '      - ' + eqc + '\n';
              pipelineR = '      - ' + eqc + '\n';
            }
          }
          if ((typer == 'Highshelf2' || typer == 'Lowshelf2')) {

            composedeq += '  ' + eqc + ':\n';
            composedeq += '    type: Biquad' + '\n';
            composedeq += '    parameters:' + '\n';
            composedeq += '      type: ' + typer.slice(0, -1) + '\n';
            composedeq += '      freq: ' + eqv[0] + '\n';
            composedeq += '      q: ' + eqv[2] + '\n';
            composedeq += '      gain: ' + eqv[1] + '\n';
            composedeq += '' + '\n';
            gainmax = ',' + eqv[1];
            if (scoper == 'L') {
              pipelineL = '      - ' + eqc + '\n';

            } else if (scoper == 'R') {
              pipelineR = '      - ' + eqc + '\n';

            } else if (scoper == 'L+R') {
              pipelineL = '      - ' + eqc + '\n';
              pipelineR = '      - ' + eqc + '\n';
            }
          } else if (typer == 'Peaking') {

            composedeq += '  ' + eqc + ':\n';
            composedeq += '    type: Biquad' + '\n';
            composedeq += '    parameters:' + '\n';
            composedeq += '      type: ' + typer + '\n';
            composedeq += '      freq: ' + eqv[0] + '\n';
            composedeq += '      q: ' + eqv[2] + '\n';
            composedeq += '      gain: ' + eqv[1] + '\n';
            composedeq += '' + '\n';
            gainmax = ',' + eqv[1];
            if (scoper == 'L') {
              pipelineL = '      - ' + eqc + '\n';

            } else if (scoper == 'R') {
              pipelineR = '      - ' + eqc + '\n';

            } else if (scoper == 'L+R') {
              pipelineL = '      - ' + eqc + '\n';
              pipelineR = '      - ' + eqc + '\n';
            }

          } else if (typer == 'Peaking2') {

            composedeq += '  ' + eqc + ':\n';
            composedeq += '    type: Biquad' + '\n';
            composedeq += '    parameters:' + '\n';
            composedeq += '      type: ' + typer.slice(0, -1) + '\n';
            composedeq += '      freq: ' + eqv[0] + '\n';
            composedeq += '      bandwidth: ' + eqv[2] + '\n';
            composedeq += '      gain: ' + eqv[1] + '\n';
            composedeq += '' + '\n';
            gainmax = ',' + eqv[1];
            if (scoper == 'L') {
              pipelineL = '      - ' + eqc + '\n';

            } else if (scoper == 'R') {
              pipelineR = '      - ' + eqc + '\n';

            } else if (scoper == 'L+R') {
              pipelineL = '      - ' + eqc + '\n';
              pipelineR = '      - ' + eqc + '\n';
            }

          } else if (typer == 'Conv') {
            filterr = eval('filter' + o)

            var composedeq = '';
            composedeq += '  conv' + [o] + ':\n';
            composedeq += '    type: Conv' + '\n';
            composedeq += '    parameters:' + '\n';
            composedeq += '      type: File' + '\n';
            composedeq += '      filename: ' + filterfolder + filterr + '\n';
            composedeq += '      format: ' + filter_format + '\n';
            composedeq += '      ' + skipval + '\n';
            composedeq += '' + '\n';
            gainmax = ',' + convatt

            if (testclipping) {
              gainmax = ',0'
            }

            if (o == 1) {
              pipelineL = '      - conv1\n'
            }
            if (o == 2) {
              pipelineR = '      - conv2\n'
            }

            //result += composedeq

          } else if ((typer == 'Lowpass' || typer == 'Highpass' || typer == 'Notch')) {

            composedeq += '  ' + eqc + ':\n';
            composedeq += '    type: Biquad' + '\n';
            composedeq += '    parameters:' + '\n';
            composedeq += '      type: ' + typer + '\n';
            composedeq += '      freq: ' + eqv[0] + '\n';
            composedeq += '      q: ' + eqv[1] + '\n';
            composedeq += '' + '\n';
            gainmax = ',' + 0
            if (scoper == 'L') {
              pipelineL = '      - ' + eqc + '\n';

            } else if (scoper == 'R') {
              pipelineR = '      - ' + eqc + '\n';

            } else if (scoper == 'L+R') {
              pipelineL = '      - ' + eqc + '\n';
              pipelineR = '      - ' + eqc + '\n';

            }

          } else if ((typer == 'Lowpass2' || typer == 'Highpass2' || typer == 'Notch2')) {

            composedeq += '  ' + eqc + ':\n';
            composedeq += '    type: Biquad' + '\n';
            composedeq += '    parameters:' + '\n';
            composedeq += '      type: ' + typer.slice(0, -1) + '\n';
            composedeq += '      freq: ' + eqv[0] + '\n';
            composedeq += '      bandwidth: ' + eqv[1] + '\n';
            composedeq += '' + '\n';
            gainmax = ',' + 0
            if (scoper == 'L') {
              pipelineL = '      - ' + eqc + '\n';

            } else if (scoper == 'R') {
              pipelineR = '      - ' + eqc + '\n';

            } else if (scoper == 'L+R') {
              pipelineL = '      - ' + eqc + '\n';
              pipelineR = '      - ' + eqc + '\n';

            }
          } else if ((typer == 'LowpassFO' || typer == 'HighpassFO')) {

            composedeq += '  ' + eqc + ':\n';
            composedeq += '    type: Biquad' + '\n';
            composedeq += '    parameters:' + '\n';
            composedeq += '      type: ' + typer + '\n';
            composedeq += '      freq: ' + eqv[0] + '\n';
            composedeq += '' + '\n';
            gainmax = ',' + 0
            if (scoper == 'L') {
              pipelineL = '      - ' + eqc + '\n';

            } else if (scoper == 'R') {
              pipelineR = '      - ' + eqc + '\n';

            } else if (scoper == 'L+R') {
              pipelineL = '      - ' + eqc + '\n';
              pipelineR = '      - ' + eqc + '\n';

            }

          } else if (typer == 'None') {

            composedeq = ''
            pipelineL = ''
            pipelineR = ''
            gainmax = ',' + 0

          }


          var outlpipeline, outrpipeline;
          result += composedeq
          outlpipeline += pipelineL
          outrpipeline += pipelineR
          pipelinelr = outlpipeline.slice(17)
          pipelinerr = outrpipeline.slice(17)
          if (loudness == false) {

            if (pipelinelr == '') {
              pipelinelr = 'nulleq2'
            }

            if (pipelinerr == '') {
              pipelinerr = 'nulleq2'
            }
          }
          gainmaxused += gainmax
          if (self.config.get('loudness') && effect) {
            pipelinelr += '      - highshelf\n';
            pipelinelr += '      - peakloudness\n';
            pipelinelr += '      - peakloudness2\n';
            pipelinelr += '      - lowshelf\n';
            pipelinerr += '      - highshelf\n';
            pipelinerr += '      - peakloudness\n';
            pipelinerr += '      - peakloudness2\n';
            pipelinerr += '      - lowshelf\n';
            //    self.logger.info('loudness pipeline set')
          }


        };


      };

      gainmaxused += ',0,' + loudnessGain

      //-----gain calculation
      self.logger.info('gainmaxused' + gainmaxused)
      self.logger.info('crossatt ' + crossatt)
      self.logger.info('pipelinerr ' + pipelinerr)



      //if ((pipelinelr != 'nulleq2' || pipelinerr != 'nulleq2') || ((pipelinelr != '      - nulleq' && pipelinerr != '      - nulleq'))) {
      if (effect) {
        gainresult = (gainmaxused.toString().split(',').slice(1).sort((a, b) => a - b)).pop();
        self.logger.info('gainresult ' + gainresult + ' ' + typeof (+gainresult))

        //   self.config.set('gainapplied', gainclipfree)

        if (+gainresult < 0) {
          gainclipfree = -2
          self.logger.info('else 1  ' + gainclipfree)
        } else {

          gainclipfree = ('-' + (parseInt(gainresult) + 2))
        }
        if (gainclipfree === undefined) {
          gainclipfree = 0
        }
        self.config.set('gainapplied', gainclipfree)

        //else
      }
      // self.logger.info('gainclipfree' +gainclipfree)
      gainclipfree = self.config.get('gainapplied')
      let monooutput = self.config.get('monooutput')
      let leftgain = (+gainclipfree + +leftlevel - +crossatt)
      let rightgain = (+gainclipfree + +rightlevel - +crossatt);
      let leftgainmono = (+gainclipfree + +leftlevel - 6)
      let rightgainmono = (+gainclipfree + +rightlevel - 6);
      self.logger.info(result)
      // self.logger.info('gain applied ' + leftgain)

      ///----mixers and pipelines generation
      var composedmixer = ''
      var composedpipeline = ''

      if ((crossconfig == 'None') && (effect)) {
        if (monooutput) {
          composedmixer += 'mixers:\n'
          composedmixer += '  mono:\n'
          composedmixer += '    channels:\n'
          composedmixer += '      in: 2\n'
          composedmixer += '      out: 2\n'
          composedmixer += '    mapping:\n'
          composedmixer += '      - dest: 0\n'
          composedmixer += '        sources:\n'
          composedmixer += '          - channel: 0\n'
          composedmixer += '            gain: ' + +leftgainmono + '\n'
          composedmixer += '            inverted: false\n'
          composedmixer += '          - channel: 1\n'
          composedmixer += '            gain: ' + +leftgainmono + '\n'
          composedmixer += '            inverted: false\n'
          composedmixer += '      - dest: 1\n'
          composedmixer += '        sources:\n'
          composedmixer += '          - channel: 0\n'
          composedmixer += '            gain: ' + +rightgainmono + '\n'
          composedmixer += '            inverted: false\n'
          composedmixer += '          - channel: 1\n'
          composedmixer += '            gain: ' + +rightgainmono + '\n'
          composedmixer += '            inverted: false\n'
          composedmixer += '\n'

          composedpipeline += '\n'
          composedpipeline += 'pipeline:\n'
          composedpipeline += '  - type: Mixer\n'
          composedpipeline += '    name: mono\n'
          composedpipeline += '  - type: Filter\n'
          composedpipeline += '    channel: 0\n'
          composedpipeline += '    names:\n'
          composedpipeline += '      - ' + pipelinelr + '\n'
          composedpipeline += '  - type: Filter\n'
          composedpipeline += '    channel: 1\n'
          composedpipeline += '    names:\n'
          composedpipeline += '      - ' + pipelinerr + '\n'
          composedpipeline += '\n'
        } else {
          composedmixer += 'mixers:\n'
          composedmixer += '  stereo:\n'
          composedmixer += '    channels:\n'
          composedmixer += '      in: 2\n'
          composedmixer += '      out: 2\n'
          composedmixer += '    mapping:\n'
          composedmixer += '      - dest: 0\n'
          composedmixer += '        sources:\n'
          composedmixer += '          - channel: 0\n'
          composedmixer += '            gain: ' + leftgain + '\n'
          composedmixer += '            inverted: false\n'
          composedmixer += '      - dest: 1\n'
          composedmixer += '        sources:\n'
          composedmixer += '          - channel: 1\n'
          composedmixer += '            gain: ' + rightgain + '\n'
          composedmixer += '            inverted: false\n'
          composedmixer += '\n'

          composedpipeline += '\n'
          composedpipeline += 'pipeline:\n'
          composedpipeline += '  - type: Mixer\n'
          composedpipeline += '    name: stereo\n'
          composedpipeline += '  - type: Filter\n'
          composedpipeline += '    channel: 0\n'
          composedpipeline += '    names:\n'
          composedpipeline += '      - ' + pipelinelr + '\n'
          composedpipeline += '  - type: Filter\n'
          composedpipeline += '    channel: 1\n'
          composedpipeline += '    names:\n'
          composedpipeline += '      - ' + pipelinerr + '\n'
          composedpipeline += '\n'
        }
      } else if ((crossconfig != 'None') && (effect)) {
        // -- if a crossfeed is used
        composedmixer += 'mixers:\n'
        composedmixer += '  2to4:\n'
        composedmixer += '    channels:\n'
        composedmixer += '      in: 2\n'
        composedmixer += '      out: 4\n'
        composedmixer += '    mapping:\n'
        composedmixer += '      - dest: 0\n'
        composedmixer += '        sources:\n'
        composedmixer += '          - channel: 0\n'
        composedmixer += '            gain: ' + leftgain + '\n'
        composedmixer += '            inverted: false\n'
        composedmixer += '      - dest: 1\n'
        composedmixer += '        sources:\n'
        composedmixer += '          - channel: 0\n'
        composedmixer += '            gain: ' + leftgain + '\n'
        composedmixer += '            inverted: false\n'
        composedmixer += '      - dest: 2\n'
        composedmixer += '        sources:\n'
        composedmixer += '          - channel: 1\n'
        composedmixer += '            gain: ' + rightgain + '\n'
        composedmixer += '            inverted: false\n'
        composedmixer += '      - dest: 3\n'
        composedmixer += '        sources:\n'
        composedmixer += '          - channel: 1\n'
        composedmixer += '            gain: ' + rightgain + '\n'
        composedmixer += '            inverted: false\n'
        composedmixer += '  stereo:\n'
        composedmixer += '    channels:\n'
        composedmixer += '      in: 4\n'
        composedmixer += '      out: 2\n'
        composedmixer += '    mapping:\n'
        composedmixer += '      - dest: 0\n'
        composedmixer += '        sources:\n'
        composedmixer += '          - channel: 0\n'
        composedmixer += '            gain: 0\n'
        composedmixer += '            inverted: false\n'
        composedmixer += '          - channel: 2\n'
        composedmixer += '            gain: 0\n'
        composedmixer += '            inverted: false\n'
        composedmixer += '      - dest: 1\n'
        composedmixer += '        sources:\n'
        composedmixer += '          - channel: 1\n'
        composedmixer += '            gain: 0\n'
        composedmixer += '            inverted: false\n'
        composedmixer += '          - channel: 3\n'
        composedmixer += '            gain: 0\n'
        composedmixer += '            inverted: false\n'

        composedpipeline += '\n'
        composedpipeline += 'pipeline:\n'
        composedpipeline += '   - type: Mixer\n'
        composedpipeline += '     name: 2to4\n'
        composedpipeline += '   - type: Filter\n'
        composedpipeline += '     channel: 0\n'
        composedpipeline += '     names:\n'
        composedpipeline += '       - highcross\n'
        composedpipeline += '   - type: Filter\n'
        composedpipeline += '     channel: 1\n'
        composedpipeline += '     names:\n'
        composedpipeline += '       - lpcross\n'
        composedpipeline += '   - type: Filter\n'
        composedpipeline += '     channel: 1\n'
        composedpipeline += '     names:\n'
        composedpipeline += '       - delay\n'
        composedpipeline += '   - type: Filter\n'
        composedpipeline += '     channel: 2\n'
        composedpipeline += '     names:\n'
        composedpipeline += '       - lpcross\n'
        composedpipeline += '   - type: Filter\n'
        composedpipeline += '     channel: 2\n'
        composedpipeline += '     names:\n'
        composedpipeline += '       - delay\n'
        composedpipeline += '   - type: Filter\n'
        composedpipeline += '     channel: 3\n'
        composedpipeline += '     names:\n'
        composedpipeline += '       - highcross\n'
        composedpipeline += '   - type: Mixer\n'
        composedpipeline += '     name: stereo\n'
        composedpipeline += '   - type: Filter\n'
        composedpipeline += '     channel: 0\n'
        composedpipeline += '     names:\n'
        composedpipeline += '      - ' + pipelinelr + '\n'
        composedpipeline += '   - type: Filter\n'
        composedpipeline += '     channel: 1\n'
        composedpipeline += '     names:\n'
        composedpipeline += '      - ' + pipelinerr + '\n'


      } else if (effect == false) {

        self.logger.info('Effects disabled, Nulleq applied')
        gainresult = 0
        //   gainclipfree = self.config.get('gainapplied')

        composedmixer += 'mixers:\n'
        composedmixer += '  stereo:\n'
        composedmixer += '    channels:\n'
        composedmixer += '      in: 2\n'
        composedmixer += '      out: 2\n'
        composedmixer += '    mapping:\n'
        composedmixer += '      - dest: 0\n'
        composedmixer += '        sources:\n'
        composedmixer += '          - channel: 0\n'
        composedmixer += '            gain: ' + leftgain + '\n'
        composedmixer += '            inverted: false\n'
        composedmixer += '      - dest: 1\n'
        composedmixer += '        sources:\n'
        composedmixer += '          - channel: 1\n'
        composedmixer += '            gain: ' + rightgain + '\n'
        composedmixer += '            inverted: false\n'
        composedmixer += '\n'

        pipeliner = '      - nulleq2';
        pipelinelr = pipeliner.slice(8)
        pipelinerr = pipeliner.slice(8)

        composedpipeline += '\n'
        composedpipeline += 'pipeline:\n'
        composedpipeline += '  - type: Mixer\n'
        composedpipeline += '    name: stereo\n'
        composedpipeline += '  - type: Filter\n'
        composedpipeline += '    channel: 0\n'
        composedpipeline += '    names:\n'
        composedpipeline += '      - ' + pipelinelr + '\n'
        composedpipeline += '  - type: Filter\n'
        composedpipeline += '    channel: 1\n'
        composedpipeline += '    names:\n'
        composedpipeline += '      - ' + pipelinerr + '\n'
        composedpipeline += '\n'
      }


      //self.logger.info('gain applied left ' + leftgain + ' right ' + rightgain)

      let conf = data.replace("${resulteq}", result)
        .replace("${resampling}", (composeddevice))
        .replace("${capturesamplerate}", (capturesamplerate))

        .replace("${composeout}", (composeout))
        .replace("${mixers}", composedmixer)
        //.replace("${gain}", leftgain)
        //.replace("${gain}", rightgain)
        .replace("${composedpipeline}", composedpipeline.replace(/-       - /g, '- '))
        //  .replace("${pipelineR}", pipelinerr)
        ;
      fs.writeFile("/data/configuration/audio_interface/fusiondsp/camilladsp.yml", conf, 'utf8', function (err) {
        if (err)
          defer.reject(new Error(err));
        else defer.resolve();
      });
      self.sendCommandToCamilla()

    });

  } catch (err) {

  }

  return defer.promise;
};


//----------------------here we save eqs config.json
FusionDsp.prototype.saveparameq = function (data, obj) {
  const self = this;

  let defer = libQ.defer();
  let test = '';
  let selectedsp = self.config.get('selectedsp')
  if (selectedsp == 'PEQ') {
    var nbreq = self.config.get('nbreq')
    for (var o = 1; o < (nbreq + 1); o++) {
      var typec = 'type' + o;
      var scopec = 'scope' + o;
      var eqc = 'eq' + o;
      var typer = (data[typec].value)
      var eqr = (data[eqc]).split(',')
      var veq = Number(eqr[0]);

      if (typer !== 'None' && typer !== 'Remove') {
        self.logger.info('Type is ' + typer)

        if (Number.parseFloat(veq) && (veq > 0 && veq < 20001)) {
          self.logger.info('value ok ')

        } else {

          self.logger.info('wrong value in ' + eqc)
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('FREQUENCY_RANGE') + eqc)
          return;
        }
      }
      if (typer == 'Peaking' || typer == 'Highshelf2' || typer == 'Lowshelf2') {

        var q = Number(eqr[2]);
        if ((Number.parseFloat(q)) && (q > 0 && q < 25.1)) {

        } else {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('Q_RANGE') + eqc)
          return;
        }

      }

      if (typer == 'Peaking2') {

        var q = Number(eqr[2]);
        if ((Number.parseFloat(q)) && (q > 0 && q < 8)) {

        } else {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('BANDWIDTH_RANGE') + eqc)
          return;
        }

      }

      if (typer == 'Highpass' || typer == 'Lowpass' || typer == 'Notch') {

        var q = Number(eqr[1]);
        if ((Number.parseFloat(q)) && (q > 0 && q < 25.1)) {

        } else {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('Q_RANGE') + eqc)
          return;
        }

      }
      if (typer == 'Highpass2' || typer == 'Lowpass2' || typer == 'Notch2') {

        var q = Number(eqr[1]);
        if ((Number.parseFloat(q)) && (q > 0 && q < 25.1)) {

        } else {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('BANDWIDTH_RANGE') + eqc)
          return;
        }

      }
      if (typer == 'Peaking' || typer == 'Highshelf' || typer == 'Lowshelf') {

        var g = Number(eqr[1]);
        if ((Number.parseFloat(g)) && (g > -20.1 && g < 20.1)) {

        } else {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('GAIN_RANGE') + eqc)
          return;
        }

      }
      if (typer == 'Highshelf' || typer == 'Lowshelf') {

        var s = Number(eqr[2]);
        if ((Number.isInteger(s)) && (s > 0 && s < 13)) {

        } else {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('SLOPE_RANGE') + eqc)
          return;
        }
      }
      /*
            if (typer == 'Highshelf2' || typer == 'Lowshelf2') {
      
              var s = Number(eqr[2]);
              if ((Number.parseFloat(q)) && (q > 0 && q < 25.1)) {
      
          //    if ((Number.isInteger(s)) && (s > 0 && s < 13)) {
      
              } else {
                self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('Q_RANGE') + eqc)
      
                //self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('BANDWIDTH_SLOPE_RANGE') + eqc)
                self.commandRouter.pushToastMessage('error', 'pas bon ' + eqc)
      
                return;
              }
            }
      */
      if (typer == 'Highpass' || typer == 'Lowpass' || typer == 'Notch' || typer == 'Highpass2' || typer == 'Lowpass2' || typer == 'Notch2') {

        var q = eqr[2];
        self.logger.info('last value ' + q)
        if (q != undefined) {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('NO_THIRDCOEFF') + eqc)
          return;
        } else {
          //do nthing
        }
      }

      if (typer == 'HighpassFO' || typer == 'LowpassFO') {

        var q = eqr[1];
        self.logger.info('last value ' + q)
        if (q != undefined) {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('ONLY_FREQ') + eqc)
          return;
        } else {
          //do nthing
        }
      } else {
        self.logger.info('nothing todo');
      }
    }
    let skipeqn = 0;
    for (var xo = 1; xo < (nbreq + 1); xo++) {
      var o = xo
      var typec = 'type' + o;
      var scopec = 'scope' + o;
      var eqc = 'eq' + o;
      //--- skip PEQ if set to REMOVE
      if (((data[typec].value) != 'Remove')) {
        test += ('Eq' + o + '|' + data[typec].value + '|' + data[scopec].value + '|' + data[eqc] + '|');
        //  self.logger.info('test values ' + test)0,0,0
        self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('VALUE_SAVED_APPLIED'))
      } else if (((data[typec].value) == 'Remove') && (nbreq == 1)) {
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('CANT_REMOVE_LAST_PEQ'))
      } else if (((data[typec].value) == 'Remove') && (nbreq != 1)) {
        skipeqn = skipeqn + 1
        self.logger.info('skipeqn ' + skipeqn)

      }
    }
    self.config.set('nbreq', nbreq - skipeqn)
    self.config.set('savednbreq', nbreq - skipeqn)
    self.config.set('savedmergedeq', test)


  } else if (selectedsp == 'EQ15') {
    let geq15 = (data['geq15'])
    self.config.set('geq15', geq15);
    self.config.set('x2geq15', geq15);

    eqr = geq15
    self.logger.info('setting EQ15 values ' + eqr)
    for (let o in eqr) {
      let eqval = geq15[o]
      test += ('Eq' + o + '|Peaking|L+R|' + eq15range[o] + ',' + eqval + ',' + coefQ + '|');
    }
    self.config.set('savedmergedgeq15', test)
    self.config.set('savedgeq15', self.config.get('geq15'))

  } else if (selectedsp == '2XEQ15') {
    let geq15 = (data['geq15'])
    let x2geq15 = (data['x2geq15'])
    let ltest, rtest
    self.config.set('geq15', geq15);
    self.config.set('x2geq15', x2geq15);
    for (let o in geq15) {
      var eqval = geq15[o]
      ltest += ('Eq' + o + '|Peaking|L|' + eq15range[o] + ',' + eqval + ',' + coefQ + '|');
    }
    for (let v in x2geq15) {
      var eqval = x2geq15[v]
      rtest += ('Eq' + v + '|Peaking|R|' + eq15range[v] + ',' + eqval + ',' + coefQ + '|');
    }
    test = ltest + rtest
    self.config.set('savedmergedeqx2geq15', test)
    self.config.set('savedx2geq15l', self.config.get('geq15'))
    self.config.set('savedx2geq15r', self.config.get('x2geq15'))

  } else if (selectedsp == 'convfir') {
    let attenuationl = (data['attenuationl'].value);
    let attenuationr = (data['attenuationr'].value);
    let leftfilter = (data['leftfilter'].value);
    let rightfilter = (data['rightfilter'].value);
    //   self.logger.error('Sxxxxxxxxxxxxxxxxxxxxxxxxxxxx' + leftfilter);
    let filtername //= self.config.get('leftfilterlabel');
    let filext = (data['leftfilter'].value).split('.').pop().toString();

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

      if (filext == "wav") {
        let listf = ('leftfilter,rightfilter')
        let list = listf.split(',')
        for (i in list) {
          filtername = (data[list[i]].value)
          self.commandRouter.pushToastMessage('error', 'Wav file is going to be converted in raw to be use')
          //sox example.wav --bits 32 example.raw
          try {
            let cmdsox = ("/usr/bin/sox " + filterfolder + filtername + " --bits 32 " + filterfolder + filtername.slice(0, -3) + "raw");
            execSync(cmdsox);
            self.logger.info(cmdsox);
            self.commandRouter.pushToastMessage('success', 'Wav file converted in raw. Please select it now to use it')

          } catch (e) {
            self.logger.info('input file does not exist ' + e);
            self.commandRouter.pushToastMessage('error', 'Sox fails to convert file' + e);
          };
          self.config.set(list[i], filtername.slice(0, -3) + "raw");
          self.config.set('leftfilterlabel', filtername.slice(0, -3) + "raw");

          // self.config.set(list[i] + ',' + filtername.slice(0, -3) + "raw")
          self.logger.info('filter saved ' + list[i] + ',' + filtername.slice(0, -3) + "raw")
          // self.refreshUI();
        }
      } else {
        self.config.set('leftfilterlabel', leftfilter);
        self.config.set('leftfilter', leftfilter);
        self.config.set('rightfilter', rightfilter);
      }
      self.dfiltertype(data);

      let val = self.dfiltertype(obj);
      let valfound = val.valfound
      let enableclipdetect = data['enableclipdetect'];
      self.config.set('attenuationl', attenuationl);
      self.config.set('attenuationr', attenuationr);
      self.config.set('enableclipdetect', enableclipdetect);
      // if ((enableclipdetect) && (valfound) && ((rightfilter != 'None') || (leftfilter != 'None'))) {
      if (enableclipdetect && ((rightfilter != 'None') || (leftfilter != 'None'))) {


        setTimeout(function () {

          //  self.refreshUI();
          self.logger.info('For detection attenuation set to ' + self.config.get('attenuationl'))
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
                payload: { 'endpoint': 'audio_interface/fusiondsp', 'method': 'testclipping', 'data': '' },
                //     emit: 'closeModals'

              }
            ]
          }
          self.commandRouter.broadcastMessage("openModal", responseData);
        }, 1000);

      }
      setTimeout(function () {

        self.areSampleswitch();
      }, 1500);
      let ltest, rtest, cleftfilter, crightfilter

      cleftfilter = filterfolder + leftfilter
      crightfilter = filterfolder + rightfilter
      let typerl = 'Conv'
      let typerr = 'Conv'
      if (leftfilter == 'None') {
        typerl = 'None'
        attenuationl = 0
      }
      if (rightfilter == 'None') {
        typerr = 'None'
        attenuationr = 0
      }
      ltest = ('Eq1' + '|' + typerl + '|L' + cleftfilter + '|' + attenuationl + '|');
      rtest = ('Eq2' + '|' + typerr + '|R' + crightfilter + '|' + attenuationr + '|');
      test = ltest + rtest
      self.logger.info('Test ' + test)

      self.config.set('savedmergedeqfir', test)

    }
  }
  if (self.config.get('moresettings')) {

    let monooutput = data["monooutput"]
    if (monooutput) {
      self.config.set('crossfeed', 'None');
    } else {
      self.config.set('crossfeed', data['crossfeed'].value)
    }
    let loudness = data["loudness"]
    if (loudness) {
      self.sendvolumelevel()
    } else {
      socket.off()
    }
    self.config.set('leftlevel', data.leftlevel);
    self.config.set('rightlevel', data.rightlevel);
    self.config.set('monooutput', data["monooutput"]);
    if (self.config.get('showloudness')) {

      self.config.set('loudness', loudness);
      self.config.set('loudnessthreshold', data.loudnessthreshold)
    }
  }

  self.config.set('effect', true);
  self.config.set('showeq', data["showeq"]);
  self.config.set('usethispreset', 'no preset used');
  self.config.set('mergedeq', test);

  setTimeout(function () {
    self.refreshUI();

    self.createCamilladspfile()
  }, 800);

  return defer.promise;
};

FusionDsp.prototype.saveequalizerpreset = function (data) {
  const self = this;
  let defer = libQ.defer();
  let selectedsp = self.config.get('selectedsp')
  let state4preset = [
    self.config.get('crossfeed'),
    self.config.get('monooutput'),
    self.config.get('loudness'),
    self.config.get('loudnessthreshold'),
    self.config.get('leftlevel'),
    self.config.get('rightlevel')
  ]

  let preset = (data['eqpresetsaved'].value);
  if (preset == 'Select a preset') {
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('CHOOSE_PRESET'))
    return;
  }
  var nbreq = self.config.get('nbreq')
  // self.logger.info('eqpresetsaved ' + preset)
  var rpreset = (data['renpreset'])
  //if (rpreset != 'choose a name') {
  switch (preset) {
    case ("mypreset1"):
      var spreset = 'p1'
      var renprestr = '1'
      break;
    case ("mypreset2"):
      var spreset = 'p2'
      var renprestr = '2'
      break;
    case ("mypreset3"):
      var spreset = 'p3'
      var renprestr = '3'
      break;
  }
  if (rpreset == 'choose a name') {
    self.logger.info('No change in name !')
  } else {
    self.config.set("renpreset" + renprestr, (data['renpreset']));
    let name = (self.config.get('renpreset' + renprestr));

  }
  if (selectedsp == 'PEQ') {
    self.config.set(spreset + 'nbreq', nbreq);
    self.config.set('mergedeq' + renprestr, self.config.get('mergedeq'));

  } else if (selectedsp == 'EQ15') {
    self.config.set("geq15" + renprestr, self.config.get('geq15'));
    self.config.set("x2geq15" + renprestr, self.config.get('geq15'));
    self.logger.info('geq151 = ' + self.config.get('geq15'))

  } else if (selectedsp == '2XEQ15') {
    self.config.set("x2geq15" + renprestr, self.config.get('x2geq15'));
    self.config.set("geq15" + renprestr, self.config.get('eq15'));


  } else if (selectedsp == 'convfir') {

    self.logger.info('aaaaaaaaaaaaaaaaaa nothing to do!')
  }
  self.config.set('state4preset' + renprestr, state4preset)
  self.logger.info('State for preset' + renprestr + ' = ' + state4preset)
  self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('VALUE_SAVED_PRESET') + spreset)

  self.refreshUI();

  return defer.promise;
};


FusionDsp.prototype.usethispreset = function (data) {
  const self = this;
  let defer = libQ.defer();

  let test = ''
  let geq15, x2geq15
  let preset = (data['usethispreset'].value);
  let selectedsp = self.config.get('selectedsp')

  switch (preset) {
    case ("mypreset1"):
      var spreset = '1'
      var eqspreset = 'geq151'
      var reqspreset = 'x2geq151'
      break;
    case ("mypreset2"):
      var spreset = '2'
      var eqspreset = 'geq152'
      var reqspreset = 'x2geq152'
      break;
    case ("mypreset3"):
      var spreset = '3'
      var eqspreset = 'geq153'
      var reqspreset = 'x2geq153'
      break;
    case ("voice"):
      var spreset = 'voice'
      var eqspreset = 'voice'
      var reqspreset = 'voice'
      break;
    case ("bass"):
      var spreset = 'bass'
      var eqspreset = 'bass'
      var reqspreset = 'bass'
      break;
    case ("flat"):
      var spreset = 'flat'
      var eqspreset = 'flat'
      var reqspreset = 'flat'
      break;
    case ("rock"):
      var spreset = 'rock'
      var eqspreset = 'rock'
      var reqspreset = 'rock'
      break;
    case ("classic"):
      var spreset = 'classic'
      var eqspreset = 'classic'
      var reqspreset = 'classic'
      break;
    case ("soundtrack"):
      var spreset = 'soundtrack'
      var eqspreset = 'soundtrack'
      var reqspreset = 'soundtrack'
      break;
    default:
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('CHOOSE_PRESET'))
      return;
  }

  if (selectedsp == 'EQ15') {
    geq15 = self.config.get(eqspreset).split(',')
    //  self.logger.info('geq1 ' + geq15)

    let o = 1
    var eqr = geq15//.split(',')
    //self.logger.info('setting EQ15 values ' + typeof (eqr))
    for (o in eqr) {
      let eqval = geq15[o]
      test += ('Eq' + o + '|Peaking|L+R|' + eq15range[o] + ',' + eqval + ',' + coefQ + '|');
    }
    self.logger.info('test ' + test)
    self.config.set('mergedeq', test);
    self.config.set("nbreq", 15);

  } else if (selectedsp == '2XEQ15') {
    geq15 = self.config.get(eqspreset).split(',')
    x2geq15 = self.config.get(reqspreset).split(',')

    self.logger.info('geq15 ' + geq15)
    let ltest, rtest
    let o = 1
    var eqr = geq15
    for (let o in geq15) {
      var eqval = geq15[o]
      ltest += ('Eq' + o + '|Peaking|L|' + eq15range[o] + ',' + eqval + ',' + coefQ + '|');
    }
    for (let o in x2geq15) {
      var eqval = x2geq15[o]
      rtest += ('Eq' + o + '|Peaking|R|' + eq15range[o] + ',' + eqval + ',' + coefQ + '|');
    }
    test = ltest + rtest

    self.logger.info('test ' + test)
    self.config.set('mergedeq', test);
    self.config.set("nbreq", 30);

  }

  if ((selectedsp == 'EQ15') || (selectedsp == '2XEQ15')) {
    self.config.set('geq15', self.config.get(eqspreset))
    self.config.set('x2geq15', self.config.get(reqspreset))
    self.config.set("usethispreset", preset);

  } else if (selectedsp == 'PEQ') {
    var nbreqc = self.config.get('p' + spreset + 'nbreq')
    self.config.set("nbreq", nbreqc);
    self.config.set('mergedeq', self.config.get('mergedeq' + spreset));
    self.config.set("usethispreset", preset);

  } else if (selectedsp == 'convfir') {
    //   self.logger.info('aaaaaaaaaaaaaaaaaa')
  }
  if (preset == "mypreset1" || preset == "mypreset2" || preset == "mypreset3") {
    let state4preset = self.config.get('state4preset' + spreset)

    self.logger.info('state4preset ' + state4preset)
    self.config.set('crossfeed', state4preset[0])
    self.config.set('monooutput', state4preset[1])
    self.config.set('loudness', state4preset[2])
    self.config.set('loudnessthreshold', state4preset[3])
    self.config.set('leftlevel', state4preset[4])
    self.config.set('rightlevel', state4preset[5])
  }

  self.commandRouter.pushToastMessage('info', spreset + self.commandRouter.getI18nString('PRESET_LOADED_USED'))

  setTimeout(function () {
    self.refreshUI();
    self.createCamilladspfile()
  }, 500);
  return defer.promise;

};

FusionDsp.prototype.importeq = function (data) {
  const self = this;
  let path = 'https://raw.githubusercontent.com/jaakkopasanen/AutoEq//master/results'
  let defer = libQ.defer();
  var nameh = data['importeq'].label
  var name = nameh.split('  ').slice(1).toString();
  self.logger.info('name ' + typeof (name));
  var namepath = data['importeq'].value
  self.config.set('addreplace', true);
  self.config.set('nbreq', 1);
  var toDownload = (path + namepath + '/' + name.replace(' ', '%20') + '%20ParametricEQ.txt\'')
  self.logger.info('wget \'' + toDownload)
  try {
    execSync("/usr/bin/wget \'" + toDownload + " -O /tmp/EQfile.txt", {
      uid: 1000,
      gid: 1000
    });
    defer.resolve();
  } catch (err) {
    self.logger.info('failed to download Eq' + err);
  }
  self.config.set('eqfrom', 'autoeq');

  self.convertimportedeq();
  return defer.promise;
};

FusionDsp.prototype.importlocal = function (data) {
  const self = this;
  let defer = libQ.defer();
  let file = data['importlocal'].value;
  let localscope;
  if ((file == '') || (file == 'select a file')) {
    self.commandRouter.pushToastMessage('error', 'Choose a file')
    return;
  }
  self.config.set('eqfrom', data['importlocal'].value);
  //self.config.set('localfile', data[]);
  self.config.set('localscope', data['localscope'].value);
  self.config.set('addreplace', data['addreplace']);
  self.convertimportedeq();
  return defer.promise;
};

//----------------here we convert imported file
FusionDsp.prototype.convertimportedeq = function () {
  const self = this;
  let defer = libQ.defer();
  var filepath;
  let localscope;
  var EQfile;
  let test;

  var EQfilef = self.config.get('eqfrom')
  var addreplace = self.config.get('addreplace');
  if (EQfilef == 'autoeq') {
    filepath = ('/tmp/EQfile.txt');
  } else {
    filepath = ('/data/INTERNAL/FusionDsp/peq/' + EQfilef);
  }
  try {
    EQfile = fs.readFileSync(filepath, "utf8");
    //let nbreq = 1;
    var o = 0;
    if (addreplace) {

      var nbreq = 1;
    } else {
      test = self.config.get('mergedeq')
      var nbreq = self.config.get('nbreq') + 1;
    }

    var result = (EQfile.split('\n'));
    for (o; o < result.length; o++) {
      if (nbreq < tnbreq) {
        if ((result[o].indexOf("Filter") != -1) && (result[o].indexOf("None") == -1) && (result[o].indexOf("PK") != -1) && (result[o].indexOf('Gain   0.00 dB') == -1)) {
          var lresult = (result[o].replace(/       /g, ' ').replace(/   /g, ' ').replace(/  /g, ' ').replace(/ON PK Fc /g, ',').replace(/ Hz Gain /g, ',').replace(/ dB Q /g, ','));
          //  self.logger.info('filter in line ' + o + lresult)
          var eqv = (lresult);
          var param = eqv.split(',')
          // console.log(param)
          var eqs = (param[1] + ',' + param[2] + ',' + param[3])
          var typec = 'type' + nbreq;
          var scopec = 'scope' + nbreq;
          var eqc = 'eq' + nbreq;
          nbreq = nbreq + 1;
          if (EQfilef == 'autoeq') {
            localscope = 'L+R';
          } else {
            localscope = self.config.get('localscope');
          }
          test += ('Eq' + o + '|Peaking|' + localscope + '|' + eqs + '|');

          self.config.set("nbreq", nbreq - 1);
          self.config.set('effect', true)
          self.config.set('usethispreset', 'no preset used');


          setTimeout(function () {
            self.refreshUI();

            self.createCamilladspfile()
            self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('EQ_LOADED_USED'))

          }, 300);
        } else {
          //nothing to do...

        }
      } else {
        self.logger.info('Max eq reached')
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('MAX_EQ_REACHED'));
      }
    }
    //  self.logger.info('test bbbbbbbb' + test)
    self.config.set('mergedeq', test);
    self.config.set('savednbreq', nbreq - 1)
    self.config.set('savedmergedeq', test)
  } catch (err) {
    self.logger.info('failed to read EQ file ' + err);
  }
  return defer.promise;
};

FusionDsp.prototype.updatelist = function (data) {
  const self = this;
  let path = 'https://raw.githubusercontent.com/jaakkopasanen/AutoEq//master/results';
  let name = 'README.md';
  let defer = libQ.defer();
  var destpath = ' \'/data/plugins/audio_interface/fusiondsp';
  // self.config.set('importeq', namepath)
  var toDownload = (path + '/' + name + '\'');
  self.logger.info('wget \'' + toDownload)
  try {
    execSync("/usr/bin/wget \'" + toDownload + " -O" + destpath + "/downloadedlist.txt\'", {
      uid: 1000,
      gid: 1000
    });
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('LIST_SUCCESS_UPDATED'))

    defer.resolve();
  } catch (err) {
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('LIST_FAIL_UPDATE'))

    self.logger.info('failed to  download file ' + err);
  }

  return defer.promise;
}


FusionDsp.prototype.resampling = function (data) {
  const self = this;
  let defer = libQ.defer();
  var mpdresample = this.getAdditionalConf('audio_interface', 'alsa_controller', 'resampling');
  if (mpdresample) {
    self.logger.error('Resampling must be disabled in playback settings in order to enable this feature');
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('RESAMPLING_WARN'));
    self.refreshUI();

    return
  } else {
    let selectedsp = self.config.get('selectedsp')
    if (selectedsp == "convfir") {
      var responseData = {
        title: self.commandRouter.getI18nString('SAMPLE_WARNING_TITLE'),
        message: self.commandRouter.getI18nString('SAMPLE_WARNING_MESS'),
        size: 'lg',
        buttons: [
          {
            name: self.commandRouter.getI18nString('GET_IT'),
            class: 'btn btn-cancel',
            emit: 'closeModals',
            payload: ''
          },
        ]
      }
      self.commandRouter.broadcastMessage("openModal", responseData);
    }

    self.config.set('enableresampling', data['enableresampling'])
    self.config.set('resamplingset', data['resamplingset'].value)
    self.config.set('resamplingq', data['resamplingq'].value)
    self.createCamilladspfile()
  }
  return defer.promise;
};
//-----------DRC-FIR section----------------

//here we save value for converted file
FusionDsp.prototype.fileconvert = function (data) {
  const self = this;
  let defer = libQ.defer();
  self.config.set('filetoconvert', data['filetoconvert'].value);
  self.config.set('tc', data['tc'].value);
  self.config.set('drcconfig', data['drcconfig'].value);
  self.config.set('drc_sample_rate', data['drc_sample_rate'].value);
  self.config.set('outputfilename', data['outputfilename']);
  self.convert()
  return defer.promise;
};

//here we convert file using sox and generate filter with DRC-FIR
FusionDsp.prototype.convert = function (data) {
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
    let outsample = self.config.get('drc_sample_rate');
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
          self.refreshUI()
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
};

//--------------Tools Section----------------

//here we download and install tools
FusionDsp.prototype.installtools = function (data) {
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
      let cp5 = execSync('tar -xvf /tmp/tools.tar.xz -C /data/' + toolspath);
      let cp6 = execSync('/bin/rm /tmp/tools.tar.xz*');
      self.config.set('toolsfiletoplay', self.commandRouter.getI18nString('TOOLS_CHOOSE_FILE'));
      self.config.set('toolsinstalled', true);
      self.refreshUI();

      socket.emit('updateDb');


    } catch (err) {
      self.logger.info('An error occurs while downloading or installing tools');
      self.commandRouter.pushToastMessage('error', 'An error occurs while downloading or installing tools');
    }

    resolve();
  });
};

//here we remove tools
FusionDsp.prototype.removetools = function (data) {
  const self = this;
  self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('TOOLS_REMOVE'));
  return new Promise(function (resolve, reject) {

    try {

      let cp6 = execSync('/bin/rm /data/' + toolspath + "/*");
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
    self.refreshUI();
    socket.emit('updateDb');

    //   return self.commandRouter.reloadUi();
  });
};
//------ actions tools------------

FusionDsp.prototype.playToolsFile = function (data) {
  const self = this;
  self.config.set('toolsfiletoplay', data['toolsfiletoplay'].value);
  let toolsfile = self.config.get("toolsfiletoplay");
  let track = toolspath + toolsfile;
  self.commandRouter.replaceAndPlay({ uri: track });
  self.commandRouter.volumioClearQueue();
};


FusionDsp.prototype.sendvolumelevel = function () {
  const self = this;
  let loudnessMaxGain = 15
  let loudnessVolumeThreshold = self.config.get('loudnessthreshold')
  let loudnessLowThreshold = 10
  let loudnessRange = loudnessVolumeThreshold - loudnessLowThreshold
  let ratio = loudnessMaxGain / loudnessRange
  let loudnessGain
  socket.on('pushState', function (data) {
    if (data.volume > loudnessLowThreshold && data.volume < loudnessVolumeThreshold) {
      loudnessGain = ratio * (loudnessVolumeThreshold - data.volume)
    } else if (data.volume <= loudnessLowThreshold) {
      loudnessGain = loudnessMaxGain
    } else if (data.volume >= loudnessVolumeThreshold) {
      loudnessGain = 0
    }

    self.logger.info('volume level for loudness ' + data.volume + ' gain applied ' + Number.parseFloat(loudnessGain).toFixed(2))
    self.config.set('loudnessGain', Number.parseFloat(loudnessGain).toFixed(2))
    self.createCamilladspfile()
  })
}
/*
test for future features...
FusionDsp.prototype.displayfilters = function () {
  const self = this;
  const express = require('express');
  const app = express();
  const port = 8087;

  // Define the static file path
  app.use(express.static(__dirname));

  app.get('/', function (req, res) {
    res.sendFile(__dirname + '/filtersview.html');
  })

  app.listen(port, () => console.log('The server running on Port ' + port));

  //return defer.promise;
}
*/