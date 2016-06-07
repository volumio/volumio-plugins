'use strict';

var libQ = require('kew');
var libxmljs = require("libxmljs");
var unirest = require('unirest');

// Define the ControllerShoutcast class
module.exports = ControllerShoutcast;
function ControllerShoutcast(context) {
	var self = this;

	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
	this.configManager = this.context.configManager;

    
}



ControllerShoutcast.prototype.onVolumioStart = function()
{
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

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
            if (curUri.startsWith('shoutcast/myWebRadio')) {
                response = self.listMyWebRadio(curUri);
            }
            else if (curUri.startsWith('shoutcast/favourites'))
                response = self.listRadioFavourites(curUri);
            else if (curUri.startsWith('shoutcast/byGenre')) {
                if (curUri == 'shoutcast/byGenre')
                    response = self.listRadioGenres(curUri);
                else
                    response = self.listRadioForGenres(curUri);

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
                    title: 'My Web Radios',
                    artist: '',
                    album: '',
                    icon: 'fa fa-heartbeat',
                    uri: 'shoutcast/myWebRadio'
                },
                {
                    service: 'shoutcast',
                    type: 'radio-favourites',
                    title: 'Favourite Radios',
                    artist: '',
                    album: '',
                    icon: 'fa fa-heart',
                    uri: 'shoutcast/favourites'
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

    unirest.get('http://api.shoutcast.com/legacy/genrelist?k=vKgHQrwysboWzMwH')
    .end(function (xml) {
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

    unirest.get('http://api.shoutcast.com/legacy/genresearch?k=vKgHQrwysboWzMwH&genre='+genre)
        .end(function (xml) {
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