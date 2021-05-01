/*--------------------
Parameq plugin for volumio2. By balbuze Febuary  2021
Up to 14 eq
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


// Nbre total of Eq - if increased, config.json and UIconfig.json need to be modified
const tnbreq = 14

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
      self.logger.info('effect ' + effect)

      if (effect == true) {
        uiconf.sections[nsections].content[43].hidden = true;
        uiconf.sections[nsections].content[42].hidden = false;

      } else if (effect == false) {
        uiconf.sections[nsections].content[42].hidden = true;
        uiconf.sections[nsections].content[43].hidden = false;

      }

      /*
            var showeq = self.config.get('showeq');
            if (showeq == false) {
              self.logger.info('display settings ' + showeq)
      
              for (let i = ncontent * 3; i < ((3 * tnbreq) - 2); i++) {
                uiconf.sections[nsections].content[i].hidden = true;
                uiconf.sections[nsections].content[i + 1].hidden = true;
                uiconf.sections[nsections].content[i + 2].hidden = true;
              }
            } else {
      */
      for (let i = ncontent * 3; i < ((3 * tnbreq) - 2); i++) {
        uiconf.sections[nsections].content[i].hidden = true;
        uiconf.sections[nsections].content[i + 1].hidden = true;
        uiconf.sections[nsections].content[i + 2].hidden = true;
      }
      if (ncontent == 1) {
        uiconf.sections[nsections].content[45].hidden = true;
      }
      if (ncontent > 13) {
        uiconf.sections[nsections].content[44].hidden = true;
      }

      var a

      for (a = 0; a < tnbreq; a++) {
        let c = 3 * a
        /*
                value = self.config.get('type' + (a + 1));
                self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[' + (c + 0) + '].value.value', value);
                self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content]' + (c + 0) + '].value.label', value);
               
                self.logger.info('setUIConfigParam(uiconf, sections[' + nsections + '].content[' + (c + 0) + '].value.value,' + value)
        */
        value = self.config.get('scope' + (a + 1));
        self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[' + (c + 1) + '].value.value', value);
        self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[' + (c + 1) + '].value.label', value);
        // self.logger.info('setUIConfigParam(uiconf, sections[' + nsections + '].content[' + (c + 1) + '].value.value,' + value)

      }

      for (a = 0; a < tnbreq; a++) {
        let c = 3 * a

        uiconf.sections[nsections].content[(c + 2)].value = self.config.get('eq' + (a + 1));

        let items = ('None,Peaking,Lowshelf,Highshelf,Notch,Highpass,Lowpass').split(',');
        for (let x in items) {
          self.configManager.pushUIConfigParam(uiconf, 'sections[' + nsections + '].content[' + c + '].options', {
            value: items[x],
            label: items[x]
          });
        }

        let sitems = ('L,R,L+R').split(',');
        for (let i in sitems) {
          self.configManager.pushUIConfigParam(uiconf, 'sections[' + nsections + '].content[' + (c + 1) + '].options', {
            value: sitems[i],
            label: sitems[i]
          });
        }
      }
      value = self.config.get('type1');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[0].value.label', value);
      value = self.config.get('type2');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[3].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[3].value.label', value);
      value = self.config.get('type3');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[6].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[6].value.label', value);
      value = self.config.get('type4');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[9].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[9].value.label', value);
      value = self.config.get('type5');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[12].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[12].value.label', value);
      value = self.config.get('type6');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[15].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[15].value.label', value);
      value = self.config.get('type7');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[18].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[18].value.label', value);
      value = self.config.get('type8');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[21].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[21].value.label', value);
      value = self.config.get('type9');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[24].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[24].value.label', value);
      value = self.config.get('type10');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[27].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[27].value.label', value);
      value = self.config.get('type11');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[30].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[30].value.label', value);
      value = self.config.get('type12');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[33].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[33].value.label', value);
      value = self.config.get('type13');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[36].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[36].value.label', value);
      value = self.config.get('type14');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[39].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[39].value.label', value);
      value = self.config.get('scope14');
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[40].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[' + nsections + '].content[40].value.label', value);



      uiconf.sections[0].content[46].config.bars[0].value = self.config.get('leftlevel')


      uiconf.sections[0].content[47].config.bars[0].value = self.config.get('rightlevel')


      /*
            value = self.config.get('eqpresetsaved');
            self.configManager.setUIConfigParam(uiconf, 'sections[1].content[0].value.value', value);
            self.configManager.setUIConfigParam(uiconf, 'sections[1].content[0].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[1].content[0].options'), value));
      */

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
    self.createCamilladspfile()
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
  var typec = 'type' + (n + 1);
  self.config.set('effect', true)
  self.config.set(typec, 'None')
  self.config.set('nbreq', n)
  self.logger.info('nbre eq ' + n + ' last removed ' + typec + ' set to None')

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

//----------------------------------------------------------

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
      var eqo, eqc, eqv;
      var typec, typer;
      var result = '';
      var gainmaxused = [];
      var scopec, scoper;
      var nbreq = (self.config.get('nbreq'))
      var effect = self.config.get('effect')
      var leftlevel = self.config.get('leftlevel')
      var rightlevel = self.config.get('rightlevel')

      var gainresult;

      if (((self.config.get('type1') == 'None') && (self.config.get('type2') == 'None') && (self.config.get('type3') == 'None') && (self.config.get('type4') == 'None') && (self.config.get('type5') == 'None') && (self.config.get('type6') == 'None') && (self.config.get('type7') == 'None') && (self.config.get('type8') == 'None') && (self.config.get('type9') == 'None') && (self.config.get('type10') == 'None') && (self.config.get('type11') == 'None') && (self.config.get('type12') == 'None') && (self.config.get('type13') == 'None') && (self.config.get('type14') == 'None') && effect == false)) {
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
          eqc = ("eq" + o);
          typec = ("type" + o);
          scopec = ("scope" + o);
          var composedeq = '';
          var gainmax;
          var pipelineL = '';
          var pipelineR = '';
          scoper = self.config.get(scopec);
          //   self.logger.info('type ' + typec + 'scope ' + scopec + 'eq ' + eqc)

          typer = self.config.get(typec);
          eqv = self.config.get(eqc).split(',');
          var coef;

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
      var leftgain = (+gainclipfree + (+leftlevel))
      var rightgain = (+gainclipfree + +rightlevel)

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


//here we save eqs config.json
Parameq.prototype.saveparameq = function (data) {
  const self = this;

  let defer = libQ.defer();
  var nbreq = self.config.get('nbreq')
  for (var o = 1; o < (nbreq + 1); o++) {
    var typec = 'type' + o;
    var scopec = 'scope' + o;
    var eqc = 'eq' + o;
    var typer = (data[typec].value)
    var eqr = (data[eqc]).split(',')
    // self.logger.info('type in ' + eqc + ' ' + self.config.get(typec) + ' ' + 'values ' + eqr)

    var veq = Number(eqr[0]);

    if (typer != 'None') {

      if (Number.isInteger(veq) && (veq > 0 && veq < 20001)) {
        self.logger.info('value ok ')

      } else {

        self.logger.info('wrong value in ' + eqc)
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('FREQUENCY_RANGE') + eqc)
        return;
      }
    }
    if (typer == 'Peaking') {

      var g = Number(eqr[2]);
      if ((Number.parseFloat(g)) && (g > 0 && g < 15.1)) {

      } else {
        self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('Q_RANGE') + eqc)
        return;
      }

    }
    if (typer == 'Highpass' || typer == 'Lowpass' || typer == 'Notch') {

      var q = Number(eqr[1]);
      if ((Number.parseFloat(q)) && (q > 0 && q < 15.1)) {

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

    self.config.set(typec, data[typec].value);
    self.config.set(scopec, data[scopec].value);
    self.config.set(eqc, data[eqc]);
    self.config.set('leftlevel', data.leftlevel);
    self.config.set('rightlevel', data.rightlevel);

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
  // }

  self.logger.info('spreset = ' + spreset)
  for (var o = 1; o < (nbreq + 1); o++) {
    var typec = 'type' + o;
    var scopec = 'scope' + o;
    var eqc = 'eq' + o;
    //  self.logger.info('for ' + spreset + typec + ' scopec ' + preset + scopec + ' eqc ' + preset + eqc)
    self.config.set(spreset + typec, self.config.get(typec));
    self.config.set(spreset + scopec, self.config.get(scopec));
    self.config.set(spreset + eqc, self.config.get(eqc));
    self.config.set(spreset + 'nbreq', nbreq);
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('VALUE_SAVED_PRESET') + spreset)
  }
  self.refreshUI();

  return defer.promise;
};


Parameq.prototype.usethispreset = function (data) {
  const self = this;
  let preset = (data['usethispreset'].value);
  let defer = libQ.defer();
  switch (preset) {
    case ("mypreset1"):
      var spreset = 'p1'
      break;
    case ("mypreset2"):
      var spreset = 'p2'
      break;
    case ("mypreset3"):
      var spreset = 'p3'
      break;
    default:
      self.commandRouter.pushToastMessage('error', self.commandRouter.getI18nString('CHOOSE_PRESET'))
      return;

  }
  var nbreqc = self.config.get(spreset + 'nbreq')

  for (var o = 1; o < (nbreqc + 1); o++) {
    var typec = 'type' + o;
    var scopec = 'scope' + o;
    var eqc = 'eq' + o;

    self.config.set(typec, self.config.get(spreset + typec));
    self.config.set(scopec, self.config.get(spreset + scopec));
    self.config.set(eqc, self.config.get(spreset + eqc));
    self.config.set("nbreq", nbreqc);
    self.config.set("usethispreset", preset);

    self.commandRouter.pushToastMessage('info', spreset + self.commandRouter.getI18nString('PRESET_LOADED_USED'))
  }

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
  // self.config.set('importeq', namepath)
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
  self.convertimportedeq();
  return defer.promise;
};

Parameq.prototype.convertimportedeq = function (data) {
  const self = this;
  let defer = libQ.defer();

  let EQfile;
  try {
    EQfile = fs.readFileSync('/tmp/EQfile.txt', "utf8");
    var o = 1;

    var result = (EQfile.replace(/ON PK Fc /g, ',').replace(/ Hz Gain /g, ',').replace(/ dB Q /g, ',').split('\n'));
    for (o; o < result.length - 1; o++) {
      var eqv = (result[o]);
      var param = eqv.split(',')
      var eqs = (param[1] + ',' + param[2] + ',' + param[3])
      var typec = 'type' + o;
      var scopec = 'scope' + o;
      var eqc = 'eq' + o;

      self.config.set(typec, 'Peaking');
      self.config.set(scopec, 'L+R');
      self.config.set(eqc, eqs);
      self.config.set("nbreq", o);
      self.config.set('effect', true)
      self.logger.info('number of eq o = : ' + o);

    }
  } catch (err) {
    self.logger.info('failed to read EQfile.txt ' + err);
  }
  setTimeout(function () {
    self.refreshUI();

    self.createCamilladspfile()
    self.commandRouter.pushToastMessage('info', self.commandRouter.getI18nString('EQ_LOADED_USED'))

  }, 300);

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