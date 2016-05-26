'use strict';

var libQ = require('kew');
var libNet = require('net');
var libFast = require('fast.js');
var libLevel = require('level');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var SpotifyWebApi = require('spotify-web-api-node');
var nodetools = require('nodetools');

// Define the ControllerSpop class
module.exports = ControllerSpop;
function ControllerSpop(context) {
	// This fixed variable will let us refer to 'this' object at deeper scopes
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



ControllerSpop.prototype.onVolumioStart = function()
{
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);
}

ControllerSpop.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

ControllerSpop.prototype.addToBrowseSources = function () {
	var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
	this.commandRouter.volumioAddToBrowseSources(data);
};

// Plugin methods -----------------------------------------------------------------------------

ControllerSpop.prototype.startSpopDaemon = function() {
	var self = this;

    var defer=libQ.defer();

	exec("/usr/bin/sudo /bin/systemctl start spop.service", {uid:1000,gid:1000}, function (error, stdout, stderr) {
		if (error !== null) {
			self.commandRouter.pushConsoleMessage('The following error occurred while starting SPOPD: ' + error);
            defer.reject();
		}
		else {
			self.commandRouter.pushConsoleMessage('SpopD Daemon Started');
            defer.resolve();
		}
	});

    return defer.promise;
};

ControllerSpop.prototype.spopDaemonConnect = function(defer) {
	var self = this;

	// TODO use names from the package.json instead
	self.servicename = 'spop';
	self.displayname = 'Spotify';


	// Each core gets its own set of Spop sockets connected
	var nHost='localhost';
	var nPort=6602;
	self.connSpopCommand = libNet.createConnection(nPort, nHost); // Socket to send commands and receive track listings
	self.connSpopStatus = libNet.createConnection(nPort, nHost); // Socket to listen for status changes

	// Start a listener for receiving errors
	self.connSpopCommand.on('error', function(err) {
		self.logger.info('SPOP command error:');
        self.logger.info(err);

        try
        {
            defer.reject();
        } catch(ecc) {}

	});
	self.connSpopStatus.on('error', function(err) {
        self.logger.info('SPOP status error:');
        self.logger.info(err);

        try
        {
            defer.reject();
        } catch(ecc) {}
	});

	// Init some command socket variables
	self.bSpopCommandGotFirstMessage = false;
	self.spopCommandReadyDeferred = libQ.defer(); // Make a promise for when the Spop connection is ready to receive events (basically when it emits 'spop 0.0.1').
	self.spopCommandReady = self.spopCommandReadyDeferred.promise;
	self.arrayResponseStack = [];
	self.sResponseBuffer = '';

	// Start a listener for command socket messages (command responses)
	self.connSpopCommand.on('data', function(data) {
		self.sResponseBuffer = self.sResponseBuffer.concat(data.toString());

		// If the last character in the data chunk is a newline, this is the end of the response
		if (data.slice(data.length - 1).toString() === '\n') {
			// If this is the first message, then the connection is open
			if (!self.bSpopCommandGotFirstMessage) {
				self.bSpopCommandGotFirstMessage = true;
				try {
					self.spopCommandReadyDeferred.resolve();
				} catch (error) {
					self.pushError(error);
				}
				// Else this is a command response
			} else {
				try {
					self.arrayResponseStack.shift().resolve(self.sResponseBuffer);
				} catch (error) {
					self.pushError(error);
				}
			}

			// Reset the response buffer
			self.sResponseBuffer = '';
		}
	});

	// Init some status socket variables
	self.bSpopStatusGotFirstMessage = false;
	self.sStatusBuffer = '';

	// Start a listener for status socket messages
	self.connSpopStatus.on('data', function(data) {
		self.sStatusBuffer = self.sStatusBuffer.concat(data.toString());

		// If the last character in the data chunk is a newline, this is the end of the status update
		if (data.slice(data.length - 1).toString() === '\n') {
			// Put socket back into monitoring mode
			self.connSpopStatus.write('idle\n');

			// If this is the first message, then the connection is open
			if (!self.bSpopStatusGotFirstMessage) {
				self.bSpopStatusGotFirstMessage = true;
				// Else this is a state update announcement
			} else {
				var timeStart = Date.now();
				var sStatus = self.sStatusBuffer;

				self.logStart('Spop announces state update')
					.then(function(){
					 return self.getState.call(self);
					 })
					.then(function() {
						return self.parseState.call(self, sStatus);
					})
					.then(libFast.bind(self.pushState, self))
					.fail(libFast.bind(self.pushError, self))
					.done(function() {
						return self.logDone(timeStart);
					});
			}

			// Reset the status buffer
			self.sStatusBuffer = '';
		}
	});

	// Define the tracklist
	self.tracklist = [];

	// Start tracklist promise as rejected, so requestors do not wait for it if not immediately available.
	// This is okay because no part of Volumio requires a populated tracklist to function.
	self.tracklistReadyDeferred = null;
	self.tracklistReady = libQ.reject('Tracklist not yet populated.');

	// Attempt to load tracklist from database on disk
	// TODO make this a relative path
	self.sTracklistPath = __dirname + '/db/tracklist';


	self.addToBrowseSources();


	self.spotifyApi= new SpotifyWebApi({
		clientId : self.config.get('spotify_api_client_id'),
		clientSecret : self.config.get('spotify_api_client_secret')
	});


};


ControllerSpop.prototype.onStop = function() {
	var self = this;

    self.logger.info("Killing SpopD daemon");
	exec("killall spopd", function (error, stdout, stderr) {

	});

    return libQ.defer();
};

ControllerSpop.prototype.onStart = function() {
    var self = this;

    var defer=libQ.defer();

    self.startSpopDaemon()
        .then(function(e)
        {
            setTimeout(function () {
                self.logger.info("Connecting to daemon");
                self.spopDaemonConnect(defer);
            }, 5000);
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        });


    return defer.promise;
};

ControllerSpop.prototype.handleBrowseUri=function(curUri)
{
	var self=this;

	//self.commandRouter.logger.info(curUri);
	var response;

	if (curUri.startsWith('spotify')) {
		if(curUri=='spotify')
		{
			response=libQ.resolve({
				navigation: {
					prev: {
						uri: 'spotify'
					},
					list: [{
						service: 'spop',
						type: 'folder',
						title: 'Playlists',
						artist: '',
						album: '',
						icon: 'fa fa-folder-open-o',
						uri: 'spotify/playlists'
					}

					]
				}
			});
		}
		else if(curUri.startsWith('spotify/playlists'))
		{
			if(curUri=='spotify/playlists')
				response=self.listPlaylists();
			else
			{
				response=self.listPlaylist(curUri);
			}
		}
	}

	return response;
};

ControllerSpop.prototype.listPlaylists=function()
{
	var self=this;

	var defer=libQ.defer();
	var commandDefer=self.sendSpopCommand('ls',[]);
	commandDefer.then(function(results){
			var resJson=JSON.parse(results);

			self.commandRouter.logger.info(resJson);
			var response={
				navigation: {
					prev: {
						uri: 'spotify'
					},
					list: []
				}
			};

			for(var i in resJson.playlists)
			{
				if(resJson.playlists[i].name!=='')
				{
					response.navigation.list.push({
						service: 'spop',
						type: 'folder',
						title: resJson.playlists[i].name,
						icon: 'fa fa-folder-open-o',
						uri: 'spotify/playlists/'+resJson.playlists[i].index
					});
				}
			}

			defer.resolve(response);

		})
		.fail(function()
		{
			defer.fail(new Error('An error occurred while listing playlists'));
		});

	return defer.promise;
};

ControllerSpop.prototype.listPlaylist=function(curUri)
{
	var self=this;

	var uriSplitted=curUri.split('/');

	var defer=libQ.defer();
	var commandDefer=self.sendSpopCommand('ls',[uriSplitted[2]]);
	commandDefer.then(function(results){
			var resJson=JSON.parse(results);

			var response={
				navigation: {
					prev: {
						uri: 'spotify/playlists'
					},
					list: []
				}
			};

			for(var i in resJson.tracks)
			{
				response.navigation.list.push({
					service: 'spop',
					type: 'song',
					title: resJson.tracks[i].title,
					artist:resJson.tracks[i].artist,
					album: resJson.tracks[i].album,
					icon: 'fa fa-list-ol',
					uri: resJson.tracks[i].uri
				});
			}

			defer.resolve(response);
		})
		.fail(function()
		{
			defer.fail(new Error('An error occurred while listing playlists'));
		});

	return defer.promise;
};




ControllerSpop.prototype.onStop = function() {
	var self = this;
	exec("killall spopd", function (error, stdout, stderr) {

	});
};






// Spop stop
ControllerSpop.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::stop');

	return self.sendSpopCommand('stop', []);
};

ControllerSpop.prototype.onRestart = function() {
	var self = this;
	//
};

ControllerSpop.prototype.onInstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerSpop.prototype.onUninstall = function() {
	var self = this;
	//Perform your installation tasks here
};

ControllerSpop.prototype.getUIConfig = function() {
	var self = this;

	var uiconf = fs.readJsonSync(__dirname + '/UIConfig.json');

    uiconf.sections[0].content[0].value = self.config.get('username');
	uiconf.sections[0].content[1].value = self.config.get('password');
	uiconf.sections[0].content[2].value = self.config.get('bitrate');

    return uiconf;
};

ControllerSpop.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerSpop.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerSpop.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

// Public Methods ---------------------------------------------------------------------------------------
// These are 'this' aware, and return a promise

// Load the tracklist from database on disk
ControllerSpop.prototype.loadTracklistFromDB = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::loadTracklistFromDB');
	self.commandRouter.pushConsoleMessage('Loading Spop tracklist from DB...');

	self.tracklist = [];

	self.tracklistReadyDeferred = libQ.defer();
	self.tracklistReady = self.tracklistReadyDeferred.promise;

	var dbTracklist = libLevel(self.sTracklistPath, {'valueEncoding': 'json', 'createIfMissing': true});

	return libQ.resolve()
	.then(function() {
		return libQ.nfcall(libFast.bind(dbTracklist.get, dbTracklist), 'tracklist');
	})
	.then(function(result) {
		self.tracklist = result;

		self.commandRouter.pushConsoleMessage('Spop tracklist loaded from DB.');

		try {
			self.tracklistReadyDeferred.resolve();
		} catch (error) {
			self.pushError('Unable to resolve tracklist promise: ' + error);
		}

		return libQ.resolve();
	})
	.fail(function(sError) {
		try {
			self.tracklistReadyDeferred.reject(sError);
		} catch (error) {
			self.pushError('Unable to reject tracklist promise: ' + error);
		}

		throw new Error('Error reading DB: ' + sError);
	})
	.fin(libFast.bind(dbTracklist.close, dbTracklist));
};

// Rebuild a library of user's playlisted Spotify tracks
ControllerSpop.prototype.rebuildTracklist = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::rebuildTracklist');

	self.tracklist = [];
	self.tracklistReadyDeferred = libQ.defer();
	self.tracklistReady = self.tracklistReadyDeferred.promise;

	var dbTracklist = libLevel(self.sTracklistPath, {'valueEncoding': 'json', 'createIfMissing': true});

	self.commandRouter.pushConsoleMessage('Populating Spop tracklist...');

	// Scan the user's Spotify playlists and populate the tracklist
	return self.sendSpopCommand('ls', [])
	.then(JSON.parse)
	.then(function(objPlaylists) {
		return self.rebuildTracklistFromSpopPlaylists(objPlaylists, [self.displayname]);
	})
	.then(function() {
		self.commandRouter.pushConsoleMessage('Storing Spop tracklist in db...');

		var ops = [
			{type: 'put', key: 'tracklist', value: self.tracklist}
		];

		return libQ.nfcall(libFast.bind(dbTracklist.batch, dbTracklist), ops);
	})
	.then(function() {
		self.commandRouter.pushConsoleMessage('Spop tracklist rebuild complete.');

		try {
			self.tracklistReadyDeferred.resolve();
		} catch (error) {
			self.pushError('Unable to resolve tracklist promise: ' + error);
		}

		return libQ.resolve();
	})
	.fail(function(sError) {
		try {
			self.tracklistReadyDeferred.reject(sError);
		} catch (error) {
			self.pushError('Unable to reject tracklist promise: ' + error);
		}

		throw new Error('Tracklist Rebuild Error: ' + sError);
	})
	.fin(libFast.bind(dbTracklist.close, dbTracklist));
};

// Define a method to clear, add, and play an array of tracks
ControllerSpop.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::clearAddPlayTrack');

    self.commandRouter.logger.info(JSON.stringify(track));

    return self.sendSpopCommand('uplay', [track.uri]);
};

// Spop stop
ControllerSpop.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::stop');

	return self.sendSpopCommand('stop', []);
};

// Spop pause
ControllerSpop.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::pause');

	// TODO don't send 'toggle' if already paused
	return self.sendSpopCommand('toggle', []);
};

// Spop resume
ControllerSpop.prototype.resume = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::resume');

	// TODO don't send 'toggle' if already playing
	return self.sendSpopCommand('toggle', []);
};

// Spop music library
ControllerSpop.prototype.getTracklist = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::getTracklist');

	return self.tracklistReady
	.then(function() {
		return self.tracklist;
	});
};

// Internal methods ---------------------------------------------------------------------------
// These are 'this' aware, and may or may not return a promise

// Send command to Spop
ControllerSpop.prototype.sendSpopCommand = function(sCommand, arrayParameters) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::sendSpopCommand');

	// Convert the array of parameters to a string
	var sParameters = libFast.reduce(arrayParameters, function(sCollected, sCurrent) {
		return sCollected + ' ' + sCurrent;
	}, '');

	// Pass the command to Spop when the command socket is ready
	self.spopCommandReady
	.then(function() {
		return libQ.nfcall(libFast.bind(self.connSpopCommand.write, self.connSpopCommand), sCommand + sParameters + '\n', 'utf-8');
	});

	var spopResponseDeferred = libQ.defer();
	var spopResponse = spopResponseDeferred.promise;
	self.arrayResponseStack.push(spopResponseDeferred);

	// Return a promise for the command response
	return spopResponse;
};

// Spop get state
ControllerSpop.prototype.getState = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::getState');

	return self.sendSpopCommand('status', []);
};

// Spop parse state
ControllerSpop.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::parseState');

	var objState = JSON.parse(sState);

	var nSeek = null;
	if ('position' in objState) {
		nSeek = objState.position * 1000;
	}

	var nDuration = null;
	if ('duration' in objState) {
		nDuration = objState.duration;
	}

	var sStatus = null;
	if ('status' in objState) {
		if (objState.status === 'playing') {
			sStatus = 'play';
		} else if (objState.status === 'paused') {
			sStatus = 'pause';
		} else if (objState.status === 'stopped') {
			sStatus = 'stop';
		}
	}

	var nPosition = null;
	if ('current_track' in objState) {
		nPosition = objState.current_track - 1;
	}

    var rate;

    if(self.config.get('bitrate')==true)
        rate='320';
    else rate='128';

    return libQ.resolve({
		status: sStatus,
		position: nPosition,
		seek: nSeek,
		duration: nDuration,
		samplerate: rate, // Pull these values from somwhere else since they are not provided in the Spop state
		bitdepth: null,
		channels: null,
		artist: objState.artist,
		title: objState.title,
		album: objState.album
	});
};

// Announce updated Spop state
ControllerSpop.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};

// Pass the error if we don't want to handle it
ControllerSpop.prototype.pushError = function(sReason) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::pushError(' + sReason + ')');

	// Return a resolved empty promise to represent completion
	return libQ.resolve();
};

// Scan tracks in playlists via Spop and populates tracklist
// Metadata fields to roughly conform to Ogg Vorbis standards (http://xiph.org/vorbis/doc/v-comment.html)
ControllerSpop.prototype.rebuildTracklistFromSpopPlaylists = function(objInput, arrayPath) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::rebuildTracklistFromSpopPlaylists');

	if (!('playlists' in objInput)) {
		throw new Error('Error building Spop tracklist - no playlists found.');
	}

	var arrayPlaylists = objInput.playlists;
	// We want each playlist to be parsed sequentially instead of simultaneously so that Spop is not overwhelmed
	// with requests. Use this chained promisedActions to guarantee sequential execution.
	var promisedActions = libQ.resolve();

	libFast.map(arrayPlaylists, function(curPlaylist) {
/*
		if (!('index' in curPlaylist)) {
			return;
		}*/
		var sPlaylistName = '';
		if (curPlaylist.name === '') {
			// The Starred playlist has a blank name
			sPlaylistName = 'Starred';
		} else {
			sPlaylistName = curPlaylist.name;
		}
		var arrayNewPath = arrayPath.concat(sPlaylistName);

		if (curPlaylist.type === 'folder') {
			promisedActions = promisedActions
				.then(function() {
					return self.rebuildTracklistFromSpopPlaylists(curPlaylist, arrayNewPath);
				});

		} else if (curPlaylist.type === 'playlist') {
			var curPlaylistIndex = curPlaylist.index;

			promisedActions = promisedActions
			.then(function() {
				return self.sendSpopCommand('ls', [curPlaylistIndex]);
			})
			.then(JSON.parse)
			.then(function(curTracklist) {
				var nTracks = 0;

				if (!('tracks' in curTracklist)) {
					return;
				}

				nTracks = curTracklist.tracks.length;

				for (var j = 0; j < nTracks; j++) {
					self.tracklist.push({
						'name': curTracklist.tracks[j].title,
						'service': self.servicename,
						'uri': curTracklist.tracks[j].uri,
						'browsepath': arrayNewPath,
						'album': curTracklist.tracks[j].album,
						'artists': libFast.map(curTracklist.tracks[j].artist.split(','), function(sArtist) {
							// TODO - parse other options in artist string, such as "feat."
							return sArtist.trim();

						}),
						'performers': [],
						'genres': [],
						'tracknumber': 0,
						'date': '',
						'duration': 0
					});
				}
			});
		}
	});

	return promisedActions;
};


ControllerSpop.prototype.explodeUri = function(uri) {
	var self = this;

	var defer=libQ.defer();

    if (uri.startsWith('spotify/playlists')) {
                var uriSplitted=uri.split('/');

                var commandDefer=self.sendSpopCommand('ls',[uriSplitted[2]]);
                commandDefer.then(function(results){
                    var resJson=JSON.parse(results);

                    var rate;
                    if(self.config.get('bitrate')===true)
                        rate="320";
                    else rate="128";

                    var response=[];
                    for(var i in resJson.tracks)
                    {
                        var albumart=self.getAlbumArt({artist:resJson.tracks[i].artist,album:resJson.tracks[i].album},"");

                        var item={
                            uri: resJson.tracks[i].uri,
                            service: 'spop',
                            type: 'song',
                            name: resJson.tracks[i].title,
                            title: resJson.tracks[i].title,
                            artist:resJson.tracks[i].artist,
                            album: resJson.tracks[i].album,
                            duration: resJson.tracks[i].duration/1000,
                            albumart: albumart,
                            samplerate: rate,
                            bitdepth: 16,
                            trackType: 'Spotify'

                        };

                        response.push(item);
                    }
                    defer.resolve(response);
                })
                    .fail(function()
                    {
                        defer.fail(new Error('An error occurred while listing playlists'));
                    });
    }
    else
    {
        var splitted=uri.split(':');

        self.spotifyApi.getTrack(splitted[2])
            .then(function(data) {
                self.commandRouter.logger.info(JSON.stringify(data));


                var artist='';
                var album='';
                var title='';

                if(data.body.artists.length>0)
                    artist=data.body.artists[0].name;

                if(data.body.album!==undefined)
                    album=data.body.album.name;

                var albumart=self.getAlbumArt({artist:artist,album:album},"");

                defer.resolve({
                    uri: uri,
                    service: 'spop',
                    name: data.body.name,
                    artist: artist,
                    album: album,
                    type: 'track',
                    duration: parseInt(data.body.duration_ms/1000),
                    tracknumber: data.body.track_number,
                    albumart: albumart,
                    samplerate: '128',
                    bitdepth: 16,
                    trackType: 'Spotify'

                });

            });
    }

	return defer.promise;
};

ControllerSpop.prototype.getAlbumArt = function (data, path) {

	var artist, album;

	if (data != undefined && data.path != undefined) {
		path = data.path;
	}

	var web;

	if (data != undefined && data.artist != undefined) {
		artist = data.artist;
		if (data.album != undefined)
			album = data.album;
		else album = data.artist;

		web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large'
	}

	var url = '/albumart';

	if (web != undefined)
		url = url + web;

	if (web != undefined && path != undefined)
		url = url + '&';
	else if (path != undefined)
		url = url + '?';

	if (path != undefined)
		url = url + 'path=' + nodetools.urlEncode(path);

	return url;
};

ControllerSpop.prototype.logDone = function(timeStart) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + '------------------------------ ' + (Date.now() - timeStart) + 'ms');
	return libQ.resolve();
};

ControllerSpop.prototype.logStart = function(sCommand) {
	var self = this;
	self.commandRouter.pushConsoleMessage('\n' + '[' + Date.now() + '] ' + '---------------------------- ' + sCommand);
	return libQ.resolve();
};



ControllerSpop.prototype.createSPOPDFile = function () {
    var self = this;

    var defer=libQ.defer();


    try {

        fs.readFile(__dirname + "/spop.conf.tmpl", 'utf8', function (err, data) {
            if (err) {
                defer.reject(new Error(err));
                return console.log(err);
            }
			var  bitrate = self.config.get('bitrate');
			var bitratevalue = 'true';
			if (bitrate == false ) {
				bitratevalue = 'false';
			}

            var conf1 = data.replace("${username}", self.config.get('username'));
            var conf2 = conf1.replace("${password}", self.config.get('password'));
            var conf3 = conf2.replace("${bitrate}", self.config.get('bitrate'));

            fs.writeFile("/etc/spopd.conf", conf3, 'utf8', function (err) {
                if (err)
                    defer.reject(new Error(err));
                else defer.resolve();
            });


        });


    }
    catch (err) {


    }

    return defer.promise;

};

ControllerSpop.prototype.saveSpotifyAccount = function (data) {
    var self = this;

    var defer = libQ.defer();

    self.config.set('username', data['username']);
    self.config.set('password', data['password']);
    self.config.set('bitrate', data['bitrate']);

    self.rebuildSPOPDAndRestartDaemon()
        .then(function(e){
            self.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
            defer.resolve({});
        })
        .fail(function(e)
        {
            defer.reject(new Error());
        })


    return defer.promise;

};


ControllerSpop.prototype.rebuildSPOPDAndRestartDaemon = function () {
    var self=this;
    var defer=libQ.defer();

    self.createSPOPDFile()
        .then(function(e)
        {
            var edefer=libQ.defer();
            exec("killall spopd", function (error, stdout, stderr) {
                edefer.resolve();
            });
            return edefer.promise;
        })
        .then(self.startSpopDaemon.bind(self))
        .then(function(e)
        {
            setTimeout(function () {
                self.logger.info("Connecting to daemon");
                self.spopDaemonConnect(defer);
            }, 5000);
        });

    return defer.promise;
}

ControllerSpop.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerSpop::seek to ' + timepos);
    return this.sendSpopCommand('seek '+timepos, []);
};