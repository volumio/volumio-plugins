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
    if (curUri.startsWith('shoutcast')) {
        if (curUri == 'shoutcast')
            response = self.listRoot(curUri);
        else {
            if (curUri.startsWith('radio/myWebRadio')) {
                response = self.listMyWebRadio(curUri);
            }
            else if (curUri.startsWith('radio/favourites'))
                response = self.listRadioFavourites(curUri);
            else if (curUri.startsWith('radio/byGenre')) {
                if (curUri == 'radio/byGenre')
                    response = self.listRadioCategories(curUri);
                else
                    response = self.listRadioForCategory(curUri);

            }
            else if (curUri.startsWith('radio/byCountry')) {
                if (curUri == 'radio/byCountry')
                    response = self.listRadioCountries(curUri);
                else
                    response = self.listRadioForCountry(curUri);

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
                },
                {
                    service: 'shoutcast',
                    type: 'radio-category',
                    title: 'By Country',
                    artist: '',
                    album: '',
                    icon: 'fa fa-globe',
                    uri: 'shoutcast/byCountry'
                }

            ]
        }
    });
}