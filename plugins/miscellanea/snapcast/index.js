'use strict';

var libQ = require('kew');
var libNet = require('net');
var fs = require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var net = require('net');
var JsonSocket = require('json-socket');

var io = require('socket.io-client');
var socket = io.connect('http://localhost:3000');
var volume = 0;
var clients = [];
var groups = [];
var streams = [];

var NDJSON = true;

// Define the ControllerSnapCast class
module.exports = ControllerSnapCast;

function ControllerSnapCast(context) 
{
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

};

ControllerSnapCast.prototype.onVolumioStart = function()
{
	var self = this;
	self.logger.info("SnapCast initiated");
	
	this.configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	self.getConf(this.configFile);
		
	return libQ.resolve();	
};

ControllerSnapCast.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
};

// Plugin methods -----------------------------------------------------------------------------
ControllerSnapCast.prototype.onStop = function() {
	var self = this;
	var defer = libQ.defer();

	self.stopService('snapserver')
	.then(function(stopClient){
		self.stopService('snapclient');
		defer.resolve();
	})
	.fail(function(e)
	{
		defer.reject(new error());
	});

	return defer.promise;
};

ControllerSnapCast.prototype.stop = function() {
	var self = this;
	var defer = libQ.defer();

	self.stopService('snapserver')
	.then(function(stopClient){
		self.stopService('snapclient');
		defer.resolve();
	})
	.fail(function(e)
	{
		defer.reject(new error());
	});

	return defer.promise;
};

ControllerSnapCast.prototype.onStart = function() {
	var self = this;
	var defer = libQ.defer();
	self.logger.info("Starting SnapCast services...");
	var host = self.config.get('volumio_host');
		if(self.config.get('custom_host'))
			host = self.config.get('host');
		
	self.getSnapServerClientsAndGroups(host);

	self.restartService('snapserver', true)
	.then(function(startClient){
		self.restartService('snapclient', true);
	})
	.then(function(binding){
		socket.on('pushState', function (data) {
			self.updateVolume(data);
		});
		defer.resolve();
	})
	.fail(function(e)
	{
		self.commandRouter.pushToastMessage('error', "Startup failed", "Could not start the SnapCast plugin in a fashionable manner.");
		self.logger.info("Could not start the SnapCast plugin in a fashionable manner.");
		defer.reject(new error());
	});

	return defer.promise;
};

ControllerSnapCast.prototype.onRestart = function() 
{
	// Do nothing
	self.logger.info("performing onRestart action");
	
	var self = this;
};

ControllerSnapCast.prototype.onInstall = function() 
{
	self.logger.info("performing onInstall action");
	
	var self = this;
};

ControllerSnapCast.prototype.onUninstall = function() 
{
	// Perform uninstall tasks here!
};

ControllerSnapCast.prototype.getUIConfig = function() {
    var self = this;
	var defer = libQ.defer();    
    var lang_code = this.commandRouter.sharedVars.get('language_code');
	var host = self.config.get('volumio_host');
		if(self.config.get('custom_host'))
			host = self.config.get('host');

	self.getConf(this.configFile);
	self.logger.info("Loaded the previous config.");
	
	var ratesdata = fs.readJsonSync((__dirname + '/options/sample_rates.json'),  'utf8', {throws: false});
	var bitdephtdata = fs.readJsonSync((__dirname +'/options/bit_depths.json'),  'utf8', {throws: false});
	var codecdata = fs.readJsonSync((__dirname + '/options/codecs.json'),  'utf8', {throws: false});
	var kbpsdata = fs.readJsonSync((__dirname + '/options/kbps_spotify.json'),  'utf8', {throws: false});
	var spotify = fs.readJsonSync((__dirname + '/options/spotify_implementations.json'),  'utf8', {throws: false});
	
	var volumioInstances = self.getVolumioInstances();
	
	self.getSnapServerClientsAndGroups(host);	
	//self.logger.info("INSTANCES: " + JSON.stringify(volumioInstances));
	var soundcards = self.getAlsaCards();
	//self.logger.info(JSON.stringify(soundcards));
	
	
	self.commandRouter.i18nJson(__dirname+'/i18n/strings_' + lang_code + '.json',
		__dirname + '/i18n/strings_en.json',
		__dirname + '/UIConfig.json')
    .then(function(uiconf)
    {
		self.logger.info("## populating UI...");
		
		// Server settings
		uiconf.sections[0].content[0].value = self.config.get('server_enabled');
		uiconf.sections[0].content[1].value = self.config.get('mpd_pipe_name');		
		for (var n = 0; n < ratesdata.sample_rates.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[2].options', {
				value: ratesdata.sample_rates[n].rate,
				label: ratesdata.sample_rates[n].name
			});
			
			if(ratesdata.sample_rates[n].rate == parseInt(self.config.get('sample_rate')))
			{
				uiconf.sections[0].content[2].value.value = ratesdata.sample_rates[n].rate;
				uiconf.sections[0].content[2].value.label = ratesdata.sample_rates[n].name;
			}
		}
		
		for (var n = 0; n < bitdephtdata.bit_depths.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[3].options', {
				value: bitdephtdata.bit_depths[n].bits,
				label: bitdephtdata.bit_depths[n].name
			});
			
			if(bitdephtdata.bit_depths[n].bits == parseInt(self.config.get('bit_depth')))
			{
				uiconf.sections[0].content[3].value.value = bitdephtdata.bit_depths[n].bits;
				uiconf.sections[0].content[3].value.label = bitdephtdata.bit_depths[n].name;
			}
		}
		
		uiconf.sections[0].content[4].value = self.config.get('channels');
		
		for (var n = 0; n < codecdata.codecs.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[0].content[5].options', {
				value: codecdata.codecs[n].extension,
				label: codecdata.codecs[n].name
			});
			
			if(codecdata.codecs[n].extension == self.config.get('codec'))
			{
				uiconf.sections[0].content[5].value.value = codecdata.codecs[n].extension;
				uiconf.sections[0].content[5].value.label = codecdata.codecs[n].name;
			}
		}
		
		uiconf.sections[0].content[6].value = self.config.get('server_cli');
		self.logger.info("1/7 server settings loaded");
		
		// Client settings
		uiconf.sections[1].content[0].value = self.config.get('client_enabled');
		for (var n = 0; n < volumioInstances.list.length; n++){			
			if(volumioInstances.list[n].isSelf == true)
			{
				self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[1].options', {
					value: '127.0.0.1',
					label: 'Localhost [default]'
				});				
			}
			else
			{
				self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[1].options', {
					value: volumioInstances.list[n].host.replace('http://', ''),
					label: volumioInstances.list[n].name
				});
			}
			
			if(volumioInstances.list[n].host.replace('http://', '') == self.config.get('volumio_host'))
			{
				uiconf.sections[1].content[1].value.value = volumioInstances.list[n].host.replace('http://', '');
				uiconf.sections[1].content[1].value.label = volumioInstances.list[n].name;
			}
		}
		uiconf.sections[1].content[2].value = self.config.get('custom_host');
		uiconf.sections[1].content[3].value = self.config.get('host');
		
		for (var n = 0; n < soundcards.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[1].content[4].options', {
				value: soundcards[n].hw,
				label: soundcards[n].name
			});
			
			if(soundcards[n].hw == self.config.get('soundcard'))
			{
				uiconf.sections[1].content[4].value.value = soundcards[n].hw;
				uiconf.sections[1].content[4].value.label = soundcards[n].name;
			}
		}
		
		uiconf.sections[1].content[5].value = self.config.get('custom_host_id');
		uiconf.sections[1].content[6].value = self.config.get('host_id');
		uiconf.sections[1].content[7].value = self.config.get('client_cli');
		self.logger.info("2/7 client settings loaded");
		
		// MPD settings
		uiconf.sections[2].content[0].value = self.config.get('patch_mpd_conf');
		
		for (var n = 0; n < ratesdata.sample_rates.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[2].content[1].options', {
				value: ratesdata.sample_rates[n].rate,
				label: ratesdata.sample_rates[n].name
			});
			
			if(ratesdata.sample_rates[n].rate == parseInt(self.config.get('mpd_sample_rate')))
			{
				uiconf.sections[2].content[1].value.value = ratesdata.sample_rates[n].rate;
				uiconf.sections[2].content[1].value.label = ratesdata.sample_rates[n].name;
			}
		}
		
		for (var n = 0; n < bitdephtdata.bit_depths.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[2].content[2].options', {
				value: bitdephtdata.bit_depths[n].bits,
				label: bitdephtdata.bit_depths[n].name
			});
			
			if(bitdephtdata.bit_depths[n].bits == parseInt(self.config.get('mpd_bit_depth')))
			{
				uiconf.sections[2].content[2].value.value = bitdephtdata.bit_depths[n].bits;
				uiconf.sections[2].content[2].value.label = bitdephtdata.bit_depths[n].name;
			}
		}
		
		uiconf.sections[2].content[3].value = self.config.get('mpd_channels');		
		uiconf.sections[2].content[4].value = self.config.get('enable_alsa_mpd');
		uiconf.sections[2].content[5].value = self.config.get('enable_fifo_mpd');
		self.logger.info("3/7 MPD settings loaded");
		
		// Patch asound
		uiconf.sections[3].content[0].value = '/etc/asound.conf';
		self.logger.info("4/7 asound settings loaded");
		
		// Spotify settings		
		uiconf.sections[4].content[0].value = self.config.get('spotify_dedicated_stream');
		uiconf.sections[4].content[1].value = self.config.get('spotify_pipe_name');
		
		for (var n = 0; n < spotify.implementations.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[4].content[2].options', {
				value: spotify.implementations[n].type,
				label: spotify.implementations[n].name
			});
			
			if(spotify.implementations[n].type == self.config.get('spotify_implementation'))
			{
				uiconf.sections[4].content[2].value.value = spotify.implementations[n].type;
				uiconf.sections[4].content[2].value.label = spotify.implementations[n].name;
			}
		}
		
		for (var n = 0; n < ratesdata.sample_rates.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[4].content[3].options', {
				value: ratesdata.sample_rates[n].rate,
				label: ratesdata.sample_rates[n].name
			});
			
			if(ratesdata.sample_rates[n].rate == parseInt(self.config.get('spotify_sample_rate')))
			{
				uiconf.sections[4].content[3].value.value = ratesdata.sample_rates[n].rate;
				uiconf.sections[4].content[3].value.label = ratesdata.sample_rates[n].name;
			}
		}
		
		for (var n = 0; n < bitdephtdata.bit_depths.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[4].content[4].options', {
				value: bitdephtdata.bit_depths[n].bits,
				label: bitdephtdata.bit_depths[n].name
			});
			
			if(bitdephtdata.bit_depths[n].bits == parseInt(self.config.get('spotify_bit_depth')))
			{
				uiconf.sections[4].content[4].value.value = bitdephtdata.bit_depths[n].bits;
				uiconf.sections[4].content[4].value.label = bitdephtdata.bit_depths[n].name;
			}
		}
		
		uiconf.sections[4].content[5].value = self.config.get('spotify_channels');
		uiconf.sections[4].content[6].value = self.config.get('expose_additional_spotify_settings');
		uiconf.sections[4].content[7].value = self.config.get('librespot_location');
		uiconf.sections[4].content[8].value = self.config.get('spotify_username');
		uiconf.sections[4].content[9].value = self.config.get('spotify_password');
		uiconf.sections[4].content[10].value = self.config.get('spotify_devicename');
		
		for (var n = 0; n < kbpsdata.kbps.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[4].content[11].options', {
				value: kbpsdata.kbps[n].bits,
				label: kbpsdata.kbps[n].name
			});
			
			if(kbpsdata.kbps[n].bits == parseInt(self.config.get('spotify_bitrate')))
			{
				uiconf.sections[4].content[11].value.value = kbpsdata.kbps[n].bits;
				uiconf.sections[4].content[11].value.label = kbpsdata.kbps[n].name;
			}
		}
		self.logger.info("5/7 spotify settings loaded");

		// Patch templates
		uiconf.sections[5].content[0].value = self.config.get('spotify_implementation');
		self.logger.info("6/7 template settings loaded");

		// Snap environment info
		self.configManager.pushUIConfigParam(uiconf, 'sections[6].content[0].options', {value: '', label: 'Disable volume update'});			
		for (var n = 0; n < clients.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[6].content[0].options', {
				value: clients[n].id,
				label: clients[n].name
			});
			
			self.configManager.pushUIConfigParam(uiconf, 'sections[6].content[2].options', {
				value: clients[n].id,
				label: clients[n].name
			});

			if(clients[n].id == self.config.get('client_id'))
			{
				uiconf.sections[6].content[0].value.value = clients[n].id;
				uiconf.sections[6].content[0].value.label = clients[n].name;
			}
			else if (self.config.get('client_id') == '')
			{
				uiconf.sections[6].content[0].value.value = '';
				uiconf.sections[6].content[0].value.label = 'Disable volume update';
			}
		}

		for (var n = 0; n < streams.length; n++){
			self.configManager.pushUIConfigParam(uiconf, 'sections[6].content[3].options', {
				value: streams[n].id,
				label: streams[n].id
			});
		}

		// Volumio info
		var soundcard = 'No card match';
		for(var i = 0; i < soundcards.length; i++) {
			if (soundcards[i].id == self.commandRouter.sharedVars.get('alsa.outputdevice')) {
				soundcard = soundcards[i].name;
				break;
			}
		}
		uiconf.sections[7].content[0].value = soundcard;
		uiconf.sections[7].content[1].value = self.commandRouter.sharedVars.get('alsa.outputdevicemixer');
		// self.logger.info("ALSA.OutputDevice: " + self.commandRouter.sharedVars.get('alsa.outputdevice') + " ALSA.OutputDeviceMixer: " + self.commandRouter.sharedVars.get('alsa.outputdevicemixer'));
		self.logger.info("7/7 environment settings loaded");
		
		self.logger.info("Populated config screen.");
		
		defer.resolve(uiconf);
	})
	.fail(function()
	{
		defer.reject(new Error());
	});

	return defer.promise;
};

ControllerSnapCast.prototype.setUIConfig = function(data) {
	var self = this;
	
	self.logger.info("Updating UI config");
	var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');
	
	return libQ.resolve();
};

ControllerSnapCast.prototype.getConf = function(configFile) {
	var self = this;
	this.config = new (require('v-conf'))()
	this.config.loadFile(configFile)
	
	return libQ.resolve();
};

ControllerSnapCast.prototype.setConf = function(conf) {
	var self = this;
	return libQ.resolve();
};

// Public Methods ---------------------------------------------------------------------------------------

ControllerSnapCast.prototype.getAdditionalConf = function (type, controller, data) {
	var self = this;
	return self.commandRouter.executeOnPlugin(type, controller, 'getConfigParam', data);
};

ControllerSnapCast.prototype.restartService = function (serviceName, boot)
{
	var self = this;
	var defer=libQ.defer();

	if((serviceName == 'snapserver' && self.config.get('server_enabled')) || (serviceName == 'snapclient' && self.config.get('client_enabled')) || serviceName == 'mpd')
	{
		var command = "/usr/bin/sudo /bin/systemctl restart " + serviceName;
		
		exec(command, {uid:1000,gid:1000}, function (error, stdout, stderr) {
			if (error !== null) {
				self.commandRouter.pushConsoleMessage('The following error occurred while starting ' + serviceName + ': ' + error);
				self.commandRouter.pushToastMessage('error', "Restart failed", "Restarting " + serviceName + " failed with error: " + error);
				defer.reject();
			}
			else {
				self.commandRouter.pushConsoleMessage(serviceName + ' started');
				if(boot == false)
					self.commandRouter.pushToastMessage('success', "Restarted " + serviceName, "Restarted " + serviceName + " for the changes to take effect.");
				
				defer.resolve();
			}
		});
	}
	else
	{
		self.logger.info("Not starting " + serviceName + "; it's not enabled.");
		defer.resolve();
	}

	return defer.promise;
};

ControllerSnapCast.prototype.stopService = function (serviceName)
{
	var self = this;
	var defer=libQ.defer();

	var command = "/usr/bin/sudo /bin/systemctl stop " + serviceName;
	
	exec(command, {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while stopping ' + serviceName + ': ' + error);
			self.commandRouter.pushToastMessage('error', "Stopping service failed", "Stopping " + serviceName + " failed with error: " + error);
			defer.reject();
		}
		else {
			self.commandRouter.pushConsoleMessage(serviceName + ' stopped');
			self.commandRouter.pushToastMessage('success', "Stopping", "Stopped " + serviceName + ".");
			defer.resolve();
		}
	});

	return defer.promise;
};

ControllerSnapCast.prototype.updateBootConfig = function (data) 
{
	var self = this;	
	var defer = libQ.defer();	

	return defer.promise;
};

ControllerSnapCast.prototype.updateSnapServer = function (data)
{
	var self = this;
	var defer = libQ.defer();
	
	self.config.set('server_enabled', data['server_enabled']);
	self.config.set('mpd_pipe_name', data['mpd_pipe_name']);
	self.config.set('sample_rate', data['sample_rate'].value);
	self.config.set('bit_depth', data['bit_depth'].value);
	self.config.set('channels', data['channels']);
	self.config.set('codec', data['codec'].value);
	self.config.set('server_cli', data['server_cli']);
	
	self.logger.info("Successfully updated snapserver configuration");
	
	self.updateSnapServerConfig()
	.then(function (restartService) {
		if(data['server_enabled'] == true)
			self.restartService("snapserver", false);
		else
			self.stopService("snapserver");
	})
	.fail(function(e)
	{
		defer.reject(new error());
	})
	
	return defer.promise;
};

ControllerSnapCast.prototype.updateSnapServerSpotify = function (data)
{
	var self = this;
	var defer = libQ.defer();
	
	self.config.set('spotify_dedicated_stream', data['spotify_dedicated_stream']);
	if(self.config.get('spotify_dedicated_stream'))
		self.config.set('spotify_pipe', '/tmp/spotififo');
	else
		self.config.set('spotify_pipe', '/tmp/snapfifo');
	self.config.set('spotify_pipe_name', data['spotify_pipe_name']);
	self.config.set('spotify_implementation', data['spotify_implementation'].value);
	self.config.set('spotify_sample_rate', data['spotify_sample_rate'].value);
	self.config.set('spotify_bit_depth', data['spotify_bit_depth'].value);
	self.config.set('spotify_channels', data['spotify_channels']);
	self.config.set('expose_additional_spotify_settings', data['expose_additional_spotify_settings']);
	self.config.set('librespot_location', data['librespot_location']);
	self.config.set('spotify_username', data['spotify_username']);
	self.config.set('spotify_password', data['spotify_password']);
	self.config.set('spotify_devicename', data['spotify_devicename']);
	self.config.set('spotify_bitrate', data['spotify_bitrate'].value);
	
	self.logger.info("Successfully updated snapserver spotify configuration");
	
	self.updateSnapServerConfig()
	.then(function (restartService) {
		if(self.config.get('server_enabled') == true)
			self.restartService("snapserver", false);
		else
			self.stopService("snapserver");
	})
	.fail(function(e)
	{
		defer.reject(new error());
	})
	
	return defer.promise;
};

ControllerSnapCast.prototype.updateSnapClient = function (data)
{
	var self = this;
	var defer = libQ.defer();
	
	self.config.set('client_enabled', data['client_enabled']);
	self.config.set('volumio_host', data['volumio_host'].value);
	self.config.set('custom_host', data['custom_host']);
	self.config.set('host', data['host']);
	self.config.set('soundcard', data['soundcard'].value);
	self.config.set('custom_host_id', data['custom_host_id']);
	self.config.set('host_id', data['host_id']);
	self.config.set('client_cli', data['client_cli']);
	
	self.logger.info("Successfully updated sound configuration");
	
	self.updateSnapClientConfig(data)
	.then(function (restartService) {
		if(data['client_enabled'] == true)
			self.restartService("snapclient", false);
		else
			self.stopService("snapclient");
	})
	.fail(function(e)
	{
		defer.reject(new error());
	})
	
	return defer.promise;
};

ControllerSnapCast.prototype.updateMPDConfig = function (data)
{
	var self = this;
	var defer = libQ.defer();
	
	self.config.set('patch_mpd_conf', data['patch_mpd_conf']);
	self.config.set('mpd_sample_rate', data['mpd_sample_rate'].value);
	self.config.set('mpd_bit_depth', data['mpd_bit_depth'].value);
	self.config.set('mpd_channels', data['mpd_channels']);
	self.config.set('enable_alsa_mpd', data['enable_alsa_mpd']);
	self.config.set('enable_fifo_mpd', data['enable_fifo_mpd']);
	
	if(data['patch_mpd_conf'] == true)
	{
		self.generateMPDUpdateScript()
		.then(function (executeGeneratedScript) {
		 self.executeShellScript(__dirname + '/mpd_switch_to_fifo.sh');
		})
		.then(function (restartMPD) {
			self.restartService('mpd', false);
		})
		.fail(function(e)
		{
			self.commandrouter.pushtoastmessage('error', "script failed", "could not execute script with error: " + error);
			defer.reject(new error());
		})
	}
	else
		self.commandrouter.pushtoastmessage('success', "Not updating", "Not patching mpd.conf");
		
	self.logger.info("Successfully patched mpd.conf");
	
	return defer.promise;
};

ControllerSnapCast.prototype.updateSnapServerConfig = function ()
{
	var self = this;
	var defer = libQ.defer();

	var format = self.config.get('sample_rate') + ':' + self.config.get('bit_depth') + ':' + self.config.get('channels');
	var spotify_format = self.config.get('spotify_sample_rate') + ':' + self.config.get('spotify_bit_depth') + ':' + self.config.get('spotify_channels');
	
	var mpdStreamName = (self.config.get('mpd_pipe_name') == undefined ? 'VOLUMIO-MPD' : self.config.get('mpd_pipe_name'));
	var snapMode = (self.config.get('mode') == undefined ? '\\&mode=read' : '\\&mode=' + self.config.get('mode'));
	var snapFormat = (format == undefined ? '' : '\\&sampleformat=' + format);
	var snapCodec = (self.config.get('codec') == undefined ? '' : '\\&codec=' + self.config.get('codec'));

	var spotifyStreamName = (self.config.get('spotify_pipe_name') == undefined ? 'VOLUMIO-SPOTIFY' : self.config.get('spotify_pipe_name'));
	var spotifyFormat = (spotify_format == undefined ? '' : '\\&sampleformat=' + spotify_format);
	var spotifyDevicename = (self.config.get('spotify_devicename') == undefined ? '' : '\\&devicename=' + self.config.get('spotify_devicename'));
	var spotifyBitrate = (self.config.get('spotify_bitrate') == undefined ? '' : '\\&bitrate=' + self.config.get('spotify_bitrate'));
	
	var cli_commands = (self.config.get('server_cli') == undefined ? '' : self.config.get('server_cli'));

	// Omit defaults
	if(snapFormat == "\\&sampleformat=48000:16:2")
		snapFormat = '';
	if(spotifyFormat == "\\&sampleformat=48000:16:2")
		spotifyFormat = '';
	if(snapCodec == "\\&codec=flac")
		snapCodec = '';

	var mpdPipe = "-s pipe:///tmp/snapfifo?name=" + mpdStreamName + snapMode + snapFormat + snapCodec;
	
	var spotifyPipe = '';
	if(self.config.get('spotify_dedicated_stream'))
		spotifyPipe = " -s pipe:///tmp/spotififo?name=" + spotifyStreamName + snapMode + spotifyFormat;
	else if(self.config.get('spotify_implementation') == "librespot")
		spotifyPipe = " -s spotify://" + self.config.get('librespot_location') + "?name=" + spotifyStreamName + spotifyDevicename + spotifyBitrate;
	
	self.patchAsoundConfig();
	
	// Patch spopd config
	if(self.config.get('spotify_implementation') == 'spop')
	{
		self.replaceStringInFile("output_type", "output_type = raw", "/data/plugins/music_service/spop/spop.conf.tmpl");
		self.replaceStringInFile("output_type", "output_type = raw", "/etc/spopd.conf");
		self.replaceStringInFile("output_name", "output_name = " + self.config.get('spotify_pipe'), "/data/plugins/music_service/spop/spop.conf.tmpl");
		self.replaceStringInFile("output_name", "output_name = " + self.config.get('spotify_pipe'), "/etc/spopd.conf");		
		self.replaceStringInFile("effects", "effects = rate " + self.config.get('spotify_sample_rate') + "; channels " + self.config.get('spotify_channels'), "/data/plugins/music_service/spop/spop.conf.tmpl");
		self.replaceStringInFile("effects", "effects = rate " + self.config.get('spotify_sample_rate') + "; channels " + self.config.get('spotify_channels'), "/etc/spopd.conf");
	}
		
	var command = "/bin/sed -i -- 's|^SNAPSERVER_OPTS.*|SNAPSERVER_OPTS=\"-d " + mpdPipe + spotifyPipe + ' ' + cli_commands + "\"|g' /data/plugins/miscellanea/snapcast/default/snapserver";
	
	exec(command, {uid:1000, gid:1000}, function (error, stout, stderr) {
		if(error)
			console.log(stderr);
		
		defer.resolve();
	});
	
	return defer.promise;
};

ControllerSnapCast.prototype.updateSnapClientConfig = function (data)
{
	var self = this;
	var defer = libQ.defer();
		
	var streamHost = (data['volumio_host'].value == undefined ? "" : " -h " + data['volumio_host'].value);
	if(data['custom_host'] == true)
		streamHost = (data['host'] == undefined ? " -h localhost" : " -h " + data['host']);
	
	var snapSoundCard = " -s ";
	if(data['soundcard'] != undefined)
		if(data['soundcard'].value != "")
			snapSoundCard += data['soundcard'].value;
		else
			snapSoundCard = "";
	else
		snapSoundCard = " -s 0";
	
	var cli_commands = (self.config.get('client_cli') == undefined ? '' : self.config.get('client_cli'));
	
	var hostID = "";
	if(data['custom_host_id'] && data['host_id'] != undefined && data['host_id'] != "")
		hostID = " --hostID " + data['host_id'];
	
	var	command = "/bin/sed -i -- 's|^SNAPCLIENT_OPTS.*|SNAPCLIENT_OPTS=\"-d" + streamHost + snapSoundCard + hostID + ' ' + cli_commands +"\"|g' /data/plugins/miscellanea/snapcast/default/snapclient";
	
	exec(command, {uid:1000, gid:1000}, function (error, stout, stderr) {
		if(error)
			console.log(stderr);
		
		defer.resolve();
	});
	
	return defer.promise;
};

ControllerSnapCast.prototype.generateMPDUpdateScript = function()
{
	var self = this;
	var defer = libQ.defer();
	
	fs.readFile(__dirname + "/templates/mpd_switch_to_fifo.template", 'utf8', function (err, data) {
			if (err) {
				defer.reject(new Error(err));
				//return console.log(err);
			}
			
			var alsa = (self.config.get('enable_alsa_mpd') == true ? "yes" : "no");
			var fifo = (self.config.get('enable_fifo_mpd') == true ? "yes" : "no");

			var conf1 = data.replace("${SAMPLE_RATE}", self.config.get('mpd_sample_rate'));
			var conf2 = conf1.replace("${BIT_DEPTH}", self.config.get('mpd_bit_depth'));
			var conf3 = conf2.replace("${CHANNELS}", self.config.get('mpd_channels'));
			var conf4 = conf3.replace(/ENABLE_ALSA/g, alsa);
			var conf5 = conf4.replace(/ENABLE_FIFO/g, fifo);
			
			fs.writeFile(__dirname + "/mpd_switch_to_fifo.sh", conf5, 'utf8', function (err) {
				if (err)
				{
					self.commandRouter.pushConsoleMessage('Could not write the script with error: ' + err);
					defer.reject(new Error(err));
				}
				else 
					defer.resolve();
			});
		});
		
		return defer.promise;
};

ControllerSnapCast.prototype.patchAsoundConfig = function()
{
	var self = this;
	var defer = libQ.defer();
	var pluginName = "snapcast";
	var pluginCategory = "miscellanea";
	
	// define the replacement dictionary
	var replacementDictionary = [
		{ placeholder: "${SAMPLE_RATE}", replacement: self.config.get('sample_rate') },
		{ placeholder: "${OUTPUT_PIPE}", replacement: self.config.get('spotify_pipe') }
	];
	
	self.createAsoundConfig(pluginName, replacementDictionary)
	.then(function (touchFile) {
		var edefer = libQ.defer();
		exec("/bin/touch /etc/asound.conf", {uid:1000, gid:1000}, function (error, stout, stderr) {
			if(error)
			{
				console.log(stderr);
				self.commandRouter.pushConsoleMessage('Could not touch config with error: ' + error);
				self.commandRouter.pushToastMessage('error', "Configuration failed", "Failed to touch asound configuration file with error: " + error);
				edefer.reject(new Error(error));
			}
			else
				edefer.resolve();
			
			self.commandRouter.pushConsoleMessage('Touched asound config');
			return edefer.promise;
		});
	})
	.then(function (clear_current_asound_config) {
		var edefer = libQ.defer();
		exec("/bin/sed -i -- '/#" + pluginName.toUpperCase() + "/,/#ENDOF" + pluginName.toUpperCase() + "/d' /etc/asound.conf", {uid:1000, gid:1000}, function (error, stout, stderr) {
			if(error)
			{
				console.log(stderr);
				self.commandRouter.pushConsoleMessage('Could not clear config with error: ' + error);
				self.commandRouter.pushToastMessage('error', "Configuration failed", "Failed to update asound configuration with error: " + error);
				edefer.reject(new Error(error));
			}
			else
				edefer.resolve();
			
			self.commandRouter.pushConsoleMessage('Cleared previous asound config');
			return edefer.promise;
		});
	})
	.then(function (copy_new_config) {
		var edefer = libQ.defer();
		var cmd = "/bin/cat /data/plugins/" + pluginCategory + "/" + pluginName + "/asound.section >> /etc/asound.conf\nalsactl -L -R restore";
		fs.writeFile(__dirname + "/" + pluginName.toLowerCase() + "_asound_patch.sh", cmd, 'utf8', function (err) {
			if (err)
			{
				self.commandRouter.pushConsoleMessage('Could not write the script with error: ' + err);
				edefer.reject(new Error(err));
			}
			else
				edefer.resolve();
		});
		
		return edefer.promise;
	})
	.then(function (executeScript) {
		self.executeShellScript(__dirname + '/' + pluginName.toLowerCase() + '_asound_patch.sh');
		defer.resolve();
	});
	
	self.commandRouter.pushToastMessage('success', "Successful push", "Successfully pushed new ALSA configuration");
	return defer.promise;
};

ControllerSnapCast.prototype.createAsoundConfig = function(pluginName, replacements)
{
	var self = this;
	var defer = libQ.defer();
	
	fs.readFile(__dirname + "/templates/asound." + pluginName.toLowerCase(), 'utf8', function (err, data) {
		if (err) {
			defer.reject(new Error(err));
		}

		var tmpConf = data;
		for (var rep in replacements)
		{
			tmpConf = tmpConf.replace(replacements[rep]["placeholder"], replacements[rep]["replacement"]);			
		}
			
		fs.writeFile(__dirname + "/asound.section", tmpConf, 'utf8', function (err) {
				if (err)
				{
					self.commandRouter.pushConsoleMessage('Could not write the script with error: ' + err);
					defer.reject(new Error(err));
				}
				else 
					defer.resolve();
		});
	});
	
	return defer.promise;
};

ControllerSnapCast.prototype.updateSpotifyImplementation = function()
{
	var self = this;
	var defer = libQ.defer();

	var imp = self.config.get('spotify_implementation');

	if(imp == "volspotconnect1")
	{
		//self.replaceStringInFile("--playback_device", "-o snapcast $\\{familyshare\\} \\&", "/data/plugins/music_service/volspotconnect/volspotconnect.tmpl");
		self.appendStringToFile("slave.pcm spotoutf", "updateLine", "/data/plugins/music_service/volspotconnect/asound.tmpl")
		.then(function(addLines){
			// sed -- '/slave.pcm spotoutf/a updateLine' /data/plugins/music_service/volspotconnect/asound.tmpl
			self.appendStringToFile("slave.pcm spotoutf", "updateLine", "/etc/asound.conf");
			defer.resolve(addLines);
		})
		.then(function(editLines){
			// sed -- 's|updateLine|slave.pcm writeFile|g' /data/plugins/music_service/volspotconnect/asound.tmpl
			self.replaceStringInFile("updateLine", "slave.pcm writeFile", "/data/plugins/music_service/volspotconnect/asound.tmpl");
			// sed -- 's|slave.pcm spotoutf|#slave.pcm spotoutf|g' /data/plugins/music_service/volspotconnect/asound.tmpl
			self.replaceStringInFile("slave.pcm spotoutf", "#slave.pcm spotoutf", "/data/plugins/music_service/volspotconnect/asound.tmpl");
			
			self.replaceStringInFile("updateLine", "slave.pcm writeFile", "/etc/asound.conf");
			self.replaceStringInFile("slave.pcm spotoutf", "#slave.pcm spotoutf", "/etc/asound.conf");
			
			defer.resolve(editLines);
		})
		.fail(function()
		{
			defer.reject(new Error());
		});

	}
	else if (imp == "volspotconnect2")
	{
		self.replaceStringInFile("--device ${outdev}", "--backend pipe --device " + self.config.get('spotify_pipe') + " $\\{normalvolume\\} \\", "/data/plugins/music_service/volspotconnect2/volspotconnect2.tmpl");
		defer.resolve();
	}
	else if (imp == "spop")
	{
		self.replaceStringInFile("alsa", "raw", "/data/plugins/music_service/spop/spop.conf.tmpl");
		self.replaceStringInFile("${outdev}", self.config.get('spotify_pipe') + '\\neffects = rate ' + self.config.get('spotify_sample_rate'), "/data/plugins/music_service/spop/spop.conf.tmpl");
		self.replaceStringInFile("output_type", "output_type = raw", "/data/plugins/music_service/spop/spop.conf.tmpl");
		self.replaceStringInFile("output_name", "output_name = " + self.config.get('spotify_pipe'), "/data/plugins/music_service/spop/spop.conf.tmpl");		
		self.replaceStringInFile("effects", "effects = rate " + self.config.get('spotify_sample_rate') + "; channels " + self.config.get('spotify_channels'), "/data/plugins/music_service/spop/spop.conf.tmpl");
		defer.resolve();
	}
	
	var responseData = {
	title: 'Configuration required [no translation available]',
	message: 'Changes have been made to the Spotify implementation template, you need to save the settings in the corresponding plugin again for the changes to take effect. [no translation available]',
	size: 'lg',
	buttons: [{
				name: self.commandRouter.getI18nString('COMMON.CONTINUE'),
				class: 'btn btn-info',
				emit: '',
				payload: ''
			}
		]
	}

	self.commandRouter.broadcastMessage("openModal", responseData);

	return defer.promise;
};

ControllerSnapCast.prototype.updateSnapEnvironment = function(data)
{
	var self = this;
	var defer = libQ.defer();
	
	self.config.set('client_id', data['client_id'].value);
	self.commandRouter.pushToastMessage('success', "Update succeeded", "Successfully pushed new client_id: " + data['client_id'].value);
	
	if(data['switch_stream'])
	{
		if((data['link_client_id'].value != undefined && data['link_client_id'].value != '') && (data['stream_id'].value != undefined && data['stream_id'].value != ''))
		{
			self.setClientStream(self.config.get('host'), data['link_client_id'].value, data['stream_id'].value);		
		}
		else
			self.commandRouter.pushToastMessage('error', "Could not update stream", "Client and/or stream is not defined, please check your selection.");
	}
	
	return defer.resolve();
};

ControllerSnapCast.prototype.executeShellScript = function (shellScript)
{
	var self = this;
	var defer = libQ.defer();

	var command = "/bin/sh " + shellScript;
	self.logger.info("CMD: " + command);
	
	exec(command, {uid:1000, gid:1000}, function (error, stout, stderr) {
		if(error)
		{
			console.log(stderr);
			self.commandRouter.pushConsoleMessage('Could not execute script {' + shellScript + '} with error: ' + error);
		}

		self.commandRouter.pushConsoleMessage('Successfully executed script {' + shellScript + '}');
		self.commandRouter.pushToastMessage('success', "Script executed", "Successfully executed script: " + shellScript);
		defer.resolve();
	});

	
	return defer.promise;
};

ControllerSnapCast.prototype.replaceStringInFile = function (pattern, value, inFile)
{
	var self = this;
	var defer = libQ.defer();
	var castValue;
	
	if(value == true || value == false)
			castValue = ~~value;
	else
		castValue = value;

	var command = "/bin/sed -i -- 's|" + pattern + ".*|" + castValue + "|g' " + inFile;

	exec(command, {uid:1000, gid:1000}, function (error, stout, stderr) {
		if(error)
			console.log(stderr);

		defer.resolve();
	});
	
	return defer.promise;
};

ControllerSnapCast.prototype.appendStringToFile = function (pattern, value, inFile)
{
	var self = this;
	var defer = libQ.defer();
	var castValue;
	
	if(value == true || value == false)
			castValue = ~~value;
	else
		castValue = value;

	var command = "/bin/sed -i -- '/" + pattern + ".*/a " + castValue + "' " + inFile;

	exec(command, {uid:1000, gid:1000}, function (error, stout, stderr) {
		if(error)
			console.log(stderr);

		defer.resolve();
	});
	
	return defer.promise;
};

ControllerSnapCast.prototype.getAlsaCards = function () {
	var self = this;
	var cards = [];
	var multi = false;
	var carddata = fs.readJsonSync(('/volumio/app/plugins/audio_interface/alsa_controller/cards.json'),  'utf8', {throws: false});

	try {
		var soundCardDir = '/proc/asound/';
		var soundFiles = fs.readdirSync(soundCardDir);
		cards.push({id: 99, hw: "", name: "Omit soundcard parameter"});
		
		for (var i = 0; i < soundFiles.length; i++) {

			if (soundFiles[i].indexOf('card') >= 0 && soundFiles[i] != 'cards'){
				var cardnum = soundFiles[i].replace('card', '');
				var cardinfo = self.getCardinfo(cardnum);
				var rawname = cardinfo.name;
				var name = rawname;
				var hw = fs.readFileSync(soundCardDir + soundFiles[i] + '/id').toString().trim();
				var id = cardinfo.id;
					for (var n = 0; n < carddata.cards.length; n++){
						var cardname = carddata.cards[n].name.toString().trim();
						if (cardname === rawname){
							if(carddata.cards[n].multidevice) {
								multi = true;
								var card = carddata.cards[n];
								for (var j = 0; j < card.devices.length; j++) {
									var subdevice = carddata.cards[n].devices[j].number;
									name = carddata.cards[n].devices[j].prettyname;
									cards.push({id: id + ',' + subdevice, name: name});
								}

							} else {
								multi = false;
								name = carddata.cards[n].prettyname;
							}
						}
					} if (!multi){
						cards.push({id: id, hw: hw, name: name});
					}
			}

		}
	} catch (e) {
		self.logger.error('Could not enumerate soundcards, error: ' + e);
		var namestring = 'No Audio Device Available';
		cards.push({id: '', hw: 'ALSA', name: namestring});
	}
	return cards;
};

ControllerSnapCast.prototype.getCardinfo = function (cardnum) {
	var self = this;
	var info = fs.readFileSync('/proc/asound/card'+cardnum+'/pcm0p/info').toString().trim().split('\n');

	for (var e = 0; e < info.length; e++) {
		if (info[e].indexOf('id') >= 0) {
			var infoname = info[e].split(':')[1].replace(' ', '');
		}

	}
	var cardinfo = {'id':cardnum,'name':infoname};
	return cardinfo;
};

ControllerSnapCast.prototype.getVolumioInstances = function () {
	var self = this;
	var results = self.commandRouter.executeOnPlugin('system_controller', 'volumiodiscovery', 'getDevices', '');
	
	return results;
};

ControllerSnapCast.prototype.getSnapServerStatus = function (host, callback) {
	var self = this;
	JsonSocket.sendSingleMessageAndReceive(1705, host, NDJSON, {"id":1,"jsonrpc":"2.0","method":"Server.GetStatus"}, function(err, message) {
		if (err) {
			self.logger.info('An error occurred: ' + err);
		}
		//self.logger.info('Server said: ###' + message + '###');
		
		if(message != undefined)
		{
			var messages = message.toString().split(/\r?\n/);
			messages = messages.filter(function(n){ return n != "" });
			
			for (var msg in messages)
			{
				if( self.isValidJSON(messages[msg]))
				{
					var currMsg = JSON.parse(messages[msg]);
					
					if(currMsg.id == 1)
					{						
						return callback(currMsg);
						break;
					}
				}
			}
		}
	 });
};

ControllerSnapCast.prototype.getSnapServerClientsAndGroups = function (host)
{
	var self = this;	
	self.getSnapServerStatus(host, function(statusMsg) {
		clients = []; // Clear the array before filling it (again)
		groups = [];
		streams = [];
		if(statusMsg != undefined && self.isValidJSON(statusMsg))
		{
			for (var group in statusMsg.result.server.groups)
			{
				for (var client in statusMsg.result.server.groups[group].clients)
				{
					var clientObj = { name: statusMsg.result.server.groups[group].clients[client].host.name + ' [' + statusMsg.result.server.groups[group].clients[client].host.ip + ' - ' + statusMsg.result.server.groups[group].clients[client].host.os + ']'
									, id: statusMsg.result.server.groups[group].clients[client].id };
					clients.push(clientObj);
				}
				
				var groupObj = { name: statusMsg.result.server.groups[group].name, id: statusMsg.result.server.groups[group].id, stream_id: statusMsg.result.server.groups[group].stream_id };
				groups.push(groupObj);
			}
			
			for (var stream in statusMsg.result.server.streams)
			{
				var streamObj = { id: statusMsg.result.server.streams[stream].id, status: statusMsg.result.server.streams[stream].status };
				streams.push(streamObj);
			}
		}
	});
};

ControllerSnapCast.prototype.setClientStream = function (host, client_id, stream_id)
{
	var self = this;	
	self.getSnapServerStatus(host, function(statusMsg) {
		if(statusMsg != undefined && self.isValidJSON(statusMsg))
		{
			var group_id;
			for (var group in statusMsg.result.server.groups)
			{
				for (var client in statusMsg.result.server.groups[group].clients)
				{
					if(statusMsg.result.server.groups[group].clients[client].id == client_id)
						group_id = statusMsg.result.server.groups[group].id;
				}
			}
			
			JsonSocket.sendSingleMessageAndReceive(1705, host, NDJSON, {"id":4,"jsonrpc":"2.0","method":"Group.SetStream","params":{"id": group_id, "stream_id":stream_id}}, function(err, message) {
				 if (err) {
					 self.logger.info('An error occurred: ' + err);
				 }
			 });
		}
		
		self.commandRouter.pushToastMessage('success', "Successfully linked group to stream", "Successfully linked group: " + group_id + " to stream " + stream_id);
	});
	
	return libQ.resolve();
};

ControllerSnapCast.prototype.updateVolume = function (data) {
	var self = this;
	
	if(data.volume != volume && self.config.get('client_enabled') && (self.config.get('client_id') != undefined && self.config.get('client_id') != ''))
	{
		//self.logger.info('Volume change detected! New volume: ' + data.volume + ' was: ' + volume);
		volume = data.volume;
		
		var host = self.config.get('volumio_host');
		if(self.config.get('custom_host'))
			host = self.config.get('host');
		
		// Propagate new volume to SnapCast
		JsonSocket.sendSingleMessageAndReceive(1705, host, NDJSON, {"id":8,"jsonrpc":"2.0","method":"Client.SetVolume","params":{"id": self.config.get('client_id'),"volume":{"muted":data.mute,"percent":data.volume}}}, function(err, message) {
			 if (err)
				 self.logger.info('An error occurred: ' + err);
			 //self.logger.info('Server said: ###' + message + '###');
		 });
		 
		 
	}
	
	return libQ.resolve();
};

ControllerSnapCast.prototype.isValidJSON = function (str) 
{
	var self = this;
    try 
	{
        JSON.parse(JSON.stringify(str));
    } 
	catch (e) 
	{
		self.logger.error('Could not parse JSON, error: ' + e + '\nMalformed JSON msg: ' + JSON.stringify(str));
        return false;
    }
    return true;
};
