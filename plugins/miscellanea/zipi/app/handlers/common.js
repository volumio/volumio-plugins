'use strict';

const ejs = require('ejs');
const short = require('short-uuid');

const zipi = require(zipiPluginLibRoot + '/zipi');
const { removeTmp } = require(zipiPluginLibRoot + '/utils');

function renderView(name, data = {}) {
    if (!data.i18n) {
        data.i18n = zipi.getI18n.bind(zipi);
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

function checkSession(req, res) {
    return new Promise( (resolve, reject) => {
        let sessionId = req.params.sessionId || '';
        let sessions = getSessions();

        if (sessionId == '') {
            // New session
            let session = new Session();
            sessions[session.id] = session;

            zipi.getLogger().info(`[zipi-common] New session created: ${ session.id }`);

            return resolve(session);
        }

        let session = sessions[sessionId] || null;
        if (session == null) {
            res.send({
                step: 1,
                error: zipi.getI18n('ZIPI_APP_ERR_INVALID_SESSION')
            });
            return reject();
        }

        resolve(session);
    });
}

function getSessions() {
    let sessions = zipi.get('sessions', null);
    if (sessions == null) {
        sessions = {};
        zipi.set('sessions', sessions);
    }
    return sessions;
}

class Session {

    constructor() {
        this.id = short.generate();
        this._data = {};
    }

    get(key) {
        return this._data[key];
    }

    set(key, value) {
        this._data[key] = value;
    }

    clear() {
        zipi.getLogger().info(`[zipi-common] Clearing session data: ${ this.id }`);
        this._removeTmp();
        this._data = {};
    }

    end() {
        zipi.getLogger().info(`[zipi-common] Ending session: ${ this.id }`);
        this.clear();
        let sessions = getSessions();
        delete sessions[this.id];
    }

    _removeTmp() {
        let tmpWorkDir = this.get('tmpWorkDir');
        let installFile = this.get('installFile');
        removeTmp(tmpWorkDir);
        removeTmp(installFile);
    }

}

module.exports = { renderView, checkSession };