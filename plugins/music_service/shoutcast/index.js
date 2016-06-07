'use strict';

var libQ = require('kew');
var libxmljs = require("libxmljs");
var unirest = require('unirest');
var pidof = require('pidof');
var cachemanager=require('cache-manager');
var memoryCache = cachemanager.caching({store: 'memory', max: 100, ttl: 10*60/*seconds*/});
var libMpd = require('mpd');

// Define the ControllerShoutcast class
module.exports = ControllerShoutcast;
function ControllerShoutcast(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

    
}



ControllerShoutcast.prototype.getConfigurationFiles = function()
{
	return ['config.json'];
}

ControllerShoutcast.prototype.addToBrowseSources = function () {
	var data = {name: 'Shoutcast', uri: 'shoutcast',plugin_type:'music_service',plugin_name:'shoutcast'};
	this.commandRouter.volumioAddToBrowseSources(data);
};


ControllerShoutcast.prototype.onStart = function() {
    this.addToBrowseSources();

    return libQ.resolve();
};

ControllerShoutcast.prototype.handleBrowseUri=function(curUri)
{
    var self=this;

    var response;

    self.logger.info("SHOUCAST BROWSE URI: "+curUri);
    if (curUri.startsWith('shoutcast')) {
        if (curUri == 'shoutcast')
            response = self.listRoot(curUri);
        else {
            if (curUri.startsWith('shoutcast/byGenre')) {
                if (curUri == 'shoutcast/byGenre')
                    response = self.listRadioGenres(curUri);
                else
                    response = self.listRadioForGenres(curUri);
            }
            else if (curUri==='shoutcast/top500') {
                    response = self.listTop500Radios(curUri);
            }






        }
    }

    return response;
}


ControllerShoutcast.prototype.listRoot=function()
{
    return libQ.resolve({
        navigation: {
            prev: {
                uri: ''
            },
            list: [{
                    service: 'shoutcast',
                    type: 'mywebradio-category',
                    title: 'Top 500 Radios',
                    artist: '',
                    album: '',
                    icon: 'fa fa-heartbeat',
                    uri: 'shoutcast/top500'
                },
                {
                    service: 'shoutcast',
                    type: 'radio-category',
                    title: 'By Genre',
                    artist: '',
                    album: '',
                    icon: 'fa fa-tags',
                    uri: 'shoutcast/byGenre'
                }

            ]
        }
    });
}

ControllerShoutcast.prototype.listRadioGenres = function () {
    var self = this;

    var defer = libQ.defer();

    var response = {
        navigation: {
            prev: {
                uri: 'shoutcast'
            },
            list: []
        }
    };


    var uri='http://api.shoutcast.com/legacy/genrelist?k=vKgHQrwysboWzMwH';

    memoryCache.wrap(uri, function (cacheCallback) {
        var promise=libQ.defer();

        unirest.get(uri)
            .end(function(xml)
            {
                self.logger.info("READ");
                if(xml.ok)
                {
                    memoryCache.set(uri,xml);
                    promise.resolve(xml);
                }
                else promise.reject(new Error());
            });


        return promise;
        })
        .then( function (xml) {
            self.logger.info("THEN");

            if(xml.ok)
            {
                var xmlDoc = libxmljs.parseXml(xml.body);

                var children = xmlDoc.root().childNodes();

                for(var i in children)
                {
                    var name=children[i].attr('name').value();
                    var category = {
                        type: 'radio-category',
                        title: name,
                        icon: 'fa fa-folder-open-o',
                        uri: 'shoutcast/byGenre/' + name
                    };

                    response.navigation.list.push(category);
                }

                defer.resolve(response);
            }
            else defer.reject(new Error('An error occurred while querying SHOUTCAST'));
        });

    return defer.promise;
};

ControllerShoutcast.prototype.listRadioForGenres = function (curUri) {
    var self = this;

    var defer = libQ.defer();

    var genre=curUri.split('/')[2];
    self.logger.info("GENRE: "+genre);


    var response = {
        navigation: {
            prev: {
                uri: 'shoutcast/byGenre'
            },
            list: []
        }
    };

    var uri='http://api.shoutcast.com/legacy/genresearch?k=vKgHQrwysboWzMwH&genre='+genre;

    memoryCache.wrap(uri, function (cacheCallback) {
        var promise=libQ.defer();

        unirest.get(uri)
            .end(function(xml)
            {
                self.logger.info("READ");
                if(xml.ok)
                {
                    memoryCache.set(uri,xml);
                    promise.resolve(xml);
                }
                else promise.reject(new Error());
            });


        return promise;
    })
        .then( function (xml) {
            self.logger.info("THEN");

            if(xml.ok)
            {
                var xmlDoc = libxmljs.parseXml(xml.body);

                var children = xmlDoc.root().childNodes();
                var base;

                for(var i in children)
                {
                    if(children[i].name()==='tunein')
                    {
                        base=children[i].attr('base').value();
                    }
                    else if(children[i].name()==='station')
                    {
                        var name=children[i].attr('name').value();
                        var id=children[i].attr('id').value();

                        var category = {
                            service: 'shoutcast',
                            type: 'webradio',
                            title: name,
                            artist: '',
                            album: '',
                            icon: 'fa fa-microphone',
                            uri: 'http://yp.shoutcast.com' + base+'?id='+id
                        };

                        response.navigation.list.push(category);
                    }

                }

                defer.resolve(response);
            }
            else defer.reject(new Error('An error occurred while querying SHOUTCAST'));
        });

    return defer.promise;
};

ControllerShoutcast.prototype.listTop500Radios = function (curUri) {
    var self = this;

    var defer = libQ.defer();

    var response = {
        navigation: {
            prev: {
                uri: 'shoutcast'
            },
            list: []
        }
    };

    var uri='http://api.shoutcast.com/legacy/Top500?k=vKgHQrwysboWzMwH';

    memoryCache.wrap(uri, function (cacheCallback) {
        var promise=libQ.defer();

        unirest.get(uri)
            .end(function(xml)
            {
                self.logger.info("READ");
                if(xml.ok)
                {
                    memoryCache.set(uri,xml);
                    promise.resolve(xml);
                }
                else promise.reject(new Error());
            });


        return promise;
    })
        .then( function (xml) {
            self.logger.info("THEN");

            if(xml.ok)
            {
                var xmlDoc = libxmljs.parseXml(xml.body);

                var children = xmlDoc.root().childNodes();
                var base;

                for(var i in children)
                {
                    if(children[i].name()==='tunein')
                    {
                        base=children[i].attr('base').value();
                    }
                    else if(children[i].name()==='station')
                    {
                        var name=children[i].attr('name').value();
                        var id=children[i].attr('id').value();

                        var category = {
                            service: 'shoutcast',
                            type: 'webradio',
                            title: name,
                            artist: '',
                            album: '',
                            icon: 'fa fa-microphone',
                            uri: 'http://yp.shoutcast.com' + base+'?id='+id
                        };

                        response.navigation.list.push(category);
                    }

                }

                defer.resolve(response);
            }
            else defer.reject(new Error('An error occurred while querying SHOUTCAST'));
        });


    return defer.promise;
};




// Define a method to clear, add, and play an array of tracks
ControllerShoutcast.prototype.clearAddPlayTrack = function(track) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerShoutcast::clearAddPlayTrack');

    self.commandRouter.logger.info(JSON.stringify(track));

    return self.sendSpopCommand('uplay', [track.uri]);
};

// Spop stop
ControllerShoutcast.prototype.stop = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerShoutcast::stop');

    return self.sendSpopCommand('stop', []);
};

// Spop pause
ControllerShoutcast.prototype.pause = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerShoutcast::pause');

    // TODO don't send 'toggle' if already paused
    return self.sendSpopCommand('toggle', []);
};

// Spop resume
ControllerShoutcast.prototype.resume = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerShoutcast::resume');

    // TODO don't send 'toggle' if already playing
    return self.sendSpopCommand('toggle', []);
};

ControllerShoutcast.prototype.explodeUri = function(uri) {
    var self = this;

    var defer=libQ.defer();

    defer.resolve({
        uri: uri,
        service: 'shoutcast',
        name: uri,
        type: 'track'
    });

    return defer.promise;
};

ControllerShoutcast.prototype.sendMpdCommand = function (sCommand, arrayParameters) {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerShoutcast::sendMpdCommand');

    return self.mpdReady
        .then(function () {
            self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'sending command...');
            return libQ.nfcall(self.clientMpd.sendCommand.bind(self.clientMpd), libMpd.cmd(sCommand, arrayParameters));
        })
        .then(function (response) {
            self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'parsing response...');
            var respobject = libMpd.parseKeyValueMessage.call(libMpd, response);
            // If there's an error show an alert on UI
            if ('error' in respobject) {
                self.commandRouter.broadcastToastMessage('error', 'Error', respobject.error)
                //console.log(respobject.error);
            }
            return libQ.resolve(respobject);
        });
};

ControllerShoutcast.prototype.onVolumioStart = function () {
    var self = this;

    //this.commandRouter.sharedVars.registerCallback('alsa.outputdevice', this.outputDeviceCallback.bind(this));
    // Connect to MPD only if process MPD is running
    pidof('mpd', function (err, pid) {
        if (err) {
            self.logger.info('Cannot initialize  MPD Connection: MPD is not running');
        } else {
            if (pid) {
                self.logger.info('MPD running with PID' + pid + ' ,establishing connection');
                self.mpdEstablish();

            } else {
                self.logger.info('Cannot initialize  MPD Connection: MPD is not running');
            }
        }
    });

    return libQ.resolve();
};

ControllerShoutcast.prototype.mpdEstablish = function () {
    var self = this;

    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    // TODO use names from the package.json instead
    self.servicename = 'mpd';
    self.displayname = 'MPD';

    //getting configuration


    // Save a reference to the parent commandRouter
    self.commandRouter = self.context.coreCommand;
    // Connect to MPD
    self.mpdConnect();

    // Make a promise for when the MPD connection is ready to receive events
    self.mpdReady = libQ.nfcall(self.clientMpd.on.bind(self.clientMpd), 'ready');
    // Catch and log errors
    self.clientMpd.on('error', function (err) {
        console.log('MPD error: ' + err);
        if (err = "{ [Error: This socket has been ended by the other party] code: 'EPIPE' }") {
            // Wait 5 seconds before trying to reconnect
            setTimeout(function () {
                self.mpdEstablish();
            }, 5000);
        } else {
            console.log(err);
        }
    });

    // This tracks the the timestamp of the newest detected status change
    self.timeLatestUpdate = 0;

    // TODO remove pertaining function when properly found out we don't need em
    //self.fswatch();
    // When playback status changes
    self.clientMpd.on('system', function (status) {
        var timeStart = Date.now();

        self.logger.info('Mpd Status Update: '+status);
        self.logStart('MPD announces state update')
            .then(self.getState.bind(self))
            .then(self.pushState.bind(self))
            .fail(self.pushError.bind(self))
            .done(function () {
                return self.logDone(timeStart);
            });
    });


    self.clientMpd.on('system-playlist', function () {
        var timeStart = Date.now();

        self.logStart('MPD announces system state update')
            .then(self.updateQueue.bind(self))
            .fail(self.pushError.bind(self))
            .done(function () {
                return self.logDone(timeStart);
            });
    });

    //Notify that The mpd DB has changed
    self.clientMpd.on('system-database', function () {
        //return self.commandRouter.fileUpdate();
        //return self.reportUpdatedLibrary();
    });


    self.clientMpd.on('system-update', function () {

        self.sendMpdCommand('status', [])
            .then(function (objState) {
                var state = self.parseState(objState);

                return self.commandRouter.fileUpdate(state.updatedb);
            });
    });
};

ControllerShoutcast.prototype.mpdConnect = function () {

    var self = this;

    var nHost = self.config.get('nHost');
    var nPort = self.config.get('nPort');
    self.clientMpd = libMpd.connect({port: nPort, host: nHost});
};