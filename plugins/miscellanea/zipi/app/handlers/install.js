'use strict';

const fs = require('fs');
const tmp = require('tmp');
const path = require('path');
const { spawn } = require('child_process');
const escape = require('escape-html');
const archiver = require('archiver');

const zipi = require(zipiPluginLibRoot + '/zipi');
const { renderView, checkSession } = require(__dirname + '/common');

async function prepare(req, res) {
    checkSession(req, res).then( async session => {
        let installAction = session.get('installAction');
        let autoEnablePlugin = false;
        if (installAction == 'update') {
            let { category, name } = session.get('pluginInfo');
            let pluginEnabledStatus = getPluginEnabledStatus(category, name);
            autoEnablePlugin = pluginEnabledStatus.enabled;
        }
        let html = await renderView('install', {
            sessionId: session.id,
            pluginInfo: session.get('pluginInfo'),
            installAction: session.get('installAction'),
            autoEnablePlugin,
            wsHost: `${req.protocol}://${ req.hostname }:3000`
        });
        res.send({
            step: 3,
            contents: html
        });
    });
}

async function doInstall(req, res) {
    checkSession(req, res).then( session => {
        // Send empty response immediately. Status updates will be
        // provided through websocket messages.
        res.send();

        let installFile = session.get('installFile');
        let createInstallFileAction;
        if (installFile && fs.existsSync(installFile.name)) { // Installation package already created (i.e. this is a retry)
            createInstallFileAction = Promise.resolve(installFile);
        }
        else {
            let contentsPath = session.get('installContentsPath');
            if (!fs.existsSync(`${ contentsPath }/node_modules`)) {
                createInstallFileAction = 
                    installNodeModules(contentsPath)
                    .then( () => createInstallFile(contentsPath) );
            }
            else { // node modules already installed
                createInstallFileAction = createInstallFile(contentsPath);
            }
        }

        createInstallFileAction.then( installFile => {
            session.set('installFile', installFile);
            return volumioInstall(session);
        })
        .then( () => {
            // Install / update success
            zipi.broadcastMessage('zipiInstallPluginStatus', { 
                status: 'success',
                message: ''
            });
        })
        .catch( error => {
            let errMsg = escape(error ? zipi.getErrorMessage('', error, false) : zipi.getI18n('ZIPI_APP_ERR_UNKNOWN'));
            zipi.broadcastMessage('zipiInstallPluginStatus', { 
                message: errMsg,
                status: 'error',
                section: 'postVolumioInstall',
                terminate: true
            });
        });
    });
}

function enablePlugin(req, res) {
    checkSession(req, res).then( session => {
        let { category, name } = session.get('pluginInfo') || {};
        if (category && name) {
            zipi.getLogger().info(`[zipi-install] Enabling and starting plugin ${ category }.${ name }`);
            clearRequireCache(`/data/plugins/${ category }/${ name }`);
            zipi.getPluginManager().enableAndStartPlugin(category, name)
                .fin( () => {
                    // enableAndStartPlugin() calls loadCorePlugin() and startPlugin()
                    // 1. If loadCorePlugin() fails, it doesn't return error
                    // 2. If startPlugin() fails (such as when the plugin's onStart() rejects), 
                    //    the plugin is still marked as started.
                    // So there is no point in checking for errors. Simply check whether
                    // it has been marked as started after enableAndStartPlugin() - but still
                    // unreliable because of point (2).
                    let { enabled, started } = getPluginEnabledStatus(category, name);
                    res.send({ enabled, started });
                })
        }
    })
}

// https://newbedev.com/how-to-remove-module-after-require-in-node-js
function clearRequireCache(pathPrefix) {
    zipi.getLogger().info(`[zipi-install] Clearing cached node modules with path prefix "${ pathPrefix }"`);
    let count = 0;
    for (const path in require.cache) {
        if (path.startsWith(pathPrefix) && path.endsWith('.js')) {
            delete require.cache[path];
            count++;
        }
    }
    zipi.getLogger().info(`[zipi-install] Cleared ${ count } cached node modules`);
}

function getPluginEnabledStatus(category, name) {
    let pluginManager = zipi.getPluginManager();
    let enabled = pluginManager.config.get(category + '.' + name + '.enabled');
    let started = pluginManager.config.get(category + '.' + name + '.status') === 'STARTED';
    return { enabled, started };
}

function installNodeModules(contentsPath) {
    return new Promise( (resolve, reject) => {
        // TODO: Delete package-lock?
        zipi.getLogger().info('[zipi-install] Installing node modules...');
        zipi.broadcastMessage('zipiInstallPluginStatus', { 
            message: '[zipi] Installing node modules...',
            section: 'preVolumioInstall'
        });
        
        let process = spawn('npm', ['install'], { cwd: contentsPath });
        
        process.stdout.on('data', data => {
            let message = data.toString();
            zipi.getLogger().info(message);
            zipi.broadcastMessage('zipiInstallPluginStatus', {
                message: escape(message),
                section: 'preVolumioInstall'});
        });
          
        process.stderr.on('data', data => {
            let message = data.toString();
            zipi.getLogger().info(message);
            zipi.broadcastMessage('zipiInstallPluginStatus', {
                message: escape(message),
                section: 'preVolumioInstall',
                status: 'warn',
            });
        });

        process.on('error', error => {
            let errMsg = zipi.getErrorMessage('', error, false);
            zipi.getLogger().info(errMsg);
            zipi.broadcastMessage('zipiInstallPluginStatus', {
                message: escape(errMsg),
                section: 'preVolumioInstall',
                status: 'error'
            });
        });

        process.on('close', code => {
            if (code === 0) {
                resolve();
            }
            else {
                reject('[zipi] Error installing node modules');
            }
        });
    });
}

function createInstallFile(contentsPath) {
    let installFile = tmp.fileSync({ prefix: 'zipi-', postfix: '.zip' });

    return zipDir(contentsPath, installFile.name)
        .then( () => {
            zipi.getLogger().info(`[zipi-install] Installation package created: ${ installFile.name }`);
            return installFile;
        })
        .catch( error => {
            throw new Error(zip.getI18n('ZIPI_APP_ERR_CREATE_INSTALL_PKG', error.message));
        });
}

function volumioInstall(session) {
    let installFile = session.get('installFile');
    let installAction = session.get('installAction');
    let filename = path.basename(installFile.name);
    let fakePath = `http://127.0.0.1:3000/plugin-serve/${ '../' + filename }`;
    
    // Volumio looks for 'downloaded' plugin in /tmp/plugins, so
    // make sure directory exists
    let tmpPluginsDirCreated = false;
    if (!fs.existsSync('/tmp/plugins')) {
        fs.mkdirSync('/tmp/plugins');
        tmpPluginsDirCreated = true;
    }

    zipi.getLogger().info(`[zipi-install] Fake path passed to Volumio: ${ fakePath }`);
    let action;
    if (installAction == 'install') {
        action = zipi.getPluginManager().installPlugin(fakePath);
    }
    else { // update
        let pluginInfo = session.get('pluginInfo');
        let updateData = {
            url: fakePath,
            category: pluginInfo.category,
            name: pluginInfo.name
        }
        action = zipi.getPluginManager().updatePlugin(updateData);
    }
    
    return new Promise( (resolve, reject) => {
        // action is kew Promise, so we are wrapping it inside a JS promise
        action.then( () => {
            zipi.getLogger().info(`[zipi-install] Plugin ${ installAction == 'install' ? 'installed' : 'updated' }`);
            resolve();
        })
        .fail( error => {
            zipi.getLogger().error(zipi.getErrorMessage(`[zipi-install] Failed to ${ installAction } plugin: `, error));
            reject(error);
        })
        .fin( () => {
            if (tmpPluginsDirCreated && fs.existsSync('/tmp/plugins')) {
                fs.rmdirSync('/tmp/plugins');
            }
        });
    })
}

// https://stackoverflow.com/questions/15641243/need-to-zip-an-entire-directory-using-node-js
function zipDir(source, out) {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const stream = fs.createWriteStream(out);
  
    return new Promise( (resolve, reject) => {
      archive
        .directory(source, false)
        .on("error", err => reject(err))
        .pipe(stream);
  
      stream.on("close", () => resolve());
      archive.finalize();
    });
}

module.exports = { prepare, doInstall, enablePlugin };