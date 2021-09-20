const express = require('express');
const fileUpload = require('express-fileupload');
const router = require(__dirname + '/router');

const zipi = require(zipiPluginLibRoot + '/zipi');

const app = express();

app.use(fileUpload({
    useTempFiles : true,
    tempFileDir : '/tmp/'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Routes
app.use(router);
app.use(express.static(__dirname + '/public'));
app.use( (req, res, next) => {
    next(404);
});
app.use( (err, req, res, next) => {
    zipi.getLogger().error(zipi.getErrorMessage('[zipi-app] App error:', err));
    res.status(err.status || 500);
    res.sendStatus(err);
});

let server = null;

function start(options) {
    if (server) {
        zipi.getLogger().info('[zipi-app] App already started');
        return Promise.resolve();
    }
    return new Promise( (resolve, reject) => {
        let port = options.port || 7000;
        server = app.listen(options.port || 7000, () => {
            zipi.getLogger().info(`[zipi-app] App is listening on port ${ port }.`);
            resolve();
        })
        .on('error', err => {
            zipi.getLogger().error(zipi.getErrorMessage('[zipi-app] App error:', err));
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
