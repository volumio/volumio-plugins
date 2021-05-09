/*--------------------
Parameq plugin for volumio2. By balbuze May  2021
Up to 50 eq
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

// Define the Parameq class
module.exports = Parameq;

function Parameq(context) {
  const self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;
  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
};

Parameq.prototype.onVolumioStart = function () {
  const self = this;
  let configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
  this.config = new (require('v-conf'))();
  this.config.loadFile(configFile);
  return libQ.resolve();
};

Parameq.prototype.onStart = function () {
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

Parameq.prototype.onStop = function () {
  const self = this;
  let defer = libQ.defer();
  self.logger.info("Stopping camilladsp service");
  defer.resolve();
  return libQ.resolve();
};

Parameq.prototype.onRestart = function () {
  const self = this;
};

Parameq.prototype.onInstall = function () {
  const self = this;
};

Parameq.prototype.onUninstall = function () {
  const self = this;
};

Parameq.prototype.getI18nFile = function (langCode) {
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

Parameq.prototype.getUIConfig = function () {
  const self = this;
  let defer = libQ.defer();
  let lang_code = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
    __dirname + '/i18n/strings_en.json',
    __dirname + '/UIConfig.json')

    .then(function (uiconf) {
      var nsections = '0';
      let value;
      let ncontent = self.config.get('nbreq')
      var effect = self.config.get('effect')


      value = self.config.get('eqpresetsaved');

      self.logger.info('eqpresetsaved value ' + value)

      value = self.config.get('usethispreset');
      switch (value) {
        case ("mypreset1"):
          var plabel = self.config.get('renpreset1')
          break;
        case ("mypreset2"):
          var plabel = self.config.get('renpreset2')
          break;
        case ("mypreset3"):
          var plabel = self.config.get('renpreset3')
          break;
        default: var plabel = self.commandRouter.getI18nString('NO_PRESET_USED')
      }
      self.configManager.setUIConfigParam(uiconf, 'sections[2].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[2].content[0].value.label', plabel);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[1].content[0].value.label', plabel);


      let pitems = ('mypreset1,mypreset2,mypreset3').split(',');
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
          default: var plabel = self.commandRouter.getI18nString('NO_PRESET_USED')
        }
        self.logger.info('preset label' + plabel)
        self.configManager.pushUIConfigParam(uiconf, 'sections[2].content[0].options', {
          value: pitems[x],
          label: plabel
        });

        self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[0].options', {
          value: pitems[x],
          label: plabel
        });
      }
      uiconf.sections[2].content[2].value = self.config.get('renpreset');

      value = self.config.get('importeq');
      self.configManager.setUIConfigParam(uiconf, 'sections[3].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[3].content[0].value.label', value);


      try {
        let listf = fs.readFileSync('/data/plugins/audio_interface/Parameq4Volumio/downloadedlist.txt', "utf8");
        var result = (listf.split('\n'));
        let i;

        for (i = 16; i < result.length; i++) {
          var preparedresult = result[i].replace(/- \[/g, "").replace("](.", ",").slice(0, -1);

          var param = preparedresult.split(',')
          var namel = (param[0])
          var linkl = param[1]

          self.configManager.pushUIConfigParam(uiconf, 'sections[3].content[0].options', {
            value: linkl,
            label: +i - 15 + "  " + namel
          });
        }


      } catch (err) {
        self.logger.info('failed to read downloadedlist.txt' + err);
      }


      value = self.config.get('importlocal');
      self.configManager.setUIConfigParam(uiconf, 'sections[4].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[4].content[0].value.label', value);


      var localEQfolder = '/data/INTERNAL/Parameq4Volumio'
      try {
        fs.readdir(localEQfolder, function (err, item) {

          let allfilter = '' + item;
          let items = allfilter.split(',');
          // items.pop();
          for (let i in items) {

            self.configManager.pushUIConfigParam(uiconf, 'sections[4].content[0].options', {
              value: items[i],
              label: items[i]
            });
          }

        });
      } catch (err) {
        self.logger.info('failed to read local file' + err);
      }

      value = self.config.get('localscope');
      self.configManager.setUIConfigParam(uiconf, 'sections[4].content[1].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[4].content[1].value.label', value);

      let sitemsl = ('L,R,L+R').split(',');
      for (let i in sitemsl) {
        self.configManager.pushUIConfigParam(uiconf, 'sections[4].content[1].options', {
          value: sitemsl[i],
          label: sitemsl[i]
        });
      }

      var addreplace = self.config.get('addreplace')
      uiconf.sections[4].content[2].value = addreplace;

      let n = 1
      let eqval = self.config.get('mergedeq')
      let subtypex = eqval.toString().split('/')

      // self.logger.info('info subval ' + subtypex[1])

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

        uiconf.sections[0].content.push(
          {
            "id": "type" + n,
            "element": "select",
            "label": "Type Eq" + n,
            "doc": self.commandRouter.getI18nString("TYPEEQ_DOC"),
            "value": { "value": typeinui, "label": typeinui },
            "options": [{ "value": "None", "label": "None" }, { "value": "Peaking", "label": "Peaking" }, { "value": "Lowshelf", "label": "Lowshelf" }, { "value": "Highshelf", "label": "Highshelf" }, { "value": "Notch", "label": "Notch" }, { "value": "Highpass", "label": "Highpass" }, { "value": "Lowpass", "label": "Lowpass" }],
            "visibleIf": {
              "field": "showeq",
              "value": true
            }
          },
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
        uiconf.sections[0].saveButton.data.push(eqn);
        uiconf.sections[0].saveButton.data.push('type' + n);
        uiconf.sections[0].saveButton.data.push('scope' + n);



      }

      self.logger.info('effect ' + effect)

      if (effect == true) {
        uiconf.sections[0].content.push(
          {
            "id": "disableeffect",
            "element": "button",
            "label": self.commandRouter.getI18nString('DISABLE_EFFECT'),
            "description": self.commandRouter.getI18nString('DISABLE_EFFECT_DESC'),
            "onClick": {
              "type": "plugin",
              "endpoint": "audio_interface/Parameq4Volumio",
              "method": "disableeffect",
              "data": []
            }
          }
        )
        // uiconf.sections[nsections].content[(+ncontent * 3)].hidden = false;
      } else if (effect == false) {
        uiconf.sections[0].content.push(
          {
            "id": "enableeffect",
            "element": "button",
            "label": self.commandRouter.getI18nString('ENABLE_EFFECT'),
            "description": self.commandRouter.getI18nString('ENABLE_EFFECT_DESC'),
            "onClick": {
              "type": "plugin",
              "endpoint": "audio_interface/Parameq4Volumio",
              "method": "enableeffect",
              "data": []
            }
          }
        )
      }
      if (ncontent <= tnbreq) {
        uiconf.sections[0].content.push(
          {
            "id": "addeq",
            "element": "button",
            "label": self.commandRouter.getI18nString('ADD_EQ'),
            "description": self.commandRouter.getI18nString('ADD_EQ_DESC'),
            "onClick": {
              "type": "plugin",
              "endpoint": "audio_interface/Parameq4Volumio",
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
        uiconf.sections[0].content.push(
          {
            "id": "removeeq",
            "element": "button",
            "label": self.commandRouter.getI18nString("REMOVE_EQ"),
            "description": self.commandRouter.getI18nString('REMOVE_EQ_DESC'),
            "onClick": {
              "type": "plugin",
              "endpoint": "audio_interface/Parameq4Volumio",
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
      uiconf.sections[0].content.push(
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
      uiconf.sections[0].saveButton.data.push('showeq');
      uiconf.sections[0].saveButton.data.push('leftlevel');
      uiconf.sections[0].saveButton.data.push('rightlevel');

      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    })
  return defer.promise;
};

Parameq.prototype.refreshUI = function () {
  const self = this;

  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Parameq4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
  }, 100);
}

Parameq.prototype.addeq = function (data) {
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
    // self.createCamilladspfile()
  }, 100);
  self.refreshUI();
};

Parameq.prototype.removeeq = function (data) {
  const self = this;
  var n = self.config.get('nbreq')
  n = n - 1;
  if (n < 1) {
    self.logger.info('Min eq reached!')
    return
  }

  self.config.set('effect', true)
  self.config.set('nbreq', n)
  self.logger.info('nbre eq ' + n)

  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  self.refreshUI();

};

Parameq.prototype.disableeffect = function () {
  const self = this;
  self.config.set('effect', false)
  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  self.refreshUI();

};

Parameq.prototype.enableeffect = function () {
  const self = this;
  self.config.set('effect', true)
  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  self.refreshUI();

};

Parameq.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

Parameq.prototype.setUIConfig = function (data) {
  const self = this;
};

Parameq.prototype.getConf = function (varName) {
  const self = this;
  //Perform your installation tasks here
};

Parameq.prototype.setConf = function (varName, varValue) {
  const self = this;
  //Perform your installation tasks here
};

Parameq.prototype.getLabelForSelect = function (options, key) {
  let n = options.length;
  for (let i = 0; i < n; i++) {
    if (options[i].value == key)
      return options[i].label;
  }
  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';
};

Parameq.prototype.getAdditionalConf = function (type, controller, data) {
  const self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
}
// Plugin methods -----------------------------------------------------------------------------

//------------Here we define a function to send a command to CamillaDsp through websocket---------------------
Parameq.prototype.sendCommandToCamilla = function () {
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

//------------Hrer we build CmaillaDsp config file----------------------------------------------

Parameq.prototype.createCamilladspfile = function () {
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

      var gainresult;
      let eqval = self.config.get('mergedeq')
      let subtypex = eqval.toString().split('/')
      let resulttype = ''
      for (let o = 1; o < (nbreq + 1); o++) {

        typec = subtypex[((o - 1) * 4) + 1];
        resulttype += typec
      }
      if (resulttype.indexOf('None') == -1) {
        self.logger.info('resultype dif from None ' + resulttype)
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
        pipeliner = '      - nulleq';
        result += composedeq
        pipelinelr = pipeliner.slice(8)
        pipelinerr = pipeliner.slice(8)

        self.logger.info('Effects disabled, Nulleq applied')
        gainresult = 0
        gainclipfree = self.config.get('gainapplied')

      } else {

        for (let o = 1; o < (nbreq + 1); o++) {
          eqo = ("eq" + o + "c");
          eqa = subtypex[((o - 1) * 4) + 3]//("eq" + o);
          typec = subtypex[((o - 1) * 4) + 1];
          scoper = subtypex[((o - 1) * 4) + 2]//("scope" + o);
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
      };
      var leftgain = (+gainclipfree + +leftlevel)
      var rightgain = (+gainclipfree + +rightlevel);
      self.logger.info(result)

      self.logger.info('gain applied left ' + leftgain + ' right ' + rightgain)

      let conf = data.replace("${resulteq}", result)
        .replace("${gain}", leftgain)
        .replace("${gain}", rightgain)
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


//----------------------here we save eqs config.json
Parameq.prototype.saveparameq = function (data) {
  const self = this;

  let defer = libQ.defer();
  let test = '';


  var nbreq = self.config.get('nbreq')
  for (var o = 1; o < (nbreq + 1); o++) {
    var typec = 'type' + o;
    var scopec = 'scope' + o;
    var eqc = 'eq' + o;
    var typer = (data[typec].value)
    var eqr = (data[eqc]).split(',')
    var veq = Number(eqr[0]);

    if (typer != 'None') {

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
      if ((Number.isInteger(s)) && (s > 0 && s < 16)) {

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
  for (var o = 1; o < (nbreq + 1); o++) {
    var typec = 'type' + o;
    var scopec = 'scope' + o;
    var eqc = 'eq' + o;
    self.config.set('leftlevel', data.leftlevel);
    self.config.set('rightlevel', data.rightlevel);
    test += ('Eq' + o + '/' + data[typec].value + '/' + data[scopec].value + '/' + data[eqc] + '/');
    self.config.set('mergedeq', test);
    self.config.set('usethispreset', 'no preset used')
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('VALUE_SAVED_APPLIED'))
  }
  self.config.set('effect', true);
  self.config.set('showeq', data["showeq"]);

  setTimeout(function () {
    self.refreshUI();

    self.createCamilladspfile()
  }, 800);
  return defer.promise;
};

Parameq.prototype.saveequalizerpreset = function (data) {
  const self = this;
  let defer = libQ.defer();

  let preset = (data['eqpresetsaved'].value);
  if (preset == 'Select a preset') {
    self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('CHOOSE_PRESET'))
    return;
  }
  var nbreq = self.config.get('nbreq')
  self.logger.info('eqpresetsaved ' + preset)
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
    self.logger.info('renpreset ' + name)
  }

  self.logger.info('spreset = ' + spreset)
  self.config.set('mergedeq' + renprsetr, self.config.get('mergedeq'));

  self.config.set(spreset + 'nbreq', nbreq);
  self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('VALUE_SAVED_PRESET') + spreset)

  self.refreshUI();

  return defer.promise;
};


Parameq.prototype.usethispreset = function (data) {
  const self = this;
  let preset = (data['usethispreset'].value);
  let defer = libQ.defer();
  switch (preset) {
    case ("mypreset1"):
      var spreset = '1'
      break;
    case ("mypreset2"):
      var spreset = '2'
      break;
    case ("mypreset3"):
      var spreset = '3'
      break;
    default:
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('CHOOSE_PRESET'))
      return;

  }
  var nbreqc = self.config.get('p' + spreset + 'nbreq')

  self.config.set("nbreq", nbreqc);
  self.config.set('mergedeq', self.config.get('mergedeq' + spreset));
  self.config.set("usethispreset", preset);

  self.commandRouter.pushToastMessage('info', spreset + self.commandRouter.getI18nString('PRESET_LOADED_USED'))

  setTimeout(function () {
    self.refreshUI();

    self.createCamilladspfile()
  }, 300);
  return defer.promise;

};

Parameq.prototype.importeq = function (data) {
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

Parameq.prototype.importlocal = function (data) {
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
Parameq.prototype.convertimportedeq = function () {
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
    filepath = ('/data/INTERNAL/Parameq4Volumio/' + EQfilef);
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
          test += ('Eq' + o + '/Peaking/' + localscope + '/' + eqs + '/');

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
    self.logger.info('test bbbbbbbb' + test)
    self.config.set('mergedeq', test);
  } catch (err) {
    self.logger.info('failed to read EQ file ' + err);
  }
  return defer.promise;
};

Parameq.prototype.updatelist = function (data) {
  const self = this;
  let path = 'https://raw.githubusercontent.com/jaakkopasanen/AutoEq//master/results';
  let name = 'README.md';
  let defer = libQ.defer();
  var destpath = ' \'/data/plugins/audio_interface/Parameq4Volumio';
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
/*
test for future featuures...
Parameq.prototype.displayfilters = function () {
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