'use strict';

var libQ = require('kew');
var libMpd = require('mpd');
var moment = require('moment');
var fs = require("fs-extra");
var _ = require("lodash");

module.exports = live_playlists;

/* *************************************** */
/* *************** OPTIONS *************** */
/* *************************************** */
var encodingFilename = 'utf8';
var statsAttribute = "ctimeMs"; // can be one of [atimeMs, mtimeMs, ctimeMs]
var foldersToScan = ["/mnt/INTERNAL/", "/mnt/NAS/test/", "/mnt/USB/"];
var numberOfLastAdded = 100;
/* *************************************** */

function getFoldersMap (folder) {
	var array = [];
	var files = fs.readdirSync(folder, { encoding: encodingFilename });
	files.forEach(function(file) {
		if (fs.existsSync(folder + file)) {
			var stats = fs.statSync(folder + file, encodingFilename);
			var ob = {};
			ob[statsAttribute] = stats[statsAttribute];
			ob.dir = folder + file;
			if (file != "desktop.ini") {
				array.push(ob);
			}
		}
	});
	return array;
};

function live_playlists(context) {

    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
    this.playlistManager = this.context.playlistManager;
    this.controllerMpd = this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
	
	var a = [];
	foldersToScan.forEach(function(folderToScan) {
		a = _.union(a, getFoldersMap(folderToScan));
	});
	
	// Order Desc by attribute
	a = _.orderBy(a, [statsAttribute], ['desc']);
	// Keep only N first elements
	a = _.slice(a, 0, numberOfLastAdded);
	
	self.logger.info("***** FULL ARRAY = " + JSON.stringify(a));
}

live_playlists.prototype.onVolumioStart = function () {
    var self = this;
    
    self.config= new (require('v-conf'))();
    var configFile=self.commandRouter.pluginManager.getConfigurationFile(self.context,'config.json');
    self.config.loadFile(configFile);

    return libQ.resolve();
};

live_playlists.prototype.onStart = function () {
    var self = this;
    self.addToBrowseSources();

    return libQ.resolve();
}

live_playlists.prototype.handleBrowseUri = function (curUri) {
    var self = this;
    var response = [];
    var defer = libQ.defer();
	
    var response = {
        navigation: {
            prev: {
                uri: "/"
            },
            lists: [{
                "availableListViews": ["list", "grid"],
                "items": []
            }]
        }
    };
    var list = response.navigation.lists[0].items;

    if(curUri.startsWith('live_playlists')){

        /*self.controllerMpd.mpdReady.then(function () {
            self.controllerMpd.clientMpd.sendCommand(libMpd.cmd('find Date "2016" base "NAS/Singles"', []), function (err, msg) {
                console.log(msg);
            });
        });*/

        /*self.controllerMpd.mpdReady.then(function () {
            self.controllerMpd.clientMpd.sendCommand(libMpd.cmd('find artist "Radiohead"', []), function (err, msg) {
                console.log(msg);
            });
        });*/

        if(curUri == 'live_playlists') {
            if (self.config.get('random')) {
                list.push({
                    service: 'live_playlists',
                    type: 'folder',
                    title: 'Random tracks',
                    artist: '',
                    album: '',
                    icon: 'fa fa-folder-open-o',
                    uri: 'live_playlists_random'
                });
            }
            if (self.config.get('latest')) {
                list.push({
                    service: 'live_playlists',
                    type: 'folder',
                    title: 'Recently added tracks',
                    artist: '',
                    album: '',
                    icon: 'fa fa-folder-open-o',
                    uri: 'live_playlists_latest'
                });
            }
            list.push({
                service: 'live_playlists',
                type: 'folder',
                title: 'Tracks by decade',
                artist: '',
                album: '',
                icon: 'fa fa-folder-open-o',
                uri: 'live_playlists_decade'
            });
        } else if (curUri == 'live_playlists_random') {
            response.navigation.prev.uri = "live_playlists";
            list.push({
                type: 'playlist',
                title: '10 random tracks',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_random_10'
            });
            list.push({
                type: 'playlist',
                title: '50 random tracks',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_random_50'
            });
            list.push({
                type: 'playlist',
                title: '100 random tracks',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_random_100'
            });
            list.push({
                type: 'playlist',
                title: '500 random tracks',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_random_500'
            });
        } else if (curUri == 'live_playlists_latest') {
            response.navigation.prev.uri = "live_playlists";
            list.push({
                type: 'playlist',
                title: 'Tracks added in last week',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_latest_1_week'
            });
            list.push({
                type: 'playlist',
                title: 'Tracks added in last month',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_latest_1_month'
            });
            list.push({
                type: 'playlist',
                title: 'Tracks added in last 3 months',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_latest_3_months'
            });
            list.push({
                type: 'playlist',
                title: 'Tracks added in last 6 months',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_latest_6_months'
            });
            list.push({
                type: 'playlist',
                title: 'Tracks added in last year',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_latest_1_year'
            });
        } else if (curUri == 'live_playlists_decade') {
            response.navigation.prev.uri = "live_playlists";
            /*list.push({
                type: 'playlist',
                title: 'Tracks from 2015',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_year_2015'
            });
            list.push({
                type: 'playlist',
                title: 'Tracks from 2016',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_year_2016'
            });*/
            list.push({
                type: 'playlist',
                title: 'Tracks from the 80s',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_year_80s'
            });
            list.push({
                type: 'playlist',
                title: 'Tracks from the 90s',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_year_90s'
            });
            list.push({
                type: 'playlist',
                title: 'Tracks from the 00s',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_year_00s'
            });
            list.push({
                type: 'playlist',
                title: 'Tracks from the 10s',
                service:'live_playlists',
                icon: 'fa fa-list-ol',
                uri: 'live_playlists_year_10s'
            });
        }

        defer.resolve(response);
    }
    return defer.promise;
}

live_playlists.prototype.addToBrowseSources = function () {
    var data = {name: 'Live playlists', uri: 'live_playlists', plugin_type:'music_service',
        plugin_name:'live_playlists'};
    this.commandRouter.volumioAddToBrowseSources(data);
};

live_playlists.prototype.explodeUri = function(uri) {
    var self = this;

    if(uri.startsWith('live_playlists_random')){
        switch (uri) {
            case 'live_playlists_random_50':
                return self.getRandom(50);
                break;
            case 'live_playlists_random_100':
                return self.getRandom(100);
                break;
            case 'live_playlists_random_500':
                return self.getRandom(500);
                break;
            default:
                return self.getRandom(10);
                break;
        }
    }

    if(uri.startsWith('live_playlists_year_')){
        switch (uri) {
            case 'live_playlists_year_2015':
                return self.findByYear(2015);
                break;
            case 'live_playlists_year_2016':
                return self.findByYear(2016);
                break;
            case 'live_playlists_year_80s':
                return self.findByYearRange(1980, 1989);
                break;
            case 'live_playlists_year_90s':
                return self.findByYearRange(1990, 1999);
                break;
            case 'live_playlists_year_00s':
                return self.findByYearRange(2000, 2009);
                break;
            case 'live_playlists_year_10s':
                return self.findByYearRange(2010, 2019);
                break;
            default:
                return self.findByYear(2000);
                break;
        }
    }

    if (uri.startsWith('live_playlists_latest_')) {
        switch (uri) {
            case 'live_playlists_latest_1_week':
                return self.findLastAdded(1, 'weeks');
                break;
            case 'live_playlists_latest_1_month':
                return self.findLastAdded(1, 'months');
                break;
            case 'live_playlists_latest_3_months':
                return self.findLastAdded(3, 'months');
                break;
            case 'live_playlists_latest_6_months':
                return self.findLastAdded(6, 'months');
                break;
            case 'live_playlists_latest_1_year':
            default:
                return self.findLastAdded(1, 'years');
                break;
        }
    }
};

live_playlists.prototype.getRandom = function(count) {
    var self = this;
    var defer = libQ.defer();
    count = count || 10;
    var filter_path = self.config.get('filter_path');

    self.controllerMpd.mpdReady.then(function () {
        self.controllerMpd.clientMpd.sendCommand(libMpd.cmd('listall', [filter_path]), function (err, msg) {
            var items = [];
            if (msg) {
                var lines = msg.split('\n');
                var length = lines.length;
                var promises = [];
                for (var i = 0; i < count; i++) {
                    var randomLine = lines[Math.floor(Math.random() * length)];
                    if (randomLine.indexOf("file:") === 0) {
                        var path = randomLine.slice(6);
                        var promise = self.getTrackInfo(path).then(function (trackInfo) {
                            items.push(trackInfo);
                        });
                        promises.push(promise);
                    }
                }
                libQ.all(promises).then(function (content) {
                    defer.resolve(items);
                });
            }
        });
    });

    return defer.promise;
};

live_playlists.prototype.findLastAdded = function(num, timeUnit) {
    var filter_path = '';
    if (this.config.get('filter_path')) {
        filter_path = 'base "' + this.config.get('filter_path') + '"';
    }

    return this.executeFind('modified-since "' + moment().startOf('date').subtract(num, timeUnit).utc().format('YYYY-MM-DD[T]HH:mm:ss[Z]') + '" ' + filter_path);
};

live_playlists.prototype.findByYear = function(year) {
    var filter_path = '';
    if (this.config.get('filter_path')) {
        filter_path = 'base "' + this.config.get('filter_path') + '"';
    }

    return this.executeFind('Date "' + parseInt(year, 10) + '" ' + filter_path);
};

live_playlists.prototype.findByYearRange = function(yearStart, yearEnd) {
    var defer = libQ.defer();
    var year = parseInt(yearStart, 10);
    var end = parseInt(yearEnd, 10);
    var itemsFinal = [];
    var promises = [];
    for(; year <= end; year++){
        promises.push(this.findByYear(year));
    }

    libQ.all(promises).then(function (itemsArr) {
        for(var k = 0; k < itemsArr.length; k++){
            itemsFinal = itemsFinal.concat(itemsArr[k]);
        }
        defer.resolve(itemsFinal);
    })
    return defer.promise;
};

live_playlists.prototype.executeFind = function(argStr) {
    var self = this;
    var defer = libQ.defer();

    self.controllerMpd.mpdReady.then(function () {
        self.controllerMpd.clientMpd.sendCommand(libMpd.cmd('find ' + argStr, []), function (err, msg) {
            var items = self.parseFindResult(msg);
            defer.resolve(items);
        });
    });

    return defer.promise;
};

live_playlists.prototype.parseFindResult = function(msg) {
    var self = this;
    var items = [];
    var path;
    var name;
    if (msg) {
        var lines = msg.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('file:') === 0) {
                var path = line.slice(6);
                var name = path.split('/').pop();

                var artist = self.controllerMpd.searchFor(lines, i + 1, 'Artist:');
                var album = self.controllerMpd.searchFor(lines, i + 1, 'Album:');
                var title = self.controllerMpd.searchFor(lines, i + 1, 'Title:');
                var time = parseInt(self.controllerMpd.searchFor(lines, i + 1, 'Time:'));
                var albumart = self.controllerMpd.getAlbumArt({artist: artist, album: album}, self.controllerMpd.getParentFolder(path),'fa-dot-circle-o');

                if (title) {
                    title = title;
                } else {
                    title = name;
                }
                items.push({
                    uri: 'music-library/' + path,
                    service: 'mpd',
                    name: title,
                    artist: artist,
                    album: album,
                    type: 'track',
                    tracknumber: 0,
                    albumart: albumart,
                    duration: time,
                    trackType: path.split('.').pop()
                });
            }
        }
    }

    return items;
};

live_playlists.prototype.getTrackInfo = function(path){
    var self = this;

    return libQ.nfcall(self.controllerMpd.clientMpd.sendCommand.bind(self.controllerMpd.clientMpd), libMpd.cmd('listallinfo', [path])).then(function (msg) {
        var lines = msg.split('\n');
        var path = lines[0].slice(6);
        var name = path.split('/').pop();

        var artist = self.controllerMpd.searchFor(lines, 1, 'Artist:');
        var album = self.controllerMpd.searchFor(lines, 1, 'Album:');
        var title = self.controllerMpd.searchFor(lines, 1, 'Title:');
        var time = parseInt(self.controllerMpd.searchFor(lines, 1, 'Time:'));
        var albumart = self.controllerMpd.getAlbumArt({artist: artist, album: album}, self.controllerMpd.getParentFolder(path),'fa-dot-circle-o');

        if (title) {
            title = title;
        } else {
            title = name;
        }
        return {
            uri: 'music-library/' + path,
            service: 'mpd',
            name: title,
            artist: artist,
            album: album,
            type: 'track',
            tracknumber: 0,
            albumart: albumart,
            duration: time,
            trackType: path.split('.').pop()
        };

    });
};

live_playlists.prototype.onStop = function () {
    var self = this;
    //Perform stop tasks here
    return libQ.resolve();
};

live_playlists.prototype.onRestart = function () {
    var self = this;
    //Perform restart tasks here
};

live_playlists.prototype.onInstall = function () {
    var self = this;
    //Perform your installation tasks here
};

live_playlists.prototype.onUninstall = function () {
    var self = this;
    //Perform your deinstallation tasks here
};

live_playlists.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            uiconf.sections[0].content[0].value = self.config.get('filter_path');
            uiconf.sections[0].content[1].value = self.config.get('random');
            uiconf.sections[0].content[2].value = self.config.get('latest');
            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

live_playlists.prototype.setUIConfig = function (data) {
    var self = this;
    //Perform your UI configuration tasks here
};

live_playlists.prototype.getConf = function (varName) {
    var self = this;
    //Perform your tasks to fetch config data here
};

live_playlists.prototype.setConf = function (varName, varValue) {
    var self = this;
    //Perform your tasks to set config data here
};

//Optional functions exposed for making development easier and more clear
live_playlists.prototype.getSystemConf = function (pluginName, varName) {
    var self = this;
    //Perform your tasks to fetch system config data here
};

live_playlists.prototype.setSystemConf = function (pluginName, varName) {
    var self = this;
    //Perform your tasks to set system config data here
};

live_playlists.prototype.getAdditionalConf = function () {
    var self = this;
    //Perform your tasks to fetch additional config data here
};

live_playlists.prototype.setAdditionalConf = function () {
    var self = this;
    //Perform your tasks to set additional config data here
};

live_playlists.prototype.savePluginOptions = function (data) {
    var self = this;

    var defer = libQ.defer();

    self.config.set('filter_path', data.filter_path);
    self.config.set('random', data.random);
    self.config.set('latest', data.latest);

    self.logger.info('Live playlists configurations have been set');

    self.commandRouter.pushToastMessage('success', 'Live Playlists', 'Configuration saved');

    defer.resolve({});

    return defer.promise;

};

live_playlists.prototype.getConfigurationFiles = function()
{
	var self = this;

	return ['config.json'];
};
