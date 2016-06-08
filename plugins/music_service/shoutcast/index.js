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

    self.mpdPlugin=self.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
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

            if(xml.ok)
            {
                var xmlDoc = libxmljs.parseXml(xml.body);

                var children = xmlDoc.root().childNodes();
                var base;

                for(var i in children)
                {
                    if(children[i].name()==='tunein')
                    {
                        base=(children[i].attr('base').value()).replace('.pls','.m3u');
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
                            uri: 'http://yp.shoutcast.com' + '/sbin/tunein-station.m3u'+'?id='+id
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

            if(xml.ok)
            {
                var xmlDoc = libxmljs.parseXml(xml.body);

                var children = xmlDoc.root().childNodes();
                var base;

                for(var i in children)
                {
                    if(children[i].name()==='tunein')
                    {
                        base=(children[i].attr('base').value()).replace('.pls','.m3u');
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

    return self.mpdPlugin.sendMpdCommand('stop',[])
        .then(function()
        {
            return self.mpdPlugin.sendMpdCommand('clear',[])
        })
        .then(function()
        {
            return self.mpdPlugin.sendMpdCommand('load "'+track.uri+'"',[])
        })
        .then(function()
        {
            self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
            return self.mpdPlugin.sendMpdCommand('play',[]);
        });
};

// Spop stop
ControllerShoutcast.prototype.stop = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerShoutcast::stop');

    return self.mpdPlugin.sendMpdCommand('stop',[]);
};

// Spop pause
ControllerShoutcast.prototype.pause = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerShoutcast::pause');

    // TODO don't send 'toggle' if already paused
    return self.mpdPlugin.sendMpdCommand('pause',[]);
};

// Spop resume
ControllerShoutcast.prototype.resume = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerShoutcast::resume');

    // TODO don't send 'toggle' if already playing
    return self.mpdPlugin.sendMpdCommand('play',[]);
};

ControllerShoutcast.prototype.seek = function(position) {
    var self=this;
    this.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerShoutcast::seek');

    return self.mpdPlugin.seek(position);
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
