'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;

var Pianode = require('pianode');
var settings = require('./settings.js');

module.exports = ControllerPandora;

function ControllerPandora(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;

}



ControllerPandora.prototype.onVolumioStart = function()
{
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);
};

ControllerPandora.prototype.onStart = function() {
    
    var self = this;
    var defer=libQ.defer();

    self.servicename = 'pandora';

    var credential_email = self.config.get('email');
    var credential_password = self.config.get('password');
    var current_station = self.config.get('station');
    if (!current_station || current_station === 'undefined') {
        current_station = 1;
    }

    if (credential_email === '' || credential_password === '') {
        self.commandRouter.pushToastMessage('error', 'Please configure plugin using Plugin sidebar.');
        defer.reject(new Error('[Pandora] Missing credentials'));
    }
    self.pandora = new Pianode({
        //email: settings.email,
        //password: settings.password,
        //station: settings.station,
        //verbose: true
        email: credential_email,
        password: credential_password,
        station: current_station,
        //startPaused: true,
        verbose: true
        });
    
    self.logger.info('[Pandora] Instantiated Pianode');
    
    // set up event listeners

    self.pandora.on('error', function(error) {
        self.commandRouter.pushToastMessage('error', 'Pandora error',  error.type + ': ' + error.text);
        self.logger.error('[Pianode] ' + error.type + ': ' + error.text);
    });

    self.pandora.on('songChange', function(song) {
        self.pandora.currSong = song;
        self.logger.info('[Pianode] Song changed to: ' + song.artist + ' -- ' + song.title);
        self.commandRouter.pushToastMessage('info', 'Song Change', 'Artist: ' + song.artist + '\nTrack: ' + song.title);
    });
    // timeChange should happen right after songChange
    self.pandora.on('timeChange', function(time) {
        let stateData = self.pandora.currSong;
        stateData.timeRemaining = Number(time.remaining.seconds);
        stateData.timePlayed = Number(time.played.seconds);
        self.parseState(stateData)
        .then(function(result) {
            self.pushState(result);
        })
        .catch(function(err) {
            self.logger.error('[Pandora] Problem pushing state: ' + err);
        });
    });

    self.pandora.on('stationChange', function(station) {
        self.pandora.currStation = station;
        self.commandRouter.pushToastMessage('info', 'Station Change', 'Listening to ' + station.name);
        self.logger.info('[Pianode] Station change event to ' + station.name); 
    });

    if (credential_email && credential_password) {
        self.pandoraDaemonConnect(credential_email, credential_password)
            .then(function () {
                self.addToBrowseSources();
                defer.resolve('Successfully started Pianode object');
            })
            .catch(function(err) {
                self.logger.error('[Pandora] Error starting Pianode: ' + err);
                defer.reject(new Error('[Pandora] Cannot connect to Pandora'));
            });
    }

    // Timeout for five seconds here so stateMachine is defined.  Is there a better way?
    setTimeout(function () {
        self.context.coreCommand.stateMachine.setConsumeUpdateService(undefined);

        self.context.coreCommand.stateMachine.setVolatile({
            service: self.servicename,
            callback: self.unsetVol.bind(self)
        });
    }, 5000);

    // Once the Plugin has successfull started resolve the promise
    return defer.promise;
};

ControllerPandora.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();
    
    self.pandora.stop();

    self.context.coreCommand.stateMachine.unSetVolatile();
    self.context.coreCommand.stateMachine.resetVolumioState().then(
        self.context.coreCommand.volumioStop.bind(self.commandRouter));
    
    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return defer.promise;
};

ControllerPandora.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};

ControllerPandora.prototype.pandoraDaemonConnect = function(em, pwd) {
    var self = this;    
    var defer = libQ.defer();

    var myPromise = new Promise(function(resolve, reject) {
        if (em && pwd) {
            self.pandora.email = em;
            self.pandora.password = pwd;

            self.pandora.start();
            self.commandRouter.pushToastMessage('info', 'I hope you put your info in correctly!');
        }
        else {
            self.logger.info('[Pandora] Need username and password');
            self.commandRouter.pushToastMessage('error', 'Email and/or Password is blank');
        }
    
        if (self.pandora.getStatus !== 'error') {
            self.logger.info('[Pandora] Logged in.  Started Pianode');
            resolve('Successfully started Pianode');
        }
        else { // screwed the pooch already!
            self.logger.error('[Pandora] Error starting Pianode');
            reject(new Error('[Pandora] Cannot start Pianode'));
        }

    });

    return myPromise;
};

// Configuration Methods -----------------------------------------------------------------------------

ControllerPandora.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
    __dirname+'/i18n/strings_en.json',
    __dirname + '/UIConfig.json')
    .then(function(uiconf) {
        uiconf.sections[0].content[0].value = self.config.get('email', '');
        uiconf.sections[0].content[1].value = self.config.get('password', '');

        defer.resolve(uiconf);
    })
    .fail(function()
    {
        defer.reject(new Error());
    });

    return defer.promise;
};

ControllerPandora.prototype.getConfigurationFiles = function() {
    return ['config.json'];
};

ControllerPandora.prototype.setUIConfig = function(data) {
    var self = this;
    //Perform your installation tasks here
};

ControllerPandora.prototype.getConf = function(varName) {
    var self = this;
    //Perform your installation tasks here
};

ControllerPandora.prototype.setConf = function(options) {
    var self = this;
    var defer = libQ.defer();

    //Perform your installation tasks here
    self.config.set('email', options.email);
    self.config.set('password', options.password);
    self.config.set('station', options.station);
    
    self.pandora.email = options.email;
    self.pandora.password = options.password;
    self.pandora.station = options.station; // may not use

    self.pandoraDaemonConnect()
        .then(function () {
            self.addToBrowseSources();
            self.commandRouter.pushToastMessage('info', 'Pandora Login', 'Credentials saved');
            defer.resolve('Successfully started Pianode object');
        })
        .catch(function(err) {
            self.logger.error('[Pandora] Error starting Pianode: ' + err);
            self.commandRouter.pushToastMessage('error', 'Bad username/password.  Please fix.');
            defer.reject(new Error('[Pandora] Cannot connect to Pandora'));
        });

    defer.resolve({});
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


ControllerPandora.prototype.addToBrowseSources = function () {
    // Use this function to add your music service plugin to music sources
    //var data = {name: 'Spotify', uri: 'spotify',plugin_type:'music_service',plugin_name:'spop'};
    var data = {
        albumart: '/albumart?sourceicon=music_service/pandora/pandora.png ',
        icon: 'fa fa-microphone',
        name: 'Pandora Radio',
        uri: 'pandora',
        plugin_type: 'music_service',
        plugin_name: 'pandora'
    };
    this.commandRouter.volumioAddToBrowseSources(data);
};

ControllerPandora.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    var defer = libQ.defer();

    var response;

    self.logger.info('[Pandora] Got to initial step in handleBrowseUri. curUri: ' + curUri);

    if (curUri.startsWith('pandora')) {
        if (curUri === 'pandora') {
            response = self.listStations();
        }
        else if (curUri.startsWith('pandora/stations')) { 
            if (curUri === 'pandora/stations') { // will this ever happen?
            response = self.listStations(curUri); 
            }
            else { // tuning in station
                var m = curUri.match(/^.+?id=(\d+)$/);
                self.logger.info('Changing to station: ' + m[1]);
                self.pandora.changeStation(m[1]);
                self.config.set('station', m[1]); // attempt to save current station
                //response = curUri; // should this be the station id?
            }
        }
    }
    defer.resolve(response);

    return defer.promise;
};

ControllerPandora.prototype.listStations=function()
{
    var self=this;
    var defer = libQ.defer();

    self.logger.info('[Pandora] Attempting to get station list from pianode');
    var stationGrab = self.pandora.getStationList();
        //.then(function(results) {
            self.logger.info('Station List: ' + JSON.stringify(stationGrab));
            var response={
                navigation: {
                    'prev': {
                        uri: 'pandora'
                    },
                    'lists': [
                        {
                            'availableListViews': [
                                'list'
                            ],
                            'items': [
                            ]
                         }
                     ]
                }
            };

            for(var i in stationGrab) {
                if(!stationGrab.hasOwnProperty(i)) continue;
                    response.navigation.lists[0].items.push({
                            service: 'pandora',
                            type: 'pandora-station',
                            artist: '',
                            album: '',
                            title: stationGrab[i],
                            icon: 'fa fa-music',
                            uri: 'pandora/stations/' + '?id=' + i
                            });
             }

             defer.resolve(response);
        //})
        //.catch(function(err) {
        //self.logger.error("[Pandora] ERROR: " + err);
        //defer.reject(new Error('[Pandora] An error occurred while grabbing stations'));
        //});

    return defer.promise;
};

// Define a method to clear, add, and play an array of tracks
ControllerPandora.prototype.clearAddPlayTrack = function(track) {
    var self = this;
    var defer = libQ.defer();

   
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::clearAddPlayTrack');

    self.commandRouter.logger.info(JSON.stringify(track));

    var m = track.uri.match(/^.+?id=(\d+)$/);
    
    self.commandRouter.pushConsoleMessage('Changing station to StationID ' + m[1]);
    self.pandora.changeStation(m[1]);
    
    defer.resolve();

    return defer.promise;
};


// Media Control Overrides

// Seek
ControllerPandora.prototype.seek = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::seek to ' + timepos);

    //return this.sendSpopCommand('seek '+timepos, []);
};

// Stop
ControllerPandora.prototype.stop = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::stop');

    self.pandora.stop();
};

// Pause
ControllerPandora.prototype.pause = function() {
    var self = this;
    var defer = libQ.defer();

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::pause');

    self.pandora.pause();
    if (self.state.status === 'play') {
        self.state.status = 'pause';
    }
    else {
        self.state.status = 'play';
    }
    self.commandRouter.servicePushState(self.state, self.servicename);

    defer.resolve();

    return defer.promise;
};

// Play
ControllerPandora.prototype.play = function() {
    var self = this;
    var defer = libQ.defer();

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::play');

    self.pandora.play();
    self.state.status = 'play';
    self.commandRouter.servicePushtate(self.state, self.servicename);

    defer.resolve();

    return defer.promise;
};

// Next
ControllerPandora.prototype.next = function () {
    var self = this;
    var defer = libQ.defer();

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::next');

    self.pandora.next();

    defer.resolve();

    return defer.promise;
};

// Previous
ControllerPandora.prototype.previous = function (timepos) {
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::previous');
};


// Get state
ControllerPandora.prototype.getState = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::getState');
};

//Parse state
ControllerPandora.prototype.parseState = function(state) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::parseState');

    var sStatus;

    var myPromise = new Promise(function(resolve,reject) {
        var objStatus = self.pandora.getStatus();
        if (objStatus.status === 'playing') {
            sStatus = 'play';
        } else if (objStatus.status === 'paused') {
            sStatus = 'pause';
        } else if (objStatus.status === 'not running' || objStatus.status === 'undefined') {
            sStatus = 'stop';
        }

        if (state && sStatus) {
            var parsedState = {
                status: sStatus,
                service: self.servicename,
                volatile: true,
                type: 'song', // is this needed?
                position: state.timePlayed,
                seek: state.timePlayed * 1000,
                duration: Number(state.songDuration),
                //samplerate: self.samplerate, // is this needed? 
                //bitdepth: null, // is this needed?
                tracknumber: 0,
                channels: 2,
                artist: state.artist,
                title: state.title,
                album: state.album,
                albumart: state.art
            };
            self.state = parsedState;
            resolve(parsedState);
        }
        else {
            reject('Bad state/status information passed into parseState');
        }
    });

    return myPromise;

    //Use this method to parse the state and eventually send it with the following function
};

// Announce updated State
ControllerPandora.prototype.pushState = function(state) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::pushState');

    self.logger.info('[Pandora] Pushing state');

    return self.commandRouter.servicePushState(state, self.servicename);
};


ControllerPandora.prototype.explodeUri = function(uri) {
    var self = this;
    var defer=libQ.defer();

    // Mandatory: retrieve all info for a given URI

    var explodedUri = {
        service: 'pandora',
        type: 'song',
        artist: self.pandora.currSong.artist,
        title: self.pandora.currSong.title,
        tracknumber: 0,
        uri: uri,
        albumart: '/albumart?sourceicon=music_service/pandora/pandora.png'
    };

    explodedUri.name = self.pandora.currStation.name;

    defer.resolve(explodedUri);

    return defer.promise;
};

ControllerPandora.prototype.getAlbumArt = function (data, path) {

    var artist, album;

    if (data !== undefined && data.path !== undefined) {
        path = data.path;
    }

    var web;

    if (data !== undefined && data.artist !== undefined) {
        artist = data.artist;
        if (data.album !== undefined)
            album = data.album;
        else album = data.artist;

        web = '?web=' + nodetools.urlEncode(artist) + '/' + nodetools.urlEncode(album) + '/large';
    }

    var url = '/albumart';

    if (web !== undefined)
        url = url + web;

    if (web !== undefined && path !== undefined)
        url = url + '&';
    else if (path !== undefined)
        url = url + '?';

    if (path !== undefined)
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

ControllerPandora.prototype.unsetVol = function () {
    var self = this;

};
