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
    var defer = libQ.defer();

    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    defer.resolve();

    return defer.promise;
};

ControllerPandora.prototype.onStart = function() {
    
    var self = this;
    var defer=libQ.defer();

    self.servicename = 'pandora';
    //self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');

    var credential_email = self.config.get('email');
    var credential_password = self.config.get('password');
    var current_station = self.config.get('station');
    if (isNaN(current_station)) {
        current_station = 0;
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
        self.commandRouter.pushToastMessage('error', 'Pianode error',  error.type + ': ' + error.text);
        self.logger.error('[Pianode] ' + error.type + ': ' + error.text);
    });

    self.pandora.on('badLogin', function() {
        self.logger.error('[Pandora] Error starting Pianode / Bad Login');
        self.commandRouter.pushToastMessage('error', 'Pandora Login', 'Bad Pandora Login');
    });

    self.pandora.on('loggedIn', function() {
        self.rewriteUIConfig('new_list');
        self.logger.info('[Pandora] Logged in.  Started Pianode');
        self.commandRouter.pushToastMessage('info', 'Pandora Login', 'Successful Pandora Login');
    });

    self.pandora.on('songChange', function(song) {
        self.currSong = song;
        self.logger.info('[Pianode] Song changed to: ' + song.artist + ' -- ' + song.title);
        self.commandRouter.pushToastMessage('info', 'Song Change', 'Artist: ' + song.artist + '\nTrack: ' + song.title);
    });
    // timeChange should happen right after songChange
    self.pandora.on('timeChange', function(time) {
        let stateData = self.currSong;
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
        self.stations = self.pandora.getStationList(); // This should be somewhere else
        for (var key in self.stations) {
            if(self.stations[key] === station.name) {
                self.currStation = {id: key, name: station.name};
                break;
            }
        }

        self.commandRouter.pushToastMessage('info', 'Station Change', 'Listening to ' + station.name);
        self.logger.info('[Pianode] Station change event to ' + station.name); 
    });

    if (credential_email && credential_password) {
        var passedOptions = {
            email: credential_email,
            password: credential_password,
            station: current_station
        };
        self.pandoraDaemonConnect(passedOptions)
            .then(function () {
                self.addToBrowseSources();
                defer.resolve('Successfully started Pianode object');
            })
            .catch(function(err) {
                self.logger.error('[Pandora] Error starting Pianode: ' + err);
                defer.reject(new Error('[Pandora] Cannot connect to Pandora'));
            });
    }
    else {
        self.commandRouter.pushToastMessage('error', 'Configure Pandora', 'Go to Plugin Configuration page');
        defer.resolve();
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
    
    self.context.coreCommand.stateMachine.unSetVolatile();
    self.context.coreCommand.stateMachine.resetVolumioState().then(
        self.context.coreCommand.volumioStop.bind(self.commandRouter));
    
    self.pandora.stop(); // this crashes Volumio

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return defer.promise;
};

ControllerPandora.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};

ControllerPandora.prototype.pandoraDaemonConnect = function(options) {
    var self = this;    
    var defer = libQ.defer();

    var myPromise = new Promise(function(resolve, reject) {
        if (options.email && options.password && !isNaN(options.station)) {
            self.pandora.setOptions(options);
            self.pandora.start();
            resolve('Successfully started Pianode');
        }
        else {
            self.logger.info('[Pandora] Need email, password and station');
            self.commandRouter.pushToastMessage('error', 'Need email, password and station');
            reject(new Error('[Pandora] Need email, password and station'));
        }
        
        //setTimeout(function () { // wait five seconds to log in
        //    if (self.pandora.getStatus().status !== 'error' && self.pandora.getState().loggedIn) {
        //        self.rewriteUIConfig('new_list');
        //        self.logger.info('[Pandora] Logged in.  Started Pianode');
        //        self.commandRouter.pushToastMessage('info', 'Successful Pandora Login');
        //        resolve('Successfully started Pianode');
        //    }
        //    else { // screwed the pooch already!
        //        self.logger.error('[Pandora] Error starting Pianode / Bad Login');
        //        self.commandRouter.pushToastMessage('error', 'Error starting Pandora / Bad Login');
        //        reject(new Error('[Pandora] Error starting Pianode / Bad Login'));
        //    }
        //}, 5000);
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
        uiconf.sections[0].content[2].value = self.config.get('station', '');

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
    if (!isNaN(options.station.value))
        self.config.set('station', options.station.value);
    else
        self.config.set('station', 0);

    self.commandRouter.pushToastMessage('info', 'Pandora Login', 'Credentials saved');
    
    var objStatus = self.pandora.getStatus().status;

    if (objStatus !== 'playing' && objStatus !== 'paused') { // Pianode object not started
        if (options.email && options.password && !isNaN(options.station.value)) {
            var passedOptions = {
                email: options.email,
                password: options.password,
                station: options.station.value
            };
            self.pandoraDaemonConnect(passedOptions)
                .then(function () {
                    self.addToBrowseSources();
                    defer.resolve('Successfulliy started Pianode object');
                })
                .catch(function(err) {
                    self.logger.error('[Pandora] Error starting Pianode: ' + err);
                    self.commandRouter.pushToastMessage('error', 'Pandora login error', 'Bad username/password/station');
                    defer.reject(new Error('[Pandora] Cannot connect to Pandora'));
                });
        }
        else {
            self.commandRouter.pushToastMessage('error', 'Enter values for email, password and station');
            defer.reject(new Error('[Pandora] Insufficient startup information given'));
        }
    }
    else { // can only change station -- can't change email/password on the fly
        // let's possibly be redundant for the sake of safety.
        self.stations = self.pandora.getStationList(); // returns stations object
        if (!isNaN(options.station.value)) {
            self.changeStation(options.station.value);
        }
        else { // no station was chosen.  bad dog.
            self.changeStation(0);
        }
        defer.resolve();
    }
    return defer.promise;
};

ControllerPandora.prototype.rewriteUIConfig = function(action) {
    var self=this;
    var defer = libQ.defer();
    
    self.stations = self.pandora.getStationList(); // returns stations object

    //read file UIConfig.json
    fs.readFile(__dirname + '/UIConfig.json',
        //callback function called when read file is done
        function(err, data) {
            if (err) {
                //defer.reject('Problem reading UIConfig.json: ' + err);
                throw err;
            }
            //json data
            var jsonData = data;
            var jsonParsed = JSON.parse(jsonData);

            //if (action === 'new_list') { // doing this for all cases for now
                //truncate current station list
                jsonParsed.sections[0].content[2].options.length = 0;
                        
                //add new station list
                for (var i in self.stations) { //is there a better way?
                    jsonParsed.sections[0].content[2].options[i] = {value: i, label: self.stations[i]};
                }
            //}
            //also add current station below

            jsonParsed.sections[0].content[2].value.value = self.currStation.id;
            jsonParsed.sections[0].content[2].value.label = self.currStation.name;
            
            //var tabspaces = 2;
            //var jsonOut = JSON.stringify(jsonParsed, null, tabspaces);
            // Strip null values from station list -- should be fixed now
            //var regex = new RegExp('\n\\s{' + (tabspaces * 6) + '}null,', 'g');
            //jsonOut = jsonOut.replace(regex, '');

            //write new UIConfig.json (indented 2 spaces)
            fs.writeJSON(__dirname + '/UIConfig.json', jsonParsed, {spaces: 2},
                //callback function called when write is done
                function (err) {
                    if (err) {
                        //defer.reject('Problem writing UIConfig.json: ' + err);
                        throw err;
                    }
                    self.logger.info('Saved stations to UIConfig.json');
                    defer.resolve();
            });
    });
    return defer.promise;
};



// Playback Controls ---------------------------------------------------------------------------------------
// If your plugin is not a music_sevice don't use this part and delete it


ControllerPandora.prototype.addToBrowseSources = function () {
    var defer = libQ.defer();

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

    defer.resolve();
    return defer.promise;
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
                self.changeStation(m[1]);
                //response = curUri; // should this be the station id?
            }
        }
    }
    defer.resolve(response);

    return defer.promise;
};

ControllerPandora.prototype.listStations=function() {
    var self=this;
    var defer = libQ.defer();

    self.logger.info('[Pandora] Attempting to get station list from pianode');
    self.stations = self.pandora.getStationList(); //returns object of stations
    self.logger.info('Station List: ' + JSON.stringify(self.stations));

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

    for(var i in self.stations) {
        if(!self.stations.hasOwnProperty(i)) continue;
        response.navigation.lists[0].items.push({
            service: 'pandora',
            type: 'pandora-station',
            artist: '',
            album: '',
            title: self.stations[i],
            icon: 'fa fa-music',
            uri: 'pandora/stations/' + '?id=' + i
        });
    }

    self.rewriteUIConfig('new_list');

    defer.resolve(response);

    return defer.promise;
};

ControllerPandora.prototype.changeStation = function(stationID) {
    var self = this;
    var defer = libQ.defer();
    
    self.logger.info('Changing to station: ' + stationID);
    self.currStation = {id: stationID, name: self.stations[stationID]};
    self.pandora.changeStation(stationID);
    self.config.set('station', stationID);
    self.rewriteUIConfig('change_station');
    
    defer.resolve();

    return defer.promise;
};

// Define a method to clear, add, and play an array of tracks
ControllerPandora.prototype.clearAddPlayTrack = function(track) {
    var self = this;
    var defer = libQ.defer();

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::clearAddPlayTrack');

    self.commandRouter.logger.info(JSON.stringify(track));

    //return self.mpdPlugin.sendMpdCommand('stop', [])
    //    .then(function () {
    //        return self.mpdPlugin.sendMpdCommand('clear', []);
    //    })
    //    .then(function () {
    //        return self.mpdPlugin.sendMpdCommand('add "' + track.uri + '"', []);
    //    })
    //    .then(function () {
    //        //return self.mpdPlugin.sendMpdCommand('play', []).then(function () {
    //        self.pandora.play();
    //        self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
    //        return libQ.resolve();
    //    });

    //var m = track.uri.match(/^.+?id=(\d+)$/);
    
    //self.commandRouter.pushConsoleMessage('Changing station to StationID ' + m[1]);
    //self.pandora.changeStation(m[1]);
    
    //defer.resolve();

    //return defer.promise;
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
    self.state.status = 'pause';
    
    self.commandRouter.servicePushState(self.state, self.servicename);

    defer.resolve();

    //return defer.promise;
};

// Play
ControllerPandora.prototype.resume = function() {
    var self = this;
    var defer = libQ.defer();

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerPandora::resume');

    self.pandora.play();
    self.state.status = 'play';
    self.commandRouter.servicePushState(self.state, self.servicename);

    defer.resolve();

    //return defer.promise;
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
                disableUiControls: true,
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
    var response = [];

    // Mandatory: retrieve all info for a given URI

    response.push({
        service: 'pandora',
        type: 'song',
        name: self.currStation.name,
        artist: self.currSong.artist,
        title: self.currSong.title,
        //tracknumber: 0,
        uri: uri,
        albumart: '/albumart?sourceicon=music_service/pandora/pandora.png'
    });

    defer.resolve(response);

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
