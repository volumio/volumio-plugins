'use strict';

const path = require('path');
global.zipiPluginLibRoot = path.resolve(__dirname) + '/lib';

const libQ = require('kew');
const zipi = require(zipiPluginLibRoot + '/zipi');
const app = require(__dirname + '/app');

module.exports = ControllerZipi;

function ControllerZipi(context) {
	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}

ControllerZipi.prototype.getUIConfig = function() {
    let self = this;
    let defer = libQ.defer();

    let lang_code = self.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
    .then( async uiconf => {
        let daemonUIConf = uiconf.sections[0];

        let port = zipi.getConfigValue('port', 7000);      
        daemonUIConf.content[0].value = port;

        // Get Zipi Url
        let systemInfo = await self.commandRouter.executeOnPlugin('system_controller', 'system', 'getSystemInfo');
        let url = `${ systemInfo.host }:${ port }`;
        daemonUIConf.content[1].value = url;
        daemonUIConf.content[2].onClick.url = url;

        defer.resolve(uiconf);
    })
    .fail( error => {
            zipi.getLogger().error(zipi.getErrorMessage('[zipi] getUIConfig(): Cannot populate Zip Installer configuration:', error));
            defer.reject(new Error());
        }
    );

    return defer.promise;
};

ControllerZipi.prototype.configSaveDaemon = function(data) {
    let oldPort = zipi.getConfigValue('port', 7000);
    let port = parseInt(data['port'], 10);
    if (port < 1024 || port > 65353) {
        zipi.toast('error', zipi.getI18n('ZIPI_INVALID_PORT'));
        return;
    }

    if (oldPort !== port) {
            var modalData = {
            title: zipi.getI18n('ZIPI_CONFIGURATION'),
            message: zipi.getI18n('ZIPI_CONF_RESTART_CONFIRM'),
            size: 'lg',
            buttons: [
                {
                name: zipi.getI18n('ZIPI_NO'),
                class: 'btn btn-warning',
                },
                {
                name: zipi.getI18n('ZIPI_YES'),
                class: 'btn btn-info',
                emit: 'callMethod',
                payload: {
                    'endpoint': 'miscellanea/zipi',
                    'method': 'configConfirmSaveDaemon',
                    'data': { port }
                }
                }  
            ]
        };
        this.commandRouter.broadcastMessage("openModal", modalData);
    }
    else {
        zipi.toast('success', zipi.getI18n('ZIPI_SETTINGS_SAVED'));
    }
}

ControllerZipi.prototype.configConfirmSaveDaemon = function(data) {
    let self = this;
    self.config.set('port', data['port']);
    self.restart().then( () => {
        self.refreshUIConfig();
        zipi.toast('success', zipi.getI18n('ZIPI_RESTARTED'));
    });
}

ControllerZipi.prototype.refreshUIConfig = function() {
    let self = this;
    
    self.commandRouter.getUIConfigOnPlugin('miscellanea', 'zipi', {}).then( config => {
        self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
}

ControllerZipi.prototype.onVolumioStart = function() {
	let configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
}

ControllerZipi.prototype.onStart = function() {
    let defer = libQ.defer();

    zipi.init(this.context, this.config);
    app.start({
        port: zipi.getConfigValue('port', 7000)
    })
    .then( () => {
        defer.resolve();
    })
    .catch( error => {
        zipi.toast('error', zipi.getI18n('ZIPI_DAEMON_START_ERR', error.message));
        defer.reject(error);
    });

    return defer.promise;
};

ControllerZipi.prototype.onStop = function() {
    app.stop();

    // End all sessions
    let sessions = zipi.get('sessions', {});
    Object.values(sessions).forEach( session => session.end() );

    zipi.reset();

	return libQ.resolve();
};

ControllerZipi.prototype.restart = function() {
    let self = this;
    return self.onStop().then( () => self.onStart() );
}

ControllerZipi.prototype.getConfigurationFiles = function() {
    return ['config.json'];
}

