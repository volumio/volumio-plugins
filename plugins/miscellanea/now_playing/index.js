'use strict';

const path = require('path');
global.nowPlayingPluginLibRoot = path.resolve(__dirname) + '/lib';

const libQ = require('kew');
const np = require(nowPlayingPluginLibRoot + '/np');
const util = require(nowPlayingPluginLibRoot + '/util');
const app = require(__dirname + '/app');

const volumioKioskPath = '/opt/volumiokiosk.sh';
const volumioKioskBackupPath = '/home/volumio/.now_playing/volumiokiosk.sh.bak';
const volumioBackgroundPath = '/data/backgrounds';

module.exports = ControllerNowPlaying;

function ControllerNowPlaying(context) {
	this.context = context;
	this.commandRouter = this.context.coreCommand;
	this.logger = this.context.logger;
    this.configManager = this.context.configManager;
}

ControllerNowPlaying.prototype.getUIConfig = function() {
    let self = this;
    let defer = libQ.defer();

    let lang_code = self.commandRouter.sharedVars.get('language_code');

    self.commandRouter.i18nJson(__dirname + '/i18n/strings_' + lang_code + '.json',
        __dirname + '/i18n/strings_en.json',
        __dirname + '/UIConfig.json')
    .then( async uiconf => {
        let daemonUIConf = uiconf.sections[0];
        let textStylesUIConf = uiconf.sections[1];
        let widgetStylesUIConf = uiconf.sections[2];
        let albumartStylesUIConf = uiconf.sections[3];
        let backgroundStylesUIConf = uiconf.sections[4];
        let kioskUIConf = uiconf.sections[5];

        /**
         * Daemon conf
         */
        let port = np.getConfigValue('port', 4004);
        daemonUIConf.content[0].value = port;

        // Get Now Playing Url
        let systemInfo = await self.commandRouter.executeOnPlugin('system_controller', 'system', 'getSystemInfo');
        let url = `${ systemInfo.host }:${ port }`;
        let previewUrl = `${ url }/preview`
        daemonUIConf.content[1].value = url;
        daemonUIConf.content[2].value = previewUrl;
        daemonUIConf.content[3].onClick.url = previewUrl;

        /**
         * Text Styles conf
         */
        let styles = np.getConfigValue('styles', {}, true);

        let fontSizes = styles.fontSizes || 'auto';
        textStylesUIConf.content[0].value = {
            value: fontSizes,
            label: fontSizes == 'auto' ? np.getI18n('NOW_PLAYING_AUTO') : np.getI18n('NOW_PLAYING_CUSTOM')
        };
        textStylesUIConf.content[1].value = styles.titleFontSize || '';
        textStylesUIConf.content[2].value = styles.artistFontSize || '';
        textStylesUIConf.content[3].value = styles.albumFontSize || '';
        textStylesUIConf.content[4].value = styles.mediaInfoFontSize || '';

        let fontColors = styles.fontColors || 'default';
        textStylesUIConf.content[5].value = {
            value: fontColors,
            label: fontColors == 'default' ? np.getI18n('NOW_PLAYING_DEFAULT') : np.getI18n('NOW_PLAYING_CUSTOM')
        };
        textStylesUIConf.content[6].value = styles.titleFontColor || '#FFFFFF';
        textStylesUIConf.content[7].value = styles.artistFontColor || '#CCCCCC';
        textStylesUIConf.content[8].value = styles.albumFontColor || '#CCCCCC';
        textStylesUIConf.content[9].value = styles.mediaInfoFontColor || '#CCCCCC';

        let textMargins = styles.textMargins || 'auto';
        textStylesUIConf.content[10].value = {
            value: textMargins,
            label: textMargins == 'auto' ? np.getI18n('NOW_PLAYING_AUTO') : np.getI18n('NOW_PLAYING_CUSTOM')
        };
        textStylesUIConf.content[11].value = styles.titleMargin || '';
        textStylesUIConf.content[12].value = styles.artistMargin || '';
        textStylesUIConf.content[13].value = styles.albumMargin || '';
        textStylesUIConf.content[14].value = styles.mediaInfoMargin || '';

        let textAlignmentH = styles.textAlignmentH || 'left';
        textStylesUIConf.content[15].value = {
            value: textAlignmentH
        };
        switch (textAlignmentH) {
            case 'center':
                textStylesUIConf.content[15].value.label = np.getI18n('NOW_PLAYING_POSITION_CENTER');
                break;
            case 'right':
                textStylesUIConf.content[15].value.label = np.getI18n('NOW_PLAYING_POSITION_RIGHT');
                break;
            default: 
                textStylesUIConf.content[15].value.label = np.getI18n('NOW_PLAYING_POSITION_LEFT');
        }

        let textAlignmentV = styles.textAlignmentV || 'flex-start';
        textStylesUIConf.content[16].value = {
            value: textAlignmentV
        };
        switch (textAlignmentV) {
            case 'center':
                textStylesUIConf.content[16].value.label = np.getI18n('NOW_PLAYING_POSITION_CENTER');
                break;
            case 'flex-end':
                textStylesUIConf.content[16].value.label = np.getI18n('NOW_PLAYING_POSITION_BOTTOM');
                break;
            case 'space-between':
                textStylesUIConf.content[16].value.label = np.getI18n('NOW_PLAYING_SPREAD');
                break;
            default: 
                textStylesUIConf.content[16].value.label = np.getI18n('NOW_PLAYING_POSITION_TOP');
        }

        let maxLines = styles.maxLines || 'auto';
        textStylesUIConf.content[17].value = {
            value: maxLines,
            label: maxLines == 'auto' ? np.getI18n('NOW_PLAYING_AUTO') : np.getI18n('NOW_PLAYING_CUSTOM')
        };
        textStylesUIConf.content[18].value = styles.maxTitleLines || '';
        textStylesUIConf.content[19].value = styles.maxArtistLines || '';
        textStylesUIConf.content[20].value = styles.maxAlbumLines || '';
        
        /**
         * Widget Styles conf
         */
        let widgetColors = styles.widgetColors || 'default';
        widgetStylesUIConf.content[0].value = {
            value: widgetColors,
            label: widgetColors == 'default' ? np.getI18n('NOW_PLAYING_DEFAULT') : np.getI18n('NOW_PLAYING_CUSTOM')
        };
        widgetStylesUIConf.content[1].value = styles.widgetPrimaryColor || '#CCCCCC';
        widgetStylesUIConf.content[2].value = styles.widgetHighlightColor || '#24A4F3';

        let widgetVisibility = styles.widgetVisibility || 'default';
        widgetStylesUIConf.content[3].value = {
            value: widgetVisibility,
            label: widgetVisibility == 'default' ? np.getI18n('NOW_PLAYING_DEFAULT') : np.getI18n('NOW_PLAYING_CUSTOM')
        };
        let playbackButtonsVisibility = styles.playbackButtonsVisibility == undefined ? true : styles.playbackButtonsVisibility;
        let seekbarVisibility = styles.seekbarVisibility == undefined ? true : styles.seekbarVisibility;
        widgetStylesUIConf.content[4].value = playbackButtonsVisibility ? true : false;
        widgetStylesUIConf.content[5].value = seekbarVisibility ? true : false;
        let playbackButtonSizeType = styles.playbackButtonSizeType || 'auto';
        widgetStylesUIConf.content[6].value = {
            value: playbackButtonSizeType,
            label: playbackButtonSizeType == 'auto' ? np.getI18n('NOW_PLAYING_AUTO') : np.getI18n('NOW_PLAYING_CUSTOM')
        };
        widgetStylesUIConf.content[7].value = styles.playbackButtonSize || '';

        let widgetMargins = styles.widgetMargins || 'auto';
        widgetStylesUIConf.content[8].value = {
            value: widgetMargins,
            label: widgetMargins == 'auto' ? np.getI18n('NOW_PLAYING_AUTO') : np.getI18n('NOW_PLAYING_CUSTOM')
        };
        widgetStylesUIConf.content[9].value = styles.playbackButtonsMargin || '';
        widgetStylesUIConf.content[10].value = styles.seekbarMargin || '';

        /**
         * Albumart Styles conf
         */
        let albumartVisibility = styles.albumartVisibility == undefined ? true : styles.albumartVisibility;
        albumartStylesUIConf.content[0].value = albumartVisibility ? true : false;
        let albumartSize = styles.albumartSize || 'auto';
        albumartStylesUIConf.content[1].value = {
            value: albumartSize,
            label: albumartSize == 'auto' ? np.getI18n('NOW_PLAYING_AUTO') : np.getI18n('NOW_PLAYING_CUSTOM')
        };
        albumartStylesUIConf.content[2].value = styles.albumartWidth || '';
        albumartStylesUIConf.content[3].value = styles.albumartHeight || '';

        let albumartFit = styles.albumartFit || 'cover';
        albumartStylesUIConf.content[4].value = {
            value: albumartFit
        };
        switch (albumartFit) {
            case 'contain':
                albumartStylesUIConf.content[4].value.label = np.getI18n('NOW_PLAYING_FIT_CONTAIN');
                break;
            case 'fill': 
                albumartStylesUIConf.content[4].value.label = np.getI18n('NOW_PLAYING_FIT_FILL');
                break;
            default: 
                albumartStylesUIConf.content[4].value.label = np.getI18n('NOW_PLAYING_FIT_COVER');
        }
        albumartStylesUIConf.content[5].value = styles.albumartBorderRadius || '';
        if (!albumartVisibility) {
            albumartStylesUIConf.content = [ albumartStylesUIConf.content[0] ];
            albumartStylesUIConf.saveButton.data = [ 'albumartVisibility' ];
        }

        /**
         * Background Styles Conf
         */
        let backgroundType = styles.backgroundType || 'default';
        backgroundStylesUIConf.content[0].value = {
            value: backgroundType,
        };
        switch (backgroundType) {
            case 'albumart': 
                backgroundStylesUIConf.content[0].value.label = np.getI18n('NOW_PLAYING_ALBUM_ART');
                break;
            case 'color':
                backgroundStylesUIConf.content[0].value.label = np.getI18n('NOW_PLAYING_COLOR');
                break;
            case 'volumioBackground':
                backgroundStylesUIConf.content[0].value.label = np.getI18n('NOW_PLAYING_VOLUMIO_BACKGROUND');
                break;
            default:
                backgroundStylesUIConf.content[0].value.label = np.getI18n('NOW_PLAYING_DEFAULT');
        }

        backgroundStylesUIConf.content[1].value = styles.backgroundColor || '#000000';

        let albumartBackgroundFit = styles.albumartBackgroundFit || 'cover';
        backgroundStylesUIConf.content[2].value = {
            value: albumartBackgroundFit
        };
        switch (albumartBackgroundFit) {
            case 'contain':
                backgroundStylesUIConf.content[2].value.label = np.getI18n('NOW_PLAYING_FIT_CONTAIN');
                break;
            case 'fill': 
                backgroundStylesUIConf.content[2].value.label = np.getI18n('NOW_PLAYING_FIT_FILL');
                break;
            default: 
                backgroundStylesUIConf.content[2].value.label = np.getI18n('NOW_PLAYING_FIT_COVER');
        }
        let albumartBackgroundPosition = styles.albumartBackgroundPosition || 'center';
        backgroundStylesUIConf.content[3].value = {
            value: albumartBackgroundPosition
        };
        switch (albumartBackgroundPosition) {
            case 'top':
                backgroundStylesUIConf.content[3].value.label = np.getI18n('NOW_PLAYING_POSITION_TOP');
                break;
            case 'left': 
                backgroundStylesUIConf.content[3].value.label = np.getI18n('NOW_PLAYING_POSITION_LEFT');
                break;
            case 'bottom':
                backgroundStylesUIConf.content[3].value.label = np.getI18n('NOW_PLAYING_POSITION_BOTTOM');
                break;
            case 'right':
                backgroundStylesUIConf.content[3].value.label = np.getI18n('NOW_PLAYING_POSITION_RIGHT');
                break;
            default: 
                backgroundStylesUIConf.content[3].value.label = np.getI18n('NOW_PLAYING_POSITION_CENTER');
        }
        backgroundStylesUIConf.content[4].value = styles.albumartBackgroundBlur || '';
        backgroundStylesUIConf.content[5].value = styles.albumartBackgroundScale || '';

        let volumioBackgrounds = getVolumioBackgrounds();
        let volumioBackgroundImage = styles.volumioBackgroundImage || '';
        if (volumioBackgroundImage !== '' && !volumioBackgrounds.includes(volumioBackgroundImage)) {
            volumioBackgroundImage = '';  // img no longer exists
        }
        backgroundStylesUIConf.content[6].value = {
            value: volumioBackgroundImage,
            label: volumioBackgroundImage
        };
        backgroundStylesUIConf.content[6].options = [];
        volumioBackgrounds.forEach( bg => {
            backgroundStylesUIConf.content[6].options.push({
                value: bg,
                label: bg
            });
        });
        let volumioBackgroundFit = styles.volumioBackgroundFit || 'cover';
        backgroundStylesUIConf.content[7].value = {
            value: volumioBackgroundFit
        };
        switch (volumioBackgroundFit) {
            case 'contain':
                backgroundStylesUIConf.content[7].value.label = np.getI18n('NOW_PLAYING_FIT_CONTAIN');
                break;
            case 'fill': 
                backgroundStylesUIConf.content[7].value.label = np.getI18n('NOW_PLAYING_FIT_FILL');
                break;
            default: 
                backgroundStylesUIConf.content[7].value.label = np.getI18n('NOW_PLAYING_FIT_COVER');
        }
        let volumioBackgroundPosition = styles.volumioBackgroundPosition || 'center';
        backgroundStylesUIConf.content[8].value = {
            value: volumioBackgroundPosition
        };
        switch (volumioBackgroundPosition) {
            case 'top':
                backgroundStylesUIConf.content[8].value.label = np.getI18n('NOW_PLAYING_POSITION_TOP');
                break;
            case 'left': 
                backgroundStylesUIConf.content[8].value.label = np.getI18n('NOW_PLAYING_POSITION_LEFT');
                break;
            case 'bottom':
                backgroundStylesUIConf.content[8].value.label = np.getI18n('NOW_PLAYING_POSITION_BOTTOM');
                break;
            case 'right':
                backgroundStylesUIConf.content[8].value.label = np.getI18n('NOW_PLAYING_POSITION_RIGHT');
                break;
            default: 
                backgroundStylesUIConf.content[8].value.label = np.getI18n('NOW_PLAYING_POSITION_CENTER');
        }
        backgroundStylesUIConf.content[9].value = styles.volumioBackgroundBlur || '';
        backgroundStylesUIConf.content[10].value = styles.volumioBackgroundScale || '';

        let backgroundOverlay = styles.backgroundOverlay || 'default';
        backgroundStylesUIConf.content[11].value = {
            value: backgroundOverlay
        };
        switch (backgroundOverlay) {
            case 'custom':
                backgroundStylesUIConf.content[11].value.label = np.getI18n('NOW_PLAYING_CUSTOM');
                break;
            case 'none': 
                backgroundStylesUIConf.content[11].value.label = np.getI18n('NOW_PLAYING_NONE');
                break;
            default: 
                backgroundStylesUIConf.content[11].value.label = np.getI18n('NOW_PLAYING_DEFAULT');
        }
        backgroundStylesUIConf.content[12].value = styles.backgroundOverlayColor || '#000000';
        backgroundStylesUIConf.content[13].value = styles.backgroundOverlayOpacity || '';

        /**
         * Kiosk conf
         */
        let kiosk = checkVolumioKiosk();
        let kioskDesc, kioskButton;
        if (!kiosk.exists) {
            kioskDesc = np.getI18n('NOW_PLAYING_KIOSK_NOT_FOUND');
        }
        else if (kiosk.display == 'default') {
            kioskDesc = np.getI18n('NOW_PLAYING_KIOSK_SHOWING_DEFAULT');
            kioskButton = {
                id: 'kioskSetToNowPlaying',
                element: 'button',
                label: np.getI18n('NOW_PLAYING_KIOSK_SET_TO_NOW_PLAYING'),
                onClick: {
                    type: 'emit',
                    message: 'callMethod',
                    data: {
                        endpoint: 'miscellanea/now_playing',
                        method: 'configureVolumioKiosk',
                        data: {
                            display: 'nowPlaying'
                        }
                    }
                }
            };
        }
        else if (kiosk.display == 'nowPlaying') {
            kioskDesc = np.getI18n('NOW_PLAYING_KIOSK_SHOWING_NOW_PLAYING');
            kioskButton = {
                id: 'kioskRestore',
                element: 'button',
                label: np.getI18n('NOW_PLAYING_KIOSK_RESTORE'),
                onClick: {
                    type: 'emit',
                    message: 'callMethod',
                    data: {
                        endpoint: 'miscellanea/now_playing',
                        method: 'configureVolumioKiosk',
                        data: {
                            display: 'default'
                        }
                    }
                }
            };
        }
        else {
            kioskDesc = np.getI18n('NOW_PLAYING_KIOSK_SHOWING_UNKNOWN');
            if (util.fileExists(volumioKioskBackupPath)) {
                kioskDesc += ' ' + np.getI18n('NOW_PLAYING_DOC_KIOSK_RESTORE_BAK');
                kioskButton = {
                    id: 'kioskRestoreBak',
                    element: 'button',
                    label: np.getI18n('NOW_PLAYING_KIOSK_RESTORE_BAK'),
                    onClick: {
                        type: 'emit',
                        message: 'callMethod',
                        data: {
                            endpoint: 'miscellanea/now_playing',
                            method: 'restoreVolumioKioskBak'
                        }
                    }   
                };
            }
        }
        kioskUIConf.description = kioskDesc;
        if (kioskButton) {
            kioskUIConf.content = [ kioskButton ];
        }
        
        defer.resolve(uiconf);
    })
    .fail( error => {
            np.getLogger().error(np.getErrorMessage('[now-playing] getUIConfig(): Cannot populate Now Playing configuration:', error));
            defer.reject(new Error());
        }
    );

    return defer.promise;
};

ControllerNowPlaying.prototype.configSaveDaemon = function(data) {
    let oldPort = np.getConfigValue('port', 4004);
    let port = parseInt(data['port'], 10);
    if (port < 1024 || port > 65353) {
        np.toast('error', np.getI18n('NOW_PLAYING_INVALID_PORT'));
        return;
    }

    if (oldPort !== port) {
            var modalData = {
            title: np.getI18n('NOW_PLAYING_CONFIGURATION'),
            message: np.getI18n('NOW_PLAYING_CONF_RESTART_CONFIRM'),
            size: 'lg',
            buttons: [
                {
                name: np.getI18n('NOW_PLAYING_NO'),
                class: 'btn btn-warning',
                },
                {
                name: np.getI18n('NOW_PLAYING_YES'),
                class: 'btn btn-info',
                emit: 'callMethod',
                payload: {
                    'endpoint': 'miscellanea/now_playing',
                    'method': 'configConfirmSaveDaemon',
                    'data': { port, oldPort }
                }
                }  
            ]
        };
        this.commandRouter.broadcastMessage("openModal", modalData);
    }
    else {
        np.toast('success', np.getI18n('NOW_PLAYING_SETTINGS_SAVED'));
    }
}

ControllerNowPlaying.prototype.configConfirmSaveDaemon = function(data) {
    let self = this;

    // Obtain kiosk info before saving new port
    let kiosk = checkVolumioKiosk();

    self.config.set('port', data['port']);

    self.restartApp().then( () => {
        np.toast('success', np.getI18n('NOW_PLAYING_RESTARTED'));

        // Check if kiosk script was set to show Now Playing, and update 
        // to new port (do not restart volumio-kiosk service because 
        // the screen will reload itself when app is started)
        if (kiosk.exists && kiosk.display == 'nowPlaying') {
            self.modifyVolumioKioskScript(data['oldPort'], data['port'], false);
        }

        self.refreshUIConfig();
    })
    .fail( error => {
        self.config.set('port', data['oldPort']);
        self.refreshUIConfig();
    });
}

ControllerNowPlaying.prototype.configSaveTextStyles = function(data) {
    let maxTitleLines = data.maxTitleLines ? parseInt(data.maxTitleLines, 10) : '';
    let maxArtistLines = data.maxArtistLines ? parseInt(data.maxArtistLines, 10) : '';
    let maxAlbumLines = data.maxAlbumLines ? parseInt(data.maxAlbumLines, 10) : '';
    let styles = {
        fontSizes: data.fontSizes.value,
        titleFontSize: data.titleFontSize,
        artistFontSize: data.artistFontSize,
        albumFontSize: data.albumFontSize,
        mediaInfoFontSize: data.mediaInfoFontSize,
        fontColors: data.fontColors.value,
        titleFontColor: data.titleFontColor,
        artistFontColor: data.artistFontColor,
        albumFontColor: data.albumFontColor,
        mediaInfoFontColor: data.mediaInfoFontColor,
        textAlignmentH: data.textAlignmentH.value,
        textAlignmentV: data.textAlignmentV.value,
        textMargins: data.textMargins.value,
        titleMargin: data.titleMargin,
        artistMargin: data.artistMargin,
        albumMargin: data.albumMargin,
        mediaInfoMargin: data.mediaInfoMargin,
        maxLines: data.maxLines.value,
        maxTitleLines,
        maxArtistLines,
        maxAlbumLines
    };
    let currentStyles = np.getConfigValue('styles', {}, true);
    let updatedStyles = Object.assign(currentStyles, styles);
    this.config.set('styles', JSON.stringify(updatedStyles));
    np.toast('success', np.getI18n('NOW_PLAYING_SETTINGS_SAVED'));

    np.broadcastMessage('nowPlayingSetCustomCSS', updatedStyles);
}

ControllerNowPlaying.prototype.configSaveWidgetStyles = function(data) {
    let styles = {
        widgetColors: data.widgetColors.value,
        widgetPrimaryColor: data.widgetPrimaryColor,
        widgetHighlightColor: data.widgetHighlightColor,
        widgetVisibility: data.widgetVisibility.value,
        playbackButtonsVisibility: data.playbackButtonsVisibility,
        seekbarVisibility: data.seekbarVisibility,
        playbackButtonSizeType: data.playbackButtonSizeType.value,
        playbackButtonSize: data.playbackButtonSize,
        widgetMargins: data.widgetMargins.value,
        playbackButtonsMargin: data.playbackButtonsMargin,
        seekbarMargin: data.seekbarMargin
    };
    let currentStyles = np.getConfigValue('styles', {}, true);
    let updatedStyles = Object.assign(currentStyles, styles);
    this.config.set('styles', JSON.stringify(updatedStyles));
    np.toast('success', np.getI18n('NOW_PLAYING_SETTINGS_SAVED'));

    np.broadcastMessage('nowPlayingSetCustomCSS', updatedStyles);
}

ControllerNowPlaying.prototype.configSaveAlbumartStyles = function(data) {
    let styles = {};
    for (const [key, value] of Object.entries(data)) {
        if (typeof value === 'object' && value.value !== undefined) {
            styles[key] = value.value;
        }
        else {
            styles[key] = value;
        }
    }
    /*let styles = {
        albumartVisibility: data.albumartVisibility,
        albumartSize: data.albumartSize.value,
        albumartWidth: data.albumartWidth,
        albumartHeight: data.albumartHeight,
        albumartFit: data.albumartFit.value,
        albumartBorderRadius: data.albumartBorderRadius
    };*/
    let currentStyles = np.getConfigValue('styles', {}, true);
    let currentAlbumartVisibility = (currentStyles.albumartVisibility == undefined ? true : currentStyles.albumartVisibility) ? true : false;
    let refresh = currentAlbumartVisibility !== styles.albumartVisibility;
    let updatedStyles = Object.assign(currentStyles, styles);
    this.config.set('styles', JSON.stringify(updatedStyles));
    np.toast('success', np.getI18n('NOW_PLAYING_SETTINGS_SAVED'));

    np.broadcastMessage('nowPlayingSetCustomCSS', updatedStyles);

    if (refresh) {
        this.refreshUIConfig();
    }
}

ControllerNowPlaying.prototype.configSaveBackgroundStyles = function(data) {
    let styles = {
        backgroundType: data.backgroundType.value,
        backgroundColor: data.backgroundColor,
        albumartBackgroundFit: data.albumartBackgroundFit.value,
        albumartBackgroundPosition: data.albumartBackgroundPosition.value,
        albumartBackgroundBlur: data.albumartBackgroundBlur,
        albumartBackgroundScale: data.albumartBackgroundScale,
        volumioBackgroundImage: data.volumioBackgroundImage.value,
        volumioBackgroundFit: data.volumioBackgroundFit.value,
        volumioBackgroundPosition: data.volumioBackgroundPosition.value,
        volumioBackgroundBlur: data.volumioBackgroundBlur,
        volumioBackgroundScale: data.volumioBackgroundScale,
        backgroundOverlay: data.backgroundOverlay.value,
        backgroundOverlayColor: data.backgroundOverlayColor,
        backgroundOverlayOpacity: data.backgroundOverlayOpacity
    };
    let currentStyles = np.getConfigValue('styles', {}, true);
    let updatedStyles = Object.assign(currentStyles, styles);
    this.config.set('styles', JSON.stringify(updatedStyles));
    np.toast('success', np.getI18n('NOW_PLAYING_SETTINGS_SAVED'));

    np.broadcastMessage('nowPlayingSetCustomCSS', updatedStyles);
}

ControllerNowPlaying.prototype.configureVolumioKiosk = function(data) {
    let self = this;
    let oldPort, newPort;
    if (data.display == 'nowPlaying') {
        oldPort = 3000;
        newPort = np.getConfigValue('port', 4004);
    }
    else { // display == 'default'
        oldPort = np.getConfigValue('port', 4004);
        newPort = 3000;
    }
    
    self.modifyVolumioKioskScript(oldPort, newPort).then( () => {
        self.config.set('kioskDisplay', data.display);
    });
    self.refreshUIConfig();
}

ControllerNowPlaying.prototype.restoreVolumioKioskBak = function() {
    if (!util.fileExists(volumioKioskBackupPath)) {
        np.toast('error', np.getI18n('NOW_PLAYING_KIOSK_BAK_NOT_FOUND'));
        return;
    }
    try {
        util.copyFile(volumioKioskBackupPath, volumioKioskPath, { asRoot: true });
        this.restartVolumioKioskService();
    } catch (error) {
        np.getLogger().error(np.getErrorMessage('[now-playing] Error restoring kiosk script from backup: ', error));
        np.toast('error', np.getI18n('NOW_PLAYING_KIOSK_RESTORE_BAK_ERR'));
    }
    this.refreshUIConfig();
}

ControllerNowPlaying.prototype.modifyVolumioKioskScript = function(oldPort, newPort, restartService = true) {
    try {
        if (oldPort == 3000) {
            np.getLogger().info(`[now-playing] Backing up ${ volumioKioskPath } to ${ volumioKioskBackupPath }`);
            util.copyFile(volumioKioskPath, volumioKioskBackupPath, { createDestDirIfNotExists: true });
        }
        util.replaceInFile(volumioKioskPath, `localhost:${ oldPort }`, `localhost:${ newPort }`);
        np.toast('success', np.getI18n('NOW_PLAYING_KIOSK_MODIFIED'));
    } catch (error) {
        np.getLogger().error(np.getErrorMessage('[now-playing] Error modifying Volumio Kiosk script:', error));
        np.toast('error', np.getI18n('NOW_PLAYING_KIOSK_MODIFY_ERR'));
        return libQ.reject();
    }

    if (restartService) {
        return this.restartVolumioKioskService();
    }
    else {
        return libQ.resolve();
    }
}

ControllerNowPlaying.prototype.restartVolumioKioskService = function() {
    let defer = libQ.defer();

    // Restart volumio-kiosk service if it is active
    util.isSystemdServiceActive('volumio-kiosk').then( isActive => {
        if (isActive) {
            np.toast('info', 'Restarting Volumio Kiosk service...');
            util.restartSystemdService('volumio-kiosk')
            .then( () => { defer.resolve(); })
            .catch( error => {
                np.toast('error', 'Failed to restart Volumio Kiosk service.');
                defer.resolve();
            });
        }
        else {
            defer.resolve();
        }
    })
    .catch( error => {
        defer.resolve();
    });

    return defer.promise;
}

ControllerNowPlaying.prototype.broadcastRefresh = function() {
    np.broadcastMessage('nowPlayingRefresh');
    np.toast('success', np.getI18n('NOW_PLAYING_BROADCASTED_COMMAND'));
}

let broadcastPluginInfoTimer = null;
ControllerNowPlaying.prototype.broadcastPluginInfo = function() {
    // Multiple screens could be calling this function, so we send after two seconds.
    // During this time, ignore all other requests.
    if (broadcastPluginInfoTimer) {
        return;
    }
    broadcastPluginInfoTimer = setTimeout( () => {
        let appPort = np.getConfigValue('port', 4004);
        let pluginVersion = util.getPluginVersion();
        np.broadcastMessage('nowPlayingPluginInfo', { pluginVersion, appPort });
        broadcastPluginInfoTimer = null;
    }, 2000);
}

ControllerNowPlaying.prototype.refreshUIConfig = function() {
    let self = this;
    
    self.commandRouter.getUIConfigOnPlugin('miscellanea', 'now_playing', {}).then( config => {
        self.commandRouter.broadcastMessage('pushUiConfig', config);
    });
}

ControllerNowPlaying.prototype.onVolumioStart = function() {
	let configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, 'config.json');
	this.config = new (require('v-conf'))();
    this.config.loadFile(configFile);

    return libQ.resolve();
}

ControllerNowPlaying.prototype.onStart = function() {
    let self = this;

    np.init(self.context, self.config);

    return self.startApp().then( () => {
        let display = np.getConfigValue('kioskDisplay', 'default');
        if (display == 'nowPlaying') {
            let kiosk = checkVolumioKiosk();
            if (kiosk.exists && kiosk.display == 'default') {
                self.modifyVolumioKioskScript(3000, np.getConfigValue('port', 4004));
            }
        }
        
        return libQ.resolve();
    });
};

ControllerNowPlaying.prototype.onStop = function() {
    this.stopApp();

    if (broadcastPluginInfoTimer) {
        clearTimeout(broadcastPluginInfoTimer);
    }

    // If kiosk is set to Now Playing, restore it back to default
    let restoreKiosk;
    let kiosk = checkVolumioKiosk();
    if (kiosk.exists && kiosk.display == 'nowPlaying') {
        restoreKiosk = this.modifyVolumioKioskScript(np.getConfigValue('port', 4004), 3000);
    }
    else {
        restoreKiosk = libQ.resolve();
    }

    return restoreKiosk.fin( () => {
        np.reset();
    });
};

ControllerNowPlaying.prototype.getConfigurationFiles = function() {
    return ['config.json'];
}

ControllerNowPlaying.prototype.startApp = function() {
    let self = this;
    let defer = libQ.defer();

    app.start({
        port: np.getConfigValue('port', 4004)
    })
    .then( () => {
        // This is for active Now Playing screens to reload themselves
        // if plugin version or port has changed.
        // Note: if Volumio has just restarted, the socket
        // on client side might not have reconnected and will not receive the message.
        // So on the client side we request plugin info upon socket reconnect.
        self.broadcastPluginInfo();

        defer.resolve();
    })
    .catch( error => {
        np.toast('error', np.getI18n('NOW_PLAYING_DAEMON_START_ERR', error.message));
        defer.reject(error);
    });

    return defer.promise;
}

ControllerNowPlaying.prototype.stopApp = function() {
    app.stop();
}

ControllerNowPlaying.prototype.restartApp = function() {
    this.stopApp();
    return this.startApp();
}

function checkVolumioKiosk() {
    try {
        if (!util.fileExists(volumioKioskPath)) {
            return {
                exists: false,
            };
        }

        if (util.findInFile(volumioKioskPath, 'localhost:3000')) {
            return {
                exists: true,
                display: 'default'
            };
        }

        if (util.findInFile(volumioKioskPath, `localhost:${ np.getConfigValue('port', 4004) }`)) {
            return {
                exists: true,
                display: 'nowPlaying'
            };
        }

        return {
            exists: true,
            display: 'unknown'
        };

    } catch (error) {
        np.getLogger().error(np.getErrorMessage('[now-playing] Error reading Volumio Kiosk script: ', error));
        np.toast('error', np.getI18n('NOW_PLAYING_KIOSK_CHECK_ERR'));
        return {
            exists: false
        };
    }
}

function getVolumioBackgrounds() {
    try {
        return util.readdir(volumioBackgroundPath, 'thumbnail-');
    } catch (error) {
        np.getLogger().error(np.getErrorMessage(`[now-playing] Error getting Volumio backgrounds from ${ volumioBackgroundPath }: `, error));
        np.toast('error', np.getI18n('NOW_PLAYING_GET_VOLUMIO_BG_ERR'));
        return [];
    }
}