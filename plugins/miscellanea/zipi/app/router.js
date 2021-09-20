'use strict';

const handlers = require(__dirname + '/handlers');

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    handlers.workflow.index(req, res);
})

router.get('/begin/:sessionId?', (req, res) => {
    handlers.workflow.begin(req, res);
});

router.post('/upload/:sessionId', (req, res) => {
    handlers.upload.process(req, res);
});

router.get('/install/:sessionId/:command?', (req, res) => {
    if (req.params.command == 'do') {
        handlers.install.doInstall(req, res);
    }
    else if (req.params.command == 'enablePlugin') {
        handlers.install.enablePlugin(req, res);
    }
    else {
        handlers.install.prepare(req, res);
    }
});

router.get('/finish/:sessionId', (req, res) => {
    handlers.workflow.finish(req, res);
});

module.exports = router;
