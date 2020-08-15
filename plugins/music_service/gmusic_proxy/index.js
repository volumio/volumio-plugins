'use strict';

var libQ = require('kew');
var http = require('http');
var url = require('url');
var winston = require('winston');
var semver = require('compare-versions');

var glogger = new (winston.Logger)({
				transports: [new (winston.transports.Console)()]
			});

/**
 * These requires are for our playlist fix
 */
const util = require('util');
var fs = require('fs-extra');
const setTimeoutPromise = util.promisify(setTimeout);
/**
 * End playlist fix. 
 */
const GMP_REQUIRED_VERSION = "2.2.0";
const GMPTYPE = 'GMusicProxy';
const GMP = 'gmusic_proxy';
const GURI = 'gmproxy'
const BROWSEDATA = {name: GMPTYPE, uri: GURI,plugin_type:'music_service',plugin_name:GMP, albumart: '/albumart?sourceicon=music_service/gmusic_proxy/gmusic.svg'};
const ROOT_ITEMS = [
	new Item('item-no-menu','My Playlists', '', '', 'fa fa-folder-open-o',GURI+':get_all_playlists'),
	new Item('item-no-menu','My Stations', '', '', 'fa fa-folder-open-o',GURI+':get_all_stations'),
	new Item('item-no-menu','My Library', '', '', 'fa fa-folder-open-o',GURI+':get_collection'),
	new Item('item-no-menu','Situations', '', '', 'fa fa-folder-open-o',GURI+':get_situations'),
	new Item('item-no-menu','Listen Now - Artists', '', '', 'fa fa-folder-open-o',GURI+':get_listen_now'),
	new Item('item-no-menu','Listen Now - Albums', '', '', 'fa fa-folder-open-o',GURI+':get_listen_now:Zm9ybWF0PWpzb24mdHlwZT1hbGJ1bQ=='),
	new Item('playlist','Get Top Songs', '', '', 'fa fa-folder-open-o',GURI+':get_top_songs')
];
const ROOT_MENU = new MenuResponse('/', ROOT_ITEMS);

const EP_FOLDER = { 
	itemType: "folder",
	itemIcon: "fa fa-folder-open-o"
};

const EP_PLAYLIST = { 
	itemType: "playlist",
	itemIcon: "fa fa-folder-open-o"
};

const EP_SONG = {
	itemType: "song",
	itemIcon: "fa fa-music"
};

const ENDPOINT_MAP = {
	get_song: EP_SONG,
	get_playlist: EP_PLAYLIST,
	get_station: EP_PLAYLIST,
	get_all_playlists: EP_FOLDER,
	get_all_stations: EP_FOLDER,
	get_collection: EP_PLAYLIST,
	get_new_station_by_id: EP_PLAYLIST,
	get_listen_now_list: EP_FOLDER
};


module.exports = GMusicProxy;
function GMusicProxy(context) {
	var self = this;
	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	glogger = this.context.logger;
	this.configManager = this.context.configManager;
	setTimeoutPromise(500).then(() => self.fixPlaylist(this.commandRouter)).catch((e) => { 
		self.logger.debug("GMusicProxy::Error: " + e);
	});
}

/** 
 * The method recursively waits until the playlist manager is instantiated and then we 
 * override the commonAddToPlaylist method so we can deal w/GMP items correctly.
*/
GMusicProxy.prototype.fixPlaylist = function(commandRouter) {
	var self = this;
	var playListManager = commandRouter.playListManager;
	if (!playListManager || !playListManager.commonAddToPlaylist) {
		setTimeoutPromise(500).then((commandRouter) => self.fixPlaylist(commandRouter)).catch((e) => { 
			self.logger.debug("GMusicProxy:: Error: " + e);
		});
		self.logger.info("GMusicProxy:: Playlist Manager still null");
		return;
	}
	self.logger.info("GMusicProxy:: PlaysList Manager not null, we can try to fix it now");
	self.origPLM = playListManager.commonAddToPlaylist;
	playListManager.commonAddToPlaylist = self.commonAddToPlaylist;
}

GMusicProxy.prototype.commonAddToPlaylist = function(folder, name, service, uri, title) {
	var self = this.commandRouter.pluginManager.getPlugin('music_service', GMP);
	self.logger.debug("GMusicProxy::commonAddToPlaylist ");
	if (service !== GMP) {
		return self.origPLM(folder, name, service, uri, title);
	}
	self.logger.debug("the gmusic override uri:" + uri + " folder:" + folder + " name:" + name + " service:" + service + " title:" + title );

	var defer = libQ.defer();

	var filePath = folder + name;
	playlistFileExists(filePath)
		.then(() => {
			self.logger.debug("GMusicProxy::commonAddToPlaylist Exploding items");
			return self.explodeUri(uri)
		})
		.then((entries) => {
			self.logger.debug("GMusicProxy::commonAddToPlaylist Writing Playlist");
			entries[0].service = GMP;
			entries[0].uri = uri;
			self.writeJSON(entries, folder, name, defer)
		});
	return defer.promise;
}

function playlistFileExists(filePath) {
	var fileDefer=libQ.defer();
	fs.exists(filePath, function (exists) {
		if (!exists) {
			var playlist = [];
			fs.writeJson(filePath, playlist, function (err) {
				if (err) {
					fileDefer.reject(new Error());
				} else {
					fileDefer.resolve();
				}
			})
		} else {
			fileDefer.resolve();
		}
	});
	return fileDefer.promise;
}

GMusicProxy.prototype.writeJSON = function(entries, folder, name, defer) {
	var self = this;
	var filePath = folder + name;
	self.logger.debug("Reading filepath " + filePath);
	fs.readJson(filePath, function (err, data) {
		if (err) {
			self.logger.warn("ERR "+err);
			defer.resolve({success: false});
		} else {
			self.logger.debug("Read this data "+data)
			if (!data) {
				data=[];
			}
			var output = data.concat(entries);

			self.saveJSONFile(folder, name, output).then(function(){
				var favourites = self.commandRouter.checkFavourites({uri: path});
				defer.resolve(favourites);
			}).fail(function(){
				defer.resolve({success:false});
			})
		}
	});        
}

GMusicProxy.prototype.saveJSONFile = function(localFolder, fileName, data) {
    var self=this;
    var defer=libQ.defer();

    if((this.commandRouter.sharedVars.get('myVolumio.cloudDeviceEnabled') === 'true'))
    {
        return self.commandRouter.executeOnPlugin('system_controller', 'my_volumio', 'saveCloudItem', {
            fileName:fileName,
            data:data
        });
    } else {
        fs.writeJson(localFolder + fileName, data, function (err) {
            if (err)
                defer.reject(new Error());
            else defer.resolve();
        })
    }

    return defer.promise;
}

GMusicProxy.prototype.onVolumioStart = function() {
	var self = this;
	var configFile = self.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);
	self.logger.debug('GMusicProxy::onVolumioStart');

    return libQ.resolve();
};

GMusicProxy.prototype.onStart = function() {
    var self = this;
	self.logger.debug('Starting GMusicProxy plugin');
	self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service','mpd');
	self.addToBrowseSources();
    return libQ.resolve();
};

GMusicProxy.prototype.onStop = function() {
    var self = this;
	self.commandRouter.volumioRemoveToBrowseSources(BROWSEDATA.name);
    return libQ.resolve();
};

GMusicProxy.prototype.onRestart = function() {
    return libQ.resolve();
};

// Configuration Methods -----------------------------------------------------------------------------

GMusicProxy.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
			uiconf.sections[0].content[0].value = self.config.get('address');
			uiconf.sections[0].content[1].value = self.config.get('port');
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error('Failed to load config'));
        });

    return defer.promise;
};

GMusicProxy.prototype.getConfigurationFiles = function() {
	return ['config.json'];
};

GMusicProxy.prototype.setUIConfig = function(data) {
	var self = this;
	//Perform your installation tasks here
};

GMusicProxy.prototype.getConf = function(varName) {
	var self = this;
	//Perform your installation tasks here
};

GMusicProxy.prototype.setConf = function(varName, varValue) {
	var self = this;
	//Perform your installation tasks here
};


// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it

GMusicProxy.prototype.addToBrowseSources = function () {
	this.logger.debug('GMusicProxy::addToBrowseSources');
    this.commandRouter.volumioAddToBrowseSources(BROWSEDATA);
};

GMusicProxy.prototype.handleBrowseUri = function(curUri) {
	var self = this;
	var log = self.logger;
	log.debug('GMusicProxy::handleBrowseUri ' + curUri)
	if (!curUri.startsWith(GURI)) {
		return;
	}
	var uriTokens = curUri.split(':');
	if (uriTokens.length == 1) {
		// root, return default
		return libQ.resolve(ROOT_MENU.getEntry());
	}
	
	return self.fetchMenuEntry(uriTokens, curUri);
};

GMusicProxy.prototype.fetchMenuEntry = function(uriTokens, curUri) {
	var self = this;
	var options = self.uriToOptions(uriTokens);
	var defer = libQ.defer();
    self.httpGet(options).then((body) => {
		var items = jspfToItems(curUri, body);
		var response = new MenuResponse(self.getParentUri(uriTokens),items);
		defer.resolve(response.getEntry()); 
	}).fail((e) => defer.reject(new Error(e)));
	return defer.promise;
};

GMusicProxy.prototype.addToFavourites = function(meta) {
	var self = this;
	self.logger.debug('GMusicProxy::addToFavourites ' + JSON.stringify(meta));
	return libQ.resolve({});
};

GMusicProxy.prototype.uriToOptions = function(uriTokens) {
	var len = uriTokens.length;
	var path;
	if (len == 2) {
		path = uriTokens[1];
	} else {
		path = uriTokens[len-2] + '/' + uriTokens[len-1];
	}
	return this.buildOptions(path);
};

GMusicProxy.prototype.getParentUri = function(uriTokens) {
	if (uriTokens.length == 2) {
		return GURI;
	}
	var copy = [...uriTokens];
	copy.splice(-2,2)
	return copy.join(":");
};

// Define a method to clear, add, and play an array of tracks
GMusicProxy.prototype.clearAddPlayTrack = function(track) {
	var self = this;
	self.logger.debug('GMusicProxy::clearAddPlayTrack');

	return self.mpdPlugin.sendMpdCommand('stop', [])
    .then(() => self.mpdPlugin.sendMpdCommand('clear', []))
    .then(() => {
		var streamurl = self.toStreamURL(track);
		self.logger.debug("GMusicProxy::clearAddPlayTrack add " + streamurl)
		return self.mpdPlugin.sendMpdCommand('add "'+streamurl+'"',[])
	})
    .then(() => {
      self.mpdPlugin.clientMpd.on('system', (status) => {
		  if (typeof status !== 'string') {
			status.trackType = GMPTYPE;
		  }
		  return self.commandRouter.stateMachine.syncState(status, GMP);  
      });

	  return self.mpdPlugin.sendMpdCommand('play', []).then(() => this.getAndSyncState());

    })
    .fail((e) => { return defer.reject(new Error(e));});

};

GMusicProxy.prototype.prefetch = function (nextTrack) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'GMusicProxy::prefetch');
	return self.mpdPlugin.sendMpdCommand('add "' + self.toStreamURL(nextTrack) + '"', [])
		.then(() => self.mpdPlugin.sendMpdCommand('consume 1', []));
  };

GMusicProxy.prototype.toStreamURL = function(track) {
	var self = this;
	self.logger.debug("GMusicProxy::toStreamURL "+ JSON.stringify(track))
	var uriTokens = track.uri.split(":");
	var lastIdx = uriTokens.length - 1;
	return "http://" + self.config.get('address') + ":" + self.config.get('port') + "/" + uriTokens[lastIdx-1] + "/" + uriTokens[lastIdx];
}

GMusicProxy.prototype.stop = function () {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'GMusicProxy::stop');
	return self.mpdPlugin.stop().then(() => self.getAndSyncState());
  };
  
GMusicProxy.prototype.pause = function () {
	var self = this;
	self.commandRouter.pushConsoleMessage('GMusicProxy::pause');
	// TODO don't send 'toggle' if already paused
	return self.mpdPlugin.pause().then(() => self.getAndSyncState());
  };
  
GMusicProxy.prototype.resume = function () {
	var self = this;
	self.commandRouter.pushConsoleMessage('GMusicProxy::resume');
	// TODO don't send 'toggle' if already playing
	return self.mpdPlugin.resume().then(() => self.getAndSyncState());
  };
  
GMusicProxy.prototype.seek = function (position) {
	var self = this;
	self.commandRouter.pushConsoleMessage('GMusicProxy::seek');
	return self.mpdPlugin.seek(position);
  };
  
GMusicProxy.prototype.next = function () {
	var self = this;
	self.commandRouter.pushConsoleMessage('GMusicProxy::next');
	return self.mpdPlugin.sendMpdCommand('next', []).then(() => self.getAndSyncState());
  };
  
GMusicProxy.prototype.previous = function () {
	var self = this;
	self.commandRouter.pushConsoleMessage('GMusicProxy::previous');
	return self.mpdPlugin.sendMpdCommand('previous', []).then(() => self.getAndSyncState());
  };

GMusicProxy.prototype.getAndSyncState = function() {
	var self = this;
	return self.mpdPlugin.getState().then((state) => {
		state.trackType = GMPTYPE;
		return self.commandRouter.stateMachine.syncState(state, GMP);
	});
};

//Parse state
GMusicProxy.prototype.parseState = function(sState) {
	var self = this;
	self.logger.debug('GMusicProxy::parseState');
	//Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
GMusicProxy.prototype.pushState = function(state) {
	var self = this;
	self.logger.debug('GMusicProxy::pushState');
	return self.commandRouter.servicePushState(state, GMP);
};


GMusicProxy.prototype.explodeUri = function(uri) {
	var self = this;
	var defer=libQ.defer();
	glogger.debug("GMusicProxy::explodeUri " + JSON.stringify(uri));
	var uriTokens = uri.split(':');
	// bail... we shouldn't get here for top level menu items
	if (uriTokens.length < 4 && uriTokens[uriTokens.length-1] !== 'get_top_songs') {
		return defer.resolve;
	}
	if (uriTokens[uriTokens.length-2] === 'get_song') {
		self.fetchSongInfoItem(uriTokens)
		.then((item) => {
			var response=[item];
			glogger.debug("GMusicProxy::explode callback: " + JSON.stringify(response))
			defer.resolve(response);
		})
		.fail((e) => defer.reject(new Error(e)));
	} else {
		// playlist, etc recurse
		self.fetchMenuEntry(uriTokens, uri)
		.then((menuResponse) => {
			glogger.debug("GMusicProxy::explode fetchMenuEntry:", JSON.stringify(menuResponse))
			var items = menuResponse.navigation.lists[0].items;
			items.forEach(i => { delete i.icon; i.type = "track"; });
			defer.resolve(items);
		});
	}
	// Mandatory: retrieve all info for a given URI
	return defer.promise;
};

GMusicProxy.prototype.fetchSongInfoItem = function(uriTokens) {
	var self = this;
	var lastIdx = uriTokens.length-1;
	var options = this.buildOptions("get_song_info/" + uriTokens[lastIdx]);
	var defer = libQ.defer();
	self.httpGet(options).then((body) => {
		var item = self.songInfoToItem(body, uriTokens);
		defer.resolve(item);
	}).fail((e) => { // retry once
		return libQ.delay(1000).then(() => self.httpGet(options));
	}).then((body) => {
			var item = self.songInfoToItem(body, uriTokens);
			defer.resolve(item);
	}).fail((e) => defer.reject(new Error(e)));
	return defer.promise;
}

GMusicProxy.prototype.songInfoToItem = function(body, uriTokens) {
	var songMeta = JSON.parse(body);
	glogger.debug("songInfoToItem body: " + body)
	var item = new Item('track', songMeta.title, songMeta.artist, songMeta.album, null, uriTokens.join(':'));
	item.albumart = songMeta.albumArtRef[0].url;
	item.duration = Math.trunc(songMeta.durationMillis/1000);
	item.samplerate = '44.1 kHz';
	item.bitdepth = '320kbps CBR';
	item.trackType = 'mp3';
	return item;
}

GMusicProxy.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();
	self.logger.debug("GMusicProxy::search " + query);
	
	// setup the search type
	var searchParams = self.parseSearchType(query.value);
	var qString = [];
	for(var key in searchParams) {
		if (searchParams.hasOwnProperty(key)) {
			qString.push(key + '=' + encodeURIComponent(searchParams[key]));
		}
	}
	var path = "get_by_search?" + qString.join('&');
	var options = self.buildOptions(path);
	self.httpGet(options).then((body) => {
		var items = jspfToItems(GURI+":search:results", body);
		var response = new MenuResponse(GURI,items);
		var searchResults = response.getEntry().navigation.lists[0];
		searchResults.title = "GMusicProxy returned " + items.length + " results";
		defer.resolve([searchResults]); 
	}).fail((e) => defer.reject(new Error(e)));
	return defer.promise;
};

GMusicProxy.prototype.parseSearchType = function (search) {
	var typePattern = /(?:(artist|title|type):)/g;
	var validTypes = /(matches|album|artist)(.*)?/g;
	var searchParts = search.split(typePattern);
	var result = {
		type: 'matches',
	};
	var untaggedText = searchParts[0].trim();
	for (var i = 1; i<searchParts.length; i++) {
		result[searchParts[i]] = searchParts[++i].trim();
	}
	var type_splits = validTypes.exec(result.type);
	if (!type_splits) {
		result.type = 'matches';
	} else if (type_splits[2]) {
		// additional text with the type
		untaggedText += ' ' + type_splits[2].trim();
		result.type = type_splits[1];
	}
	// untagged search make some assumptions
	untaggedText = untaggedText.trim();
	if (untaggedText.length > 0) {
		if (result.type === 'artist' && !result.artist) {
			result.artist = untaggedText;
		} else if (!result.title) {
			result.title = untaggedText;
		} else {
			result.artist = untaggedText;
		}
	}
	return result;
};

GMusicProxy.prototype.saveGMusicConfig = function (data) {
	let gm_address = data['address']
	let gm_port = parseInt(data['port']);
	var options = this.buildOptions('get_version');
	options.host = gm_address;
	options.port = gm_port;
	var defer=libQ.defer();
	this.httpGet(options).then(
		(body) => {
			let version = JSON.parse(body)["version"];
			glogger.debug("GMusicProxy::saveGMusicConfig received version " + version);
			if (semver.validate(version) && semver(version, GMP_REQUIRED_VERSION)>=0) {
				this.config.set('address', gm_address);
				this.config.set('port', gm_port);
				this.commandRouter.pushToastMessage('success', "Configuration update", 'The configuration has been successfully updated');
			} else {
				this.commandRouter.pushToastMessage('error', "Configuration error", 'Connection error. Incorrect parameters or GMusicProxy 1.0.10+ is required for this version of the plugin.');
			}
			defer.resolve();
		}
	).fail((e) => {
		glogger.error("Failed to contact GMusicProxy " + gm_address + ":" + gm_port);
		this.commandRouter.pushToastMessage('error', "Configuration error", 'An error occurred trying to contact the GMusiceProxy');
		defer.reject(e);
	})
	
	return defer.promise
};

GMusicProxy.prototype.buildOptions = function(path) {
	var self = this;
	var req_headers = {
		'Accept': 'application/json'
	};
	var options = {
		host: self.config.get('address'),
		port: self.config.get('port'),
		path: "/" + path,
		headers: req_headers
	};
	return options;
}

function Item(type, title, artist, album, icon, uri) {
	this.service = GMP;
	this.type = type;
	this.title = title;
	this.name = title;
	this.artist = artist;
	this.album = album;
	this.icon = icon;
	this.uri =  uri;
}

function MenuResponse(prevuri, itemArray=[]) {
	this.prevuri = prevuri;
	this.itemArray = itemArray;
};

MenuResponse.prototype.getEntry = function() {
	var self = this;
	var entry = {
		navigation: {
			"lists": [
				{
					"availableListViews": [ "list", "grid" ],
					"items": self.itemArray
				}
			],
			"prev": {
				uri: self.prevuri
			}
		}
	};
	return entry;
}

function jspfToItems(curUri, body) {
	var jspf = JSON.parse(body)
	glogger.debug("jspfToItems: " + JSON.stringify(jspf))
	var playlist = jspf.playlist.track
	var items = [];
	playlist.forEach(entry => {
		var entryURL = url.parse(entry.location)
		var entryEndpoint = entryURL.pathname.split('/')
		var itemMeta = ENDPOINT_MAP[entryEndpoint[1]];
		var itemUri = curUri + entryEndpoint.join(":")
		// title album artist
		var item = new Item(itemMeta.itemType, entry.title, entry.creator, entry.album, itemMeta.itemIcon, itemUri);
		if (entry.image) {
			item.albumart = entry.image;
			delete item.icon;
		}
		if (item.type === EP_SONG.itemType) {
			item.duration = Math.trunc(entry.duration/1000);
			item.samplerate = '44.1 kHz';
			item.bitdepth = '320kbps CBR';
			item.trackType = 'mp3';
		}
		items.push(item);
	});
	return items;
}

GMusicProxy.prototype.httpGet = function(options) {
	var log = this.logger;
	var defer = libQ.defer();
	log.debug(JSON.stringify(options));
	http.get(options, (res) => {
		var body = [];
		res.on('data', (chunk) => { body.push(chunk); });
		res.on('end', () => {
			var response = body.join('');
			defer.resolve(response);
		});
	  }).on('error', (e) => {
		log.error("Got error: " + e.message);
		defer.reject(e);
	  });
	  return defer.promise;
}
