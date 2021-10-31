'use strict';

const handler = require(__dirname + '/handler');

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    handler.index(req, res);
})

router.get('/preview', (req, res) => {
    handler.preview(req, res);
});

router.get('/volumio', (req, res) => {
    handler.volumio(req, res);
});

module.exports = router;
