'use strict';

var libQ = require('kew');
var fs = require('fs-extra');
var libFsExtra = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
const si = require('systeminformation');
var spawn = require('child_process').spawn;
// Define the Systeminfo class
module.exports = Systeminfo;



function Systeminfo(context) {
   var self = this;

   // Save a reference to the parent commandRouter
   self.context = context;
   self.commandRouter = self.context.coreCommand;
   self.logger = self.commandRouter.logger;


   this.context = context;
   this.commandRouter = this.context.coreCommand;
   this.logger = this.context.logger;
   this.configManager = this.context.configManager;

};

Systeminfo.prototype.onVolumioStart = function () {
   var self = this;
   var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
   this.config = new (require('v-conf'))();
   this.config.loadFile(configFile);

   return libQ.resolve();


};

Systeminfo.prototype.getConfigurationFiles = function () {
   var self = this;
   return ['config.json'];
};




// Plugin methods -----------------------------------------------------------------------------

Systeminfo.prototype.onStop = function () {
   var self = this;
   var defer = libQ.defer();
   defer.resolve();
   return defer.promise;
};

Systeminfo.prototype.onStart = function () {
   var self = this;
   var defer = libQ.defer();


   // Once the Plugin has successfull started resolve the promise
   defer.resolve();

   return defer.promise;
};

// playonconnect stop



Systeminfo.prototype.onRestart = function () {
   var self = this;
   //
};

Systeminfo.prototype.onInstall = function () {
   var self = this;
   //Perform your installation tasks here
};

Systeminfo.prototype.onUninstall = function () {
   var self = this;
};

Systeminfo.prototype.getUIConfig = function () {
   var defer = libQ.defer();
   var self = this;

   var lang_code = this.commandRouter.sharedVars.get('language_code');

   self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
      __dirname + '/i18n/strings_en.json',
      __dirname + '/UIConfig.json')
      .then(function (uiconf) {


         defer.resolve(uiconf);
      })
      .fail(function () {
         defer.reject(new Error());
      });

   return defer.promise;

};

Systeminfo.prototype.setUIConfig = function (data) {
   var self = this;
   //Perform your installation tasks here
};

Systeminfo.prototype.getConf = function (varName) {
   var self = this;
   //Perform your installation tasks here
};

Systeminfo.prototype.setConf = function (varName, varValue) {
   var self = this;
   //Perform your installation tasks here
};


//here we detect hw info
Systeminfo.prototype.hwinfo = function () {
   var self = this;
   var nchannels;
   var hwinfo;
   var samplerates, probesmplerates;
   fs.readFile('/data/configuration/audio_interface/alsa_controller/config.json', 'utf8', function (err, config) {
      if (err) {
         self.logger.info('Error reading config.json', err);
      } else {
         try {
            const hwinfoJSON = JSON.parse(config);
            var cmixt = hwinfoJSON.mixer_type.value;
            var cout = hwinfoJSON.outputdevicename.value
            var output_device = hwinfoJSON.outputdevice.value
            console.log('AAAAAAAAAAAAAAAAAAAAAAAAAA-> ' + output_device + ' <-AAAAAAAAAAAAA');

            self.config.set('cmixt', cmixt);
            self.config.set('cout', cout);



            exec('/data/plugins/miscellanea/Systeminfo/hw_params hw:' + output_device + ' >/data/configuration/miscellanea/Systeminfo/config.json ', {
               uid: 1000,
               gid: 1000
            }, function (error, stdout, stderr) {
               if (error) {
                  self.logger.info('failed ' + error);
                  self.commandRouter.pushToastMessage('error', 'Audio Hardware detection seems to fail  !', 'Do not play music or equalizer while probing system and retry');
               } else {

                  fs.readFile('/data/configuration/miscellanea/Systeminfo/config.json', 'utf8', function (err, hwinfo) {
                     if (err) {
                        self.logger.info('Error reading config', err);
                     } else {
                        try {
                           const hwinfoJSON = JSON.parse(hwinfo);
                           nchannels = hwinfoJSON.channels.value;
                           samplerates = hwinfoJSON.samplerates.value;
                           console.log('AAAAAAAAAAAAAAAAAAAAAAAAAA-> ' + nchannels + ' <-AAAAAAAAAAAAA');
                           console.log('AAAAAAAAAAAAAAAAAAAAAAAAAA-> ' + samplerates + ' <-AAAAAAAAAAAAA');
                           self.config.set('nchannels', nchannels);
                           self.config.set('smpl_rate', samplerates);
                           //    var output_format = formats.split(" ").pop();
                        } catch (e) {
                           self.logger.info('Error reading Systeminfo/config.json, detection failed', e);

                        }
                     }
                  });
               }
            })
         } catch (e) {
            self.logger.info('Error reading config.json, detection failed', e);
         }
      }
   });

};


//here we detect the firmware version for the rpi
Systeminfo.prototype.firmwareversion = function () {
   var self = this;
   var firmware;
   try {
      exec("/bin/echo volumio | /usr/bin/sudo -S /data/plugins/miscellanea/Systeminfo/firmware.sh >/data/configuration/miscellanea/Systeminfo/firmware.json", { uid: 1000, gid: 1000 }, function (error, stdout, stderr) {
         if (error) {
            self.logger.info('failed ' + error);
            self.commandRouter.pushToastMessage('error', 'firmware detection failed');
            firmware = 'not applicable';
         } else {

            fs.readFile('/data/configuration/miscellanea/Systeminfo/firmware.json', 'utf8', function (err, firmware) {
               if (err) {
                  self.logger.info('Error reading config', err);
               } else {
                  try {
                     const hwinfoJSON = JSON.parse(firmware);
                     firmware = hwinfoJSON.firmware.value;
                     console.log('AAAAAAAAAAAAAAAAAAAAAAAAAA-> ' + firmware + ' <-AAAAAAAAAAAAA');
                     self.config.set('firmware', firmware);

                  } catch (e) {
                     self.logger.info('Error reading Systeminfo/firmware.json, detection failed', e);

                  }
               }
            });
         }
      })
   } catch (e) {
      self.logger.info('Error reading firmware.json, detection failed', e);
   }


};
//here we detect the temperature for the cpu
Systeminfo.prototype.temperature = function () {
   var self = this;
   var temperature;
   var roundtemp;
   exec("/bin/cat /sys/class/thermal/thermal_zone0/temp", function (error, stdout, stderr) {
      if (error) {
         self.logger.info('failed ' + error);
         self.commandRouter.pushToastMessage('error', 'temperature detection failed');
         roundtemp = 'not applicable';
      } else {
         roundtemp = (stdout / 1000).toFixed(0)
         console.log('BBBBBBBBBBBBBB-CPU Temp ' + roundtemp + ' °C');
         self.config.set('temperature', roundtemp);
      }
   })
};

//local storage probe
Systeminfo.prototype.storages = function () {
   var self = this;
   var storages;
   exec("/bin/df -hBM --output=size,used,avail /data | /usr/bin/tail -1", function (error, stdout, stderr) {
      if (error) {
         self.logger.info('failed ' + error);
         self.commandRouter.pushToastMessage('error', 'storage detection failed');
         storages = 'not applicable';
      } else {


         while (stdout.charAt(0) === ' ') {

            stdout = stdout.substr(1).replace(/  /g, ' ');
            console.log('Storage info ' + stdout);
            self.config.set('storages', stdout);
         }

      }
   })
};

Systeminfo.prototype.getsysteminfo = function () {
   var self = this;
   var data;
   self.hwinfo();
   self.firmwareversion();
   self.temperature();
   self.storages();
   si.getAllData()
      .then(data => {

         //memory
         var memtotal = data.mem.total / 1024 + ' Ko';
         var memfree = data.mem.free / 1024 + ' Ko';
         var memused = data.mem.used / 1024 + ' Ko';

         //local storage
         var storages = self.config.get('storages');
         var fields = storages.split(' ');
         var size = fields[0];
         var used = fields[1];
         var avail = fields[2];
         var savail = avail.slice(0, -2)
         var ssize = size.slice(0, -1)
         var pcent = ((savail / ssize) * 100).toFixed(0);
         console.log('internal       ' + avail + '   ' + savail);

         //human readable uptime
         var uptime = data.time.uptime;
         var seconds = parseInt(uptime, 10);
         var days = Math.floor(seconds / (3600 * 24));
         seconds -= days * 3600 * 24;
         var hrs = Math.floor(seconds / 3600);
         seconds -= hrs * 3600;
         var mnts = Math.floor(seconds / 60);
         seconds -= mnts * 60;
         console.log(days + " days, " + hrs + " Hrs, " + mnts + " Minutes, " + seconds + " Seconds");
         var cuptime = (days + " days, " + hrs + " Hrs, " + mnts + " Minutes, " + seconds + " Seconds");

         //audio hw
         var nchannels = self.config.get('nchannels');
         var samplerate = self.config.get('smpl_rate');
         var cmixt = self.config.get('cmixt');
         var cout = self.config.get('cout');
         console.log('output' + cout + 'cmixt' + cmixt);

         //firmware
         var firmware;
         var firm;
         if (self.config.get('firmware') == 'undefined') {
            firmware = 'Available only for RPI'
         } else {
            firmware = self.config.get('firmware')
         };
         //console.log ('MMMMMMMMMMMMMMMMMMMMMMmmm' + firmware);


         //temperature
         var roundtemp = self.config.get('temperature');

         //messages generation
         var messages1 = "<br><li>Board info</br></li><ul><li>Manufacturer: " + data.system.manufacturer + "</li><li>Model: " + data.system.model + "</li><li>Version: " + data.system.version + "</li><li>Firmware Version: " + firmware + "</li></ul>";

         var messages2 = "<br><li>CPU info</br></li><ul><li>Brand: " + data.cpu.brand + "</li><li>Speed: " + data.cpu.speed + "Ghz</li><li>Number of cores: " + data.cpu.cores + "</li><li>Physical cores: " + data.cpu.physicalCores + "</li><li>Average load: " + (data.currentLoad.avgLoad * 100).toFixed(0) + "%</li><li>Temperature: " + roundtemp + "°C</li></ul>";

         var messages3 = "<br><li>Memory info</br></li><ul><li>Memory: " + memtotal + "</li><li>Free: " + memfree + "</li><li>Used: " + memused + "</li></ul>";

         var sysversionf = self.commandRouter.executeOnPlugin('system_controller', 'system', 'getSystemVersion', '')
         sysversionf.then((info) => {
            try {
               var result = info.systemversion

               var messages4 = "<br><li>OS info</br></li><ul><li>Version of Volumio: " + result + "</li><li>Hostname: " + data.os.hostname + "</li><li>Kernel: " + data.os.kernel + "</li><li>Governor: " + data.cpu.governor + "</li><li>Uptime: " + cuptime + "</li></ul>";

               //var messages5 = "<br><li>Disks infos</br></li><ul><li>Disks: " + data.fsSize.size +"</li><li>Size: " + data.fsSize.size +"</li><li>Used: " + data.fsSize.use+"</li></ul>";

               var messages6 = "<br><li>Audio info</br></li><ul><li>Hw audio configured: " + cout + "</li><li>Mixer type: " + cmixt + "</li><li>Number of channels: " + nchannels + "</li><li>Supported sample rate: " + samplerate + "</li></ul>";
               var messages7 = "<br><li>Storage info</br></li><ul><li>INTERNAL storage - Size: " + size + "o </li><li>Used: " + used + "o </li><li>Available for storage: " + savail + "Mo (" + pcent + "%) </li></ul>";

               var modalData = {
                  title: 'System Information',
                  message: messages4 + messages6 + messages1 + messages2 + messages3 + messages7,
                  size: 'lg',
                  buttons: [{
                     name: 'Close',
                     class: 'btn btn-warning',
                     emit: 'closeModals',
                     payload: ''
                  },]
               }
               self.commandRouter.broadcastMessage("openModal", modalData);

               console.log(result);
            } catch (e) {
               self.logger.error('Could not establish connection with Push Updates Facility: ' + e);
            }
         });


      })

      //console.log(data);

      .catch(error => console.error(error));



};
