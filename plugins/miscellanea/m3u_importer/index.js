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
        self.errMsg = '';
    }

    self.logMsg('importDone:');
	var msg = '';
	if(self.playlistsImported > 0) {
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
			msg += ' ' + self.tracksNotfound + ' entries were ignored.';
		}
	}
	else if(self.playlistsSkipped > 0) {
		msg += self.playlistsSkipped + ' existing playlists were skipped.';
	}
	else {
		msg = 'No M3U playlists were imported.';
	}
	self.commandRouter.pushToastMessage('success',msg);
    fs.close(self.logFile);
}

// Main entry from UIConfig
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
    self.ignoreErrs = false;
	self.haveExtInf = false;
    var fileOrDir = args['fileOrDir'];

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
		var self = this;
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
	var askingUser = false;

    self.logMsg('import_m3u: file "' + file + '"');
    self.logMsg('  modalResult: "' + self.modalResult + '"');

    if(file[0] == '/') {
    // Just a single file
        var m3u_path = file;
    }
    else {
        var m3u_path = self.dir + '/' + file;
    }
    this.first = true;
    self.playlist_out = fs.openSync(self.playlist_path,'w')
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
    self.m3uLines = fileData.split('\n');
    self.m3uLine = 0;
    self.extendedM3u = false;

    if(self.m3uLines[0].startsWith('#EXTM3U')) {
        self.extendedM3u = true;
		self.m3uLine++;
    }
	return self.import_m3uLines();
}

m3uImporter.prototype.import_m3uLines = function () 
{
    var self = this;
	var askingUser = false;

    while(self.m3uLine < self.m3uLines.length) {
		self.logMsg('m3uLine: ' + self.m3uLine);
        var line = self.m3uLines[self.m3uLine].trim();
        if(line.length == 0 || (!self.extendedM3u && line.startsWith('#'))) {
        // ignore blank lines and comments in simple files
			self.logMsg('ignoring blank line: ' + line);
        }
        else if(self.extendedM3u) {
			if((askingUser = self.importExtendedM3u())) {
			// asking user for feedback
				self.logMsg('importExtendedM3u returned true');
				break;
			}
        }
        else {
			if((askingUser = self.importSimpleM3u())) {
			// asking user for feedback
				self.logMsg('importSimpleM3u returned true');
				break;
			}
        }
		self.m3uLine++;
    }

    if(self.m3uLine >= self.m3uLines.length) {
		if(!this.first) {
			fs.writeSync(self.playlist_out,']');
		}
        self.logMsg('-----');
        fs.closeSync(self.playlist_out);
		self.fileNdx++;
		self.importPlaylists();
    }
	return askingUser;
}

m3uImporter.prototype.importExtendedM3u = function() 
{
    var self = this;
    var artist;
    var title;
    var split_index;
    var comma_index;
    var parseErr = false;
    var errMsg = '';
    var askingUser = false;
	var line = self.m3uLines[self.m3uLine].trim();

	self.logMsg('importExtendedM3u line:');
	self.logMsg('  ' + line);

	if(self.haveExtInf) {
		if(line.startsWith('http://') || line.startsWith('https://')) {
			self.haveExtInf = false;
			self.uri = line;
			this.webRadioUri();
		}
		else {
			self.uri = line.replace(/\\/g,'/');
			if(!(askingUser = this.fileUri())) {
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
			errMsg = ', no comma';
			parseErr = true;
		}
	}
	else if(line.startsWith('#')) {
		if(self.haveExtInf) {
			parseErr = true;
			errMsg = ', expected uri';
		}
	}
	else {
		parseErr = true;
	}

	if(parseErr) {
		parseErr = false;
		var msg = 'parsing error' + errMsg + ': ' + line;
		self.logMsg('  ' + msg);
	}
    return askingUser;
}

m3uImporter.prototype.fileUri = function() 
{
    var self = this;

    self.logMsg('  artist: "' + self.artist + '"');
    self.logMsg('  title: "' + self.title + '"');
    self.logMsg('  uri line: "' + self.uri + '"');
    self.logMsg('  modalResult: "' + self.modalResult+ '"');
    var uri_path = path.normalize(self.dir + '/' + self.uri);
    var askingUser = false;

	if(self.modalResult != '') {
	// handle the user's answer
		var modalResult = self.modalResult;
		self.modalResult = '';
		switch(modalResult) {
			case 'continue':
				self.tracksNotfound++;
				self.m3uLine++;
				self.haveExtInf = false;
				self.import_m3uLines();
				return true;

			case 'ignore_errs':
				self.ignoreErrs = true;
				break;

			case 'cancel':
				self.fileNdx = self.files.length;
				self.importPlaylists();
				return true;
		}
	}

    if(fs.existsSync(uri_path)) {
        self.tracksReferenced++;
        self.logMsg('  uri exists: ' + uri_path);
        if(this.first) {
            this.first = false;
            fs.writeSync(self.playlist_out,'[');
        }
        else {
            fs.writeSync(self.playlist_out,',\n');
        }

        var entry = '{"service":"mpd",' +
                    '"uri":"' + uri_path.substring(1) + 
                    '","title":"' + self.title + '"';

        if(self.artist != '') {
            entry += ',"artist":"' + self.artist + '"'
        }
        entry += '}'
        fs.writeSync(self.playlist_out,entry);
    }
    else if(!self.ignoreErrs){
		askingUser = true;
		var msg = 'While processing '+ self.currentPlaylist +
			" couldn't find " + '"' + path.basename(uri_path) + '"';
		self.logMsg(msg);
		self.modalCallback = self.fileUri;
		self.displayErr(msg);
    }
	else {
		self.tracksNotfound++;
		self.m3uLine++;
		self.haveExtInf = false;
		self.import_m3uLines();
		return true;
	}

    return askingUser;
}

m3uImporter.prototype.webRadioUri = function(line,title) {
    var self = this;

    self.stationsReferenced++;
    self.logMsg('  title: "' + title + '"');
    var entry = '{"service":"webradio",' +
                '"uri":"' + line + 
                '","title":"' + title + 
                '","icon":"fa-microphone"}'

    if(this.first) {
        this.first = false;
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
    var artist = '';
    var title = '';
    var split_index;
    var askingUser = false;
    this.first = true;
	var line = self.m3uLines[self.m3uLine].trim();

// Simple M3U, get title from filename
	var uri = line.replace(/\\/g,'/');
	var ext = path.extname(uri);
	var basename = path.basename(uri,ext);
	if((split_index = basename.indexOf(' - ')) > 0) {
		artist = basename.substring(0,split_index).trim();
		title = basename.substring(split_index + 3).trim();
	}
	else {
		artist = 'unknown';
		title = basename;
	}

	if(line.startsWith('http://') || line.startsWith('https://')) {
		this.webRadioUri(uri,title);
	}
	else {
		askingUser = this.fileUri(uri,artist,title);
	}

    return askingUser;
}

m3uImporter.prototype.importPlaylists = function () {
    var self = this;
    var askingUser = false;

    while(self.fileNdx < self.files.length) {
		self.logMsg('importPlaylists: file ' + (self.fileNdx + 1) + ' of ' + 
					self.files.length + ' modalResult "' + 
					self.modalResult + '"');
        var file = self.files[self.fileNdx];
        var plist_ext = path.extname(file);
        var basename = path.basename(file,plist_ext);
        self.playlist_path = playlistdir + basename;
        var playlist_exists = false;
		var convert_playlist = false;

        try {
            var stats = fs.lstatSync(self.playlist_path)
            playlist_exists = true;
        } catch (e) { }

        switch (self.which) {
            case "new":
                if(playlist_exists) {
                    var msg = file + ': skipped, playlist already exists';
                    self.logMsg('  ' + msg);
                    self.playlistsSkipped++;
                }
                else {
                    convert_playlist = true;
                }
                break;

            case "all":
                convert_playlist = true;
                break;

            case "ask":
                if(self.modalResult != '') {
                // handle the user's answer
                    switch(self.modalResult) {
                        case 'yes':
                            convert_playlist = true;
                            break;

                        case 'no':
                            self.playlistsSkipped++;
                            break;

                        case 'cancel':
                            self.fileNdx = self.files.length;
                            break;

                        case 'go':
                            convert_playlist = true;
                            self.which = 'all';
                            break;
                    }
                    self.modalResult = '';
                }
                else if(playlist_exists) {
                    self.modalCallback = self.importPlaylists;
                    self.ask2Import(path.basename(self.playlist_path));
                    askingUser = true;
                }
                break;

            default:
                self.logMsg('  Internal error, which "' + self.which + '"');
                break;
        }

        self.currentPlaylist = file;
        if(askingUser) {
            break;
        }

		let importer;
        if(convert_playlist) {
            switch (plist_ext.toLowerCase()) {
                case '.m3u':
                case '.m3u8':
                    importer = self.import_m3u();
                    break;

                default:
                    break;
            }
        }

		if(importer === undefined) {
			self.logMsg('  File "' + file + '" ignored');
			self.fileNdx++;
		}
		else {
			self.logMsg('calling importer');
			self.importer();
			break;
		}
    }

    if(self.fileNdx >= self.files.length) {
        self.importDone();
    }
}

m3uImporter.prototype.dialog_result = function(answer) {
    var self = this;
    self.logMsg('dialog_result: answer ' + answer);
    self.modalResult = answer;
    self.modalCallback();
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
    console.log(msg);
    fs.writeSync(this.logFile,msg + '\n');
}

