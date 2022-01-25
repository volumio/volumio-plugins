'use strict';

const fs = require('fs');
const ejs = require('ejs');
const exec = require('child_process').exec;
const execSync = require('child_process').execSync;
const jsonfile = require('jsonfile');
const path = require('path');

const np = require(nowPlayingPluginLibRoot + '/np');

function fileExists(path) {
    try {
        return fs.existsSync(path) && fs.lstatSync(path).isFile();
    } catch (error) {
        return false;
    }
}

function findInFile(path, str) {
    let contents = fs.readFileSync(path).toString();
    let regex = new RegExp(`\\b${ str }\\b`, 'gm');
    return regex.test(contents);
}

function replaceInFile(path, search, replace) {
    let cmd = `echo volumio | sudo -S sed -i 's/${ search }/${ replace }/g' "${ path }"`;
    return execSync(cmd, {uid: 1000, gid: 1000});
}

function copyFile(src, dest, opts = {}) {
    let cmdPrefix = opts.asRoot ? 'echo volumio | sudo -S' : '';
    if (opts.createDestDirIfNotExists) {
        let p = path.parse(dest);
        execSync(`${ cmdPrefix } mkdir -p ${ p.dir }`);
    }
    execSync(`${ cmdPrefix } cp ${ src } ${ dest }`);
}

function systemctl(cmd, service) {
    return new Promise( (resolve, reject) => {
        let fullCmd = `/usr/bin/sudo /bin/systemctl ${ cmd } ${ service }`;
        np.getLogger().info(`[now-playing-util] Executing ${ fullCmd }`);
        exec(fullCmd, {uid: 1000, gid: 1000}, function (error, stdout, stderr) {
            if (error) {
                np.getLogger().error(np.getErrorMessage(`[now-playing-util] Failed to execute systemctl command ${ cmd } on ${ service }: ${ stderr.toString() }`, error));
                reject(error);
            } else {
                resolve(stdout.toString());
            }
        });
    })
};

function isSystemdServiceActive(service) {
    return systemctl('status', service).then( out => {
        return out.indexOf('active') >= 0 && out.indexOf('inactive') == -1;
    });
}

function restartSystemdService(service) {
    return systemctl('restart', service);
}

function readdir(path, ignoreIfContains) {
    let files = fs.readdirSync(path);
    if (ignoreIfContains) {
        files = files.filter( f => f.indexOf(ignoreIfContains) < 0);
    }
    return files;
}

function getPluginVersion() {
    let packageJsonPath = nowPlayingPluginLibRoot + '/../package.json';
    try {
        let pluginInfo = jsonfile.readFileSync(packageJsonPath);
        return pluginInfo.version || null;
    } catch (error) {
        np.getLogger().error(np.getErrorMessage('[now-playing-util] Unable to read package.json in getPluginVersion(): ', error));
        return null;
    }
}

module.exports = {
    fileExists,
    findInFile,
    replaceInFile,
    isSystemdServiceActive,
    restartSystemdService,
    readdir,
    getPluginVersion,
    copyFile
}