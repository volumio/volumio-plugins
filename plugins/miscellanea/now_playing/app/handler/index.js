'use strict';

const ejs = require('ejs');
const np = require(nowPlayingPluginLibRoot + '/np');
const util = require(nowPlayingPluginLibRoot + '/util');

async function index(req, res) {
    let html = await renderView('index', req, {
        styles: np.getConfigValue('styles', {}, true)
    });
    res.send(html);
}

async function volumio(req, res) {
    let html = await renderView('volumio', req, {
        nowPlayingUrl: getNowPlayingURL(req)
    });
    res.send(html);
}

async function preview(req, res) {
    let html = await renderView('preview', req, {
        nowPlayingUrl: getNowPlayingURL(req)
    });
    res.send(html);
}

function getNowPlayingURL(req) {
    return `${req.protocol}://${ req.hostname }:${ np.getConfigValue('port', 4004) }`;
}

function renderView(name, req, data = {}) {
    if (!data.i18n) {
        data.i18n = np.getI18n.bind(np);
    }
    if (!data.host) {
        data.host = `${req.protocol}://${ req.hostname }:3000`;
    }
    if (!data.pluginVersion) {
        data.pluginVersion = util.getPluginVersion();
    }
    if (!data.appPort) {
        data.appPort = np.getConfigValue('port', 4004);
    }
    return new Promise( (resolve, reject) => {
        ejs.renderFile(`${ __dirname }/../views/${ name }.ejs`, data, {}, (err, str) => {
            if (err) {
                reject(err);
            }
            else {
                resolve(str);
            }
        });
    });
}

module.exports = { index, volumio, preview };