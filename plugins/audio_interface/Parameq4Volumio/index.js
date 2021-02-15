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
  let output_device;
  output_device = self.config.get('output_device');

  let lang_code = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
    __dirname + '/i18n/strings_en.json',
    __dirname + '/UIConfig.json')

    .then(function (uiconf) {
      var value;


      value = self.config.get('type1');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[0].value.label', value);

      uiconf.sections[0].content[1].value = self.config.get('eq1');

      value = self.config.get('type2');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[2].value.label', value);

      uiconf.sections[0].content[3].value = self.config.get('eq2');

      value = self.config.get('type3');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[4].value.label', value);

      uiconf.sections[0].content[5].value = self.config.get('eq3');

      value = self.config.get('type4');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[6].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[6].value.label', value);

      uiconf.sections[0].content[7].value = self.config.get('eq4');

      value = self.config.get('type5');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[8].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[8].value.label', value);

      uiconf.sections[0].content[9].value = self.config.get('eq5');

      value = self.config.get('type6');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[10].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[10].value.label', value);

      uiconf.sections[0].content[11].value = self.config.get('eq6');

      value = self.config.get('type7');
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[12].value.value', value);
      self.configManager.setUIConfigParam(uiconf, 'sections[0].content[12].value.label', value);

      uiconf.sections[0].content[13].value = self.config.get('eq7');


      defer.resolve(uiconf);
    })
    .fail(function () {
      defer.reject(new Error());
    })
  return defer.promise;
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
  var eqo, eqc, eqv;
  //var o; // nbre of eq
  var typec, typer;
  let defer = libQ.defer();
  var result = '';
  var pipeliner, pipelines = '';
  let gainmaxused;

  try {
    fs.readFile(__dirname + "/camilladsp.conf.yml", 'utf8', function (err, data) {
      if (err) {
        defer.reject(new Error(err));
        return console.log(err);
      }
      if ((self.config.get('type1') == 'None') && (self.config.get('type2') == 'None') && (self.config.get('type3') == 'None') && (self.config.get('type4') == 'None') && (self.config.get('type5') == 'None') && (self.config.get('type6') == 'None') && (self.config.get('type7') == 'None')) {
        composedeq += '  nulleq:' + '\n';
        composedeq += '    type: Conv' + '\n';
        //composedeq += '    parameters:' + '\n';
        //composedeq += '' + '\n';
        pipeline += '      - nulleq' + '\n';
        result += composedeq
        pipeliner += pipeline

        pipelines = pipeliner.slice(17)
      } else {

        //var o;
        for (let o = 1; o < 8; o++) {
          eqo = ("eq" + o + "c");
          eqc = ("eq" + o);
          typec = ("type" + o);
          var composedeq = '';
          var pipeline = '';
          var gainmax = [];

          typer = self.config.get(typec);
          eqv = self.config.get(eqc).split(',');
          var coef;
          if (typer != 'None') {

            if ((typer == 'Highshelf' || typer == 'Lowshelf')) {
              coef = 'slope'
            } else if (typer == 'Peaking') {
              coef = 'q'
            }

            composedeq += '  ' + eqc + ':\n';
            composedeq += '    type: Biquad' + '\n';
            composedeq += '    parameters:' + '\n';
            composedeq += '      type: ' + typer + '\n';
            composedeq += '      freq: ' + eqv[0] + '\n';
            composedeq += '      ' + coef + ': ' + eqv[1] + '\n';
            composedeq += '      gain: ' + eqv[2] + '\n';
            composedeq += '' + '\n';
            pipeline += '      - ' + eqc + '\n';
            gainmax = ',' + eqv[2];

          } else if (typer == 'None') {
            composedeq = ''
            pipeline = ''
            gainmaxused = 0
          }
          result += composedeq
          pipeliner += pipeline
          gainmaxused += gainmax


        };
        pipelines = pipeliner.slice(17)

      };

      let arr = [];
      arr.push(gainmaxused);
      arr.sort((a, b) => {
        if (a > b) return 1;
        if (a < b) return -1;
        return 0;
      });

      gainmaxused = ('-'+(arr.toString().split(',').slice(1).sort((a, b) => a - b)).pop());
      if (gainmaxused = 'undifined') {
        gainmaxused = '0'
      }
      self.logger.info('gain max in array = ' + gainmaxused);
      self.logger.info(result)
      self.logger.info("pipeline " + pipelines)

      let conf = data.replace("${resulteq}", result)
        .replace("${gain}", (gainmaxused))
        .replace("${gain}", (gainmaxused))
        .replace("${pipelineL}", pipelines)
        .replace("${pipelineR}", pipelines)
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
Parameq.prototype.saveparameq = function (data, obj) {
  const self = this;

  let defer = libQ.defer();


  self.config.set('type1', data['type1'].value);
  self.config.set('eq1', data['eq1']);
  self.config.set('type2', data['type2'].value);
  self.config.set('eq2', data['eq2']);
  self.config.set('type3', data['type3'].value);
  self.config.set('eq3', data['eq3']);
  self.config.set('type4', data['type4'].value);
  self.config.set('eq4', data['eq4']);
  self.config.set('type5', data['type5'].value);
  self.config.set('eq5', data['eq5']);
  self.config.set('type6', data['type6'].value);
  self.config.set('eq6', data['eq6']);
  self.config.set('type7', data['type7'].value);
  self.config.set('eq7', data['eq7']);


  for (var o = 1; o < 8; o++) {

    let test = self.config.get('eq' + o).split(',')
    var reg = /^[\+\-]?\d*\.?\d+(?:[Ee][\+\-]?\d+)?$/;
    if ((reg.test(test[0])) && (reg.test(test[1])) && (reg.test(test[2]))) {
      self.commandRouter.pushToastMessage('info', 'Values saved !');
      //      console.log('String contains = ' + test)
    } else {
      self.commandRouter.pushToastMessage('error', 'Only number! Check your config !');
      return;
    }
  }

  setTimeout(function () {
    self.createCamilladspfile()
  }, 500);

  return defer.promise;
}





