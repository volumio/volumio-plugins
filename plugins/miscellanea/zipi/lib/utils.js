'use strict';

const fs = require('fs');
const del = require('del');

const zipi = require(zipiPluginLibRoot + '/zipi');

function removeTmp(tmpObj) {
    if (!tmpObj || !tmpObj.name) {
        return;
    }
    let path = tmpObj.name;
    try {
        if (fs.existsSync(path)) {
            zipi.getLogger().info(`[zipi-common] Removing ${ path }`);
            if (fs.lstatSync(path).isDirectory()) {
                del.sync([
                    `${ path }/**`,
                    `!${ path }`],
                    { force: true, dot: true, dryRun: false });
            }
            tmpObj.removeCallback();
        }
    } catch (error) {
        zipi.getLogger().error(zipi.getErrorMessage(`[zipi-common] Failed to remove ${ path }:`, error));
    }
}

module.exports = { removeTmp };