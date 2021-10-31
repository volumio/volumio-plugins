const express = require('express');
const router = require(__dirname + '/router');

const np = require(nowPlayingPluginLibRoot + '/np');

const app = express();

app.use(express.json());
//app.use(express.urlencoded({ extended: false }));

// Routes
app.use(router);
app.use(express.static(__dirname + '/public'));
app.use( (req, res, next) => {
    next(404);
});
app.use( (err, req, res, next) => {
    np.getLogger().error(np.getErrorMessage('[now-playing-app] App error:', err));
    res.status(err.status || 500);
    res.sendStatus(err);
});

let server = null;

function start(options) {
    if (server) {
        np.getLogger().info('[now-playing-app] App already started');
        return Promise.resolve();
    }
    return new Promise( (resolve, reject) => {
        let port = options.port || 4004;
        server = app.listen(port, () => {
            np.getLogger().info(`[now-playing-app] App is listening on port ${ port }.`);
            resolve();
        })
        .on('error', err => {
            np.getLogger().error(np.getErrorMessage('[now-playing-app] App error:', err));
            reject(err);
        });
    });
}

function stop() {
    if (server) {
        server.close();
        server = null;
    }
}

module.exports = { start, stop };
