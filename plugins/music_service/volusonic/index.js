'use strict';

var libQ = require('kew');
var libNet = require('net');
var exec = require('child_process').exec;
var config = new (require('v-conf'))();
var volusonicApi = require('./volusonicAPI');
var fs = require('fs');

module.exports = ControllerVolusonic;

function ControllerVolusonic(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;
}

ControllerVolusonic.prototype.onVolumioStart = function()
{
	var self = this;
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

	return libQ.resolve();
}

ControllerVolusonic.prototype.onStart = function() {
    	var self = this;
	var defer=libQ.defer();

	
	self.api = new volusonicApi(self.commandRouter.logger,self.config);
	self.mpdPlugin = self.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

	self.commandRouter.loadI18nStrings();
	self.commandRouter.updateBrowseSourcesLang();
        self.addToBrowseSources();
	
	// Once the Plugin has successfull started resolve the promise
	defer.resolve();

    return defer.promise;
};

ControllerVolusonic.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

ControllerVolusonic.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};

ControllerVolusonic.prototype.getI18nFile = function () {
	var self = this;
	var file = __dirname+'/i18n/strings_'+this.commandRouter.sharedVars.get('language_code')+'.json';
	
	if (fs.existsSync(file)){
		return file;
	}else{
		return __dirname+'/i18n/strings_en.json';
	}
};

// Configuration Methods -----------------------------------------------------------------------------
ControllerVolusonic.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
		var findOption = function (optionVal, options) {
			for (var i = 0; i < options.length; i++) {
                    		if (options[i].value === optionVal)
                        	return options[i];
                	}
            	};

		uiconf.sections[0].content[0].value = self.config.get('server');
		uiconf.sections[0].content[1].value = self.config.get('username');
		uiconf.sections[0].content[2].value = self.config.get('auth');

		uiconf.sections[1].content[0].value = findOption(self.config.get('transcode'),uiconf.sections[1].content[0].options);
		uiconf.sections[1].content[1].value = findOption(self.config.get('listsSize'),uiconf.sections[1].content[1].options);
		uiconf.sections[1].content[2].value = findOption(self.config.get('artSize'),uiconf.sections[1].content[2].options);
		uiconf.sections[1].content[3].value = findOption(self.config.get('timeOut'),uiconf.sections[1].content[3].options);
		/*
			tracks in search
			show similar artists not present in subso 
		*/
		defer.resolve(uiconf);
        })
        .fail(function()
        {
		defer.reject(new Error('getUIconfig'));
        });
    return defer.promise;
};

ControllerVolusonic.prototype.getConfigurationFiles = function() {
	return ['config.json'];
}

ControllerVolusonic.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolusonic.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolusonic.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};

ControllerVolusonic.prototype.savePluginCredentials = function(data) {
	var self = this;
	var defer = libQ.defer();

	self.config.set('server', data['server']);
	self.config.set('username',data['username']);
	self.config.set('auth', self.api.getAuth(data['username'],data['auth']));

        var result = self.api.submitQuery('ping?')
                .then(function(result) 
                {
                        var msg;
                        if (result['subsonic-response'].status=='ok'){
                                msg = self.commandRouter.getI18nString('CON_OK');
                        }
                        else {
                                msg = self.commandRouter.getI18nString('CON_ERROR');
                        }         

                        var conTest = {
                                title: self.commandRouter.getI18nString('TEST_CREDS'),
                                message: msg,
                                size: 'lg',
                                        buttons: [{
                                                name: 'Ok',
                                                class: 'btn btn-warning'
                                        }]
                        }
                        self.commandRouter.broadcastMessage("openModal", conTest);      
                        defer.resolve();
                })
                .fail(function(result) {
                        defer.reject(new Error('savePluginCredentials'));
                });     
	return defer.promise;
};

ControllerVolusonic.prototype.savePluginOptions = function(data) {
    var self = this;
    var defer = libQ.defer();

    self.config.set('transcode', data['transcode'].value);
    self.config.set('listsSize', data['listsSize'].value);
    self.config.set('artSize', data['artSize'].value);
    self.config.set('timeOut', data['timeOut'].value);
	
    self.commandRouter.pushToastMessage('success', self.commandRouter.getI18nString('VOLUSONIC_OPTIONS'), self.commandRouter.getI18nString('SAVED') + " !");

    defer.resolve();
    return defer.promise;
};


// Browsing functions ---------------------------------------------------------------------------------------

ControllerVolusonic.prototype.addToBrowseSources = function () {
    var data = {name: 'Volusonic', uri: 'volusonic',plugin_type:'music_service',plugin_name:'volusonic', albumart:'/albumart?sourceicon=music_service/volusonic/subso.png'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerVolusonic.prototype.handleBrowseUri = function (curUri) {
    
	var self = this;
	var response;
	var uriParts = curUri.split('/');
	var defer = libQ.defer();

    	var ping = self.api.submitQuery('ping?')
	.then(function(ping){
		if (ping['subsonic-response'].status=='ok'){   
			if (curUri.startsWith('volusonic')) {
				if(curUri=='volusonic')
				{
					response=libQ.resolve({
						navigation: {
							prev: {
								uri: '/'
							},
							lists: [
                    						{
						                    title: self.config.get('server'),
						                    icon: "fa fa-server",
						                    availableListViews: ["list","grid"],
								    items: [
									{
										service: 'volusonic',
										type: 'item-no-menu',
										title: self.commandRouter.getI18nString('RANDOMS_ALBUMS'),
										artist: '',
										album: '',
										icon: 'fa fa-random',
										uri: 'volusonic/random'
									},
									{
										service: 'volusonic',
										type: 'item-no-menu',
										title: self.commandRouter.getI18nString('NEWEST_ALBUMS'),
										artist: '',
										album: '',
										icon: 'fa fa-star',
										uri: 'volusonic/newest'
									},
									{
										service: 'volusonic',
										type: 'item-no-menu',
										title: self.commandRouter.getI18nString('GENRES'),
										artist: '',
										album: '',
										icon: 'fa fa-transgender-alt',
										uri: 'volusonic/genres'
									},
									{
										service: 'volusonic',
										type: 'item-no-menu',
										title: self.commandRouter.getI18nString('ARTISTS'),
										artist: '',
										album: '',
										icon: 'fa fa-microphone',
										uri: 'volusonic/artists'
									},
									{
										service: 'volusonic',
										type: 'item-no-menu',
										title: self.commandRouter.getI18nString('PLAYLISTS'),
										artist: '',
										album: '',
										icon: 'fa fa-list-alt',
										uri: 'volusonic/playlists'
									},
									{
										service: 'volusonic',
										type: 'item-no-menu',
										title: self.commandRouter.getI18nString('PODCASTS'),
										artist: '',
										album: '',
										icon: 'fa fa-podcast',
										uri: 'volusonic/podcasts'
									}
								    ]
								}
                					]
                				}
					});
				}
				else if(curUri.startsWith('volusonic/random')){
					if (curUri === 'volusonic/random') {
						response=self.listAlbums(uriParts, curUri);
					}
					else {
						response = self.listTracks(uriParts, curUri);
					}
				}
				else if(curUri.startsWith('volusonic/search')){
					if (uriParts[3] === 'album' && uriParts.length == 5) {
						response = self.listTracks(uriParts, curUri);
					} else { 
						var query = { 'value': uriParts[2], 'type': 'any'};
					        response = self._search(query,"volusonic/search");
					}
				}
				else if(curUri.startsWith('volusonic/newest')){
					if (curUri === 'volusonic/newest') {
               			       		response=self.listAlbums(uriParts, curUri);
                        		}
     			                else {
                        		        response = self.listTracks(uriParts, curUri);
                        		}
				}
				else if(curUri.startsWith('volusonic/genres'))
				{
					if(curUri=='volusonic/genres')
						response=self.listGenres(uriParts, curUri);
					else if (uriParts.length == 3) {
						response=self.listAlbums(uriParts, curUri);
					}
					else if (uriParts.length == 4) {
						response=self.listTracks(uriParts, curUri);
					}
				}
				else if(curUri.startsWith('volusonic/artists'))
				{
					if(uriParts.length == 2 ) {
						response=self.listArtists(uriParts, curUri);
					}else if (uriParts.length == 3 ) {
						response=self.showArtist(uriParts, curUri);
					}else if (uriParts.length == 4) {
						response=self.listTracks(uriParts, curUri);
					}
				}
				else if(curUri.startsWith('volusonic/playlists'))
				{
					if(curUri=='volusonic/playlists')
						response=self.listPlaylists(uriParts, curUri);
					else if  (uriParts.length == 3)
					{
						response=self.playlistEntrys(uriParts, curUri);
					}
				}
				else if(curUri.startsWith('volusonic/podcasts'))
				{
					if(curUri=='volusonic/podcasts')
						response=self.listPodcasts(uriParts, curUri);
					else if  (uriParts.length == 3)
					{
						response=self.podcastEpisodes(uriParts, curUri);
					}
				}
			}
    			defer.resolve(response);
		}else{		
			var conError = {
				title: self.commandRouter.getI18nString('POP_ERROR'),
				message: self.commandRouter.getI18nString('CON_ERROR'),
				size: 'lg',
				buttons: [{
					name: 'Ok',
					class: 'btn btn-warning'
				}]
			}         
			self.commandRouter.broadcastMessage("openModal", conError);      
			//defer.resolve();       
		}
	});
	return defer.promise;
};

ControllerVolusonic.prototype._getIcon = function (path) {
	var self = this;
	var icon = 'fa fa-music';

	switch(path) {
    		case 'random':
        		icon = 'fa fa-random';
       		break;
    		case 'newest':
       			icon = 'fa fa-star';
        	break;
    		case 'genres':
       			icon = 'fa fa-transgender-alt';
        	break;
		case 'playlists':
			icon = 'fa fa-list-alt';
		break;
		case 'artists':
			icon = 'fa fa-microphone';
		break;
		case 'podcasts':
			icon = 'fa fa-podcast'
		break;
	}
	return icon; 
}

ControllerVolusonic.prototype.getSetting = function (setting){
	var self = this;
	var set;

	switch(setting) {
    		case 'listsSize':
        		switch (self.config.get('listsSize')) {
				case 0:
					set = '500';
					break;
				case 1:
					set = '200';
					break;
				case 2:
					set = '100';
					break;
				case 3:
					set = '50';
					break;
			}
        		break;
    		case 'artSize':
        		switch (self.config.get('artSize')) {
				case 0:
					set = '1200';
					break;
				case 1:
					set = '800';
					break;
				case 2:
					set = '600';
					break;
				case 3: 
					set = '400';
					break;
				case 4:
					set = '200';
					break;
			}
        		break;
		case 'transcode':
			switch (self.config.get('transcode')) {
				case 0:
					set = 'raw';
					break;
				case 1:
					set = '320';
					break;
				case 2:
					set = '256';
					break;
				case 3:
					set = '128';
					break;
				case 4:
					set = '64';
					break;
			}
			break; 
	} 
	return set;
}

ControllerVolusonic.prototype.playlistEntrys = function (uriParts, curUri) {
	var self = this;
	var defer = libQ.defer();
	var title;

	var id = uriParts.pop();
	var params = 'id=' + id;

	var result = self.api.get('getPlaylist', id, params)
	.then(function(result) {
		var items = [];
		var playlist = result['subsonic-response']['playlist'];
		playlist['entry'].forEach(function(song) {
			items.push(self._formatSong(song,curUri));
		});
		defer.resolve(self._formatPlay(playlist.name,playlist.owner, playlist.coverArt, new Date(playlist.changed).toLocaleDateString(), playlist.duration, items, self._prevUri(curUri), curUri));
	})
	.fail(function(result) {
		defer.reject(new Error('playlistEntrys'));
	});          
	return defer.promise;
}

ControllerVolusonic.prototype.showArtist = function (uriParts, curUri) {
	var self = this;
	var defer = libQ.defer();
	
	var id = uriParts.pop();

        var nav = {         
                        navigation: {
                                lists: [],
                                prev: {
                                        uri: self._prevUri(curUri)
                                },
				info: {}
                        }
        }

	var info = {
			uri: curUri,
			title:'',
			service: 'volusonic',
			type: 'artist',
			albumart: ''
	}

	var infos = self._artistInfos(id);
	infos.then(function (infos) {
		var artist = self._artist(id);
		artist.then(function (artist) {
			var top = self._topSongs(encodeURIComponent(artist.name),'10');
			top.then(function (top) {
				//head section
				info.title = artist.name;		
				if (infos.mediumImageUrl !== undefined) {
					info.albumart = infos.mediumImageUrl;
				} else {
					info.albumart = self.config.get('server') + '/rest/getCoverArt?id=' + artist.coverArt + '&size=' + self.getSetting('artSize') + '&' + self.config.get('auth');
				}
				//bio section
				if (infos.biography !== undefined) {
					var bio = {
						title: infos.biography,
						type: 'folder',
						availableListViews: 'list',
						items: [{
							service: 'volusonic',
       		                	 		type: 'song',
							icon: 'fa fa-bolt',
       		                 			title: self.commandRouter.getI18nString('START_RADIO'),
	       	   	              			uri: 'volusonic/radio/' + id,
						}]
					}
					nav.navigation['lists'].push(bio);
				}
				//top songs section
				if (top.song !== undefined) {
					var sgs = [];
					top['song'].forEach(function (song) {
						sgs.push(self._formatSong(song,curUri));
					});
					var topSongs = {
						title: self.commandRouter.getI18nString('TOP_SONGS'),
						type: 'song',
						availableListViews: 'List',
						items: sgs
					}
					nav.navigation['lists'].push(topSongs);
				}
				//albums section
				if (artist.album !== undefined) {
					var albs = [];
					artist['album'].forEach(function (album) {
						albs.push(self._formatAlbum(album,curUri));
					});
					var albums = {
						title: self.commandRouter.getI18nString('ALBUMS'),
						type: 'folder',
						availableListViews: 'list',
						items: albs
					}
					nav.navigation['lists'].push(albums);	
				}
				//similar artists
				if (infos.similarArtist !== undefined) {
                       			var arts = [];
					infos['similarArtist'].forEach(function (similar) {
						arts.push(self._formatArtist(similar,self._prevUri(curUri)));
					});
                        		var similars = {
                                		title: self.commandRouter.getI18nString('SIMILAR_ARTISTS'),
                                		type: 'folder',
                                		availableListViews: 'list',
                                		items: arts
                        		}
					nav.navigation['lists'].push(similars);
                		}

				nav.navigation['info'] = info;
				defer.resolve(nav);
			});
		});
	});
	return defer.promise;
}

ControllerVolusonic.prototype._artist = function (id) {
        var self = this;
        var defer = libQ.defer();

        var result = self.api.get('getArtist', id, "id=" + id)
	.then(function(result) {
		defer.resolve(result['subsonic-response']['artist']);
	})
	.fail(function(result) {
		defer.reject(new Error('_artist'));
	});
    	return defer.promise;
}

ControllerVolusonic.prototype._topSongs = function (artist, count) {
        var self = this;
        var defer = libQ.defer();

        var result = self.api.get('getTopSongs', artist + count, "artist=" + artist + "&count=" + count)
                .then(function(result) {
                        defer.resolve(result['subsonic-response']['topSongs']);
                })
                .fail(function(result) {
                                defer.reject(new Error('_topSongs'));
                });          
    	return defer.promise;
}

ControllerVolusonic.prototype._artistInfos = function (id) {
	var self = this;
	var defer = libQ.defer();

	var result = self.api.get('getArtistInfo2', id, "id=" + id)
		.then(function(result) {
			defer.resolve(result['subsonic-response']['artistInfo2']);
		})
		.fail(function(result) {
                        	defer.reject(new Error('_artistInfos'));
                });          
    	return defer.promise;
}

ControllerVolusonic.prototype._album = function (id) {
        var self = this;
        var defer = libQ.defer();

        var result = self.api.get('getAlbum', id, "id=" + id)
                .then(function(result) {
                        defer.resolve(result['subsonic-response']['album']);
                })
                .fail(function(result) {
                                defer.reject(new Error('_artistInfos'));
                });          
    	return defer.promise;
}

ControllerVolusonic.prototype.listTracks = function (uriParts, curUri) {
	var self = this;
	var defer = libQ.defer();
	var title;

	var id = uriParts.pop();
	var params = 'id=' + id;

	var result = self.api.get('getAlbum', id, params)
		.then(function(result) {
			var album = result['subsonic-response']['album'];
			var items = [];
			album['song'].forEach(function (song) {
				items.push(self._formatSong(song,curUri));
			});
			var play = self._formatPlay(album.name, album.artist, album.coverArt, album.year, album.duration, items, self._prevUri(curUri), curUri);
			var albumInfos = self._albumInfos(id);
			albumInfos.then( function (albumInfos) {
				if (albumInfos.mediumImageUrl !== undefined && albumInfos.mediumImageUrl !== "") {
					play.navigation['info'].albumart = albumInfos.mediumImageUrl;	
				}
				if (albumInfos.notes !== undefined) {
					play.navigation.lists[0].title = albumInfos.notes;
					play.navigation.lists[0].type = 'folder';
				}
				defer.resolve(play);
			});
		})
		.fail(function(result) {
                        	defer.reject(new Error('listTracks'));
                });          
    	return defer.promise;
}

ControllerVolusonic.prototype._albumInfos = function (id) {
        var self = this;
        var defer = libQ.defer();

        var result = self.api.get('getAlbumInfo2', id, "id="+id)
                .then(function(result) {
                        defer.resolve(result['subsonic-response']['albumInfo']);
                })
                .fail(function(result) {
                                defer.reject(new Error('_albumInfos'));
                });          
    return defer.promise;
}
ControllerVolusonic.prototype._formatPlay = function (album, artist, coverart, year, duration, items, prevUri, curUri) {
        var self = this;

	var nav = {         
			navigation: {
				lists: [{
					title: '',
					type: '',					
					availableListViews: ['list'],
					items: items
				}],
				prev: {
					uri: prevUri
				},
				info: {
		                	uri: curUri,
                			service: 'volusonic',
			                artist: artist,
			                album: album,
			                albumart: self.config.get('server') + '/rest/getCoverArt?id=' + coverart + '&size=' + self.getSetting('artSize') + '&' + self.config.get('auth'),
			                year: year,
			                type: 'album',
			                duration: parseInt(duration/60) + 'mns'
            			}
			}
	}
	return nav;
}

ControllerVolusonic.prototype.listPlaylists = function (uriParts, curUri) {
        var self = this;
        var defer = libQ.defer();

	var params = '';

        var result = self.api.get('getPlaylists', 'All', params)
                .then(function(result) {
				var items = [];
				result['subsonic-response']['playlists']['playlist'].forEach(function (playlist) {
					items.push(self._formatPlaylist(playlist,curUri));
				});
				defer.resolve(self._formatNav('Playlists','folder',self._getIcon(uriParts[1]),['list', 'grid'],items,self._prevUri(curUri)));
                })
                .fail(function(result) {
                        defer.reject(new Error('listPlaylist'));
                });	     
   	 return defer.promise;
}

ControllerVolusonic.prototype.listPodcasts = function (uriParts, curUri) {
        var self = this;
        var defer = libQ.defer();

	var id="All";
	var params = "includeEpisodes=no";

        var result = self.api.get('getPodcasts', id, params)
                .then(function(result) {
				var items = [];
				result['subsonic-response']['podcasts']['channel'].forEach(function (podcast) {
					items.push(self._formatPodcast(podcast,curUri));
				});
				defer.resolve(self._formatNav('Podcasts','item-no-menu',self._getIcon(uriParts[1]),['list', 'grid'],items,self._prevUri(curUri)));
                })
                .fail(function(result) {
                        defer.reject(new Error('listPodcasts'));
                });	     
    	return defer.promise;
}

ControllerVolusonic.prototype.podcastEpisodes = function (uriParts, curUri) {
        var self = this;
        var defer = libQ.defer();

	var id = uriParts.pop();
	var params = "id=" + id;

        var result = self.api.get('getPodcasts', id, params)
                .then(function(result) {
				var items = [];
				result['subsonic-response']['podcasts']['channel']['0']['episode'].forEach(function (episode) {
					items.push(self._formatPodcastEpisode(episode,curUri));
				});
				defer.resolve(self._formatNav(result['subsonic-response']['podcasts']['channel']['0'].title,'folder',self._getIcon(uriParts[1]),['list', 'grid'],items,self._prevUri(curUri)));
                })
                .fail(function(result) {
                        defer.reject(new Error('podcastEpisode'));
                });	     
    	return defer.promise;
}

ControllerVolusonic.prototype.listAlbums = function (uriParts, curUri) {
        var self = this;
        var defer = libQ.defer();

	var params;
	var id = uriParts[1];
	if (id == "genres" ) {
		id = uriParts[2];
		params = "type=byGenre&genre=" + uriParts[2] + "&size=" + self.getSetting('listsSize');
	} else {
		params = "type=" + uriParts[1] + "&size=" + self.getSetting('listsSize');
	}

        var result = self.api.get('getAlbumList2', id, params)
                .then(function(result) {
				var items = [];
				result['subsonic-response']['albumList2']['album'].forEach(function (album) {
					items.push(self._formatAlbum(album,curUri));
				});
				defer.resolve(self._formatNav(uriParts[uriParts.length - 1].charAt(0).toUpperCase() + uriParts[uriParts.length - 1].slice(1),'folder',self._getIcon(uriParts[1]),['list', 'grid'],items,self._prevUri(curUri)));
                })
                .fail(function(result) {
                        defer.reject(new Error('listAlbums'));
                });	     
	return defer.promise;
}

ControllerVolusonic.prototype._prevUri = function (curUri){
	var self = this;
	var lastIndex=curUri.lastIndexOf("/");
	return curUri.slice(0,lastIndex);
}

ControllerVolusonic.prototype._formatNav = function (title, type, icon, views, items, prevUri) {
        var self = this;
	var nav = {         
			navigation: {
				lists: [{
					title: title,
					type: type,
					icon: icon,
					availableListViews: views,
					items: items
				}],
				prev: {
					uri: prevUri
				},
			}
	}
	return nav;
}

ControllerVolusonic.prototype._formatPodcastEpisode = function (episode, curUri) {
	var self = this;
        var item = {
                        service: 'volusonic', 
                        type: 'song', 
                        title: episode.title,
                        artist: new Date(episode.publishDate).toLocaleDateString(),
                        album: episode.description, 
                        albumart: self.config.get('server') + '/rest/getCoverArt?id=' + episode.coverArt + '&' + self.getSetting('artSize') + '&' + self.config.get('auth'), 
                        uri: 'volusonic/track/' + episode.streamId
        }
        return item;
}

ControllerVolusonic.prototype._formatSong = function (song, curUri) {
        var self = this;
        var item = {
			service: 'volusonic',
			type: 'song',
			title: song.title,
			artist: song.artist,
			albumart: self.config.get('server') + '/rest/getCoverArt?id=' + song.coverArt + '&size=' + self.getSetting('artSize') + '&' + self.config.get('auth'),
			uri: 'volusonic/track/' + song.id,
	}
        return item;
}

ControllerVolusonic.prototype._formatPodcast = function (podcast, curUri) {
        var self = this;
        var item = {
                        service: 'volusonic', 
			type: 'item-no-menu', 
                        title: podcast.title,
                        artist: podcast.description,
                        album: "", 
                        albumart: self.config.get('server') + '/rest/getCoverArt?id=' + podcast.coverArt + '&' + self.getSetting('artSize') + '&' + self.config.get('auth'), 
                        icon: "",
                        uri: curUri + '/' + podcast.id
        }
        return item;
}

ControllerVolusonic.prototype._formatAlbum = function (album, curUri) {
	var self = this;
	var item = {
			service: 'volusonic', 
        	        type: 'playlist', 
			title: album.name + ' (' + new Date(album.created).getFullYear() + ')',
			artist: album.artist,
			album: "", 
			albumart: self.config.get('server') + '/rest/getCoverArt?id=' + album.coverArt + '&' + self.getSetting('artSize') + '&' + self.config.get('auth'),
 			icon: "",
			uri: curUri + '/' + album.id
	}

	return item;
}

ControllerVolusonic.prototype._formatPlaylist = function (playlist, curUri) {
        var self = this;
        var item = {
                        service: 'volusonic', 
                        type: 'folder', 
                        title: playlist.name + ' (' + new Date(playlist.created).getFullYear() + ')',
                        albumart: self.config.get('server') + '/rest/getCoverArt?id=' + playlist.coverArt + '&' + self.getSetting('artSize') + '&' + self.config.get('auth'), 
                        icon: "",
                        uri: curUri + '/' + playlist.id
        }
        return item;
}

ControllerVolusonic.prototype._formatArtist = function (artist, curUri) {
        var self = this;

	var item = {
			service: 'volusonic', 
			type: 'item-no-menu', 
			title: artist.name,
			icon: '',
			uri: curUri + '/' + artist.id
	}
        return item;
};

ControllerVolusonic.prototype.listGenres = function (uriParts, curUri) {
        var self = this;
        var defer = libQ.defer();
        var result = self.api.get('getGenres', 'All', '')
                .then(function(result) {
				var item;
				var items = [];
				result['subsonic-response']['genres']['genre'].forEach(function(genre) {
					item = {
						service: 'volusonic', 
                                            	type: 'folder', 
                                            	title: genre.value,
                                                icon: "fa fa-transgender-alt",
                                                uri: curUri + '/' + genre.value
					}
					if (genre.value != "Podcast" && genre.value != "radio") {
						items.push(item);
					}
				});
				/*	items.sort(function(a, b) {
						var tA = a.title.toLowerCase();
						var tB = b.title.toLowerCase();
						
						if (tA < tB){
							return -1;
						}

						if (tB < tA){
							return 1;
						}
						return 0;
					});
				*/
				defer.resolve(self._formatNav(uriParts[1].charAt(0).toUpperCase() + uriParts[1].slice(1),'folder','fa fa-transgender-alt',['list', 'grid'],items,self._prevUri(curUri)));
                })
                .fail(function(result) {
                        defer.reject(new Error('listGenres'));
                });	     
    	return defer.promise;
};

ControllerVolusonic.prototype.listArtists = function (uriParts, curUri) {
        var self = this;
        var defer = libQ.defer();
        var result = self.api.get('getArtists', 'All', '')
                .then(function(result) {
				var list = [];
				var item;
				var items = [];
				var artists = [];

				result['subsonic-response']['artists']['index'].forEach(function (index) {
					index['artist'].forEach(function(artist){
						artists.push(self._formatArtist(artist,curUri));
					});
					item = {
						service: 'volusonic', 
                                             	type: 'item-no-menu', 
                                            	title: index.name,
                                                icon: '',//"fa fa-microphone",
                                                uri: curUri + '/' + index.name,
						items: artists
					}
					list.push(item);
					artists = [];
				});
				defer.resolve({         
		                        navigation: {
                		                lists: list,
                                		prev: {
                                        		uri: self._prevUri(curUri)
                                		}
                        		}
        			});
		})
                .fail(function(result) {
                        defer.reject(new Error('listArtists'));
                });	     
    	return defer.promise;
}

ControllerVolusonic.prototype.artistInfo = function (uriParts, curUri) {
        var self = this;
        var defer = libQ.defer();
	var id = uriParts.pop();

	var result = self.api.get('getArtistInfo2', id, 'id=' + id)
                .then(function(result) {
			
	})
	.fail(function(result) {
                        defer.reject(new Error('artistInfo'));
	});          
	return defer.promise;
}

//Playable function
ControllerVolusonic.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();
	
	var uriParts = uri.split('/');
	var id = uriParts.pop();
	var command;
	var params;
	var items = [];
	var song;

	if (uri.startsWith('volusonic/track')) {
		command = 'getSong';
		params = 'id=' + id;
		var result = self.api.get(command,id,params)
                .then(function(result) {
				song = result['subsonic-response']['song'];
                                defer.resolve(self._getPlayable(song));
		})
                .fail(function(result) {
                        defer.reject(new Error('explodeUri volusonic/track'));
                });    
	}else if (uri.startsWith('volusonic/playlists')){
		command = 'getPlaylist';
		params = 'id=' + id;
		var result = self.api.get(command,id,params)
                .then(function(result) {
			result['subsonic-response']['playlist']['entry'].forEach(function(song) {
                                items.push(self._getPlayable(song));        
			});
			defer.resolve(items);
                })
                .fail(function(result) {
                                defer.reject(new Error('explodeUri volusonic/playlists'));
                });
	}else if (uri.startsWith('volusonic/radio')){
		command = 'getSimilarSongs2';
		params = 'id=' + id + "&count=500";
		var result = self.api.get(command,id,params)
                .then(function(result) {
			result['subsonic-response']['similarSongs2']['song'].forEach(function(song) {
                                items.push(self._getPlayable(song));        
			});
			defer.resolve(items);
                })
                .fail(function(result) {
                                defer.reject(new Error('explodeUri volusonic/radio'));
                });
	}else if (uri.startsWith('volusonic/artists') && uriParts.length == 2){
		var artist = self._artist(id);
		artist.then (function (artist) {
			if (artist.album !== undefined) {
				var proms = [];
				artist['album'].forEach(function (album) {
					var alb = self._album(album.id);
                                        alb.then (function (alb) {
						alb['song'].forEach(function(song){
                                                        items.push(self._getPlayable(song));
                                                });
					});
					proms.push(alb);
                                });
				libQ.all(proms)
				.then(function(){
					defer.resolve(items);
				});
                        }
		});
	}else if (uri.startsWith('volusonic/genres') && uriParts.length == 2){
		command = 'getRandomSongs';
		params = 'genre=' + id + "&size=" + self.getSetting('listsSize');

		var result = self.api.get(command,id,params)
                .then(function(result) {
			result['subsonic-response']['randomSongs']['song'].forEach(function (song) {
				items.push(self._getPlayable(song));
			});
			defer.resolve(items);
                })
                .fail(function(result) {
                                defer.reject(new Error('explodeUri volusonic/genres'));
                });
	} else {
		command = 'getAlbum';
		params = 'id=' + id;
		var result = self.api.get(command,id,params)
                .then(function(result) {
			result['subsonic-response']['album']['song'].forEach(function (song) {
				items.push(self._getPlayable(song));
                        });
			defer.resolve(items);
                })
                .fail(function(result) {
                                defer.reject(new Error('explodeUri volusonic default'));
                });
	}
	return defer.promise;
};

ControllerVolusonic.prototype._getPlayable = function(song) {
		var self = this;

		var format="format=mp3&estimateContentLength=true&maxBitRate=" + self.getSetting('transcode');
		var type = song.transcodedSuffix;
		var bRate = self.getSetting('transcode');
                                
		if (self.getSetting('transcode') === 'raw') {
			format = "format=raw";
			type = song.suffix;
			bRate = song.bitRate;
		}

		var track = {
			service: 'volusonic',
			type: 'song',
			name: song.title,
			title: song.title,
			artist: song.artist,
			duration: song.duration,
			albumart: self.config.get('server') + '/rest/getCoverArt?id=' + song.coverArt + '&size=' + self.getSetting('artSize') + '&' + self.config.get('auth'),
			uri: self.config.get('server') + '/rest/stream?id=' + song.id + '&' + format + '&' + self.config.get('auth'),
			samplerate: bRate + " kbps",
			trackType: type,
			streaming: true
		}
		return track;
}


ControllerVolusonic.prototype.getTrackInfo = function (uri){
	var self = this;
	var deferred = libQ.defer();
	var uriParts = uri.split('/');

        if (uri.startsWith('volusonic/track')){
                var result = self.api.get('getSong',uriParts[2],'id=' + uriParts[2])
                .then(function(result) {
			var song = result['subsonic-response']['song'];
			defer.resolve(self._getPlayable(song));
                })
                .fail(function(result) {
                        defer.reject(new Error('getTrackInfo'));
                });    
        }
        return defer.promise;
}

ControllerVolusonic.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();
	var id = encodeURI(query.value);
	var params = "query=" + encodeURI(query.value) + "&artistCount=" +  self.getSetting('listsSize') + "&albumCount=" + self.getSetting('listsSize') + "&songCount=" + self.getSetting('listsSize');

        var result = self.api.get('search3', id, params)
                .then(function(result){
			var answer = [];
			var artists = [];
			var albums = [];
			var songs = [];
					
			if (result['subsonic-response']['searchResult3']['artist'] !== undefined){
				result['subsonic-response']['searchResult3']['artist'].forEach(function (artist) {
					artists.push(self._formatArtist(artist,"volusonic/artists"));
				});
				answer.push({         
                                	title: self.commandRouter.getI18nString('ARTISTS'),
                                	icon: 'fa fa-microphone',
                                	availableListViews: [
                                        	"list",
                                        	"grid"
                                	],
                                	items: artists
                        	});
			}
			if (result['subsonic-response']['searchResult3']['album'] !== undefined) {
				result['subsonic-response']['searchResult3']['album'].forEach(function (album) {
					albums.push(self._formatAlbum(album,"volusonic/search/" + query.value + "/album"));
				});
				answer.push({         
                                        title: self.commandRouter.getI18nString('ALBUMS'),
                                        icon: 'fa fa-play',
                                        availableListViews: [
                                                "list",
                                                "grid"
                                        ],
                                        items: albums
                                });
			}
			if (result['subsonic-response']['searchResult3']['song'] !== undefined ) {
				result['subsonic-response']['searchResult3']['song'].forEach(function(song) {
					songs.push(self._formatSong(song,"volusonic/search/" + query.value + "/track"));
				});
				answer.push({         
                                        title: self.commandRouter.getI18nString('TRACKS'),
                                        icon: 'fa fa-music',
                                        availableListViews: [
                                                "list",
                                                "grid"
                                        ],
                                        items: songs
                                });
			}
			defer.resolve(answer);
		})
                .fail(function(result) {
                        defer.reject(new Error('search'));
                });	     
	return defer.promise;
};

ControllerVolusonic.prototype._search = function (query,curUri){
	var self = this;
	var defer=libQ.defer();

	var result = self.search(query)
		.then(function(result){
			defer.resolve({
				navigation: {
					lists: result,
                                        prev: {
						uri: self._prevUri(curUri)
					}
				}
			})
		})
		.fail(function(result) {
                        defer.reject(new Error('_search'));
                }); 

	return defer.promise;
}

// Define a method to clear, add, and play an array of tracks
ControllerVolusonic.prototype.clearAddPlayTrack = function (track) {
    var self = this;

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerVolusonic::clearAddPlayTrack');

    return self.mpdPlugin.sendMpdCommand('stop', [])
        .then(function () {
            return self.mpdPlugin.sendMpdCommand('clear', []);
        })
        .then(function () {
            return self.mpdPlugin.sendMpdCommand('load "' + track.uri + '"', []);
        })
        .fail(function (e) {
            return self.mpdPlugin.sendMpdCommand('add "' + track.uri + '"', []);
        })
	.then(function () {
          self.commandRouter.stateMachine.setConsumeUpdateService('volusonic', true);
          //this.mpdPlugin.ignoreUpdate(true);
          self.mpdPlugin.clientMpd.on('system', function (status) {
		  var timeStart = Date.now();
		  self.mpdPlugin.getState().then(function (state) {
			  state.trackType = track.trackType;
			  state.isStreaming = 'true';
			  return self.commandRouter.stateMachine.syncState(state, "volusonic");
            });
          });
          return self.mpdPlugin.sendMpdCommand('play', []).then(function () {
            self.commandRouter.pushConsoleMessage("Volusonic::After Play");
            return self.mpdPlugin.getState().then(function (state) {
		    state.trackType = track.trackType;
		    state.isStreaming = 'true';
		    return self.commandRouter.stateMachine.syncState(state, "volusonic");
            });
          });
        })
        .fail(function (e) {
          return defer.reject(new Error('clearAddPlayTrack: '+e));
        });

	/*.then(function () {
            self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
            return self.mpdPlugin.sendMpdCommand('play', []);
        });*/
};

// Stop
ControllerVolusonic.prototype.stop = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'volusonic::stop');

 	self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
	return self.mpdPlugin.sendMpdCommand('stop', []);
};

// Spop pause
ControllerVolusonic.prototype.pause = function() {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'volusonic::pause');

 	self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
	return self.mpdPlugin.sendMpdCommand('pause', []);
};

// Resume
ControllerVolusonic.prototype.resume = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'volusonic::resume');
    self.commandRouter.stateMachine.setConsumeUpdateService('mpd');

    return self.mpdPlugin.sendMpdCommand('play', []);
};

/*
// Clear
ControllerVolusonic.prototype.clear = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'volusonic::clear');
    self.commandRouter.stateMachine.setConsumeUpdateService('mpd');

    return self.mpdPlugin.sendMpdCommand('stop', [])
        .then(function () {
            return self.mpdPlugin.sendMpdCommand('clear', []);
        });

};
*/

// Seek
ControllerVolusonic.prototype.seek = function (position) {
    var self = this;
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'volusonic::seek');

    return self.mpdPlugin.seek(position);
};

// Get state
ControllerVolusonic.prototype.getState = function() {
	var self = this;

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'volusonic::getState');
};

//Parse state
ControllerVolusonic.prototype.parseState = function(sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'volusonic::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
ControllerVolusonic.prototype.pushState = function(state) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'volusonic::pushState');

	return self.commandRouter.servicePushState(state, self.servicename);
};

