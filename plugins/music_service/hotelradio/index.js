'use strict'
var unirest=require('unirest');
var libQ=require('kew');
var ip = require('public-ip');
var fs=require('fs-extra');

/**
 * CONSTRUCTOR
 */
module.exports = ControllerHotelRadio;

function ControllerHotelRadio(context) {
	var self=this;

    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}

ControllerHotelRadio.prototype.getConfigurationFiles = function () {
    var self = this;

    return ['config.json'];
};

ControllerHotelRadio.prototype.onVolumioStart = function () {
    var defer=libQ.defer();

    this.mpdPlugin=this.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
    var configFile=this.commandRouter.pluginManager.getConfigurationFile(this.context,'config.json');
    this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    defer.resolve('');

    return defer.promise;
};

ControllerHotelRadio.prototype.onStart = function () {
    var defer=libQ.defer();

    this.loadI18n();
    this.startupLogin();

    defer.resolve('');

    return defer.promise;
};

ControllerHotelRadio.prototype.loadI18n = function () {
    var self=this;

    var language_code = this.commandRouter.sharedVars.get('language_code');
    fs.readJson(__dirname+'/i18n/strings_en.json', (err, defaulti18n) => {
        if (err) {} else {
            self.i18nStringsDefaults = defaulti18n;
            fs.readJson(__dirname+'/i18n/strings_'+language_code+".json", (err, langi18n) => {
                if (err) {
                    self.i18nStrings = self.i18nStringsDefaults;
                } else {
                    self.i18nStrings = langi18n;
                }
            });
        }
    });
};

ControllerHotelRadio.prototype.getI18n = function (key) {
    var self=this;

    if (key.indexOf('.') > 0) {
        var mainKey = key.split('.')[0];
        var secKey = key.split('.')[1];
        if (self.i18nStrings[mainKey][secKey] !== undefined) {
            return self.i18nStrings[mainKey][secKey];
        } else {
            return self.i18nStringsDefaults[mainKey][secKey];
        }

    } else {
        if (self.i18nStrings[key] !== undefined) {
            return self.i18nStrings[key];
        } else {
            return self.i18nStringsDefaults[key];
        }
    }
};

ControllerHotelRadio.prototype.startupLogin = function () {
    var self=this;

    self.shallLogin()
        .then(()=>self.loginToHotelRadio(this.config.get('username'), this.config.get('password'), false))
        .then(()=>self.registerIPAddress())
        .then(()=>self.addToBrowseSources())
};

ControllerHotelRadio.prototype.shallLogin = function () {
    var self=this;
    var defer=libQ.defer()

    if(this.config.get("loggedin",false) 
        && this.config.get("username")
        && this.config.get("username")!=""
        && this.config.get("password")
        && this.config.get("password")!="")
    {
        defer.resolve()
    } else 
    {
        defer.reject()
    }
    
    return defer.promise
};

ControllerHotelRadio.prototype.loginToHotelRadio=function(username, password) {
    var defer=libQ.defer()
    var self=this

    unirest.post('https://users.hotelradio.fm/api/index/login')
        .send('username='+username)
        .send('password='+password)
        .then((response)=>{
            if(response && 
                response.cookies && 
                'PHPSESSID' in response.cookies && 
                response.status === 200 &&
                response.body &&
                'user' in response.body &&
                'id' in response.body['user'])
            {
                self.sessionId=response.cookies['PHPSESSID']
                
                self.userId=response.body['user']["id"]
                self.userEmail=response.body['user']["email"]
                
                self.config.set("loggedin",true)
                defer.resolve()
            } else {
                defer.reject()
            }   
        })

    return defer.promise
}

ControllerHotelRadio.prototype.registerIPAddress=function() {
    var self=this
    var defer=libQ.defer()
    
    ip.v4().then((address)=>{
        var cookieJar=unirest.jar()
        cookieJar.add('PHPSESSID='+self.sessionId,'https://users.hotelradio.fm/api/user/updateip')

        var request=unirest.post('https://users.hotelradio.fm/api/user/updateip')
            .jar(cookieJar)
            .send('id='+self.userId)
            .send('ip='+address)
            .then((response)=>{
                if(response && 
                    response.status === 200 &&
                    'user' in response.body)
                {
                    defer.resolve()
                } else {
                    defer.reject()
                }   
            })
    }).catch((error)=>{
        defer.reject()
    })

    return defer.promise
}

ControllerHotelRadio.prototype.onStop = function () {
    var self = this;
    var defer=libQ.defer();

    self.commandRouter.volumioRemoveToBrowseSources('hotelradio.fm');

    defer.resolve('');

    return defer.promise;
};

ControllerHotelRadio.prototype.addToBrowseSources = function () {
    var self = this;

    self.logger.info('Adding Hotel Radio to Browse Sources');
    var data = {name: 'hotelradio.fm', uri: 'hotelradio://',plugin_type:'music_service',plugin_name:'hotelradio',albumart:'/albumart?sectionimage=music_service/hotelradio/icons/hotelradio-icon.png'};
    return self.commandRouter.volumioAddToBrowseSources(data);
}

ControllerHotelRadio.prototype.handleBrowseUri = function (curUri) {
    switch(curUri)
    {
        case 'hotelradio://':
            return this.handleRootBrowseUri()

        default:
            return this.handleGroupBrowseUri(curUri)
    }
};

ControllerHotelRadio.prototype.handleRootBrowseUri=function() {
    var defer=libQ.defer()
    var self=this

    var cookieJar = unirest.jar()
    cookieJar.add('PHPSESSID=' + this.sessionId, 'https://users.hotelradio.fm/api/channelgroups/user')

    var request = unirest.post('https://users.hotelradio.fm/api/channelgroups/user')
        .jar(cookieJar)
        .send('id=' + this.userId)
        .then((response) => {
            if (response &&
                response.status === 200 &&
                'channel_groups' in response.body) {
                var groupItems = []
                response.body['channel_groups'].map(group => {
                    groupItems.push({
                        "type": "item-no-menu",
                        "title": group['group_name'],
                        "albumart": group['group_cover'],
                        "uri": `hotelradio://${group['id']}`
                    })
                })

                var browseResponse={
                    "navigation": {
                        "lists": [
                            {
                                "type": "title",
                                "title": "TRANSLATE.HOTELRADIO.GROUPS",
                                "availableListViews": [
                                    "grid", "list"
                                ],
                                "items": groupItems
                            }]
                    }
                }
                self.commandRouter.translateKeys(browseResponse, self.i18nStrings, self.i18nStringsDefaults);

                defer.resolve(browseResponse)
            } else {
                defer.reject()
            }
        })

    return defer.promise
}

ControllerHotelRadio.prototype.handleGroupBrowseUri=function(curUri) {
    var defer=libQ.defer()
    var self=this

    var groupId=curUri.split('/')[2]

    var cookieJar = unirest.jar()
    cookieJar.add('PHPSESSID=' + this.sessionId, 'https://users.hotelradio.fm/api/channels/group')

    var request = unirest.post('https://users.hotelradio.fm/api/channels/group')
        .jar(cookieJar)
        .send('id=' + groupId)
        .then((response) => {
            if (response &&
                response.status === 200 &&
                'channels' in response.body) {
                var channelItems = []
                response.body['channels'].map(channel => {
                    channelItems.push({
                        "type": "webradio",
                        "title": channel['stream_name'],
                        "albumart": channel['channel_cover'],
                        "uri": `hotelradio://${groupId}/${channel['id']}`,
                        "service":"hotelradio"

                    })
                })

                var browseResponse={
                    "navigation": {
                        "lists": [
                            {
                                "type": "title",
                                "title": "TRANSLATE.HOTELRADIO.CHANNELS",
                                "availableListViews": [
                                    "grid", "list"
                                ],
                                "items": channelItems
                            }]
                    }
                }
                self.commandRouter.translateKeys(browseResponse, self.i18nStrings, self.i18nStringsDefaults);

                defer.resolve(browseResponse)
            } else {
                defer.reject()
            }
        })

    return defer.promise
}

ControllerHotelRadio.prototype.explodeUri = function(curUri) {
    var defer=libQ.defer()
    var self=this

    var groupId=curUri.split('/')[2]
    var channelId= curUri.split('/')[3]

    var cookieJar = unirest.jar()
    cookieJar.add('PHPSESSID=' + this.sessionId, 'https://users.hotelradio.fm/api/channels/group')

    var request = unirest.post('https://users.hotelradio.fm/api/channels/group')
        .jar(cookieJar)
        .send('id=' + groupId)
        .then((response) => {
            if (response &&
                response.status === 200 &&
                'channels' in response.body) {


                var explodeResp =  {
                            "uri": curUri,
                            "service": "hotelradio",
                            "name": "",
                            "title": "",
                            "album": "",
                            "type": "track",
                            "albumart": "/albumart?sectionimage=music_service/hotelradio/icons/hotelradio-icon.png"
                        }

                response.body['channels'].map(channel => {
                    if(channel['id']==channelId)
                    {
                        explodeResp['name']=channel['stream_name']
                        explodeResp['title']=channel['stream_name']
                        explodeResp['albumart']=channel['channel_cover']
                    }
                })

                defer.resolve([explodeResp])
            } else {
                defer.reject()
            }
        })

    return defer.promise
};

ControllerHotelRadio.prototype.getStreamUrl = function (curUri) {
    var defer=libQ.defer()
    var self=this

    var groupId=curUri.split('/')[2]
    var channelId= curUri.split('/')[3]

    var cookieJar = unirest.jar()
    cookieJar.add('PHPSESSID=' + this.sessionId, 'https://users.hotelradio.fm/api/channels/group')

    var request = unirest.post('https://users.hotelradio.fm/api/channels/group')
        .jar(cookieJar)
        .send('id=' + groupId)
        .then((response) => {
            if (response &&
                response.status === 200 &&
                'channels' in response.body) {


                var explodeResp = {
                    "uri": ""
                }
                response.body['channels'].map(channel => {
                    if(channel['id']==channelId)
                    {
                        if(channel["mp3128_stream_dir"] && channel['mp3128_stream_dir']!="")
                        {
                            explodeResp['uri']=channel['stream_path']+channel["mp3128_stream_dir"]
                        }
                        else if(channel['aacp_stream_dir'] && channel['aacp_stream_dir']!="")
                        {
                            explodeResp['uri']=channel['stream_path']+channel["aacp_stream_dir"]
                        } 
                        else {
                            explodeResp['uri']=channel['stream_path']+channel["stream_dir"]
                        }
                        
                    }
                })

                defer.resolve(explodeResp)
            } else {
                defer.reject()
            }
        })

    return defer.promise
}

ControllerHotelRadio.prototype.clearAddPlayTrack = function(track) {
    var self = this;
    var defer=libQ.defer();

    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerHotelRadio::clearAddPlayTrack');
    

    self.getStreamUrl(track.uri)
        .then(function(track) {
            return self.mpdPlugin.sendMpdCommand('stop',[])
                .then(function() {
                    return self.mpdPlugin.sendMpdCommand('clear',[]);
                })
                .then(function(stream) {
                    return self.mpdPlugin.sendMpdCommand('load "'+track.uri+'"',[]);
                })
                .fail(function (e) {
                    return self.mpdPlugin.sendMpdCommand('add "'+track.uri+'"',[]);
                })
                .then(function() {
                    self.commandRouter.stateMachine.setConsumeUpdateService('mpd');
                    return self.mpdPlugin.sendMpdCommand('play',[]);
                })
                .fail(function (e) {
                    self.logger.error('Could not Clear and Play HOTELRADIO Track: ' + e);
                    defer.reject(new Error());
                })
            ;
        })
        .fail(function(e)
        {   self.logger.error('Could not get HOTERADIO Stream URL: ' + e);
            defer.reject(new Error());
        });

    return defer;
};

ControllerHotelRadio.prototype.stop = function() {
    var self = this;
    self.commandRouter.pushConsoleMessage('[' + Date.now() + '] ' + 'ControllerHotelRadio::stop');
    
    return self.mpdPlugin.sendMpdCommand('stop', []);
};

ControllerHotelRadio.prototype.getUIConfig = function () {
    var self = this;

    var defer=libQ.defer();
    self.commandRouter.i18nJson(__dirname+'/i18n/strings_'+this.commandRouter.sharedVars.get('language_code')+'.json',
        __dirname+'/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
        .then(function(uiconf)
        {
            if (self.isLoggedIn()) {
                uiconf.sections[0].content[0].hidden=true;
                uiconf.sections[0].content[1].hidden=true;
                uiconf.sections[0].content[2].hidden=true;
                uiconf.sections[0].content[3].hidden=true;
                //uiconf.sections[0].content[4].hidden=false;
                
                uiconf.sections[0].description=self.getI18n("HOTELRADIO.LOGGED_IN_EMAIL")+self.userEmail;
                uiconf.sections[0].saveButton.label=self.getI18n("COMMON.LOGOUT")
                uiconf.sections[0].onSave.method="clearAccountCredentials"
            } else {
                uiconf.sections[0].content[0].hidden=false;
                uiconf.sections[0].content[1].hidden=false;
                uiconf.sections[0].content[2].hidden=false;
                uiconf.sections[0].content[3].hidden=true;
                //uiconf.sections[0].content[4].hidden=true;

                switch(self.commandRouter.sharedVars.get('language_code'))
                {
                    case 'de':
                        uiconf.sections[0].content[0].onClick.performerUrl="https://hotelradio.fm/volumio";
                    break

                    case 'it':
                        uiconf.sections[0].content[0].onClick.performerUrl="https://hotelradio.fm/it/volumio";
                    break

                    case 'fr':
                        uiconf.sections[0].content[0].onClick.performerUrl="https://hotelradio.fm/fr/volumio";
                    break

                    case 'es':
                        uiconf.sections[0].content[0].onClick.performerUrl="https://hotelradio.fm/es/volumio";
                    break

                    default:
                        uiconf.sections[0].content[0].onClick.performerUrl="https://hotelradio.fm/en/volumio";
                    break


                }
                

                uiconf.sections[0].description=self.getI18n("HOTELRADIO.ACCOUNT_LOGIN_DESC")
                uiconf.sections[0].saveButton.label=self.getI18n("COMMON.LOGIN")
                uiconf.sections[0].onSave.method="saveAccountCredentials"
            }

            defer.resolve(uiconf);
        })
        .fail(function(e)
        {
            self.logger.error('Could not fetch HOTELRADIO UI Configuration: ' + e);
            defer.reject(new Error());
        });

    return defer.promise;
};

ControllerHotelRadio.prototype.saveAccountCredentials = function (settings) {
    var self=this;
    var defer=libQ.defer();

    self.loginToHotelRadio(settings['hotelradio_username'], settings['hotelradio_password'], 'user')
        .then(() => self.registerIPAddress())
        .then(() => self.addToBrowseSources())
        .then(()=>{
            this.config.set('username', settings['hotelradio_username'])
            this.config.set('password',settings['hotelradio_password'])

            var config = self.getUIConfig();
            config.then(function(conf) {
                self.commandRouter.broadcastMessage('pushUiConfig', conf);
            });

            self.commandRouter.pushToastMessage('success', self.getI18n('COMMON.LOGGED_IN'));
            defer.resolve({})
        })
        .fail(()=>{
            self.commandRouter.pushToastMessage('error', self.getI18n('COMMON.ERROR_LOGGING_IN'));
            defer.reject()
        })
    
    return defer.promise
}

ControllerHotelRadio.prototype.clearAccountCredentials = function (settings) {
    var self=this;
    var defer=libQ.defer();

    self.logoutFromHotelRadio(settings['hotelradio_username'], settings['hotelradio_password'])
        //.then(() => self.registerIPAddress())
        .then(() => self.commandRouter.volumioRemoveToBrowseSources('hotelradio.fm'))
        .then(()=>{
            var config = self.getUIConfig();
            config.then(function(conf) {
                self.commandRouter.broadcastMessage('pushUiConfig', conf);
            })

            self.commandRouter.pushToastMessage('success', self.getI18n('COMMON.LOGGED_OUT'));
            defer.resolve({})
        })
        .fail(()=>{
            self.commandRouter.pushToastMessage('error', self.getI18n('COMMON.ERROR_LOGGING_OUT'));
            defer.reject()
        })
    
    return defer.promise
}

ControllerHotelRadio.prototype.logoutFromHotelRadio=function(username, password) {
    var defer=libQ.defer()
    var self=this

    unirest.post('https://users.hotelradio.fm/api/index/logout')
        .send('username='+username)
        .send('password='+password)
        .then((response)=>{
            if(response && 
                response.cookies && 
                'PHPSESSID' in response.cookies && 
                response.status === 200 &&
                response.body &&
                response.body.code == 200)
            {   
                this.config.set('username', "")
                this.config.set('password', "")
                this.config.set("loggedin", false)

                defer.resolve()
            } else {
                defer.reject()
            }   
        })

    return defer.promise
}

ControllerHotelRadio.prototype.isLoggedIn = function () {
    return this.config.get("loggedin", false)
}