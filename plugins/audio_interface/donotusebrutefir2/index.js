/*brutefir plugin for volumio2. By balbuze 2018*/ 
'use strict';

 var io = require('socket.io-client');
 var fs = require('fs-extra');
 var libFsExtra = require('fs-extra');
 var exec = require('child_process').exec;
 var execSync = require('child_process').execSync;
 var libQ = require('kew');
 var libNet = require('net');
 var net = require('net');
 var config = new(require('v-conf'))();



 // Define the ControllerBrutefir class
 module.exports = ControllerBrutefir;

 function ControllerBrutefir(context) {
  var self = this;
  self.context = context;
  self.commandRouter = self.context.coreCommand;
  self.logger = self.commandRouter.logger;

  this.context = context;
  this.commandRouter = this.context.coreCommand;
  this.logger = this.context.logger;
  this.configManager = this.context.configManager;
 };

 ControllerBrutefir.prototype.onVolumioStart = function() {
  var self = this;
  var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
 this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.outputDeviceCallback.bind(this));
  this.config = new(require('v-conf'))();
  this.config.loadFile(configFile);
  self.autoconfig
 // .then(self.rebuildBRUTEFIRAndRestartDaemon())
  //self.rebuildBRUTEFIRAndRestartDaemon()
  return libQ.resolve();
 };

 ControllerBrutefir.prototype.getConfigurationFiles = function() {
  return ['config.json'];
 };

 // Plugin methods -----------------------------------------------------------------------------
 //here we load snd_aloop module to provide a Loopback device
 ControllerBrutefir.prototype.modprobeLoopBackDevice = function() {
  var self = this;
  var defer = libQ.defer();

  exec("/usr/bin/sudo /sbin/modprobe snd_aloop index=7 pcm_substreams=2", {
   uid: 1000,
   gid: 1000
  }, function(error, stdout, stderr) {
   if (error) {
    self.logger.info('failed to load snd_aloop' + error);
   } else {
    self.commandRouter.pushConsoleMessage('snd_aloop loaded');
    defer.resolve();
   }
  });
  setTimeout(function() {

   return defer.promise;
  }, 500)
 };

 //here we save the volumio config for the next plugin start
 ControllerBrutefir.prototype.saveVolumioconfig = function() {
  var self = this;

  return new Promise(function(resolve, reject) {

   var cp = execSync('/bin/cp /data/configuration/audio_interface/alsa_controller/config.json /tmp/vconfig.json');
   var cp2 = execSync('/bin/cp /data/configuration/system_controller/i2s_dacs/config.json /tmp/i2sconfig.json');
   try {
    var cp3 = execSync('/bin/cp /boot/config.txt /tmp/config.txt');

    // console.log('mmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmmm')

   } catch (err) {
    self.logger.info('config.txt does not exist');
   }
   resolve();
  });
 };

 //here we define the volumio restore config
 ControllerBrutefir.prototype.restoreVolumioconfig = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
   setTimeout(function() {

    var cp = execSync('/bin/cp /tmp/vconfig.json /data/configuration/audio_interface/alsa_controller/config.json');
    var cp2 = execSync('/bin/cp /tmp/i2sconfig.json /data/configuration/system_controller/i2s_dacs/config.json');
    try {
     var cp3 = execSync('/bin/cp /tmp/config.txt /boot/config.txt');
    } catch (err) {
     self.logger.info('config.txt does not exist');
    }

   }, 8000)
   resolve();
  });
 };


 ControllerBrutefir.prototype.startBrutefirDaemon = function() {
  var self = this;

  var defer = libQ.defer();

  exec("/usr/bin/sudo /bin/systemctl start brutefir.service", {
   uid: 1000,
   gid: 1000
  }, function(error, stdout, stderr) {
   if (error) {
    self.logger.info('brutefir failed to start. Check your configuration ' + error);
   } else {
    self.commandRouter.pushConsoleMessage('Brutefir Daemon Started');
    defer.resolve();
   }
  });

  return defer.promise;

 };

 //here we connect to brutefir to send equalizer settings
 ControllerBrutefir.prototype.brutefirDaemonConnect = function(defer) {
  var self = this;
  var client = new net.Socket();
  client.connect(3002, '127.0.0.1', function(err) {
   defer.resolve();
   var eqprofile = self.config.get('eqprofile')
   var coef = self.config.get('coef')
   var enablemyeq = self.config.get('enablemyeq')
   var scoef
   console.log('myeq or preset =' + enablemyeq)

if (self.config.get('enablemyeq') == false) {
   if (self.config.get('eqprofile') === 'flat')
    scoef = self.config.get('flat')
   else if (self.config.get('eqprofile') === 'loudness')
    scoef = self.config.get('loudness')
   else if (self.config.get('eqprofile') === 'rock')
    scoef = self.config.get('rock')
   else if (self.config.get('eqprofile') === 'classic')
    scoef = self.config.get('classic')
   else if (self.config.get('eqprofile') === 'bass')
    scoef = self.config.get('bass')
   else if (self.config.get('eqprofile') === 'voice')
    scoef = self.config.get('voice')
  else if (self.config.get('eqprofile') === 'soundtrack')
    scoef = self.config.get('soundtrack')
  else if (self.config.get('eqprofile') === 'mypreset1')
    scoef = self.config.get('mypreset1')
  else if (self.config.get('eqprofile') === 'mypreset2')
    scoef = self.config.get('mypreset2')
  else if (self.config.get('eqprofile') === 'mypreset3')
    scoef = self.config.get('mypreset3')
   } else scoef = self.config.get('coef')
  
   //   console.log(' raw values are %j', scoef);
   var values = scoef.split(',');

   //   console.log('splitted coef values are %j', values);
   var brutefircmd
    //here we compose brutefir command
 /*  brutefircmd = ('lmc eq 0 mag 31/' + values[0] + ', 63/' + values[1] + ', 125/' + values[2] + ', 250/' + values[3] + ', 500/' + values[4] + ', 1000/' + values[5] + ', 2000/' + values[6] + ', 4000/' + values[7] + ', 8000/' + values[8] + ', 16000/' + values[9]);*/
//cmd for the 30 bands 1/3 octace equalizer
  brutefircmd = ('lmc eq 0 mag 25/' + values[0] + ', 31/' + values[1] + ', 40/' + values[2] + ', 50/' + values[3] + ', 63/' + values[4] + ', 80/' + values[5] + ', 100/' + values[6] + ', 125/' + values[7] + ', 160/' + values[8] + ', 200/' + values[9] + ', 250/' + values[10] + ', 315/' + values[11] + ', 400/' + values[12] + ', 500/' + values[13] + ', 630/' + values[14] + ', 800/' + values[15] + ', 1000/' + values[16] + ', 1250/' + values[17] + ', 1600/' + values[18] + ', 2000/' + values[19] + ', 2500/' + values[20] + ', 3150/' + values[21] + ', 4000/' + values[22] + ', 5000/' + values[23] + ', 6300/' + values[24] + ', 8000/' + values[25] + ', 10000/' + values[26] + ', 12500/' + values[27] + ', 16000/' + values[28] + ', 20000/' + values[29]);

   //here we send the command to brutefir
   client.write(brutefircmd);
   console.log('cmd sent to brutefir = ' + brutefircmd);

  });
  //error handling section
  client.on('error', function(e) {

   if (e.code == 'ECONNREFUSED') {
    console.log('Huumm, is brutefir running ?');
    self.commandRouter.pushToastMessage('error', "Brutefir failed to start. Check your config !");

   }
  });
  client.on('data', function(data) {
   console.log('Received: ' + data);
   client.destroy(); // kill client after server's response
  });
 };


 ControllerBrutefir.prototype.onStop = function() {
  var self = this;
  var defer = libQ.defer();
  self.logger.info("Stopping Brutefir service");

  exec("/usr/bin/sudo /bin/systemctl stop brutefir.service", {
   uid: 1000,
   gid: 1000
  }, function(error, stdout, stderr) {})

  self.restoresettingwhendisabling()
  defer.resolve();
  return libQ.resolve();
 };

 ControllerBrutefir.prototype.autoconfig = function() {
  var self = this;
  var defer = libQ.defer();
  self.saveVolumioconfig()
   .then(self.modprobeLoopBackDevice())
   .then(self.saveHardwareAudioParameters())
   .then(self.setLoopbackoutput())
 //  .then(self.setVolumeParameters())
 //  .then(self.restoreVolumioconfig())

  .catch(function(err) {
   console.log(err);
  });
  defer.resolve()
  return defer.promise;

 };


 ControllerBrutefir.prototype.onStart = function() {
  var self = this;

  var defer = libQ.defer();
  self.autoconfig()

  self.rebuildBRUTEFIRAndRestartDaemon()
  // .then( self.startBrutefirDaemon() )

  .then(function(e) {
    setTimeout(function() {
     self.logger.info("Connecting to daemon brutefir");

     //self.getFilterList();
     self.brutefirDaemonConnect(defer);
    }, 1000);
   })
   .fail(function(e) {
    defer.reject(new Error());
   });

  //this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.rebuildBRUTEFIRAndRestartDaemon.bind(this));
  return defer.promise;
 };

 ControllerBrutefir.prototype.onRestart = function() {
  // self.enableLoopBackDevice();

  var self = this;
  //   self.autoconfig()
 };

 ControllerBrutefir.prototype.onInstall = function() {
  var self = this;

  //	//Perform your installation tasks here
 };

 ControllerBrutefir.prototype.onUninstall = function() {
  var self = this;
  //Perform your installation tasks here
 };

 ControllerBrutefir.prototype.getUIConfig = function() {
  var self = this;
  var defer = libQ.defer();
  var output_device;
/*  var sbauer;
  if (self.config.get('sbauer') === true)
   output_device = "headphones";
else
*/
    output_device = self.config.get('output_device');

  var lang_code = this.commandRouter.sharedVars.get('language_code');
  self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
    __dirname + '/i18n/strings_en.json',
    __dirname + '/UIConfig.json')
   .then(function(uiconf) {
    //equalizer section
    uiconf.sections[0].content[0].value = self.config.get('enablemyeq');

    value = self.config.get('eqprofile');
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[0].content[1].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[0].content[1].options'), value));

    //for coef in equalizer
    // we retrieve the coefficient configuration
    var coefconf = self.config.get('coef');
    // it is a string, so to get single values we split them by , and create an array from that
    var coefarray = coefconf.split(',');
    //console.log(coefarray)
    // for every value that we put in array, we set the according bar value
    for (var i in coefarray) {
     uiconf.sections[0].content[2].config.bars[i].value = coefarray[i]
    }
   //for equalizer custom mypreset1
    // we retrieve the coefficient configuration
    var cmypreset1 = self.config.get('mypreset1');
    // it is a string, so to get single values we split them by , and create an array from that
    var coefarrayp1 = cmypreset1.split(',');
    //console.log(coefarrayp1)
    // for every value that we put in array, we set the according bar value
    for (var i in coefarrayp1) {
     uiconf.sections[1].content[1].config.bars[i].value = coefarrayp1[i]
    }
    //for equalizer custom mypreset2
    // we retrieve the coefficient configuration
    var cmypreset2 = self.config.get('mypreset2');
    // it is a string, so to get single values we split them by , and create an array from that
    var coefarrayp2 = cmypreset2.split(',');
    //console.log(coefarrayp2)
    // for every value that we put in array, we set the according bar value
    for (var i in coefarrayp2) {
     uiconf.sections[1].content[2].config.bars[i].value = coefarrayp2[i]
    }
    //for equalizer custom mypreset3
    // we retrieve the coefficient configuration
    var cmypreset3= self.config.get('mypreset3');
    // it is a string, so to get single values we split them by , and create an array from that
    var coefarrayp3 = cmypreset3.split(',');
    //console.log(coefarrayp3)
    // for every value that we put in array, we set the according bar value
    for (var i in coefarrayp3) {
     uiconf.sections[1].content[3].config.bars[i].value = coefarrayp3[i]
	}
  
  //advanced settings option

    var filterfolder = "/data/INTERNAL/brutefirfilters";
    var itemslist //var filterl = [];
    fs.readdir(filterfolder, function(err, items) {
      console.log('list of available filters: ' + items);
      //  for (var i=0; i<items.length; i++) {
      //  console.log(items[i]);
     })
     //var itemslist = items.toString().split(',');
     //console.log('available filters are:' + itemslist)
     //for (var i in items) {
     // uiconf.sections[1].content[2].value[i] = items[i]



//advanced settings for brutefir

    uiconf.sections[2].content[2].value = self.config.get('leftfilter');
    uiconf.sections[2].content[3].value = self.config.get('rightfilter');

    value = self.config.get('attenuation');
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[1].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[1].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[2].content[1].options'), value));
    value = self.config.get('filter_format');
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[4].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[4].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[2].content[4].options'), value));
    value = self.config.get('filter_size');
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[5].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[5].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[2].content[5].options'), value));
    value = self.config.get('numb_part');
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[6].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[6].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[2].content[6].options'), value));
    value = self.config.get('fl_bits');
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[7].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[7].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[2].content[7].options'), value));
    value = self.config.get('smpl_rate');
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[8].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[8].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[2].content[8].options'), value));
    value = self.config.get('input_format');
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[9].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[9].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[2].content[9].options'), value));
    value = self.config.get('output_format');
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[10].value.value', value);
    self.configManager.setUIConfigParam(uiconf, 'sections[2].content[10].value.label', self.getLabelForSelect(self.configManager.getValue(uiconf, 'sections[2].content[10].options'), value));
    var value;


    defer.resolve(uiconf);
   })
   .fail(function() {
    defer.reject(new Error());
   })
  return defer.promise

 };
 /*
 ControllerBrutefir.prototype.getFilterListForSelect = function (filterl, key) {
 	var n = filterl.length;
 	for (var i = 0; i < n; i++) {
 		if (filterl[i].value == key)
 			return filterl[i].label;
 	}

 	return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';

 };

 */
 ControllerBrutefir.prototype.getFilterList = function() {
  var filterfolder = "/data/INTERNAL/brutefirfilters"
   //var filterl = [];
  fs.readdirSync(filterfolder).forEach(file => {
   console.log(file);
  });


 };
 //here we test if the name.ext of filter exists
 ControllerBrutefir.prototype.checkifleftfilterexits = function() {
  var self = this;
  var filterfolder = "/data/INTERNAL/brutefirfilters/";
  var filterfile = self.config.get('leftfilter');
  var filetocheck;
  filetocheck = filterfolder + filterfile;
  console.log(filetocheck)
  var stats;

  try {
   stats = fs.statSync(filetocheck);
   console.log("File exists.");
  } catch (e) {
   console.log("File does not exist.");
   self.commandRouter.pushToastMessage('error', "Wrong left filter name", 'check the spelling or extension');
  }


 };
 //here we test if the name.ext of filter exists
 ControllerBrutefir.prototype.checkifrightfilterexits = function() {
  var self = this;
  var filterfolder = "/data/INTERNAL/brutefirfilters/";
  var filterfile = self.config.get('rightfilter');
  var filetocheck;
  filetocheck = filterfolder + filterfile;
  var
   stats;

  try {
   stats = fs.statSync(filetocheck);
   console.log("File exists.");
  } catch (e) {
   console.log("File does not exist.");
   self.commandRouter.pushToastMessage('error', "Wrong right filter name", 'check the spelling or extension');
  }


 };


 ControllerBrutefir.prototype.getLabelForSelect = function(options, key) {
  var n = options.length;
  for (var i = 0; i < n; i++) {
   if (options[i].value == key)
    return options[i].label;
  }

  return 'VALUE NOT FOUND BETWEEN SELECT OPTIONS!';

 };

 ControllerBrutefir.prototype.setUIConfig = function(data) {
  var self = this;

 };

 ControllerBrutefir.prototype.getConf = function(varName) {
  var self = this;
  //Perform your installation tasks here
 };


 ControllerBrutefir.prototype.setConf = function(varName, varValue) {
  var self = this;
  //Perform your installation tasks here
 };

 ControllerBrutefir.prototype.createBRUTEFIRFile = function() {
  var self = this;

  var defer = libQ.defer();


  try {

   fs.readFile(__dirname + "/brutefir.conf.tmpl", 'utf8', function(err, data) {
    if (err) {
     defer.reject(new Error(err));
     return console.log(err);
    }

    var value;
    var devicevalue;
    var sbauer;
    var input_device = 'Loopback,1';
    var filter_path = "/data/INTERNAL/brutefirfilters/";
    var leftfilter;
    var rightfilter;
    var filterattenuation;
    var n_part = self.config.get('numb_part');
    var num_part = parseInt(n_part);
    var f_size = self.config.get('filter_size');
    var filter_size = parseInt(f_size);
    var filtersizedivided = filter_size / num_part;
    var output_device;

/*
    if (self.config.get('sbauer') === true)
     output_device = "headphones";
    else
*/
 output_device = 'hw:' + self.config.get('alsa_device');

    /*
          if(self.config.get('sbauer')===true)
                        output_device="headphones";
                    else output_device='hw:'+self.config.get('output_device');
    */
    if (self.config.get('leftfilter') == "") {
     leftfilter = "dirac pulse";
     filterattenuation = "0"
    } else leftfilter = filter_path + self.config.get('leftfilter');
    filterattenuation = "6";
    if (self.config.get('rightfilter') == "")
     rightfilter = "dirac pulse",
     filterattenuation = "0"
    else rightfilter = filter_path + self.config.get('rightfilter');
    filterattenuation = "6";
    //output_device = output_device;
    console.log(output_device);
    var conf1 = data.replace("${smpl_rate}", self.config.get('smpl_rate'));
    var conf2 = conf1.replace("${filter_size}", filtersizedivided);
    var conf3 = conf2.replace("${numb_part}", self.config.get('numb_part'));
    var conf4 = conf3.replace("${fl_bits}", self.config.get('fl_bits'));
    var conf5 = conf4.replace("${input_device}", input_device);
    var conf6 = conf5.replace("${input_format}", self.config.get('input_format'));
    var conf7 = conf6.replace("${attenuation1}", self.config.get('attenuation'));
    var conf8 = conf7.replace("${attenuation2}", self.config.get('attenuation'));
    var conf9 = conf8.replace("${leftfilter}", leftfilter);
    var conf10 = conf9.replace("${filter_format1}", self.config.get('filter_format'));
    var conf11 = conf10.replace("${filterattenuation1}", filterattenuation);
    var conf12 = conf11.replace("${rightfilter}", rightfilter);
    var conf13 = conf12.replace("${filter_format2}", self.config.get('filter_format'));
    var conf14 = conf13.replace("${filterattenuation2}", filterattenuation);
    var conf15 = conf14.replace("${output_device}", output_device);
    var conf16 = conf15.replace("${output_format}", self.config.get('output_format'));

    fs.writeFile("/data/configuration/audio_interface/brutefir/volumio-brutefir-config", conf16, 'utf8', function(err) {
     if (err)
      defer.reject(new Error(err));
     else defer.resolve();
    });
    self.checkifleftfilterexits()
    self.checkifrightfilterexits()
   });


  } catch (err) {


  }

  return defer.promise;

 };

 //here we save the equalizer settings
 ControllerBrutefir.prototype.saveBrutefirconfigAccount1 = function(data) {
  var self = this;
  var defer = libQ.defer();
  self.config.set('enablemyeq', data['enablemyeq']);
  self.config.set('eqprofile', data['eqprofile'].value);
  self.config.set('coef', data['coef']);

  //	self.config.set('phas', data['phas']);

  self.logger.info('Equalizer Configurations have been set');

  self.commandRouter.pushToastMessage('success', "Configuration update", 'Brutefir new equalizer successfully applied');

  self.brutefirDaemonConnect(defer);
  return defer.promise;
 };

//here we save the equalizer preset
 ControllerBrutefir.prototype.saveequalizerpreset = function(data) {
  var self = this;
  var defer = libQ.defer();
 // self.config.set('enablepreset', data['enablepreset']);
  self.config.set('mypreset1', data['mypreset1']);
  self.config.set('mypreset2', data['mypreset2']);
  self.config.set('mypreset3', data['mypreset3']);
  self.logger.info('Equalizer preset saved');
  self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('COMMON.CONFIGURATION_UPDATE_DESCRIPTION'));
  return defer.promise;
 };


 //here we save the brutefir config.json
 ControllerBrutefir.prototype.saveBrutefirconfigAccount2 = function(data) {
  var self = this;
  var output_device
  var input_device = "Loopback,1";

  output_device = self.config.get('alsa_device');
  var defer = libQ.defer();
  self.config.set('attenuation', data['attenuation'].value);
  self.config.set('smpl_rate', data['smpl_rate'].value);
  self.config.set('leftfilter', data['leftfilter']);
  self.config.set('rightfilter', data['rightfilter']);
  self.config.set('filter_format', data['filter_format'].value);
  self.config.set('filter_size', data['filter_size'].value);
  self.config.set('numb_part', data['numb_part'].value);
  self.config.set('fl_bits', data['fl_bits'].value);
  self.config.set('input_device', data['input_device']);
  self.config.set('input_format', data['input_format'].value);
  self.config.set('output_device', data['output_device']);
  self.config.set('output_format', data['output_format'].value);

  self.rebuildBRUTEFIRAndRestartDaemon()
   .then(function(e) {
    self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
    defer.resolve({});
   })
   .fail(function(e) {

    defer.reject(new Error('Brutefir failed to start. Check your config !'));
    self.commandRouter.pushToastMessage('error', 'Brutefir failed to start. Check your config !');
   })


  return defer.promise;


 };
 ControllerBrutefir.prototype.rebuildBRUTEFIRAndRestartDaemon = function() {
  var self = this;
  var defer = libQ.defer();
  self.createBRUTEFIRFile()
   .then(function(e) {
    var edefer = libQ.defer();
    exec("/usr/bin/sudo /bin/systemctl restart brutefir.service", {
     uid: 1000,
     gid: 1000
    }, function(error, stdout, stderr) {
     if (error) {
      //	self.logger.error('Cannot Enable brutefir');
      self.commandRouter.pushToastMessage('error', 'Brutefir failed to start. Check your config !', 'Output, filters name');
     } else {
      //self.logger.error('Brutefir started ! ');
      self.commandRouter.pushToastMessage('success', 'Attempt to start Brutefir...');
     }
     edefer.resolve();
    });

    return edefer.promise;
   })
   .then(self.startBrutefirDaemon.bind(self))
   .then(function(e) {
    setTimeout(function() {
      self.logger.info("Connecting to daemon");
      self.brutefirDaemonConnect(defer);
     }, 2000)
     .fail(function(e) {
      //	defer.reject(new Error('Brutefir failed to start. Check your config !'));
      self.commandRouter.pushToastMessage('error', "Brutefir failed to start. Check your config !", "Wrong Ouptut or filter name ?");
      self.logger.info("Brutefir failed to start. Check your config !");
     });
   });

  return defer.promise;
 };

 ControllerBrutefir.prototype.setVolumeParameters = function() {
  var self = this;
  // here we set the volume controller in /volumio/app/volumecontrol.js
  // we need to do it since it will be automatically set to the loopback device by alsa controller
  // to retrieve those values we need to save the configuration of the system, found in /data/configuration/audio_interface/alsa_controller/config.json
  // before enabling the loopback device. We do this in saveHardwareAudioParameters(), which needs to be invoked just before brutefir is enabled
  setTimeout(function() {
   //  return new Promise(function(resolve, reject) { 
   //var defer = libQ.defer();
   var settings = {
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
    volumesteps: self.config.get('alsa_volumesteps')
   }
   console.log(settings)
    // once completed, uncomment

   return self.commandRouter.volumioUpdateVolumeSettings(settings)
    //setTimeout(function() {      
    //resolve();
  }, 5000);
  //});
  // return defer.promise;
 };

 ControllerBrutefir.prototype.saveHardwareAudioParameters = function() {
  var self = this;
  var defer = libQ.defer();

  var conf;
  // we save the alsa configuration for future needs here, note we prepend alsa_ to avoid confusion with other brutefir settings
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

  return defer.promise;

 }

 ControllerBrutefir.prototype.setAdditionalConf = function(type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'setConfigParam', data);
 };

ControllerBrutefir.prototype.outputDeviceCallback = function() {
  var self = this;
  var defer = libQ.defer();
  //  self.context.coreCommand.pushConsoleMessage('wwwwwwwwwwwwwwwwWWWWWWWWWWWWWWWWwwwwwwwwwwwWWWWWWWWWwwwwwwwwwwWWWWWwwOutput device has changed, continuing config');
//	self.setLoopbackoutput()
  setTimeout(function() {
	self.setVolumeParameters()
  }, 2500);
 	self.restoreVolumioconfig()
//  self.rebuildBRUTEFIRAndRestartDaemon()
 defer.resolve()
  return defer.promise;
 };

 //here we set the Loopback output
 ControllerBrutefir.prototype.setLoopbackoutput = function() {
  var self = this;
  var defer = libQ.defer();
  var outputp
  outputp = self.config.get('alsa_outputdevicename')
  setTimeout(function() {
   var stri = {
    "output_device": {
     "value": "Loopback",
     "label": (outputp + " through brutefir")
    }
   }
   self.commandRouter.executeOnPlugin('system_controller', 'i2s_dacs', 'disableI2SDAC', '');
   return self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'saveAlsaOptions', stri);
  }, 2500);

  return defer.promise;
 };

 //here we restore config of volumio when the plugin is disabled
 ControllerBrutefir.prototype.restoresettingwhendisabling = function() {

  var self = this;
  var output_restored = self.config.get('alsa_device')
  var output_label = self.config.get('alsa_outputdevicename')
  var mixert = self.config.get('alsa_mixer')
  var mixerty = self.config.get('mixer_type')
  var str = {
   "output_device": {
    "value": output_restored,
    "label": output_label
   },
   "mixer": {
    "value": mixert,
    "value": mixerty
   }
  }
  self.commandRouter.executeOnPlugin('system_controller', 'i2s_dacs', 'enableI2SDAC', '');
  return self.commandRouter.executeOnPlugin('audio_interface', 'alsa_controller', 'saveAlsaOptions', str);

 };

 ControllerBrutefir.prototype.getAdditionalConf = function(type, controller, data) {
  var self = this;
  return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
 }
