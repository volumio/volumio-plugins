'use strict';

const zipi = require(zipiPluginLibRoot + '/zipi');
const { renderView, checkSession } = require(__dirname + '/common');

async function index(req, res) {
    let appearance = zipi.getPluginManager().getPlugin('miscellanea', 'appearance');
    appearance.getUiSettings().then( async settings => {
        let background;
        if (settings.background) {
            background = {
                type: 'image',
                path:  `${req.protocol}://${ req.hostname }/backgrounds/${ settings.background.path }`
            };
        }
        else if (settings.color) {
            background = {
                type: 'color',
                color: settings.color
            };
        }
        else {
            background = {
                type: 'color',
                color: '#000'
            };
        }
        let html = await renderView('index', {
            background
        });

        res.send(html);
    });
}

async function begin(req, res) {
    checkSession(req, res).then( async session => {
        session.clear();
        let html = await renderView('begin', {
            sessionId: session.id
        });
        res.send({
            step: 1,
            contents: html
        });
    });
}

async function finish(req, res) {
    checkSession(req, res).then( async session => {
        session.end();
        res.send();
    });
}

module.exports = { index, begin, finish };