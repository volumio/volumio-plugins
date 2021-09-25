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


m3uImporter.prototype.importDone = function() {
    var self = this;

    if(self.errMsg != '') {
        self.commandRouter.pushToastMessage('error',self.errMsg);
        self.errMsg = '';
    }

    self.logMsg('importDone:');
    if (self.errMsg != '') {
        var modalData = {
           title: 'Error',
           message: self.errMsg,
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

    else if (self.results != '') {
        var modalData = {
           title: 'Results',
           message: self.results,
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

    fs.close(self.logFile);
}

// Main entry from UIConfig
m3uImporter.prototype.doImport = function(args) {
    var self = this;

    self.which = args['which'].value;
    self.dir = args['m3u_dir'];
    self.errMsg = '';
    self.results = '';
    self.logFile = fs.openSync("/tmp/m3u_importer.log",'w');
    self.playlistsImported = 0;
    self.tracksReferenced = 0;
    self.stationsReferenced = 0;
    self.files = 0;

    self.logMsg('doImport: which="' + self.which + '", dir="' + self.dir + '"');
    var fileExists = fs.existsSync(self.dir);

    if(fileExists && fs.lstatSync(self.dir).isDirectory()) {
        self.logMsg('Path is a directory');
        self.files = fs.readdirSync(self.dir);
        self.fileNdx = 0
        self.modalResult = 'ask';
        fs.writeSync(self.logFile,'opened\n');
        self.importPlaylists();
    }
    else if(fileExists) {
        self.importPlaylist(self.dir);
    }
    else {
        self.errMsg = '"' + self.dir + ' does not exist';
    }
    self.importDone();
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

m3uImporter.prototype.import_m3u = function () {
    var self = this;
    var dir = self.dir;
    var file = self.files[self.fileNdx];
    self.logMsg('import_m3u: file "' + file + '"');
    var playlist_exists = false;
    var convert_playlist = true;
    var plist_ext = path.extname(file);
    var basename = path.basename(file,plist_ext);
    self.playlist_path = playlistdir + basename;

    self.logMsg('  modalResult: ' + self.modalResult);

    switch(self.modalResult) {
        case 'no':
            if(self.files > 0) {
              self.fileNdx++;
              self.importPlaylists();
            }
            else {
              self.importDone();
            }
            return;

        case 'yes':
            break;

        case 'cancel':
            self.importDone();
            return;

        default:
            break;
    }

    try {
        var stats = fs.lstatSync(self.playlist_path)
        playlist_exists = true;
    } catch (e) { }

    switch (self.which) {
        case "new":
            if(playlist_exists) {
                var msg = file + ': skipped, playlist already exists';
                self.logMsg('  ' + msg);
                convert_playlist = false;
            }
            break;

        case "all":
            break;

        case "ask":
            if(playlist_exists && self.modalResult == 'ask') {
                self.modalCallback = self.import_m3u;
                self.ask2Import();
                return;
            }
            break;

        default:
            self.logMsg('  Internal error, which "' + self.which + '"');
            break;
    }

    if(convert_playlist) {
        var url_next = false;
        var m3u_path = dir + '/' + file;
        var playlist_out = fs.openSync(self.playlist_path,'w')
        self.logMsg('  processing '+ m3u_path)
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
        var lines = fileData.split('\n');

        if(lines[0].startsWith('#EXTM3U')) {
            self.logMsg('  calling importExtendedM3u');
            self.importExtendedM3u(lines,playlist_out);
        }
        else {
            self.logMsg('  calling importSimpleM3u');
            self.importSimpleM3u(lines,playlist_out);
        }
        self.logMsg('-----');
        fs.closeSync(playlist_out);
    }

    self.fileNdx++;
    self.importPlaylists();
}

m3uImporter.prototype.importExtendedM3u = function(lines,playlist_out) {
    var self = this;
    var extInfLine = 0;
    this.first = true;

    for (let i = 1; i < lines.length; i++) {
        if(lines[i].trim().length == 0) {
        // ignore blank lines
            continue;
        }
        var line = lines[i];
        if(extInfLine != 0) {
        // uri expected
            if(line.startsWith('http://') || line.startsWith('https://')) {
                this.webRadioUri(line,lines[extInfLine],playlist_out);
            }
            else {
                this.fileUri(line,lines[extInfLine],playlist_out);
            }
            extInfLine = 0;
        }
        else if(lines[i].startsWith('#EXTINF:')) {
            extInfLine = i;
        }
        else if(lines[i].startsWith('#')) {
            if(extInfLine != 0) {
                msg = 'parsing error, expected url: ' + lines[i];
                self.reportErr(msg);
            }
        }
        else if(lines[i].trim().length != 0) {
            var msg = 'parsing error: ' + lines[i];
            self.reportErr(msg);
        }
    }

    if(!this.first) {
        fs.writeSync(playlist_out,']');
    }
}

m3uImporter.prototype.fileUri = function(line,inf,playlist_out) 
{
    var self = this;
    var split_index = 0;
    var comma_index = 0;
    var extinf = '';

    if((split_index = inf.indexOf(' - ')) > 0 && 
       (comma_index = inf.indexOf(',')) > 0)
    {
        extinf = inf.replace(/"/g,"\\\"");
        self.logMsg('  extinf: ' + extinf);
        var artist = extinf.substring(comma_index + 1,split_index).trim();
        var title = extinf.substring(split_index + 3).trim();
    }
    else {
        var msg = 'parsing error: ' + line;
        self.reportErr(msg);
        var artist = 'unknown';
        var title = 'unknown';
    }
    self.logMsg('  artist: "' + artist + '"');
    self.logMsg('  title: "' + title + '"');
    var uri = line.trim().replace(/\\/g,'/')
    self.logMsg('  uri line: "' + uri + '"');
    var uri_path = path.normalize(self.dir + '/' + uri);

    if(fs.existsSync(uri_path)) {
        self.tracksReferenced++;
        self.logMsg('  uri exists: ' + uri_path);
        if(this.first) {
            this.first = false;
            fs.writeSync(playlist_out,'[');
        }
        else {
            fs.writeSync(playlist_out,',\n');
        }

        var entry = '{"service":"mpd",' +
                    '"uri":"' + uri_path.substring(1) + 
                    '","title":"' + title + 
                    '","artist":"' + artist + '"}'
        fs.writeSync(playlist_out,entry);
    }
    else {
        var msg = "Couldn't find " + '"' + uri_path + '"';
        self.reportErr(msg);
    }
}

m3uImporter.prototype.webRadioUri = function(line,inf,playlist_out) {
    var self = this;
    var index = 0;
    var extinf = '';

    if((index = inf.indexOf(',')) > 0) {
        self.stationsReferenced++;
        extinf = inf.replace(/"/g,"\\\"");
        self.logMsg('  extinf: ' + extinf);
        var title = extinf.substring(index + 1).trim();
        if((index = title.indexOf('.mp3?')) > 0 || 
           (index = title.indexOf('.acc?')) > 0) 
        {   // title is probably a part of a url, strip the crap
            title = title.substring(0,index);
        }
        self.logMsg('  title: "' + title + '"');

        var entry = '{"service":"webradio",' +
                    '"uri":"' + line + 
                    '","title":"' + title + 
                    '","icon":"fa-microphone"}'

        if(this.first) {
            this.first = false;
            fs.writeSync(playlist_out,'[');
        }
        else {
            fs.writeSync(playlist_out,',\n');
        }
        fs.writeSync(playlist_out,entry);
    }
    else {
        var msg = 'parsing error: ' + line;
        self.reportErr(msg);
    }
}

m3uImporter.prototype.importSimpleM3u = function(lines,playlist_out) 
{
    var self = this;

    if(!this.first) {
        fs.writeSync(playlist_out,']');
    }
}

m3uImporter.prototype.formatInfoResults = function(msg) {
    return msg + '<br>';
}

m3uImporter.prototype.reportErr = function (msg) {
    var self = this;
    if(self.errMsg == '') {
        self.errMsg += 'While processing ' + self.currentPlaylist + '<br>';
    }
    self.errMsg += msg + '\n';
    self.logMsg('  ' + msg);
}


m3uImporter.prototype.importPlaylist = function (file) {
    var self = this;
    self.currentPlaylist = file;

    var extension = path.extname(file).toLowerCase();

    switch (extension) {
        case '.m3u':
        case '.m3u8':
            self.import_m3u();
            return;

        default:
            self.reportErr('File "' + file + '" ignored');
            self.fileNdx++;
            break;
    }
}

m3uImporter.prototype.importPlaylists = function () {
    var self = this;

    self.logMsg('importPlaylists:');

    while(self.fileNdx < self.files.length) {
        self.modalResult = 'ask';
        self.importPlaylist(self.files[self.fileNdx]);
    }
}

m3uImporter.prototype.dialog_result = function(answer) {
    console.log('dialog_result: answer ' + answer);
    this.modalResult = answer;
    this.import_m3u();
}

m3uImporter.prototype.ask2Import = function() {
  var self = this;
  var message = self.commandRouter.getI18nString('M3U_IMPORT.OK_2_OVERWRITE') +
                self.files[self.fileNdx] + '?';
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
    console.log(msg);
    fs.writeSync(this.logFile,msg + '\n');
}

