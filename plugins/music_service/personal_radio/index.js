'use strict';

// This Volumio plugin provides Korean Radios (KBS, MBC) and Linn radio.

var libQ = require('kew');
var fs = require('fs-extra');
var config = require('v-conf');
var unirest = require('unirest');
var crypto = require('crypto');

module.exports = ControllerPersonalRadio;

function ControllerPersonalRadio(context) {
	var self = this;

  self.context = context;
  self.commandRouter = this.context.coreCommand;
  self.logger = this.context.logger;
  self.configManager = this.context.configManager;
  self.state = {};
  self.stateMachine = self.commandRouter.stateMachine;

  self.logger.info("ControllerPersonalRadio::constructor");
}

ControllerPersonalRadio.prototype.onVolumioStart = function()
{
  var self = this;

  this.configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
  self.getConf(this.configFile);

  return libQ.resolve();
};

ControllerPersonalRadio.prototype.getConfigurationFiles = function () {
  return ['config.json'];
};

ControllerPersonalRadio.prototype.onStart = function() {
  var self = this;

  self.mpdPlugin = this.commandRouter.pluginManager.getPlugin('music_service','mpd');

  self.loadRadioI18nStrings();
  self.addToBrowseSources();
  self.addRadioResource();

  self.serviceName = "personal_radio";

  return libQ.resolve();
};

ControllerPersonalRadio.prototype.onStop = function() {
  var self = this;

  return libQ.resolve();
};

ControllerPersonalRadio.prototype.onRestart = function() {
  var self = this;

  return libQ.resolve();
};


// Configuration Methods -----------------------------------------------------
ControllerPersonalRadio.prototype.getConf = function(configFile) {
  var self = this;

  self.config = new (require('v-conf'))();
  self.config.loadFile(configFile);
};

ControllerPersonalRadio.prototype.setConf = function(varName, varValue) {
  var self = this;

  //Perform your installation tasks here
};


// Playback Controls ---------------------------------------------------------
ControllerPersonalRadio.prototype.addToBrowseSources = function () {
  var self = this;

  self.commandRouter.volumioAddToBrowseSources({
    name: self.getRadioI18nString('PLUGIN_NAME'),
    uri: 'kradio',
    plugin_type: 'music_service',
    plugin_name: "personal_radio",
    albumart: '/albumart?sourceicon=music_service/personal_radio/personal_radio.svg'
  });
};

ControllerPersonalRadio.prototype.handleBrowseUri = function (curUri) {
  var self = this;
  var response;

  self.logger.info("ControllerPersonalRadio::handleBrowseUri");
  if (curUri.startsWith('kradio')) {
    if (curUri === 'kradio') {
      response = self.getRootContent();
    }
    else if (curUri === 'kradio/kbs') {
      response = self.getKbsContent();
    }
    else if (curUri === 'kradio/mbc') {
      response = self.getMbcContent();
    }
    else if (curUri === 'kradio/linn') {
      response = self.getLinnContent();
    }
    else {
      response = libQ.reject();
    }
  }

  return response
    .fail(function (e) {
      self.logger.info('[' + Date.now() + '] ' + 'ControllerPersonalRadio::handleBrowseUri failed');
      libQ.reject(new Error());
    });
};


ControllerPersonalRadio.prototype.getRootContent = function() {
  var self=this;
  var response;
  var defer = libQ.defer();

  response = {
    "navigation": {
      "lists": [
        {
          "availableListViews": [
            'list'
          ],
          "items": [
            {
                service: self.serviceName,
                type: 'folder',
                title: 'KBS',
                icon: 'fa fa-folder-open-o',
                uri: 'kradio/kbs'
            },
            {
                service: self.serviceName,
                type: 'folder',
                title: 'MBC',
                icon: 'fa fa-folder-open-o',
                uri: 'kradio/mbc'
            },
            {
                service: self.serviceName,
                type: 'folder',
                title: 'Linn',
                icon: 'fa fa-folder-open-o',
                uri: 'kradio/linn'
            }
          ]
        }
      ],
      "prev": {
        "uri": '/'
      }
    }
  };
  defer.resolve(response);

  return defer.promise;
};

ControllerPersonalRadio.prototype.getKbsContent = function() {
  var self=this;
  var response;
  var defer = libQ.defer();

  response = {
    "navigation": {
      "lists": [
        {
          "availableListViews": [
            'list'
          ],
          "items": [
          ]
        }
      ],
      "prev": {
        "uri": 'kradio'
      }
    }
  };
  for (var i in self.KbsChannelName) {
    var channel = {
      service: self.serviceName,
      type: 'mywebradio',
      title: self.KbsChannelName[i],
      artist: '',
      album: '',
      icon: 'fa fa-music',
      uri: 'webkbs/'+ i
    };
    response.navigation.lists[0].items.push(channel);
  }
  defer.resolve(response);

  return defer.promise;
};

ControllerPersonalRadio.prototype.getMbcContent = function() {
  var self=this;
  var response;
  var defer = libQ.defer();

  response = {
    "navigation": {
      "lists": [
        {
          "availableListViews": [
            'list'
          ],
          "items": [
          ]
        }
      ],
      "prev": {
        "uri": 'kradio'
      }
    }
  };
  for (var k in self.mbc) {
    var channel = {
      service: self.serviceName,
      type: 'mywebradio',
      title: self.mbc[k].title,
      artist: '',
      album: '',
      icon: 'fa fa-music',
      uri: 'webmbc/'+ k
    };
    response.navigation.lists[0].items.push(channel);
  }
  defer.resolve(response);

  return defer.promise;
};

ControllerPersonalRadio.prototype.getLinnContent = function() {
  var self = this;
  var response;
  var defer = libQ.defer();

  response = {
    "navigation": {
      "lists": [
        {
          "availableListViews": [
            'list'
          ],
          "items": []
        }
      ],
      "prev": {
          "uri": 'kradio'
      }
    }
  };
  for (var j in self.linn.name) {
    var channel = {
      service: self.serviceName,
      type: 'mywebradio',
      title: self.linn.name[j],
      artist: '',
      album: '',
      icon: 'fa fa-music',
      uri: 'weblinn/'+ j
    };
    response.navigation.lists[0].items.push(channel);
  }
  defer.resolve(response);

  return defer.promise;
};

ControllerPersonalRadio.prototype.clearAddPlayTrack = function(track) {
  var self = this;
  var defer = libQ.defer();

  return self.mpdPlugin.sendMpdCommand('stop', [])
    .then(function() {
        return self.mpdPlugin.sendMpdCommand('clear', []);
    })
    .then(function() {
        return self.mpdPlugin.sendMpdCommand('add "'+track.uri+'"',[]);
    })
    .then(function () {
      self.commandRouter.pushToastMessage('info',
        self.getRadioI18nString('PLUGIN_NAME'),
        self.getRadioI18nString('WAIT_FOR_RADIO_CHANNEL'));

      return self.mpdPlugin.sendMpdCommand('play', []).then(function () {
        switch (track.radioType) {
          case 'kbs':
          case 'mbc':
            return self.mpdPlugin.getState().then(function (state) {
                return self.commandRouter.stateMachine.syncState(state, self.serviceName);
            });
            break;
          default:
            self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
            return libQ.resolve();
        }
      })
    })
    .fail(function (e) {
      return defer.reject(new Error());
    });
};

ControllerPersonalRadio.prototype.seek = function (position) {
  var self = this;

  return self.mpdPlugin.seek(position);
};

ControllerPersonalRadio.prototype.stop = function() {
	var self = this;

  self.commandRouter.pushToastMessage(
      'info',
      self.getRadioI18nString('PLUGIN_NAME'),
      self.getRadioI18nString('STOP_RADIO_CHANNEL')
  );
  return self.mpdPlugin.stop().then(function () {
      return self.mpdPlugin.getState().then(function (state) {
          return self.commandRouter.stateMachine.syncState(state, self.serviceName);
      });
  });
};

ControllerPersonalRadio.prototype.pause = function() {
  var self = this;

  return self.mpdPlugin.pause().then(function () {
    return self.mpdPlugin.getState().then(function (state) {
        return self.commandRouter.stateMachine.syncState(state, self.serviceName);
    });
  });
};

ControllerPersonalRadio.prototype.resume = function() {
  var self = this;

  return self.mpdPlugin.resume().then(function () {
    return self.mpdPlugin.getState().then(function (state) {
        return self.commandRouter.stateMachine.syncState(state, self.serviceName);
    });
  });
};

ControllerPersonalRadio.prototype.explodeUri = function (uri) {
  var self = this;
  var defer = libQ.defer();
  var uris = uri.split("/");
  var channel = parseInt(uris[1]);
  var response;

    switch (uris[0]) {
      case 'webkbs':
        self.getKbsStreamUrl(channel+1).then(function (kbsUri) {
          response = {
            uri: kbsUri,
            service: self.serviceName,
            name: self.KbsChannelName[channel],
            title: self.KbsChannelName[channel],
            type: 'track',
            trackType: self.getRadioI18nString('PLUGIN_NAME'),
            radioType: 'kbs',
            albumart: '/albumart?sourceicon=music_service/personal_radio/kbs.svg'
          };
          defer.resolve(response);
        });
        break;

      case 'webmbc':
        self.getMbcStreamUrl(channel).then(function (MbcUri) {
          response = {
            uri: MbcUri,
            service: self.serviceName,
            name: self.mbc[channel].title,
            title: self.mbc[channel].title,
            type: 'track',
            trackType: self.getRadioI18nString('PLUGIN_NAME'),
            radioType: 'mbc',
            albumart: '/albumart?sourceicon=music_service/personal_radio/mbc.svg'
          };
          defer.resolve(response);
        });
        break;

      case 'weblinn':
        response = {
          uri: self.linn.uri[channel],
          service: self.serviceName,
          name: self.linn.name[channel],
          type: 'track',
          trackType: self.getRadioI18nString('PLUGIN_NAME'),
          radioType: 'linn',
          albumart: '/albumart?sourceicon=music_service/personal_radio/linn.svg'
        };
        defer.resolve(response);
        break;

      default:
        defer.resolve();
    }

    return defer.promise;
};

// Stream and resource functions for Radio -----------------------------------

ControllerPersonalRadio.prototype.getSecretKey = function () {
  var self = this;
  var defer = libQ.defer();

  var Request = unirest.get('https://raw.githubusercontent.com/ChrisPanda/volumio-kradio-key/master/radiokey.json');
  Request.end (function (response) {
    if (response.status === 200) {
      var result = JSON.parse(response.body);

      if (result !== undefined) {
        defer.resolve(result);
      } else {
        self.commandRouter.pushToastMessage('error',
            self.getRadioI18nString('PLUGIN_NAME'),
            self.getRadioI18nString('ERROR_SECRET_KEY'));

        defer.resolve(null);
      }
    } else {
      self.commandRouter.pushToastMessage('error',
          self.getRadioI18nString('PLUGIN_NAME'),
          self.getRadioI18nString('ERROR_SECRET_KEY_SERVER'));
      defer.resolve(null);
    }
  });

  return defer.promise;
};

ControllerPersonalRadio.prototype.getKbsStreamUrl = function (channel) {
  var self = this;
  var defer = libQ.defer();
  var userId;

  userId = Math.random().toString(36).substring(2, 6) + Math.random().toString(36).substring(2, 6);

  var Request = unirest.get(self.baseKbsStreamUrl);
  Request.query({
      id: userId,
      channel: channel
  }).end(function (response) {
    if (response.status === 200) {
      var result = response.body.split("\n");
      var retCode = parseInt(result[0]);
      var streamUrl = result[1];

      if (retCode === 0) {
        defer.resolve(streamUrl);
      }
      else {
        self.commandRouter.pushToastMessage('error',
            self.getRadioI18nString('PLUGIN_NAME'),
            self.getRadioI18nString('ERROR_KBS_URL'));

        defer.resolve(null);
      }
    } else {
      defer.resolve(null);
    }
  });
  return defer.promise;
};

ControllerPersonalRadio.prototype.getMbcStreamUrl = function (channel) {
  var self = this;
  var defer = libQ.defer();

  var Request = unirest.get(self.baseMbcStreamUrl);
  Request.query({
      channel: self.mbc[channel].channel,
      agent: 'agent',
      protocol: 'RTMP'
  })
  .end(function (response) {
    if (response.status === 200) {
      var result = JSON.parse(response.body.replace(/\(|\)|\;/g,''));
      var streamUrl = result.AACLiveURL;
      if (streamUrl !== undefined) {
          defer.resolve(streamUrl);
      }
      else {
        self.commandRouter.pushToastMessage('error',
            self.getRadioI18nString('PLUGIN_NAME'),
            self.getRadioI18nString('ERROR_MBC_URL'));

        defer.resolve(null);
      }
    } else {
      self.commandRouter.pushToastMessage('error',
          self.getRadioI18nString('PLUGIN_NAME'),
          self.getRadioI18nString('ERROR_MBC_URL'));
      defer.resolve(null);
    }
  });
  return defer.promise;
};

ControllerPersonalRadio.prototype.addRadioResource = function() {
  var self=this;

  // Linn Radio Resource Preparing
  self.linn = {
    uri: [
      self.config.get("linnJazzUrl"),
      self.config.get("linnRadioUrl"),
      self.config.get("linnClassicUrl")
    ],
    name: [
      self.config.get("linnJazzName"),
      self.config.get("linnRadioName"),
      self.config.get("linnClassicName")
    ]
  };

  // KBS Radio Resource Preparing
  self.KbsChannelName = [
    'KBS1 FM',
    'KBS2 FM',
    self.getRadioI18nString('KBS1_RADIO'),
    self.getRadioI18nString('KBS2_RADIO'),
    self.getRadioI18nString('KBS3_RADIO'),
    'KBS DMB',
    self.getRadioI18nString('KBS_UNION'),
    self.getRadioI18nString('KBS_WORLD')
  ];

  // MBC Radio Resource Preparing
  self.mbc = [
    {
      title: self.getRadioI18nString('MBC_STANDARD'),
      channel: 'sfm'
    },
    {
      title: self.getRadioI18nString('MBC_FM4U'),
      channel: 'mfm'
    },
    {
      title: self.getRadioI18nString('MBC_CHANNEL_M'),
      channel: 'chm'
    }
  ];

  // KBS, MBC Radio Streaming server Preparing
  var KbsCipherText = 'cac4d4e664757c065285538ec8eed223e745230cf4c9fa5942b5db7a2d4b09fbddaf6892570dbc20b48a8a2091950f289a';
  var MbcCipherText = 'cac4d4e664757c0054855dd0cfedd823ed476f04a885f95d1b87e1680d4306fbfad247d45710ba3d';

  self.getSecretKey().then(function(response) {
    var secretKey = response.secretKey;
    var algorithm = response.algorithm;

    var decipherKBS = crypto.createDecipher(algorithm, secretKey);
    self.baseKbsStreamUrl = decipherKBS.update(KbsCipherText, 'hex', 'utf8');
    self.baseKbsStreamUrl += decipherKBS.final('utf8');

    var decipherMBC = crypto.createDecipher(algorithm, secretKey);
    self.baseMbcStreamUrl = decipherMBC.update(MbcCipherText, 'hex', 'utf8');
    self.baseMbcStreamUrl += decipherMBC.final('utf8');
  });
};

ControllerPersonalRadio.prototype.loadRadioI18nStrings = function () {
  var self=this;

  try {
    var language_code = this.commandRouter.sharedVars.get('language_code');
    self.i18nStrings=fs.readJsonSync(__dirname+'/i18n/strings_'+language_code+".json");
	} catch(e) {
		self.i18nStrings=fs.readJsonSync(__dirname+'/i18n/strings_en.json');
	}

  self.i18nStringsDefaults=fs.readJsonSync(__dirname+'/i18n/strings_en.json');
};

ControllerPersonalRadio.prototype.getRadioI18nString = function (key) {
  var self=this;

  if (self.i18nStrings[key] !== undefined)
    return self.i18nStrings[key];
  else
    return self.i18nStringsDefaults[key];
};
