/*--------------------
Parameq plugin for volumio2. By balbuze Febuary  2021
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

      uiconf.sections[0].content[41].value = self.config.get('eq14');

      //}
      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    })
  return defer.promise;
};


Parameq.prototype.addeq = function (data) {
  const self = this;
  var n = self.config.get('nbreq')
  n = n + 1;
  if (n > tnbreq) {
    self.logger.info('Max eq reached!')
    return
  }
  self.config.set('nbreq', n)

  self.logger.info('nbre eq ' + n)

  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Parameq4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
  }, 200);
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

  self.config.set(typec, 'None')
  self.config.set('nbreq', n)
  self.logger.info('nbre eq ' + n + ' last removed ' + typec + ' set to None')

  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);

  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Parameq4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
  }, 200);
};

Parameq.prototype.disableeffect = function () {
  const self = this;
  self.config.set('effect', false)
  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Parameq4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
  }, 200);

};

Parameq.prototype.enableeffect = function () {
  const self = this;
  self.config.set('effect', true)
  setTimeout(function () {
    self.createCamilladspfile()
  }, 100);
  setTimeout(function () {
    var respconfig = self.commandRouter.getUIConfigOnPlugin('audio_interface', 'Parameq4Volumio', {});
    respconfig.then(function (config) {
      self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
  }, 200);

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
    self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');

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
      var gainresult;

      if (((self.config.get('type1') == 'None') && (self.config.get('type2') == 'None') && (self.config.get('type3') == 'None') && (self.config.get('type4') == 'None') && (self.config.get('type5') == 'None') && (self.config.get('type6') == 'None') && (self.config.get('type7') == 'None') && (self.config.get('type8') == 'None') && (self.config.get('type9') == 'None') && (self.config.get('type10') == 'None') && (self.config.get('type11') == 'None') && (self.config.get('type12') == 'None') && (self.config.get('type13') == 'None') && (self.config.get('type14') == 'None')) || (effect == false)) {
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
          gainclipfree = ('-' + (parseInt(gainresult) + 2))
          if (gainresult < 0) {
            gainclipfree = -2
          }
          /*
        } else {
          gainclipfree = 0
        }
        */
        }
      };

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
    self.logger.info('type in ' + eqc + ' ' + self.config.get(typec) + ' ' + 'values ' + eqr)

    var veq = Number(eqr[0]);

    if (Number.isInteger(veq) && (veq > 0 && veq < 20001)) {
      self.logger.info('value ok ')

    } else {

      self.logger.info('wrong value in ' + eqc)
      self.commandRouter.pushToastMessage('error', 'Frequency Hz in filter ' + eqc + ' must be an integer [1-20000]')
      return;
    }

    if (typer == 'Peaking') {

      var g = Number(eqr[2]);
      if ((Number.parseFloat(g)) && (g > 0 && g < 15.1)) {

      } else {
        self.commandRouter.pushToastMessage('error', 'Coefficient Q in filter ' + eqc + ' must be a float [0.1-15]')
        return;
      }

    }
    if (typer == 'Highpass' || typer == 'Lowpass' || typer == 'Notch') {

      var q = Number(eqr[1]);
      if ((Number.parseFloat(q)) && (q > 0 && q < 15.1)) {

      } else {
        self.commandRouter.pushToastMessage('error', 'Coefficient Q in filter ' + eqc + ' must be a float [0.1-15]')
        return;
      }

    }

    if (typer == 'Peaking' || typer == 'Highshelf' || typer == 'Lowshelf') {

      var g = Number(eqr[1]);
      if ((Number.isInteger(g)) && (g > -21 && g < 21)) {

      } else {
        self.commandRouter.pushToastMessage('error', 'Gain in filter ' + eqc + ' must be a integer [-20-20]')
        return;
      }

    }
    if (typer == 'Highshelf' || typer == 'Lowshelf') {

      var s = Number(eqr[2]);
      if ((Number.isInteger(s)) && (s > 0 && s < 16)) {

      } else {
        self.commandRouter.pushToastMessage('error', 'Slope in filter ' + eqc + ' must be a integer [1-15]')
        return;
      }
    }
    if (typer == 'Highpass' || typer == 'Lowpass' || typer == 'Notch') {

      var q = eqr[2];
      self.logger.info('last value ' + q)
      if (q != undefined) {
        self.commandRouter.pushToastMessage('error', 'No need third coefficient for ' + eqc)
        return;
      } else {
        //do nthing
      }

    }
  }
  for (var o = 1; o < (nbreq + 1); o++) {
    var typec = 'type' + o;
    var scopec = 'scope' + o;
    var eqc = 'eq' + o;
    // self.logger.info('typec' + data[typec].value + ' scopec ' + data[scopec].value + ' eqc ' + data[eqc])
    self.config.set(typec, data[typec].value);
    self.config.set(scopec, data[scopec].value);
    self.config.set(eqc, data[eqc]);
    self.commandRouter.pushToastMessage('info', 'Values saved and applied!')

  }
  setTimeout(function () {
    self.createCamilladspfile()
  }, 500);

  return defer.promise;
}