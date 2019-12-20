'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
var url = require('url');
var dnsSync = require('dns-sync')

var NanoTimer = require('nanotimer');
var anesidora = require('anesidora');


module.exports = ControllerPandora;
function ControllerPandora(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

}



ControllerPandora.prototype.onVolumioStart = function ()
{
	var self = this;
    var defer = libQ.defer();
	var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
	this.config = new (require('v-conf'))();
	this.config.loadFile(configFile);

    defer.resolve();
    
    return defer.promise;
};

ControllerPandora.prototype.onStart = function () {
    var self = this;

    self.servicename = 'pandora';
    self.maxSongs = 4;

    self.state = {};

    self.loginInfo = {
        email: self.config.get('email'),
        password: self.config.get('password'),
        loggedIn: false
    };
    self.useCurl302WorkAround = self.config.get('useCurl302WorkAround');

    // reinventing the wheel
    self.songCntr = (function () {
        var i = 0;
        return {
            count: function () { return i++; },
            reset: function () { i = 0; }
        }
    })();

    self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

    if (!self.loginInfo.email || !self.loginInfo.password) { // not configured
        self.logger.error('[Pandora] Missing email or password');
        self.commandRouter.pushToastMessage('error',
                            'Pandora Login',
                            'Need email address and password. See plugin settings.');
        
        return libQ.reject('[Pandora] Need email and password');
    }

    return self.initialSetup()
        .then(function () {
            return self.addToBrowseSources();
        })
        .fail(function err() {
            self.logger.error('[Pandora] Error loading stations. ' + err);
            self.commandRouter.pushToastMessage('error',
                                    'Pandora login?',
                                    'Stations not loaded.  Check configuration');
            return libQ.reject(new Error(err));
        });
};

ControllerPandora.prototype.onStop = function () {
    var self = this;
    var defer=libQ.defer();
    
    if (self.timer) {
        self.timer.clear();
    }
    if (self.stateTimer) {
        self.stateTimer.clear();
    }

    return self.mpdPlugin.sendMpdCommand('stop', [])
        .then(function () {
            return self.mpdPlugin.sendMpdCommand('clear', []);
        })
        .then(function () {
            return self.volumioUnsetVolatile();
        });
    // Once the Plugin has successfull stopped resolve the promise
};

ControllerPandora.prototype.onRestart = function () {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

ControllerPandora.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function (uiconf)
        {
            uiconf.sections[0].content[0].value = self.config.get('email', '');
            uiconf.sections[0].content[1].value = self.config.get('password', '');
            uiconf.sections[0].content[2].value = self.config.get('useCurl302WorkAround', '');
            
            defer.resolve(uiconf);
        })
        .fail(function ()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

ControllerPandora.prototype.getConfigurationFiles = function () {
	return ['config.json'];
};

ControllerPandora.prototype.setUIConfig = function (data) {
	var self = this;
	//Perform your installation tasks here
};

ControllerPandora.prototype.getConf = function (varName) {
	var self = this;
	//Perform your installation tasks here
};

ControllerPandora.prototype.setConf = function (options) {
	var self = this;

    self.config.set('email', options.email);
    self.config.set('password', options.password);
    self.config.set('useCurl302WorkAround',options.useCurl302WorkAround);
    self.loginInfo.email = options.email;
    self.loginInfo.password = options.password;
    self.useCurl302WorkAround = options.useCurl302WorkAround;
    
     if (!self.loginInfo.loggedIn) {
        return self.initialSetup()
            .then(function () {
                return self.addToBrowseSources();
            })
            .fail(function err() {
                self.logger.error('[Pandora] Error loading stations. ' + err);
                self.commandRouter.pushToastMessage('error',
                                        'Pandora login?',
                                        'Stations not loaded.  Check configuration');
            });

        
    }
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


ControllerPandora.prototype.addToBrowseSources = function () {
	// Use this function to add your music service plugin to music sources
    var data = {
        name: 'Pandora Radio',
        uri: 'pandora',
        albumart: '/albumart?sourceicon=music_service/pandora/pandora.png',
        icon: 'fa fa-microphone',
        plugin_type: 'music_service',
        plugin_name: 'pandora'
    };

    this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerPandora.prototype.iscurrService = function() {
    // Check what is the current volumio service
    var self = this;
    const currentstate = self.commandRouter.volumioGetState();
    self.logger.info(`Currently active:${currentstate.service}`);
    if (currentstate != undefined && currentstate.service != undefined && currentstate.service != self.servicename) {
      return false;
    }
    return true
};

ControllerPandora.prototype.volumioSetVolatile = function () {
    var self = this;

    self.context.coreCommand.stateMachine.setConsumeUpdateService(undefined);
    self.context.coreCommand.stateMachine.setVolatile({
        service: self.servicename,
        callback: self.unsetVol.bind(self)
    });

    return libQ.resolve();
};

ControllerPandora.prototype.volumioUnsetVolatile = function () {
    var self = this;

    self.context.coreCommand.stateMachine.unSetVolatile();
    self.context.coreCommand.stateMachine.resetVolumioState().then(
        self.context.coreCommand.volumioStop.bind(self.commandRouter));
            
    return libQ.resolve();
};

ControllerPandora.prototype.initialSetup = function () {
    var self = this;
    var defer = libQ.defer();

    self.stationList = [];
    self.pandora = new anesidora(self.loginInfo.email, self.loginInfo.password);

    return self.pandoraLogin()
        .fail(function (err) {
            if (err === 1011) {
                self.logger.error('[Pandora] Invalid Username');
                self.commandRouter.pushToastMessage('error',
                                            'Pandora Login Error',
                                            'Invalid Username');
                defer.reject('Invalid Username');
            }
            else if (err === 1012) {
                self.logger.error('[Pandora] Invalid Password');
                self.commandRouter.pushToastMessage('error',
                                            'Pandora Login Error',
                                            'Invalid Password');
                defer.reject('Invalid Password');
            }
            else {
                self.logger.error('[Pandora] Other Login Error: ' + err);
                self.commandRouter.pushToastMessage('error',
                                            'Pandora Login Error',
                                            'Other Login Error: ' + err);
                defer.reject(new Error('[Pandora] Other login error: ' + err));
            }
        
        return defer.promise;
        })
        .then(function () {
            self.logger.info('[Panodora] Logged in');
            self.commandRouter.pushToastMessage('success', 'Pandora Login', 'Successful Pandora Login');
            return self.pandoraUserGetStationList();
        })
        .fail(function (err) {
            defer.reject('[Pandora] Error getting stationList: ' + err);
            self.logger.error('[Pandora] Error getting stationList: ' + err);

            return defer.promise;
        })
        .then(function (stationList) {
            for (var i = 0; i < stationList.stations.length; i++) {
                self.stationList.push(stationList.stations[i].stationName);
            }
            self.loginInfo.loggedIn = true;
            defer.resolve(self.pandora.stationList);
           
           return defer.promise;
        })
        .fail(function (err) {
            defer.reject('[Pandora] Error retrieving stations from stationList: ' + err);
            self.logger.error('[Pandora] Error retrieving stations from stationList: ' + err);

            return defer.promise;
        });
};

ControllerPandora.prototype.handleBrowseUri = function (curUri) {
    var self = this;

    var response = {
        navigation: {
            'prev': {
                uri: 'pandora'
            },
            'lists': [
                {
                    'availableListViews': ['list'],
                    'items': []
                }
            ]
        }
    };

    if (curUri.startsWith('pandora')) {
        if (curUri === 'pandora') {
            for (var i = 0; i < self.stationList.length; i++) {
                response.navigation.lists[0].items.push({
                    service:  self.servicename,
                    type: 'mywebradio',
                    artist: '',
                    title: self.stationList[i],
                    name: self.stationList[i],
                    album: '',
                    albumart: '/albumart?sourceicon=music_service/pandora/pandora.png',
                    icon: 'fa fa-music',
                    uri: 'pandora/stations/' + '?id=' + i
                });
            }
            return libQ.resolve(response);
        }
    }
};

// Define a method to clear, add, and play an array of tracks
ControllerPandora.prototype.clearAddPlayTrack = function (track) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::clearAddPlayTrack');
    
    self.commandRouter.logger.info(JSON.stringify(track));

    if (self.timer) {
        self.timer.clear();
    }
    if (self.stateTimer) {
        self.stateTimer.clear();
    }

    var matches = track.uri.match(/pandora\/stations\/\?id=(\d+)/);
    self.currStation = {id: matches[1], name: self.stationList[matches[1]]};

    self.commandRouter.pushToastMessage('info', 'Pandora Station Selected',
                                                'Loading ' + self.currStation.name);
    var songs;
    return self.getTracks(self.maxSongs)
        .then(function (result) {
            songs = result;
        })
        .then(function () {
            return self.mpdPlugin.sendMpdCommand('stop', []);
        })
        .then(function () {
            return self.mpdPlugin.sendMpdCommand('clear', []);
        })
        .then(function () {
            // have mpd remove played tracks from playlist
            return self.mpdPlugin.sendMpdCommand('consume 1', []);
        })
        .then(function () {
            // Here we go! (¡Juana's Adicción!)
            return self.playNextTrack(songs);
        })
        .fail(function (err) {
            return libQ.reject(new Error(err));
        });
};

ControllerPandora.prototype.seek = function (timepos) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::seek to ' + timepos);
    
    return libQ.resolve();        
};

// Stop
ControllerPandora.prototype.stop = function () {
	var self = this;

	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::stop');
    
    if (self.timer) {
        self.timer.clear();
    }
    if (self.stateTimer) {
        self.stateTimer.clear();
    }

    return self.mpdPlugin.stop()
        .then(function () {
            self.state.status = 'stop';
            self.pushState(self.state, false);
        });
};

// Spop pause
ControllerPandora.prototype.pause = function () {
    var self = this;
    
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::pause');
    

    if (self.timer) {
        self.timer.pause();
    }
    if (self.stateTimer) {
        self.stateTimer.pause();
    }

    // For some reason the state has to be set more than once here
    return self.mpdPlugin.sendMpdCommand('pause', [1])
        .then(function () {
            self.state.status = 'pause';
            self.pushState(self.state, true);
        });
};

ControllerPandora.prototype.resume = function () {
    var self = this;

    return self.mpdPlugin.sendMpdCommand('play', [])
        .then(function () {
            if (self.timer) {
                self.timer.resume();
            }
            if (self.stateTimer) {
                self.stateTimer.resume();
            }

            self.state.status = 'play';
            self.pushState(self.state, true);
        });
};

ControllerPandora.prototype.previous = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::previous');

    return libQ.resolve();
};

ControllerPandora.prototype.next = function () {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::next');

    if (self.timer) {
        self.timer.clear();
    }
    if (self.stateTimer) {
        self.stateTimer.clear();
    }
    
    self.songsArray.shift();  // should have at least one track here
    return self.mpdPlugin.sendMpdCommand('stop', [])
        .then(function () {
            return self.mpdPlugin.sendMpdCommand('clear', []);
        })
        .then(function () {
            return self.playNextTrack(self.songsArray);
        });
};

// Get state
ControllerPandora.prototype.getState = function () {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::getState');


};

//Parse state
ControllerPandora.prototype.parseState = function (sState) {
	var self = this;
	self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::parseState');

	//Use this method to parse the state and eventually send it with the following function
};

ControllerPandora.prototype.pushState = function (state, repeat) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::pushState');

    self.volumioSetVolatile()
        .then(function () {
            self.commandRouter.servicePushState(state, self.servicename);
        });
   
    if (repeat) { // why does this need to repeat?
        setTimeout(self.commandRouter.servicePushState.bind(self.commandRouter), 200, state, self.servicename);
    }
};

ControllerPandora.prototype.explodeUri = function (uri) {
	var self = this;

    // Mandatory: retrieve all info for a given URI
    var matches = uri.match(/pandora\/stations\/\?id=(\d+)/);
    self.currStation = {id: matches[1], name: self.stationList[matches[1]]};
    
    var response = [];
    response.push({
        service: self.servicename,
        type: 'mywebradio',
        trackType: 'mp3',
        name: self.currStation.name,
        albumart: '/albumart?sourceicon=music_service/pandora/pandora.png',
        uri: uri,
        duration: 1000,
        samplerate: '44.1 KHz',
        bitdepth: '16 bit',
        channels: 2
    });

    return libQ.resolve(response);
};

ControllerPandora.prototype.getAlbumArt = function (data, path) {

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

		web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large';
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





ControllerPandora.prototype.search = function (query) {
	var self=this;
	var defer=libQ.defer();

	// Mandatory, search. You can divide the search in sections using following functions

	return defer.promise;
};

ControllerPandora.prototype._searchArtists = function (results) {

};

ControllerPandora.prototype._searchAlbums = function (results) {

};

ControllerPandora.prototype._searchPlaylists = function (results) {


};

ControllerPandora.prototype._searchTracks = function (results) {

};

ControllerPandora.prototype.pandoraLogin = function () {
    // Login with pandora anesidora object
    var self = this;
    var defer = libQ.defer();
    self.pandora.login(defer.makeNodeResolver());

    return defer.promise;
};

ControllerPandora.prototype.pandoraUserGetStationList = function () {
    // Retrieve a raw Pandora station list object
    var self = this;
    var defer = libQ.defer();
    self.pandora.request('user.getStationList', defer.makeNodeResolver());

    return defer.promise;
};


ControllerPandora.prototype.pandoraStationGetPlaylist = function (stationList, stationId) {
    // Retrieve a raw Pandora playlist from a Pandora station index
    var self = this;
    var defer = libQ.defer();
    var station = stationList.stations[stationId];

    self.pandora.request('station.getPlaylist', {
        'stationToken': station.stationToken,
        'additionalAudioUrl': 'HTTP_128_MP3',
        'includeTrackLength': true
        }, defer.makeNodeResolver());

    return defer.promise;
};

ControllerPandora.prototype.getSongsFromPandoraPlaylist = function (playlist, numSongs) {
    // Retrieve an array of songs we can use from a raw Pandora playlist
    var self = this;
    var defer = libQ.defer();
    var response = [];

    for (var i = 0; i < numSongs; i++) {
        var track = playlist.items[i];
        response.push({
            service: self.servicename,
            type: 'track',
            trackType: 'mp3',
            radioType: self.servicename,
            title: track.songName,
            artist: track.artistName,
            album: track.albumName,
            albumart: track.albumArtUrl,
            uri: track.additionalAudioUrl,
            streaming: true,
            //disableUiControls: true,
            duration: track.trackLength,
            samplerate: '44.1 KHz',
            bitdepth: '16 bit',
            channels: 2
        });
    }
    defer.resolve(response);

    return defer.promise;
};

ControllerPandora.prototype.parseSongState = function (song) {
    var self = this;

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::parseSongState');

    var pState = song;
    var posCount;
    var flag = false;

    if (typeof self.state.uri === 'undefined' || self.state.uri !== pState.uri) {
        self.songCntr.reset();
        flag = true;
    }

    pState.status = 'play';
    pState.volatile = true;
    posCount = self.songCntr.count();
    pState.position = posCount;
    pState.seek = posCount * 1000;
    
    self.state = pState;

    self.pushState(self.state, flag);
};

ControllerPandora.prototype.getTracks = function (numSongs) {
    var self = this;
    return self.pandoraLogin()
        .fail(function (err) {
            self.logger.error('[Pandora] Login error: ' + err);
            return libQ.reject('[Pandora] Login error: ' + err);
        })
        .then(function () {
            return self.pandoraUserGetStationList();
        })
        .fail(function (err) {
            self.logger.error('[Pandora] Error getting station list: ' + err);
            return libQ.reject('[Pandora] Error getting station list: ' + err);
        })
        .then(function (stationList) {
            return self.pandoraStationGetPlaylist(stationList, self.currStation.id);
        })
        .fail(function (err) {
            self.logger.error('[Pandora] Error getting playlist: ' + err);
            return libQ.reject('[Pandora] Error getting playlist: ' + err);
        })
        .then(function (playlist) {
            return self.getSongsFromPandoraPlaylist(playlist, numSongs);
        })
        .fail(function (err) {
            self.logger.error('[Pandora] Error getting songs from playlist: ' + err);
            return libQ.reject('[Pandora] Error getting songs from playlist: ' +err);
        });
};

ControllerPandora.prototype.playNextTrack = function (songs) {
    var self = this;
    var songsArray = songs;
    var lengthErr = 500; // song length error = +/- 1 sec
    //var songLag = 750;  // allow for slight lag between songs
    var songLag = 0;
    
    function setTimers() {
        // calculate time of next track + delay
        var duration = songsArray[0].duration * 1000 + lengthErr + songLag;
        self.logger.info('[' + Date.now() + '] ' +
            '[Pandora] Setting timer to: ' + duration + ' milliseconds.');

        self.stateTimer = new StateUpdateTimer(self.parseSongState.bind(self), [songsArray[0]], duration);
        
        songsArray.shift();
        self.songsArray = songsArray; //self.songsArray needed for "next" method

        // You go back, Jack.  Do it again... (Steely Dan)
        // And now we're back where we started.  Here we go round again... (The Kinks)
        self.timer = new PandoraSongTimer(self.playNextTrack.bind(self), [songsArray], duration);
    }

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::playNextTrack');
    
    if ( self.useCurl302WorkAround )
       self.mitigateCurl302Error(songsArray);
    // removed 'clear' command in case of traffic jam
    return self.mpdPlugin.sendMpdCommand('addid', [songsArray[0].uri])
        .then(function (result) {
            // update mpd with tags from current song
            var songId = result.Id;
            var tagUpdateCmds = [
                { command: 'addtagid', parameters: [songId, 'artist', songsArray[0].artist] },
                { command: 'addtagid', parameters: [songId, 'album', songsArray[0].album] },
                { command: 'addtagid', parameters: [songId, 'title', songsArray[0].title] }
            ];
        
            self.mpdPlugin.sendMpdCommandArray(tagUpdateCmds);
        })
        .then(function () {
            self.mpdPlugin.sendMpdCommand('play', []);
        })
        .then(function () {
            self.logger.info('[' + Date.now() + '] ' +
                    '[Pandora] Playing Track =>' +
                    ' Artist: ' + songsArray[0].artist +
                    ' Title: ' + songsArray[0].title);
            self.commandRouter.pushToastMessage('info',
                    'Pandora Playing Track',
                    'Artist: ' + songsArray[0].artist +
                    ' Song: ' + songsArray[0].title);
            if (songsArray.length <= 2) { // feed me!
                self.getTracks(self.maxSongs)
                    .then(function (newSongs) {
                        songsArray = songsArray.concat(newSongs); // append new songs
                        self.songsArray = songsArray;
                        
                        setTimers();
                    });
            }
            else { // still have a few more songs
                setTimers();
            }
        });
};

 ControllerPandora.prototype.replaceHostWithIp = function(uri) {
    var self=this;
    var  streamuri = url.parse(uri);
    var ip = dnsSync.resolve(streamuri.hostname);
    streamuri.host = ip;
    var result = streamuri.format();
    self.logger.info('[' + Date.now() + '] ' + '[Pandora] replaceHostWithIp rewrote '+uri+' as  '+result);
    return result;
}
 ControllerPandora.prototype.mitigateCurl302Error = function(songArray) {
    var self=this;
    try {
        songArray[0].uri = self.replaceHostWithIp(songArray[0].uri);
    }
    catch(err) {
        self.logger.info('[' + Date.now() + '] mitigateCurl302Error error '+err);
    }
    
}


function PandoraSongTimer(callback, args, delay) {
    var start, remaining = delay;

    var nanoTimer = new NanoTimer();

    PandoraSongTimer.prototype.pause = function () {
        nanoTimer.clearTimeout();
        remaining -= new Date() - start;
    };

    PandoraSongTimer.prototype.resume = function () {
        start = new Date();
        nanoTimer.clearTimeout();
        nanoTimer.setTimeout(callback, args, remaining + 'm');
    };

    PandoraSongTimer.prototype.clear = function () {
        nanoTimer.clearTimeout();
    };

    this.resume();
}

function StateUpdateTimer(callback, args, duration) {
    var start, remaining = duration;

    var nanoTimer = new NanoTimer();

    StateUpdateTimer.prototype.pause = function () {
        nanoTimer.clearInterval();
        nanoTimer.clearTimeout();
        remaining -= new Date() - start;
    };

    StateUpdateTimer.prototype.resume = function () {
        var offset = 0;
        var interval = 998; // allow for delay
        if (remaining !== duration) { // resuming from pause
             // resume on full interval
            offset = interval - (duration - remaining) % interval;
        }
        
        start = new Date();
        nanoTimer.clearInterval();
        nanoTimer.clearTimeout();
        nanoTimer.setTimeout(function () {
            callback.apply(this, args);
            nanoTimer.setInterval(callback, args, interval + 'm');
            }, '', offset + 'm');
        nanoTimer.setTimeout(function () {
            nanoTimer.clearInterval();
        }, '', remaining + 'm');
    };

    StateUpdateTimer.prototype.clear = function () {
        nanoTimer.clearInterval();
        nanoTimer.clearTimeout();
    };

    this.resume();
}

ControllerPandora.prototype.unsetVol = function () {
    var self = this;

};
