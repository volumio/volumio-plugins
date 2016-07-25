'use strict';

var libQ = require('kew');
var libNet = require('net');
var libFast = require('fast.js');
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
	self.connSpopStatus = libNet.createConnection(nPort, nHost, function(){
        self.addToBrowseSources();
        defer.resolve();
    }); // Socket to listen for status changes

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

        //self.commandRouter.logger.info("DATA: "+self.sResponseBuffer);

        // If the last character in the data chunk is a newline, this is the end of the response
		if (data.slice(data.length - 1).toString() === '\n') {

            self.commandRouter.logger.info("FIRST BRANCH");

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
                    self.commandRouter.logger.info("BEFORE: SPOP HAS "+self.arrayResponseStack.length+" PROMISE IN STACK");

                    if(self.arrayResponseStack!==undefined && self.arrayResponseStack.length>0)
					    self.arrayResponseStack.shift().resolve(self.sResponseBuffer);

                    self.commandRouter.logger.info("AFTER: SPOP HAS "+self.arrayResponseStack.length+" PROMISE IN STACK");

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

                self.commandRouter.logger.info("STATUS");

                self.commandRouter.logger.info(sStatus);

                self.logStart('Spop announces state update')
					//.then(function(){
					// return self.getState.call(self);
					// })
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

	// Create a spotifyAPI object and then get an access token
	self.spotifyApiConnect();

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
	this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.rebuildSPOPDAndRestartDaemon.bind(this));

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
					list: [
						{
							service: 'spop',
							type: 'folder',
							title: 'My Playlists',
							artist: '',
							album: '',
							icon: 'fa fa-folder-open-o',
							uri: 'spotify/playlists'
						},
						{
							service: 'spop',
							type: 'folder',
							title: 'Featured Playlists',
							artist: '',
							album: '',
							icon: 'fa fa-folder-open-o',
							uri: 'spotify/featuredplaylists'
						},
						{
							service: 'spop',
							type: 'folder',
							title: 'What\'s New',
							artist: '',
							album: '',
							icon: 'fa fa-folder-open-o',
							uri: 'spotify/new'
						},
						{
							service: 'spop',
							type: 'folder',
							title: 'Genres & Moods',
							artist: '',
							album: '',
							icon: 'fa fa-folder-open-o',
							uri: 'spotify/categories'
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
		else if(curUri.startsWith('spotify/featuredplaylists'))
		{
			response=self.featuredPlaylists(curUri);
		}
		else if(curUri.startsWith('spotify/webplaylist'))
		{
			response=self.listWebPlaylist(curUri);
		}
		else if(curUri.startsWith('spotify/new'))
		{
			response=self.listWebNew(curUri);
		}
		else if(curUri.startsWith('spotify/categories'))
		{
			response=self.listWebCategories(curUri);
		}
		else if(curUri.startsWith('spotify/album'))
		{
			response=self.listWebAlbum(curUri);
		}
		else if(curUri.startsWith('spotify/category'))
		{
			response=self.listWebCategory(curUri);
		}
		else if(curUri.startsWith('spotify:artist:'))
		{
			response=self.listWebArtist(curUri);
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
                     //   self.logger.info(JSON.stringify(resJson));

		//	self.commandRouter.logger.info(resJson);
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
				if(resJson.playlists[i].hasOwnProperty('name') && resJson.playlists[i].name !== '')
				{
					if(resJson.playlists[i].type == 'playlist')
					{
						response.navigation.list.push({
							service: 'spop',
							type: 'folder',
							title: resJson.playlists[i].name,
							icon: 'fa fa-list-ol',
							uri: 'spotify/playlists/'+resJson.playlists[i].index
					        });
				        }
					else if(resJson.playlists[i].type == 'folder')
					{
						for(var j in resJson.playlists[i].playlists)
						{
							response.navigation.list.push({
							        service: 'spop',
							        type: 'folder',
							        title: resJson.playlists[i].playlists[j].name,
							        icon: 'fa fa-list-ol',
							        uri: 'spotify/playlists/'+resJson.playlists[i].playlists[j].index
					                });
						}
					}
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
					icon: 'fa fa-spotify',
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

ControllerSpop.prototype.spotifyApiConnect=function()
{
	var self=this;

	var defer=libQ.defer();

	var d = new Date();

	self.spotifyApi= new SpotifyWebApi({
		clientId : '7160366cc0944645bb1f32a7b81dd1ee',
		clientSecret : 'ab4691ab353b4da6a35b151eb73dfd59'
	});

	// Retrieve an access token
	self.spotifyClientCredentialsGrant()
		.then(function(data) {
			self.logger.info('Spotify credentials grant success');
			defer.resolve();
		}, function(err) {
			self.logger.info('Spotify credentials grant failed with ' + err);
			}
		);

	return defer.promise;
}

ControllerSpop.prototype.spotifyClientCredentialsGrant=function()
{
	var self=this;

	var defer=libQ.defer();

	var d = new Date();

	var now = d.getTime();

	// Retrieve an access token
	self.spotifyApi.clientCredentialsGrant()
		.then(function(data) {
			self.spotifyApi.setAccessToken(data.body['access_token']);
			self.spotifyAccessToken = data.body['access_token'];
			self.spotifyAccessTokenExpiration = data.body['expires_in'] * 1000 + now;
			self.logger.info('The access token expires at ' + self.spotifyAccessTokenExpiration);
			self.logger.info('The access token is ' + data.body['access_token']);
			defer.resolve();
		}, function(err) {
			self.logger.info('Spotify credentials grant failed with ' + err);
		});

	return defer.promise;
}

ControllerSpop.prototype.spotifyCheckAccessToken=function()
{
	var self=this;

	var defer=libQ.defer();

	var d = new Date();

	var now = d.getTime();

	if (self.spotifyAccessTokenExpiration < now)
	{
		self.spotifyClientCredentialsGrant()
			.then(function(data) {
				self.logger.info('Refreshed access token');
			});
	}

	defer.resolve();

	return defer.promise;

}

ControllerSpop.prototype.featuredPlaylists=function(curUri)
{

	var self=this;

	var defer=libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.getFeaturedPlaylists();
			spotifyDefer.then(function (results) {
				var response = {
					navigation: {
						prev: {
							uri: 'spotify'
						},
						list: []
					}
				};

				for (var i in results.body.playlists.items) {
					response.navigation.list.push({
						service: 'spop',
						type: 'folder',
						title: results.body.playlists.items[i].name,
						icon: 'fa fa-list-ol',
						artArray: results.body.playlists.items[i].images,
						uri: 'spotify/webplaylist/' + results.body.playlists.items[i].owner.id + '/' + results.body.playlists.items[i].id
					});
				}
				defer.resolve(response);
			}, function (err) {
				self.logger.info('An error occurred while listing Spotify featured playlists ' + err);
			});
		}
	);

	return defer.promise;
};

ControllerSpop.prototype.listWebPlaylist=function(curUri)
{
	var self=this;

	var defer=libQ.defer();

	var uriSplitted=curUri.split('/');

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.getPlaylist(uriSplitted[2], uriSplitted[3]);
			spotifyDefer.then(function (results) {

				var response = {
					navigation: {
						prev: {
							uri: 'spotify'
						},
						list: []
					}
				};

				for (var i in results.body.tracks.items) {
					response.navigation.list.push({
						service: 'spop',
						type: 'song',
						title: results.body.tracks.items[i].track.name,
						artist: results.body.tracks.items[i].track.artists[0].name,
						album: results.body.tracks.items[i].track.album.name,
						icon: 'fa fa-spotify',
						uri: results.body.tracks.items[i].track.uri
					});
				}
				defer.resolve(response);
			}, function (err) {
				self.logger.info('An error occurred while listing Spotify top tracks ' + err);
			});
		});

	return defer.promise;
};

ControllerSpop.prototype.listWebNew=function(curUri)
{

	var self=this;

	var defer=libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.getNewReleases();
			spotifyDefer.then(function (results) {

				var response = {
					navigation: {
						prev: {
							uri: 'spotify'
						},
						list: []
					}
				};

				for (var i in results.body.albums.items) {
					response.navigation.list.push({
						service: 'spop',
						type: 'folder',
						title: results.body.albums.items[i].name,
						icon: 'fa fa-list-ol',
						artArray: results.body.albums.items[i].images,
						uri: 'spotify/album/' + results.body.albums.items[i].id + '/' + encodeURIComponent(results.body.albums.items[i].name),
					});
				}
				defer.resolve(response);
			}, function (err) {
				self.logger.info('An error occurred while listing Spotify new albums ' + err);
			});
		});

	return defer.promise;
};

ControllerSpop.prototype.listWebAlbum=function(curUri)
{

	var self=this;

	var defer=libQ.defer();

	var uriSplitted=curUri.split('/');

	var album = decodeURIComponent(uriSplitted[3]);

	self.spotifyCheckAccessToken()
		.then(function(data) {
				var spotifyDefer = self.spotifyApi.getAlbumTracks(uriSplitted[2]);
				spotifyDefer.then(function (results) {
					var response = {
						navigation: {
							prev: {
								uri: 'spotify'
							},
							list: []
						}
					};

					for (var i in results.body.items) {
						response.navigation.list.push({
							service: 'spop',
							type: 'song',
							title: results.body.items[i].name,
							artist: results.body.items[i].artists[0].name,
							album: album,
							icon: 'fa fa-spotify',
							uri: results.body.items[i].uri
						});
					}
					defer.resolve(response);
				}, function (err) {
					self.logger.info('An error occurred while listing Spotify new album tracks ' + err);
				});
			}
		);


	return defer.promise;
};

ControllerSpop.prototype.listWebCategories=function(curUri)
{

	var self=this;

	var defer=libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.getCategories();
			spotifyDefer.then(function (results) {

				var response = {
					navigation: {
						prev: {
							uri: 'spotify'
						},
						list: []
					}
				};

				for (var i in results.body.categories.items) {
					response.navigation.list.push({
						service: 'spop',
						type: 'folder',
						title: results.body.categories.items[i].name,
						icon: 'fa fa-folder-open-o',
						artArray: results.body.categories.items[i].icons,
						uri: 'spotify/category/' + results.body.categories.items[i].id
					});
				}
				defer.resolve(response);
			}, function (err) {
				self.logger.info('An error occurred while listing Spotify categories ' + err);
			});
		});

	return defer.promise;
};

ControllerSpop.prototype.listWebCategory=function(curUri)
{

	var self=this;

	var defer=libQ.defer();

	var uriSplitted=curUri.split('/');

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.getPlaylistsForCategory(uriSplitted[2]);
			spotifyDefer.then(function (results) {

				var response = {
					navigation: {
						prev: {
							uri: 'spotify/categories'
						},
						list: []
					}
				};

				for (var i in results.body.playlists.items) {
					response.navigation.list.push({
						service: 'spop',
						type: 'folder',
						title: results.body.playlists.items[i].name,
						icon: 'fa fa-list',
						artArray: results.body.playlists.items[i].images,
						uri: 'spotify/webplaylist/spotify/' + results.body.playlists.items[i].id
					});
				}
				defer.resolve(response);
			}, function (err) {
				self.logger.info('An error occurred while listing Spotify playlist categories ' + err);
			});
		});

	return defer.promise;
};

ControllerSpop.prototype.listWebArtist = function (curUri) {

	var self = this;

	var defer = libQ.defer();

	var uriSplitted = curUri.split(':');

	var artistId = uriSplitted[2];

	var artistName = '';

	self.spotifyCheckAccessToken()
		.then(function (data) {
			var spotifyDefer = self.spotifyApi.getArtist(artistId);
			spotifyDefer.then(function (results) {
				artistName = results.body.name;
			})
		})
		.then(function (data) {
			var spotifyDefer = self.spotifyApi.getArtistTopTracks(artistId, 'GB');
			spotifyDefer.then(function (results) {

				var response = {
					navigation: {
						prev: {
							uri: 'spotify'
						},
						list: []
					}
				};
				response.navigation.list.push({type: 'title', title: 'Top Tracks'});
				for (var i in results.body.tracks) {
					var track = results.body.tracks[i];
					response.navigation.list.push({
						service: 'spop',
						type: 'song',
						title: track.name,
						album: track.album.name,
						artist: track.artists[0].name,
						icon: 'fa fa-spotify',
						artArray: track.album.images,
						uri: track.uri,
					});
				}
				//	defer.resolve(response);
				return response;
			})
				.then(function (data) {
					var spotifyDefer = self.spotifyApi.getArtistAlbums(artistId);
					spotifyDefer.then(function (results) {

						var response = data;
						response.navigation.list.push({type: 'title', title: 'Albums'});
						for (var i in results.body.items) {
							var album = results.body.items[i];
							response.navigation.list.push({
								service: 'spop',
								type: 'folder',
								title: album.name,
								icon: 'fa fa-folder-open-o',
								artArray: album.images,
								uri: 'spotify/album/' + album.id + '/' + encodeURIComponent(album.name),
							});
						}
						// defer.resolve(response);
						return response;
					})
						.then(function (data) {
							var spotifyDefer = self.spotifyApi.getArtistRelatedArtists(artistId);
							spotifyDefer.then(function (results) {

								var response = data;
								response.navigation.list.push({type: 'title', title: 'Related Artists'});
								for (var i in results.body.artists) {
									var artist = results.body.artists[i];
									response.navigation.list.push({
										service: 'spop',
										type: 'artist',
										title: artist.name,
										icon: 'fa fa-user',
										artArray: artist.images,
										uri: artist.uri
									});
								}
								defer.resolve(response);
							})
						}),
						function (err) {
							self.logger.info('An error occurred while listing Spotify artist albums ' + err);
						}
				})
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
	var defer = libQ.defer();
	var self = this;

	var lang_code = this.commandRouter.sharedVars.get('language_code');

        self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
                __dirname+'/i18n/strings_en.json',
                __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {

uiconf.sections[0].content[0].value = self.config.get('username');
uiconf.sections[0].content[1].value = self.config.get('password');
uiconf.sections[0].content[2].value = self.config.get('bitrate');

            defer.resolve(uiconf);
            })
                .fail(function()
            {
                defer.reject(new Error());
        });

        return defer.promise;
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



// Rebuild a library of user's playlisted Spotify tracks


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


    var spopResponseDeferred = libQ.defer();
	// Pass the command to Spop when the command socket is ready
	self.spopCommandReady
	.then(function() {
		return libQ.nfcall(libFast.bind(self.connSpopCommand.write, self.connSpopCommand), sCommand + sParameters + '\n', 'utf-8')
            /*.then(function()
            {
                spopResponseDeferred.resolve();
            })
            .fail(function(err)
            {
                spopResponseDeferred.reject(new Error(err));
            })*/;
	});


	var spopResponse = spopResponseDeferred.promise;

    if(sCommand!=='status')
    {
        self.commandRouter.logger.info("ADDING DEFER FOR COMMAND " + sCommand);
        self.arrayResponseStack.push(spopResponseDeferred);
    }
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

ControllerSpop.prototype.explodeAlbumUri = function(id) {
    var self=this;
    var defer=libQ.defer();

    self.spotifyApi.getAlbum(id, 'GB')
        .then(function(result)
        {
            self.commandRouter.logger.info(result);
            defer.resolve();
        });


    return defer.promise;
}



ControllerSpop.prototype.getAlbumTracks = function(id,offset,album) {
    var self=this;
    var defer=libQ.defer();

    var offsetStep=10;

    self.spotifyApi.getAlbums([id],{limit:offsetStep,offset:offset})
        .then(function (result) {
            console.log(JSON.stringify(result.body.albums[0]));

            var resJson = result.body.albums[0];

            var rate;
            if (self.config.get('bitrate') === true)
                rate = "320";
            else rate = "128";

            var moreDefer = libQ.defer();
            if (resJson.total > offset+offsetStep) {
                moreDefer = self.getAlbumTracks(id, offset + offsetStep);
            }
            else moreDefer.resolve();

            moreDefer.then(function (result) {
                console.log("RESULT:         "+JSON.stringify(result));

                var response=[];

                for (var i in resJson.items) {
                    var artist = resJson.items[i].artists[0].name;

                    var albumart = self.getAlbumArt({
                        artist: artist,
                        album: album
                    }, "");

                    var item = {
                        uri: resJson.items[i].uri,
                        service: 'spop',
                        type: 'song',
                        name: resJson.items[i].name,
                        title: resJson.items[i].name,
                        artist: artist,
                        album: album,
                        duration: resJson.items[i].duration_ms / 1000,
                        albumart: albumart,
                        samplerate: '44.1 KHz',
                        bitdepth: '16 bit',
                        trackType: 'spotify'

                    };

                    response.push(item);
                }

                response=response.concat(result).filter(function(v){return !!(v)==true;});
                defer.resolve(response);
            }).fail(function (err) {
                defer.reject(new Error(err));
            })
        });

    return defer.promise;
}




ControllerSpop.prototype.explodeUri = function(uri) {

	var self = this;

	var defer=libQ.defer();

	var rate;

	if(self.config.get('bitrate')===true)
		rate="320Kbps";
	else rate="128Kbps";

    if (uri.startsWith('spotify/playlists')) {
                var uriSplitted=uri.split('/');

                var commandDefer=self.sendSpopCommand('ls',[uriSplitted[2]]);
                commandDefer.then(function(results){
                    var resJson=JSON.parse(results);

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
                            bitdepth: '16 bit',
                            trackType: 'spotify'

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
    else if(uri.startsWith('spotify:artist:'))
    {
        var uriSplitted=uri.split(':');
		self.spotifyCheckAccessToken()
			.then(function(data) {
				self.spotifyApi.getArtistTopTracks(uriSplitted[2], 'GB')
					.then(function (result) {
						var resJson = result.body;
						var response = [];
						for (var i in resJson.tracks) {
							var artist = resJson.tracks[i].artists[0].name;
							var album = resJson.tracks[i].album.name;

							var albumart = self.getAlbumArt({
								artist: artist,
								album: album
							}, "");

							var item = {
								uri: resJson.tracks[i].uri,
								service: 'spop',
								type: 'song',
								name: resJson.tracks[i].name,
								title: resJson.tracks[i].name,
								artist: artist,
								album: album,
								duration: Math.trunc(resJson.tracks[i].duration_ms / 1000),
								albumart: albumart,
								samplerate: rate,
								bitdepth: '16 bit',
								trackType: 'spotify'

							};

							response.push(item);
						}
						defer.resolve(response);
					});
			});

    }
    else if(uri.startsWith('spotify/album/'))
	{
		var uriSplitted=uri.split('/');

		var albumName = decodeURIComponent(uriSplitted[3]);

		self.spotifyCheckAccessToken()
			.then(function(data) {
					var spotifyDefer = self.spotifyApi.getAlbumTracks(uriSplitted[2]);
					spotifyDefer.then(function (results) {
						var response = [];

						for (var i in results.body.items) {
							var artist = '';
							var album = albumName;
							var track = results.body.items[i];
							if (track.artists.length > 0) {
								artist = track.artists[0].name;
							}
							var albumart=self.getAlbumArt({artist: artist, album: album}, "");
							var qitem = {
								service: 'spop',
								type: 'song',
								title: track.name,
								name: track.name,
								artist: artist,
								album: album,
							//	icon: 'fa fa-spotify',
								uri: track.uri,
								samplerate: rate,
								bitdepth: '16 bit',
								trackType: 'spotify',
								albumart: albumart,
								duration: Math.trunc(track.duration_ms / 1000)
							};
							response.push(qitem);
						}
						defer.resolve(response);
					}, function (err) {
						self.logger.info('An error occurred while listing Spotify new album tracks ' + err);
					});
				}
			);
	}
    else if (uri.startsWith('spotify/webplaylist/'))
	{
		var uriSplitted=uri.split('/');

		self.spotifyCheckAccessToken()
			.then(function(data) {
				var spotifyDefer = self.spotifyApi.getPlaylist(uriSplitted[2], uriSplitted[3]);
				spotifyDefer.then(function (results) {

					var response = [];

					for (var i in results.body.tracks.items) {
						var track = results.body.tracks.items[i].track;
						var albumart=self.getAlbumArt({artist: track.artists[0].name, album: track.album.name}, "");
						var qitem = {
							service: 'spop',
							type: 'song',
							name: track.name,
							title: track.name,
							artist: track.artists[0].name,
							album: track.album.name,
							uri: track.uri,
							samplerate: rate,
							bitdepth: '16 bit',
							trackType: 'spotify',
						//	albumart: track.album.images[2].url,
							albumart: albumart,
							duration: Math.trunc(track.duration_ms / 1000)
						};
						response.push(qitem);
					}
					defer.resolve(response);
				}, function (err) {
					self.logger.info('An error occurred while exploding listing Spotify top tracks ' + err);
				});
			});
	}
    else if (uri.startsWith('spotify:track:'))
    {
		var uriSplitted = uri.split(':');

		self.spotifyApi.getTrack(uriSplitted[2])
			.then(function (data) {

				var response = [];
				var artist = '';
				var album = '';
				var title = '';

				if (data.body.artists.length > 0) {
					artist = data.body.artists[0].name;
				}

				if (data.body.hasOwnProperty('album') && data.body.album.hasOwnProperty('name')) {
					album = data.body.album.name;
				}

				var albumart = self.getAlbumArt({artist: artist, album: album}, "");

				var qitem = {
					uri: uri,
					service: 'spop',
					name: data.body.name,
					artist: artist,
					album: album,
					type: 'track',
					duration: parseInt(data.body.duration_ms / 1000),
					tracknumber: data.body.track_number,
					albumart: albumart,
					samplerate: rate,
					bitdepth: '16 bit',
					trackType: 'spotify'
				};
				response.push(qitem);
				defer.resolve(response);
			}, function (err) {
				self.logger.info('An error occurred while exploding listing Spotify track ' + err);
			});
	}
	else {
		self.logger.info('Bad URI while exploding Spotify URI: ' + uri);
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
			var outdev = self.commandRouter.sharedVars.get('alsa.outputdevice');
			var hwdev = 'hw:' + outdev;
			var  bitrate = self.config.get('bitrate');
			var bitratevalue = 'true';
			if (bitrate == false ) {
				bitratevalue = 'false';
			}

            var conf1 = data.replace("${username}", self.config.get('username'));
            var conf2 = conf1.replace("${password}", self.config.get('password'));
            var conf3 = conf2.replace("${bitrate}", self.config.get('bitrate'));
			var conf4 = conf3.replace("${outdev}", hwdev);

            fs.writeFile("/etc/spopd.conf", conf4, 'utf8', function (err) {
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

ControllerSpop.prototype.search = function (query) {

	var self=this;

	var defer=libQ.defer();

	self.spotifyCheckAccessToken()
		.then(function(data) {
			var spotifyDefer = self.spotifyApi.search(query.value, ['artist', 'album', 'playlist', 'track']);
			spotifyDefer.then(function (results) {

				var list = [];

				// TODO put in internationalized strings
				// Show artists, albums, playlists then tracks
				if(results.body.hasOwnProperty('artists') && results.body.artists.items.length > 0)
				{
					list.push({type: 'title', title: 'Spotify Artists'});
					for (var i in results.body.artists.items) {
						var artist = results.body.artists.items[i];
						list.push({
							service: 'spop',
							type: 'artist',
							title: artist.name,
							icon: 'fa fa-user',
							artArray: artist.images,
							uri: artist.uri
						});
					}
				}
				if(results.body.hasOwnProperty('albums') && results.body.albums.items.length > 0)
				{
					list.push({type:'title',title:'Spotify Albums'});
					for (var i in results.body.albums.items) {
						var album = results.body.albums.items[i];
						list.push({
							service: 'spop',
							type: 'folder',
							title: album.name,
							icon: 'fa fa-folder-open',
							artArray: album.images,
							uri: 'spotify/album/' + album.id + '/' + encodeURIComponent(album.name),
						});
					}
				}
				if(results.body.hasOwnProperty('playlists') && results.body.playlists.items.length > 0)
				{
					list.push({type:'title',title:'Spotify Playlists'});
					for (var i in results.body.playlists.items) {
						var playlist = results.body.playlists.items[i];
						list.push({
							service: 'spop',
							type: 'folder',
							title: playlist.name,
							icon: 'fa fa-list',
							artArray: playlist.images,
							uri: 'spotify/webplaylist/' + playlist.owner.id + '/' + playlist.id,
						});
					}
				}
				if(results.body.hasOwnProperty('tracks') && results.body.tracks.items.length > 0)
				{
					list.push({type:'title',title:'Spotify Tracks'});
					for (var i in results.body.tracks.items) {
						var track = results.body.tracks.items[i];
						list.push({
							service: 'spop',
							type: 'song',
							title: track.name,
							artist: track.artists[0].name,
							album: track.album.name,
							icon: 'fa fa-spotify',
							artArray: track.album.images,
							uri: track.uri
						});
					}
				}
				defer.resolve(list);
			}, function (err) {
				self.logger.info('An error occurred while searching ' + err);
			});
		});

	return defer.promise;
};

