'use strict';

var libQ = require('kew');
//var fs=require('fs-extra');
var config = new (require('v-conf'))();
//var exec = require('child_process').exec;
const si = require('systeminformation');

// Define the Systeminfo class
module.exports = Systeminfo;



function Systeminfo(context) {
	var self = this;

	// Save a reference to the parent commandRouter
	self.context = context;
	self.commandRouter = self.context.coreCommand;
	self.logger=self.commandRouter.logger;


	 this.context = context;
	 this.commandRouter = this.context.coreCommand;
	 this.logger = this.context.logger;
	 this.configManager = this.context.configManager;

};

Systeminfo.prototype.onVolumioStart = function()
	{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    return libQ.resolve();


};

Systeminfo.prototype.getConfigurationFiles = function()
{
	var self= this;

};




// Plugin methods -----------------------------------------------------------------------------

Systeminfo.prototype.onStop = function() {
	var self = this;

};

Systeminfo.prototype.onStart = function() {
    var self = this;
		var defer=libQ.defer();


			// Once the Plugin has successfull started resolve the promise
			defer.resolve();

		    return defer.promise;
};

// playonconnect stop



Systeminfo.prototype.onRestart = function() {
	var self = this;
	//
};

Systeminfo.prototype.onInstall = function() {
	var self = this;
	//Perform your installation tasks here
};

Systeminfo.prototype.onUninstall = function() {
	var self = this;
};

Systeminfo.prototype.getUIConfig = function() {
	var defer = libQ.defer();
     var self = this;

     var lang_code = this.commandRouter.sharedVars.get('language_code');

     self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
         __dirname+'/i18n/strings_en.json',
         __dirname + '/UIConfig.json')
         .then(function(uiconf)
         {


             defer.resolve(uiconf);
         })
         .fail(function()
         {
             defer.reject(new Error());
         });

     return defer.promise;

};

Systeminfo.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

Systeminfo.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

Systeminfo.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

Systeminfo.prototype.getsysteminfo = function() {
	var self = this;
	var data;
	si.getAllData()
			.then(data => {
	var memtotal = data.mem.total/1024 + ' Ko';
	var memfree = data.mem.free/1024 + ' Ko';
	var memused = data.mem.used/1024 + ' Ko';
	var messages1 = "<br><li>CPU infos</br></li><ul><li>brand: " + data.cpu.brand +"</li><li>Speed: " + data.cpu.speed + "Mhz</li><li>Number of cores: " + data.cpu.cores +"</li><li>Physical cores: " + data.cpu.physicalCores+"</li></ul>";
	var messages2 = "<br><li>Memory infos</br></li><ul><li>Memory: " + memtotal +"</li><li>Free: " + memfree +"</li><li>Used: " + memused+"</li></ul>";
	var messages3 = "<br><li>Board infos</br></li><ul><li>Manufacturer: " + data.system.manufacturer +"</li><li>Model: " + data.system.model +"</li><li>Version: " + data.system.version +"</li></ul>";
	var messages4 = "<br><li>OS infos</br></li><ul><li>Hostname: " + data.os.hostname +"</li><li>kernel: " + data.os.kernel +"</li><li>Governor: " + data.cpu.governor +"</li></ul>";
				var modalData = {
							title: 'System Informations',
							message: messages3 + messages1 + messages2 + messages4,
							size: 'lg',
							buttons: [{
							 name: 'Close',
							 class: 'btn btn-warning'
							}, ]
						 }
					 self.commandRouter.broadcastMessage("openModal", modalData);

			})
			.catch(error => console.error(error));
//console.log(messages);

};
