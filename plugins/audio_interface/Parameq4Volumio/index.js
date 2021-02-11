/*--------------------
Parameq plugin for volumio2. By balbuze January 31th 2021
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
  self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'updateALSAConfigFile')
  /*
 .then(function (e) {
     var aplayDefer = libQ.defer();
     // Play a short sample of silence to initialise the config file
     exec("dd if=/dev/zero iflag=count_bytes count=128 | aplay -f cd -D volumioDsp", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
       if (error) {
         self.logger.warn("An error occurred when trying to initialize VolumioDsp", error);
       }
       aplayDefer.resolve();
     });
     return aplayDefer.promise;
   })
*/
  self.autoconfig()
/*

    .then(function (e) {
      setTimeout(function () {
        self.logger.info("Starting camilladsp");
        self.rebuildcamilladspRestartDaemon(defer);
      }, 1000);
      defer.resolve();
    })
    .fail(function (e) {
      defer.reject(new Error());
    });
    */
   self.startcamilladsp();
   defer.resolve();
  return defer.promise;
};

Parameq.prototype.onStop = function () {
  const self = this;
  let defer = libQ.defer();
  self.logger.info("Stopping camilladsp service");
  self.commandRouter.stateMachine.stop().then(function () {
    exec("/usr/bin/sudo /bin/systemctl stop camilladsp.service", {
      uid: 1000,
      gid: 1000
    }, function (error, stdout, stderr) { })
    self.restoresettingwhendisabling()
    socket.off();
  });
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

//here we load snd_aloop module to provide a Loopback device
Parameq.prototype.modprobeLoopBackDevice = function () {
  const self = this;
  let defer = libQ.defer();
  //self.hwinfo();
  exec("/usr/bin/sudo /sbin/modprobe snd_aloop index=7 pcm_substreams=2", {
    uid: 1000,
    gid: 1000
  }, function (error, stdout, stderr) {
    if (error) {
      self.logger.info('failed to load snd_aloop' + error);
    } else {
      self.commandRouter.pushConsoleMessage('snd_aloop loaded');
      defer.resolve();
    }
  });
  setTimeout(function () {
    return defer.promise;
  }, 500)
};

//here we detect hw info
Parameq.prototype.hwinfo = function () {
  const self = this;
  let defer = libQ.defer();

  let output_device = self.config.get('alsa_device');
  let nchannels;
  let formats;
  let hwinfo;
  let samplerates;
  try {
    exec('/data/plugins/audio_interface/Dsp4Volumio/hw_params hw:' + output_device + ' >/data/configuration/audio_interface/Dsp4Volumio/hwinfo.json ', {
      uid: 1000,
      gid: 1000
    }),
      hwinfo = fs.readFileSync('/data/configuration/audio_interface/Dsp4Volumio/hwinfo.json');
    try {
      const hwinfoJSON = JSON.parse(hwinfo);
      nchannels = hwinfoJSON.channels.value;
      formats = hwinfoJSON.formats.value.replace('_', '').replace(', ,', '').replace(',,', '');
      samplerates = hwinfoJSON.samplerates.value;
      console.log('AAAAAAAAAAAAAAAAAAAAAAAAAA-> ' + nchannels + ' <-AAAAAAAAAAAAA');
      console.log('AAAAAAAAAAAAAAAAAAAAAAAAAA-> ' + formats + ' <-AAAAAAAAAAAAA');
      console.log('AAAAAAAAAAAAAAAAAAAAAAAAAA-> ' + samplerates + ' <-AAAAAAAAAAAAA');
      self.config.set('nchannels', nchannels);
      self.config.set('formats', formats);
      self.config.set('probesmplerate', samplerates);
      let output_format = formats.split(" ").pop();

      var arr = ['S16LE', 'S24LE', 'S24LE3', 'S32LE'];
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

Parameq.prototype.startcamilladsp = function () {
  const self = this;
  let defer = libQ.defer();
  exec("/usr/bin/sudo /bin/systemctl start camilladsp.service", {
    uid: 1000,
    gid: 1000
  }, function (error, stdout, stderr) {
    if (error) {
      self.logger.info('Camilladsp failed to start. Check your configuration ' + error);
    } else {
      self.commandRouter.pushConsoleMessage('Camilladsp Daemon Started');
      self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('START_BRUTEFIR'));

      defer.resolve();
    }
  });
};

Parameq.prototype.autoconfig = function () {
  const self = this;
  let defer = libQ.defer();
  self.modprobeLoopBackDevice()
  self.rebuildcamilladspRestartDaemon() //no sure to keep it..
  self.hwinfo()
  defer.resolve()
  return defer.promise;
};

//----------------we restart the daemon-------------------
Parameq.prototype.rebuildcamilladspRestartDaemon = function () {
  const self = this;
  let defer = libQ.defer();
  self.createCamilladspfile()
    .then(function (e) {
      let edefer = libQ.defer();
      exec("/usr/bin/sudo /bin/systemctl restart camilladsp.service", {
        uid: 1000,
        gid: 1000
      }, function (error, stdout, stderr) {
        if (error) {
          self.commandRouter.pushToastMessage('error', 'camilladsp failed to start. Check your config !');
        } else {
          self.commandRouter.pushToastMessage('success', 'Attempt to start camilladsp...');
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

  return defer.promise;
};

//------------Here we define a function to send a command to CamillaDsp through websocket---------------------
Parameq.prototype.sendCommandToCamilla = function (camilladspcmd) {
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
}
  
};

//----------------------------------------------------------

Parameq.prototype.createCamilladspfile = function (obj) {
  const self = this;
  var eq1c, eq2c, eq3c, eq3c, eq4c, eq5c, eq6c, eq7c;
  var pipelineL, pipelineR;
  var eqo;
  var o;
  //var typec, typer;
  let defer = libQ.defer();
  var result = '';
  var pipeline = '';
  var composedeq = '';
  let pipeliner, pipelines = '';

  try {
    fs.readFile(__dirname + "/camilladsp.conf.yml", 'utf8', function (err, data) {
      if (err) {
        defer.reject(new Error(err));
        return console.log(err);
      }
      //var o;
      for (o = 1; o < 8; o++) {
        var eqc;
        eqo = ("eq" + o + "c");
        eqc = ("eq" + o);
        var typec = ("type" + o);

        var typer = self.config.get(typec);
        var eqv = self.config.get(eqc).split(',');
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

        } else if (typer == 'None') {
          composedeq = ''
          pipeline = ''
        }
        result += composedeq
        pipeliner += pipeline
      };
      pipelines = pipeliner.slice(17)

      self.logger.info(result)
      self.logger.info("pipeline " + pipelines)

      let conf = data.replace("${resulteq}", result)
        .replace("${pipelineL}", pipelines)
        .replace("${pipelineR}", pipelines)
        ;
      fs.writeFile("/data/configuration/audio_interface/Parameq4Volumio/camilladsp.yml", conf, 'utf8', function (err) {
        if (err)
          defer.reject(new Error(err));
        else defer.resolve();
      });
      let camilladspcmd = ("getconfigname")
      self.sendCommandToCamilla(camilladspcmd);
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


  setTimeout(function () {
    /*
        self.rebuildcamilladspRestartDaemon()
    
    
          .then(function (e) {
            self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
            defer.resolve({});
          })
          .fail(function (e) {
            defer.reject(new Error('Camilladsp failed to start. Check your config !'));
            self.commandRouter.pushToastMessage('error', 'camilladsp failed to start. Check your config !');
          })
    */
    self.createCamilladspfile()
  }, 500);

  return defer.promise;
}





