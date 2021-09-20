'use strict';

const fs = require('fs');
const tmp = require('tmp');
const decompress = require('decompress');
const jsonfile = require('jsonfile');
const compareVersions = require('compare-versions');
const escape = require('escape-html');

const zipi = require(zipiPluginLibRoot + '/zipi');
const { removeTmp } = require(zipiPluginLibRoot + '/utils');
const { renderView, checkSession } = require(__dirname + '/common');

function process(req, res) {
    checkSession(req, res).then( async session => {
        let pluginFile = req.files.pluginFile;
        let result = await checkUpload(pluginFile);
        if (result.error) {
            res.send({
                step: 1,
                error: result.error
            });
        }
        else {
            let viewData = {
                sessionId: session.id,
                pluginFile,
                pluginInfo: {
                    name: result.pluginInfo.volumio_info.prettyName || result.pluginInfo.name,
                    version: result.pluginInfo.version,
                    description: result.pluginInfo.description || '',
                    author: result.pluginInfo.author
                },
                installable: {
                    status: result.installable.status,
                    message: result.installable.message
                }
            };
            let html = await renderView('review', viewData);
            if (result.installable.status !== 'fail') {
                session.set('tmpWorkDir', result.tmpWorkDir);
                session.set('installContentsPath', result.contentsPath);
                session.set('installAction', result.installable.action);
                session.set('pluginInfo', {
                    name: result.pluginInfo.name,
                    category: result.pluginInfo.volumio_info.plugin_type,
                    prettyName: result.pluginInfo.volumio_info.prettyName
                });
            }
            res.send({
                step: 2,
                contents: html
            });
        }
    })
}

function checkUpload(uploadedFile) {
    // Extract files
    let unzipDir = tmp.dirSync({ prefix: 'zipi-' });

    return decompress(uploadedFile.tempFilePath, unzipDir.name)
    .then( files => {
        zipi.getLogger().info(`[zipi-upload] Uploaded file '${ uploadedFile.name }' decompressed to: ${ unzipDir.name }`);
        if (files.length == 0) {
            throw new Error(zipi.getI18n('ZIPI_APP_ERR_FILE_EMPTY'));
        }
        // Check if contents is a single top-level directory.
        let unzipDirFiles = fs.readdirSync(unzipDir.name);
        if (unzipDirFiles.length == 1) {
            let checkPath = `${ unzipDir.name }/${ unzipDirFiles[0] }`;
            let stat = fs.statSync(checkPath);
            if (stat.isDirectory()) {
                return {
                    tmpWorkDir: unzipDir,
                    contentsPath: checkPath
                };
            }
        }
        return {
            tmpWorkDir: unzipDir,
            contentsPath: unzipDir.name
        };
    })
    .then( result => {
        let { contentsPath } = result;
        // Look for and read package.json to obtain plugin info
        let packageJsonPath = `${ contentsPath }/package.json`;
        let packageJsonExists;
        try {
            packageJsonExists = fs.existsSync(packageJsonPath);
        } catch(error) {
            throw new Error(zipi.getI18n('ZIPI_APP_ERR_FS', error.message));
        }
        if (packageJsonExists) {
            let pluginInfo;
            try {
                pluginInfo = jsonfile.readFileSync(packageJsonPath);
            } catch (error) {
                throw new Error(zipi.getI18n('ZIPI_APP_ERR_PKG_JSON_INVALID'));
            }
            let pluginInfoComplete = pluginInfo.name && pluginInfo.version != undefined && 
                pluginInfo.volumio_info && pluginInfo.volumio_info.plugin_type;
            if (!pluginInfoComplete) {
                throw new Error(zipi.getI18n('ZIPI_APP_ERR_PLUGIN_INFO_INCOMPLETE'));
            }
            result.pluginInfo = pluginInfo;
            return result;
        }
        else {
            throw new Error(zipi.getI18n('ZIPI_APP_ERR_PKG_JSON_MISSING'));
        }
    })
    .then( result => {
        let pluginInfo = result.pluginInfo;
        // Check if plugin is installed
        return getInstalledPlugin(pluginInfo.volumio_info.plugin_type, pluginInfo.name).then( installed => {
            if (installed) {
                // Try to compare versions
                if (compareVersions.validate(installed.version) && compareVersions.validate(pluginInfo.version)) {
                    let compare = compareVersions(installed.version, pluginInfo.version);
                    if (compare === 0) {
                        result.installable = {
                            status: 'fail',
                            message: zipi.getI18n('ZIPI_APP_ERR_PLUGIN_VER_INSTALLED')
                        };
                    }
                    else if (compare < 0) {
                        result.installable = {
                            status: 'ok',
                            action: 'update',
                            message: zipi.getI18n('ZIPI_APP_CURRENT_UPDATE_TO', escape(pluginInfo.version))
                        };
                    }
                    else {
                        result.installable = {
                            status: 'fail',
                            message: zipi.getI18n('ZIPI_APP_ERR_CURRENT_NEWER')
                        };
                    }
                }
                else if (installed.version === pluginInfo.version) {
                    result.installable = {
                        status: 'fail',
                        message: zipi.getI18n('ZIPI_APP_ERR_PLUGIN_VER_INSTALLED')
                    };
                }
                else {
                    result.installable = {
                        status: 'warn',
                        action: 'update',
                        message: zipi.getI18n('ZIPI_APP_WARN_VER_COMPARE', escape(pluginInfo.version), escape(installed.version))
                    };
                }
            }
            else {
                result.installable = {
                    status: 'ok',
                    action: 'install',
                    message: zipi.getI18n('ZIPI_APP_PLUGIN_READY_INSTALL')
                };
            }
            return result;
        });
    })
    .catch( error => {
        removeTmp(unzipDir);
        return {
            error: error.message
        };
    });
}

function getInstalledPlugin(category, name) {
    return new Promise( (resolve, reject) => {
        zipi.getPluginManager().getInstalledPlugins().then( plugins => {
            let plugin = plugins.find( p => p.name === name && p.category === category);
            resolve(plugin || null);
        })
        .fail( error => {
            reject(error);
        });
    })
}

module.exports = { process };