/*  Copyright (C) 2021  Skip Hansen
 * 
 *  This program is free software; you can redistribute it and/or modify it
 *  under the terms and conditions of the GNU General Public License,
 *  version 2, as published by the Free Software Foundation.
 *
 *  This program is distributed in the hope it will be useful, but WITHOUT
 *  ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 *  FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 *  more details.
 *
 *  You should have received a copy of the GNU General Public License along
 *  with this program; if not, write to the Free Software Foundation, Inc.,
 *  51 Franklin St - Fifth Floor, Boston, MA 02110-1301 USA.
 */

'use strict';

var libQ = require('kew');
var fs=require('fs-extra');
var config = new (require('v-conf'))();
const path = require('path');
// const util = require('util');

const playlistdir = '/data/playlist/'

module.exports = m3uImporter;
function m3uImporter(context) {
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
    var defer=libQ.defer();

    self.commandRouter.loadI18nStrings();

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
};


// Configuration Methods

m3uImporter.prototype.getUIConfig = function() {
    var defer = libQ.defer();
    var self = this;
    var mountPoints = ['USB','NAS','INTERNAL'];
    var files = fs.readdirSync('/mnt/USB');
    var defaultPath = '';

    for( let i = 0; i < mountPoints.length; i++) {
        files = fs.readdirSync('/mnt/' + mountPoints[i]);
        if(files.length > 0) {
            defaultPath = mountPoints[i] + '/';
            if(mountPoints[i] != 'INTERNAL') {
            // USB or NAS, include unique identifier or server name
                defaultPath += files[0] + '/';
            }
            break;
        }
    }

    var lang_code = self.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+lang_code+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            uiconf.sections[0].content[0].value = defaultPath;
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
};

m3uImporter.prototype.getConf = function(varName) {
};

m3uImporter.prototype.setConf = function(varName, varValue) {
};

m3uImporter.prototype.importDone = function() {
    console.trace();
    var self = this;

    var msg = '';
    var result = 'success';

    if(self.errMsg != '') {
        msg = self.errMsg;
        result = 'error';
    }
    else if(self.playlistsImported > 0) {
        msg = 'Successfully imported ' + self.playlistsImported + 
            ' playlists';

        if(self.tracksReferenced > 0) {
            msg += ' referencing ' + self.tracksReferenced + ' tracks';
        }
        if(self.stationsReferenced > 0) {
            if(self.tracksReferenced > 0) {
                msg += ' and ';
            }
            else {
                msg += ' referencing ';
            }
            msg += self.stationsReferenced + ' web radio stations';
        }
        msg += '.';

        if(self.tracksNotfound > 0) {
            msg += ' ' + self.tracksNotfound + ' playlist tracks weren\'t found.';
        }
    }
    else if(self.playlistsSkipped > 0) {
        msg += self.playlistsSkipped + ' existing playlists were skipped.';
    }
    else {
        msg = 'No M3U playlists were imported.';
    }
    self.logMsg(msg);
    self.logger.info(msg);
    self.commandRouter.pushToastMessage(result,msg);

// Clean up
    self.files = [];
    self.m3uLines = [];
    fs.closeSync(self.logFile);
    delete self.logFile;
}

// Main entry from UIConfig, called once
m3uImporter.prototype.doImport = function(args) {
    var self = this;

    self.which = args['which'].value;
    self.errMsg = '';
    self.logFile = fs.openSync("/tmp/m3u_importer.log",'w');
    self.playlistsImported = 0;
    self.playlistsSkipped = 0;
    self.tracksReferenced = 0;
    self.tracksNotfound = 0;
    self.stationsReferenced = 0;
    self.fileNdx = 0;
    self.files = [];
    self.modalResult = '';
    self.modalQuestion = '';
    self.ignoreErrs = false;
    self.haveExtInf = false;
    var fileOrDir = '/mnt/' + args['fileOrDir'];

    self.logMsg('doImport: which="' + self.which + '", fileOrDir="' + 
                fileOrDir + '"');

    if(fs.existsSync(fileOrDir)) {
        if(fs.lstatSync(fileOrDir).isDirectory()) {
            self.logMsg('Path is a directory');
            self.dir = fileOrDir;
            self.files = fs.readdirSync(fileOrDir);
        }
        else {
            self.dir = path.dirname(fileOrDir);
            self.files = [fileOrDir];
        }
        self.importPlaylists();
    }
    else {
        self.errMsg = '"' + fileOrDir + ' does not exist';
        self.importDone();
    }
}

m3uImporter.prototype.getI18nFile = function (langCode) {
  const i18nFiles = fs.readdirSync(path.join(__dirname, 'i18n'));
  const langFile = 'strings_' + langCode + '.json';

  // check for i18n file fitting the system language
  if (i18nFiles.some(function (i18nFile) { return i18nFile === langFile; })) {
    return path.join(__dirname, 'i18n', langFile);
  }
  // return default i18n file
  return path.join(__dirname, 'i18n', 'strings_en.json');
};

m3uImporter.prototype.import_m3u = function () 
{
    var self = this;
    var file = self.currentPlaylist;

    self.logMsg('import_m3u: file "' + file + '"');
    self.logMsg('  modalResult: "' + self.modalResult + '"');

    if(self.modalResult == '') {
    // First call for this playlist, do init
        if(file[0] == '/') {
        // Just a single file
            var m3u_path = file;
        }
        else {
            var m3u_path = self.dir + '/' + file;
        }
        self.first = true;
        self.playlist_out = fs.openSync(self.playlist_path,'w')
        self.logMsg('  processing '+ m3u_path)
        self.logger.info('Processing '+ m3u_path)
        var fileData = fs.readFileSync(m3u_path).toString('utf8');
        self.playlistsImported++;

        if(fileData.includes('\n') && fileData.includes('\r')) {
            self.logMsg('  file has carrage returns and line feeds');
        }
        else if(fileData.includes('\r')) { 
            self.logMsg('  file has carrage returns');
            self.fileData('\r','\n')
        }
        else if(fileData.includes('\n')) { 
            self.logMsg('  file has line feeds');
        }
        else { 
            self.logMsg('  file is empty ??? ');
        }
        self.m3uLines = fileData.split('\n');
        self.m3uLine = 0;
        self.extendedM3u = false;

        if(self.m3uLines[0].startsWith('#EXTM3U')) {
            self.extendedM3u = true;
            self.m3uLine++;
        }
    }
    else if(self.modalQuestion == 'track_error') {
    // One of the tracks in a playlist we are processing didn't exist
        switch(self.modalResult) {
            case 'continue':
                self.logMsg('  continuing');
                self.tracksNotfound++;
                self.m3uLine++;
                self.haveExtInf = false;
                break;

            case 'ignore_errs':
                self.logMsg('  ignoring');
                self.ignoreErrs = true;
                break;

            case 'cancel':
                self.logMsg('  canceling');
                self.m3uLine = self.m3uLines.length;
                self.fileNdx = self.files.length;
                break;
        }
        self.modalResult = '';
        self.modalQuestion = '';
    }

    self.logMsg('  m3uLine:' + self.m3uLine + ' m3uLines.length:' + self.m3uLines.length);

    while(self.m3uLine < self.m3uLines.length) {
        var line = self.m3uLines[self.m3uLine].trim();
        if(line.length == 0 || (!self.extendedM3u && line.startsWith('#'))) {
        // ignore blank lines and comments in simple files
        }
        else if(self.extendedM3u) {
            self.importExtendedM3u();
        }
        else {
            self.importSimpleM3u();
        }
        if(self.modalQuestion != '') {
        // reporting an error, bail
            break;
        }
        self.m3uLine++;
    }

    if(self.m3uLine >= self.m3uLines.length) {
    // Finished with this playlist
        self.logMsg('-----');
        delete self.m3uLines;
        if(!self.first) {
            try {
                fs.writeSync(self.playlist_out,']');
            } catch (e) { 
                self.logger.error('write error while writing "]" to playlist');
            }
        }
        fs.closeSync(self.playlist_out);
        self.fileNdx++;
    }
}

m3uImporter.prototype.importExtendedM3u = function() 
{
    var self = this;
    var artist;
    var title;
    var split_index;
    var comma_index;
    var parseErr = false;
    var line = self.m3uLines[self.m3uLine].trim();

    self.errMsg = '';
    self.logMsg('importExtendedM3u line ' + self.m3uLine + ':');
    self.logMsg('  ' + line);

    if(self.haveExtInf) {
        self.uri = line.replace(/\\/g,'/');
        if(line.startsWith('http://') || line.startsWith('https://')) {
            self.haveExtInf = false;
            self.webRadioUri();
        }
        else if(self.convertAbsolutePath()) {
            parseErr = true;
        }
        else {
            self.fileUri();
            if(self.modalQuestion == '') {
                self.haveExtInf = false;
            }
        }
    }
    else if(line.startsWith('#EXTINF:')) {
    // get artist and title from #EXTINF line
        var extinf = line.replace(/"/g,"\\\"");
        if((comma_index = extinf.indexOf(',')) > 0) {
            self.haveExtInf = true;
            self.logMsg('  extinf: ' + extinf);
            if((split_index = extinf.indexOf(' - ')) > 0) {
                self.artist = extinf.substring(comma_index + 1,split_index).trim();
                self.title = extinf.substring(split_index + 3).trim();
            }
            else {
                self.artist = '';
                self.title = extinf.substring(comma_index + 1).trim();
            }
        }
        else {
            self.errMsg = ', no comma';
            parseErr = true;
        }
    }
    else if(line.startsWith('#')) {
        if(self.haveExtInf) {
            parseErr = true;
            self.errMsg = ', expected uri';
        }
    }
    else {
        parseErr = true;
    }

    if(parseErr) {
        parseErr = false;
        var msg = 'parsing error' + self.errMsg + ': ' + line;
        self.logMsg('  ' + msg);
        self.logger.error(msg);
    }
}

m3uImporter.prototype.fileUri = function() 
{
    var self = this;
    var uri_path;

    self.logMsg('  artist: "' + self.artist + '"');
    self.logMsg('  title: "' + self.title + '"');
    self.logMsg('  uri line: "' + self.uri + '"');
    self.logMsg('  modalResult: "' + self.modalResult + '"');

    if(self.uri[0] == '/') {
        uri_path = self.uri;
    }
    else {
        uri_path = path.normalize(self.dir + '/' + self.uri);
    }

    if(fs.existsSync(uri_path)) {
        self.tracksReferenced++;
        self.logMsg('  uri exists: ' + uri_path);
        try {
            if(self.first) {
                self.first = false;
                fs.writeSync(self.playlist_out,'[');
            }
            else {
                fs.writeSync(self.playlist_out,',\n');
            }
        } catch (e) { 
            self.logger.error('playlist write failed');
        }

        var entry = '{"service":"mpd",' +
                    '"uri":"' + uri_path.substring(1) + 
                    '","title":"' + self.title + '"';

        if(self.artist != '') {
            entry += ',"artist":"' + self.artist + '"';
        }
        entry += '}';
        try {
            fs.writeSync(self.playlist_out,entry);
        } catch (e) {
            self.logger.error('playlist write failed');
        }
    }
    else if(!self.ignoreErrs){
        var msg = 'While processing '+ self.currentPlaylist +
            " couldn't find " + '"' + uri_path + '"';
        self.logger.error(msg);
        self.logMsg(msg);
        self.modalQuestion = 'track_error';
        msg = 'While processing '+ self.currentPlaylist +
            " couldn't find " + '"' + path.basename(uri_path) + '"';
        self.displayErr(msg);
    }
    else {
        self.tracksNotfound++;
        self.m3uLine++;
        self.haveExtInf = false;
    }
}

m3uImporter.prototype.webRadioUri = function() {
    var self = this;

    self.stationsReferenced++;
    self.logMsg('  title: "' + self.title + '"');
    var entry = '{"service":"webradio",' +
                '"uri":"' + self.uri + 
                '","title":"' + self.title + 
                '","icon":"fa-microphone"}'

    if(self.first) {
        self.first = false;
        fs.writeSync(self.playlist_out,'[');
    }
    else {
        fs.writeSync(self.playlist_out,',\n');
    }
    fs.writeSync(self.playlist_out,entry);
}

m3uImporter.prototype.importSimpleM3u = function() 
{
    var self = this;
    var split_index;
    var line = self.m3uLines[self.m3uLine].trim();

// Simple M3U, get title from filename
    self.artist = '';
    self.title = '';
    self.uri = line.replace(/\\/g,'/');
    var ext = path.extname(self.uri);
    var basename = path.basename(self.uri,ext);
    if((split_index = basename.indexOf(' - ')) > 0) {
        self.artist = basename.substring(0,split_index).trim();
        self.title = basename.substring(split_index + 3).trim();
    }
    else {
        self.title = basename;
    }

    if(line.startsWith('http://') || line.startsWith('https://')) {
        self.logMsg('importSimpleM3u: calling webRadioUri, self.uri ' + self.uri);
        self.webRadioUri(self.uri,self.title);
    }
    else if(!self.convertAbsolutePath()) {
        self.logMsg('importSimpleM3u: calling fileUri, self.uri ' + self.uri);
        self.fileUri();
    }
}

// Called by doImport() or 
// dialog_result() after the user has responded to a modal dialog
m3uImporter.prototype.importPlaylists = function () 
{
    var self = this;

    if(self.fileNdx < self.files.length) do {
    // more to do
        self.getPlaylistPath();

        self.logMsg('importPlaylists');
        self.logMsg('  fileNdx ' + self.fileNdx);
        self.logMsg('   file ' + (self.fileNdx + 1) + ' of ' + 
                    self.files.length + ' modalResult "' + 
                    self.modalResult + '"');

        if(self.modalResult == '') {
        // Called by doImport(), do init
            self.playlist_exists = false;

            try {
                var stats = fs.lstatSync(self.playlist_path)
                self.playlist_exists = true;
                self.logMsg('  ' + self.currentPlaylist + 'exists');
            } catch (e) { }
        }
        else {
        // Called by dialog_result() 
            self.logMsg('  modalQuestion: "' + self.modalQuestion + '"');
            self.logMsg('  modalResult: "' + self.modalResult + '"');
            if(self.modalQuestion == 'overwrite') {
            // handle the user's answer
                switch(self.modalResult) {
                    case 'yes':
                        self.playlist_exists = false;
                        break;

                    case 'no':
                        self.playlistsSkipped++;
                        self.fileNdx++;
                        if(self.fileNdx < self.files.length) {
                            self.getPlaylistPath();
                        }
                        break;

                    case 'cancel':
                        self.fileNdx = self.files.length;
                        break;

                    case 'go':
                        self.which = 'all';
                        break;
                }
                self.modalResult = '';
                self.modalQuestion = '';
            }
            else if(self.modalQuestion == 'track_error') {
                if(self.modalResult == 'cancel') {
                    self.fileNdx = self.files.length;
                }
            }
            else {
                self.logMsg('  Internal error, modalQuestion "' + self.modalQuestion + '"');
                self.logger.error('Internal error, modalQuestion "' + self.modalQuestion+ '"');
            }
        }

        if(self.fileNdx >= self.files.length) {
            break;
        }

        switch (self.which) {
            case "new":
                if(self.playlist_exists) {
                    var msg = self.currentPlaylist + ': skipped, playlist already exists';
                    self.logMsg('  ' + msg);
                    self.playlistsSkipped++;
                    self.fileNdx++;
                    continue;
                }
                break;

            case "all":
                break;

            case "ask":
                if(self.playlist_exists) {
                    self.modalQuestion = 'overwrite';
                    self.ask2Import(path.basename(self.playlist_path));
                }
                break;

            default:
                self.logMsg('  Internal error, which "' + self.which + '"');
                self.logger.error('Internal error, which "' + self.which + '"');
                break;
        }

        if(self.modalQuestion == 'overwrite' && self.modalQuestion != '') {
        // we're asking a question, bail
            self.logMsg('  asking a question, bailing');
            break;
        }

        var ignored = false;
        switch (self.plist_ext.toLowerCase()) {
            case '.m3u':
            case '.m3u8':
                self.logMsg('  calling import_m3u');
                self.import_m3u();
                break;

            default:
                ignored = true;
                break;
        }

        if(ignored) {
            self.logMsg('  File "' + self.currentPlaylist + '" ignored');
            self.fileNdx++;
        }
    } while (self.modalQuestion == '' && self.fileNdx < self.files.length);

    if(self.fileNdx >= self.files.length) {
        self.logMsg('importPlaylists: calling importDone');
        self.importDone();
    }
    // console.trace();
    self.logMsg('importPlaylists returning');
}

m3uImporter.prototype.dialog_result = function(answer) {
    var self = this;
    self.logMsg('dialog_result: answer ' + answer);
    self.modalResult = answer;
    self.importPlaylists();
}

m3uImporter.prototype.ask2Import = function(playlist) {
  var self = this;
  var message = self.commandRouter.getI18nString('M3U_IMPORT.OK_2_OVERWRITE') +
                '"' + playlist + '"?';
  self.logMsg('   message: "' + message + '"');

  var modalData = {
    title: self.commandRouter.getI18nString('M3U_IMPORT.PLUGIN_CONFIGURATION'),
    message: message,
    size: 'lg',
    buttons: [
      {
        name: self.commandRouter.getI18nString('M3U_IMPORT.YES'),
        class: 'btn btn-info',
        emit: 'callMethod',
        payload: { 
            endpoint: 'miscellanea/m3u_importer',
            method: 'dialog_result',
            data: 'yes'
        }
      },
      {
        name: self.commandRouter.getI18nString('M3U_IMPORT.NO'),
        class: 'btn btn-default',
        emit: 'callMethod',
        payload: {
          endpoint: 'miscellanea/m3u_importer',
          method: 'dialog_result',
          data: 'no'
        }
      },
      {
        name: self.commandRouter.getI18nString('M3U_IMPORT.GO'),
        class: 'btn btn-info',
        emit: 'callMethod',
        payload: {
          endpoint: 'miscellanea/m3u_importer',
          method: 'dialog_result',
          data: 'go'
        }
      },
      {
        name: self.commandRouter.getI18nString('M3U_IMPORT.CANCEL'),
        class: 'btn btn-info',
        emit: 'callMethod',
        payload: {
          endpoint: 'miscellanea/m3u_importer',
          method: 'dialog_result',
          data: 'cancel'
        }
      }
    ]
  };
  self.commandRouter.broadcastMessage("openModal", modalData);
}

// Display error message, continue/ignore errors/cancel
m3uImporter.prototype.displayErr = function(message) {
  var self = this;
  self.logMsg('   message: "' + message + '"');

  var modalData = {
    title: self.commandRouter.getI18nString('M3U_IMPORT.PLUGIN_CONFIGURATION'),
    message: message,
    size: 'lg',
    buttons: [
      {
        name: self.commandRouter.getI18nString('M3U_IMPORT.CONTINUE'),
        class: 'btn btn-info',
        emit: 'callMethod',
        payload: { 
            endpoint: 'miscellanea/m3u_importer',
            method: 'dialog_result',
            data: 'continue'
        }
      },
      {
        name: self.commandRouter.getI18nString('M3U_IMPORT.IGNORE_ERRS'),
        class: 'btn btn-default',
        emit: 'callMethod',
        payload: {
          endpoint: 'miscellanea/m3u_importer',
          method: 'dialog_result',
          data: 'ignore_errs'
        }
      },
      {
        name: self.commandRouter.getI18nString('M3U_IMPORT.CANCEL'),
        class: 'btn btn-info',
        emit: 'callMethod',
        payload: {
          endpoint: 'miscellanea/m3u_importer',
          method: 'dialog_result',
          data: 'cancel'
        }
      }
    ]
  };
  self.commandRouter.broadcastMessage("openModal", modalData);
}


m3uImporter.prototype.logMsg = function(msg) {
    var self = this;

    if (typeof self.logFile !== 'undefined') {
        try {
            fs.writeSync(self.logFile,msg + '\n');
        } catch (e) { 
            self.logger.error('Logfile write failed');
        }
    }
    else {
        self.logger.info(msg);
    }
}

m3uImporter.prototype.convertAbsolutePath = function()  {
    var self = this;
    var parseErr = false;
    var uri = self.uri;

    self.logMsg('convertAbsolutePath:');
    do {
        if(uri[1] == ':') {
        // Absolute Windoze path starting with a drive name, remove it
            if(uri[2] == '/') {
            // C:\
                uri = uri.substr(2);
            }
            else {
            // C:<file>
                uri = '/' + uri.substr(2);
            }
        }
        else if(uri.startsWith('//')) {
        // \\server\mount
            uri = uri.substr(1);
        }
    } while (false);

    if(!parseErr) do {
        self.logMsg('  dir: ' + self.dir);
        self.logMsg('  uri: ' + uri);
        if(uri[0] == '/' && !uri.startsWith('/mnt')) {
        // Absolute path, fixup root
            if(self.dir.startsWith('/mnt/NAS/')) {
            // add /mnt/NAS prefix
                uri = '/mnt/NAS' + uri;
            }
            else if(self.dir.startsWith('/mnt/USB/')) {
            // add /mnt/USB/<uuid> prefix
                var index = self.dir.indexOf('/',9);
                if(index < 0) {
                    parseErr = true;
                    break;
                }
                uri = self.dir.substr(0,index) + uri;
            }
            else if(self.dir.startsWith('/mnt/INTERNAL/')) {
            // add /mnt/INTERNAL prefix
                uri = '/mnt/INTERNAL' + uri.substr(2);
            }
            else if(self.dir.startsWith('/mnt/UPNP/')) {
            // add /mnt/UPNP prefix
                uri = '/mnt/UPNP' + uri.substr(2);
            }
            self.logMsg('  "' + self.uri + '" ->');
            self.logMsg('  "' + uri + '"');
        }
        self.uri = uri;
    } while (false);

    return parseErr;
}

m3uImporter.prototype.getPlaylistPath = function()  
{
    var self = this;

    var file = self.files[self.fileNdx];
    self.currentPlaylist = file;
    self.plist_ext = path.extname(file);
    var basename = path.basename(file,self.plist_ext);
    self.playlist_path = playlistdir + basename;
}

