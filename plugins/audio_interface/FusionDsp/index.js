/*--------------------
FusionDsp plugin for volumio3. By balbuze June  2021
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

// Nbre total of Eq
const tnbreq = 50


//---global Variables
const filterfolder = "/data/INTERNAL/FusionDsp/filters/";
const filtersource = "/data/INTERNAL/FusionDsp/filter-sources/";
const tccurvepath = "/data/INTERNAL/FusionDsp/target-curves/";
const toolspath = "/data/INTERNAL/FusionDsp/tools/";
const eq15range = [25, 40, 63, 100, 160, 250, 400, 630, 1000, 1600, 2500, 4000, 6300, 10000, 16000]
const coefQ = 1.1 //Q for grapics EQ

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
  setTimeout(function () {
    self.createCamilladspfile()

  }, 2000);
  defer.resolve();
  return defer.promise;
};

FusionDsp.prototype.onStop = function () {
  const self = this;
  let defer = libQ.defer();
  self.logger.info("Stopping camilladsp service");
  defer.resolve();
  return libQ.resolve();
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
    execSync('/data/plugins/audio_interface/fusiondsp/hw_params volumioDsp >/data/configuration/audio_interface/fusiondsp/hwinfo.json ', {
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
      self.logger.info('AAAAAAAAAAAAAAAAAAAA-> ' + samplerates + ' <-AAAAAAAAAAAAA');
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


        let n = 1
        let eqval = self.config.get('mergedeq')
        let subtypex = eqval.toString().split('|')


        for (n; n <= ncontent; n++) {


          let typeinui = subtypex[((n - 1) * 4) + 1]
          if (typeinui == undefined) {
            typeinui = 'None'
          }


          let scopeinui = subtypex[((n - 1) * 4) + 2]
          if (scopeinui == undefined) {
            scopeinui = 'L+R'
          }

          let eqinui = subtypex[((n - 1) * 4) + 3]
          if (eqinui == undefined) {
            eqinui = '0,0,0'
          }

          uiconf.sections[1].content.push(

            {
              "id": "type" + n,
              "element": "select",
              "label": "Type Eq" + n,
              "doc": self.commandRouter.getI18nString("TYPEEQ_DOC"),
              "value": { "value": typeinui, "label": typeinui },
              "options": [{ "value": "None", "label": "None" }, { "value": "Peaking", "label": "Peaking" }, { "value": "Lowshelf", "label": "Lowshelf" }, { "value": "Highshelf", "label": "Highshelf" }, { "value": "Notch", "label": "Notch" }, { "value": "Highpass", "label": "Highpass" }, { "value": "Lowpass", "label": "Lowpass" }, { "value": "Remove", "label": "Remove" }],
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
              "description": self.commandRouter.getI18nString('ADD_EQ_DESC'),
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
              "description": self.commandRouter.getI18nString('REMOVE_EQ_DESC'),
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
        let listeq
        let eqtext
        if (selectedsp == 'EQ15') {
          listeq = ['geq15']
          eqtext = self.commandRouter.getI18nString('LANDRCHAN')
          // i = 1
        } if (selectedsp == '2XEQ15') {
          listeq = ['geq15', 'x2geq15']
          eqtext = (self.commandRouter.getI18nString('LEFTCHAN') + ',' + self.commandRouter.getI18nString('RIGHTCHAN'))
          //i = 2

        }
        //let neq = eqtext.split(',')
        for (i in listeq) {
          let neq = eqtext.split(',')[i]
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

        valuestored = self.config.get('leftfilter');
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[0].value.value', valuestored);
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[0].value.label', valuestored);

        value = self.config.get('attenuationl');
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[1].value.value', value);
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[1].value.label', value);
        valuestored = self.config.get('rightfilter');
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[2].value.value', valuestored);
        self.configManager.setUIConfigParam(uiconf, 'sections[1].content[2].value.label', valuestored);
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

              self.logger.info('litems ' + litems[a])

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

        uiconf.sections[1].saveButton.data.push('leftfilter');
        uiconf.sections[1].saveButton.data.push('attenuationl');
        uiconf.sections[1].saveButton.data.push('rightfilter');
        uiconf.sections[1].saveButton.data.push('attenuationr');
        uiconf.sections[1].saveButton.data.push('enableclipdetect');
      }

      //----------------end of convfir section------------

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
      )

      self.logger.info('effect ' + effect)

      if (effect == true) {
        uiconf.sections[1].content.push(
          {
            "id": "disableeffect",
            "element": "button",
            "label": self.commandRouter.getI18nString('DISABLE_EFFECT'),
            "description": self.commandRouter.getI18nString('DISABLE_EFFECT_DESC'),
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
            "description": self.commandRouter.getI18nString('ENABLE_EFFECT_DESC'),
            "onClick": {
              "type": "plugin",
              "endpoint": "audio_interface/fusiondsp",
              "method": "enableeffect",
              "data": []
            }
          }
        )
      }

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
        },
        {
          "id": "showeq",
          "element": "switch",
          "doc": self.commandRouter.getI18nString('SHOW_SETTINGS_DOC'),
          "label": self.commandRouter.getI18nString('SHOW_SETTINGS'),
          "value": self.config.get('showeq')
        }

      )
      uiconf.sections[1].saveButton.data.push('showeq');
      uiconf.sections[1].saveButton.data.push('crossfeed');
      uiconf.sections[1].saveButton.data.push('leftlevel');
      uiconf.sections[1].saveButton.data.push('rightlevel');
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
        self.logger.info('No preset for FIR')
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
        self.logger.info('preset label' + plabel)
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
      self.configManager.setUIConfigParam(uiconf, 'sections[4].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[4].content[0].value.label', value);


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
      self.configManager.setUIConfigParam(uiconf, 'sections[5].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[5].content[0].value.label', value);


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

FusionDsp.prototype.disableeffect = function () {
  const self = this;
  self.config.set('effect', false)
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

//------------Fir features----------------


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
          if (pipelinelr == '') {
            pipelinelr = 'nulleq2'

          }
          if (pipelinerr == '') {
            pipelinerr = 'nulleq2'
          }
          gainmaxused += gainmax

        };

      };

      gainmaxused += ',0'

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

      let leftgain = (+gainclipfree + +leftlevel - +crossatt)
      let rightgain = (+gainclipfree + +rightlevel - +crossatt);
      self.logger.info(result)
      self.logger.info('gain applied ' + leftgain)

      ///----mixers and pipelines generation
      var composedmixer = ''
      var composedpipeline = ''

      if ((crossconfig == 'None') && (effect)) {
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


      self.logger.info('gain applied left ' + leftgain + ' right ' + rightgain)

      let conf = data.replace("${resulteq}", result)
        .replace("${resampling}", (composeddevice))
        .replace("${capturesamplerate}", (capturesamplerate))

        .replace("${composeout}", (composeout))
        .replace("${mixers}", composedmixer)
        //.replace("${gain}", leftgain)
        //.replace("${gain}", rightgain)
        .replace("${composedpipeline}", composedpipeline)
        //  .replace("${pipelineR}", pipelinerr)
        ;
      fs.writeFile("/data/configuration/audio_interface/fusiondsp/camilladsp.yml", conf, 'utf8', function (err) {
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
      if (typer == 'Peaking') {

        var q = Number(eqr[2]);
        if ((Number.parseFloat(q)) && (q > 0 && q < 25.1)) {

        } else {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('Q_RANGE') + eqc)
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
      if (typer == 'Highpass' || typer == 'Lowpass' || typer == 'Notch') {

        var q = eqr[2];
        self.logger.info('last value ' + q)
        if (q != undefined) {
          self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('NO_THIRDCOEFF') + eqc)
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
        //  self.logger.info('test values ' + test)
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
    self.config.set('leftfilterlabel', leftfilter);


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
      self.dfiltertype(data);
      let enableclipdetect = data['enableclipdetect'];

      let val = self.dfiltertype(obj);
      let valfound = val.valfound

      self.config.set('leftfilter', leftfilter);
      self.config.set('attenuationl', attenuationl);
      self.config.set('rightfilter', rightfilter);
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
        }, 500);

      }
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
  self.config.set('crossfeed', data['crossfeed'].value);
  self.config.set('leftlevel', data.leftlevel);
  self.config.set('rightlevel', data.rightlevel);
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
      var renprsetr = '1'
      break;
    case ("mypreset2"):
      var spreset = 'p2'
      var renprsetr = '2'
      break;
    case ("mypreset3"):
      var spreset = 'p3'
      var renprsetr = '3'
      break;
  }
  if (rpreset == 'choose a name') {
    self.logger.info('No change in name !')
  } else {
    self.config.set("renpreset" + renprsetr, (data['renpreset']));
    let name = (self.config.get('renpreset' + renprsetr));

  }
  if (selectedsp == 'PEQ') {
    self.config.set(spreset + 'nbreq', nbreq);
    self.config.set('mergedeq' + renprsetr, self.config.get('mergedeq'));

  } else if (selectedsp == 'EQ15') {
    self.config.set("geq15" + renprsetr, self.config.get('geq15'));
    self.config.set("x2geq15" + renprsetr, self.config.get('geq15'));
    self.logger.info('geq151 = ' + self.config.get('geq15'))

  } else if (selectedsp == '2XEQ15') {
    self.config.set("x2geq15" + renprsetr, self.config.get('x2geq15'));
    self.config.set("geq15" + renprsetr, self.config.get('eq15'));


  } else if (selectedsp == 'convfir') {

    self.logger.info('aaaaaaaaaaaaaaaaaa nothing to do!')
  }

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

  } else if (selectedsp == 'PEQ') {
    var nbreqc = self.config.get('p' + spreset + 'nbreq')
    self.config.set("nbreq", nbreqc);
    self.config.set('mergedeq', self.config.get('mergedeq' + spreset));
    self.config.set("usethispreset", preset);


  } else if (selectedsp == 'convfir') {
    self.logger.info('aaaaaaaaaaaaaaaaaa')
  }
  self.commandRouter.pushToastMessage('info', spreset + self.commandRouter.getI18nString('PRESET_LOADED_USED'))

  setTimeout(function () {
    self.refreshUI();

    self.createCamilladspfile()
  }, 300);
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
  self.config.set('enableresampling', data['enableresampling'])
  self.config.set('resamplingset', data['resamplingset'].value)
  self.config.set('resamplingq', data['resamplingq'].value)
  self.createCamilladspfile()

  return defer.promise;
}
/*
test for future featuures...
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