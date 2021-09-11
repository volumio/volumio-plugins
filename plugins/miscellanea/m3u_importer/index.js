'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
var exec = require('child_process').exec;
var execSync = require('child_process').execSync;
const util = require('util');
const path = require('path');

const playlistdir = '/data/playlist/'

module.exports = m3uImporter;
function m3uImporter(context) {
    var self = this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}

m3uImporter.prototype.onVolumioStart = function()
{
    var self = this;
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
}

m3uImporter.prototype.onStart = function() {
    var self = this;
    self.commandRouter.pushToastMessage('info', 'I was called!', 'Please wait');
    var defer=libQ.defer();


    // Once the Plugin has successfull started resolve the promise
    defer.resolve();

    return defer.promise;
};

m3uImporter.prototype.onStop = function() {
    var self = this;
    var defer=libQ.defer();

    // Once the Plugin has successfull stopped resolve the promise
    defer.resolve();

    return libQ.resolve();
};

m3uImporter.prototype.onRestart = function() {
    var self = this;
    // Optional, use if you need it
};


// Configuration Methods -----------------------------------------------------------------------------

m3uImporter.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;

    var lang_code = this.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {


            defer.resolve(uiconf);
        })
        .fail(function()
        {
            defer.reject(new Error());
        });

    return defer.promise;
};

m3uImporter.prototype.getConfigurationFiles = function() {
    return ['config.json'];
}

m3uImporter.prototype.setUIConfig = function(data) {
    var self = this;
    //Perform your installation tasks here
};

m3uImporter.prototype.getConf = function(varName) {
    var self = this;
    //Perform your installation tasks here
};

m3uImporter.prototype.setConf = function(varName, varValue) {
    var self = this;
    //Perform your installation tasks here
};


m3uImporter.prototype.doImport = function(data) {
    var self = this;

    self.commandRouter.logger.info('doImport called');
    var which = data['which'].value;
    var m3u_dir = data['m3u_dir'];

    self.commandRouter.logger.info('  which: ' + which);
    self.commandRouter.logger.info('  m3u_dir: ' + m3u_dir);
    var error_msg = '';
    var results = '';

    do {
        if(!fs.existsSync(m3u_dir)) {
            error_msg = m3u_dir + ' does not exist';
            break;
        }

        var stats = fs.lstatSync(m3u_dir)
        if (stats.isDirectory()) {
            console.log('Path is a directory');
        }
        else {
            error_msg = '"' + m3u_dir + '" is NOT a directory.';
            break;
        }
        var files = fs.readdirSync(m3u_dir);

        for (const file of files) {
            var file_lower = file.toLowerCase();
            if(file_lower.endsWith('.m3u') || file_lower.endsWith('.m3u8')) {
                results += import_m3u(m3u_dir,file,which);
            }
        }
    } while(false);

    if (error_msg != '') {
        var modalData = {
           title: 'Error',
           message: error_msg,
           size: 'lg',
           buttons: [{
              name: 'Close',
              class: 'btn btn-warning',
              emit: 'closeModals',
              payload: ''
           },]
        }
        self.commandRouter.broadcastMessage("openModal", modalData);
    }

    else if (results != '') {
        self.commandRouter.logger.info('  results: ' + results);
        var modalData = {
           title: 'Results',
           message: results,
           size: 'lg',
           buttons: [{
              name: 'Close',
              class: 'btn btn-info',
              emit: 'closeModals',
              payload: ''
           },]
        }
        self.commandRouter.broadcastMessage("openModal", modalData);
    }
};

function import_m3u(dir,file,option) {
    console.log('import_m3u: file "' + file + '"');
    var playlist_exists = false;
    var convert_playlist = true;
    var open_mode = 'w';
    var plist_ext = path.extname(file);
    var basename = path.basename(file,plist_ext);
    var playlist_path = playlistdir + basename;
    var results = 'Importing ' + file + ':<br>';

    try {
        var stats = fs.lstatSync(playlist_path)
        playlist_exists = true;
    } catch (e) { }

    switch (option) {
        case "new":
            if(playlist_exists) {
                var msg = 'skipped, playlist already exists';
                console.log('  ' + msg);
                results += formatInfoResults(msg);
                convert_playlist = false;
            }
            break;

        case "all":
            break;

        case "ask":
            if(playlist_exists) {
                console.log('  Pop up modal here')
            }
            break;
    }

    if(convert_playlist) {
        var first = true;
        var url_next = false;
        var m3u_path = dir + '/' + file;
        var playlist_out = fs.openSync(playlist_path,'w')
        console.log('  processing '+ m3u_path)
        var data = fs.readFileSync(m3u_path).toString('utf8');
        if(data.includes('\n') && data.includes('\r')) {
            console.log('  file has carrage returns and line feeds');
        }
        else if(data.includes('\r')) { 
            console.log('  file has carrage returns');
            data.replace('\r','\n')
        }
        else if(data.includes('\n')) { 
            console.log('  file has line feeds');
        }
        else { 
            console.log('  file is empty ??? ');
        }
        var lines = data.split('\n');
        var extinf = '';
        var split_index = 0;
        var comma_index = 0;

        console.log('  contents (' + lines.length + ' lines):\n-----\n');
        for (let i = 0; i < lines.length; i++) {
            if(url_next) {
                var url_exists = false;
                var url = lines[i].trim().replace(/\\/g,'/')
                console.log('  url line: "' + url + '"');
                var url_path = path.normalize(dir + '/' + url);

                if(fs.existsSync(url_path)) {
                    console.log('  url exists: ' + url_path);
                    console.log('  extinf: ' + extinf);
                    var artist = extinf.substring(comma_index + 1,split_index).trim();
                    var title = extinf.substring(split_index + 3).trim();
                    console.log('  artist: "' + artist + '"');
                    console.log('  title: "' + title + '"');
                    if(first) {
                        first = false;
                        fs.writeSync(playlist_out,'[');
                    }
                    else {
                        fs.writeSync(playlist_out,',\n');
                    }

                    var entry = '{"service":"mpd",' +
                                '"uri":"' + url_path.substring(1) + 
                                '","title":"' + title + 
                                '","artist":"' + artist + '"}'

                    fs.writeSync(playlist_out,entry);
                }
                else {
                    var msg = "Couldn't find " + '"' + url_path + '"';
                    results += formatErrResults(msg);
                    console.log("  " + msg);
                }
                url_next = false;
            }
            else if(lines[i].startsWith('#EXTINF:') && 
                    (split_index = lines[i].indexOf(' - ')) > 0 && 
                    (comma_index = lines[i].indexOf(',')) > 0)
            {
                extinf = lines[i].replace(/"/g,"\\\"");
                url_next = true;
            }
            else if(lines[i].startsWith('#')) {
                if(url_next) {
                    msg = 'parsing error, expected url: ' + lines[i];
                    results += formatErrResults(msg);
                    console.log('  ' + msg);
                }
            }
            else if(lines[i].trim().length != 0) {
                var msg = 'parsing error: ' + lines[i];
                results += formatErrResults(msg);
                console.log('  ' + msg);
            }
        }
        console.log('-----');
        fs.writeSync(playlist_out,']\n');
        fs.closeSync(playlist_out);
    }

    results += '<br>'
    return results;
}

function formatInfoResults(msg) {
    return msg + '<br>';
}

function formatErrResults(msg) {
    return msg + '<br>';
}

