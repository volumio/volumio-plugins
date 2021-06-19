/* jshint node: true, esversion: 9, unused: false */
'use strict';

var mqtt = require('mqtt');
var libQ = require('kew');

const {mqttTopic} = require('./common');
const {PUtil} = require('./helpers');
const mqttFnName = 'MQTTHandler';

function MQTTHandler(context) {
    this.context = context;
    this.logger = this.context.logger;
    this.commandRouter = this.context.commandRouter;
}

MQTTHandler.prototype.init = function (options) {
	const self = this;
    const fnName = 'init';

    self.pUtil = new PUtil(self, mqttFnName);

    self.pUtil.announceFn(fnName);

    self.serverOptions = {};
    self.serverOptions.port = options.mqttPort;
    self.serverOptions.clientId = 'volumioPandora_' +
        Math.random().toString(16).substring(2,8);

    if ((options.mqttUsername + options.mqttPassword).trim().length > 0) {
        self.serverOptions.username = options.mqttUsername;
        self.serverOptions.password = options.mqttPassword;
    }

    self.mqttHost = options.mqttHost;
    self.mqttUri = 'mqtt://' + options.mqttHost;

    if (self.mqttHost.trim() == '') {
        const errMsg = 'MQTT Broker details missing';
        self.pUtil.logError(fnName, errMsg);
        return self.pUtil.timeOutToast(
            'warning', 'MQTT Options', errMsg, 5000)
            .then(() => self.pUtil.generalReject(fnName, errMsg));
    }
    return libQ.resolve();
};

MQTTHandler.prototype.connect = function () {
    const self = this;
    const fnName = 'connect';

    self.pUtil.announceFn(fnName);

    self.client = mqtt.connect(
        self.mqttUri, self.serverOptions
    );

    self.client.on('connect', () => {
        self.pUtil.logInfo(fnName, 'MQTT Options Verified');
        return self.pUtil.timeOutToast(
            fnName, 'success', 'MQTT Options',
            'Connected to MQTT Broker', 5000);
    });
    self.client.on('error', err => self.handleError(fnName, err));

    return libQ.resolve();
};

MQTTHandler.prototype.disconnect = function () {
    const self = this;

    self.pUtil.announceFn('disconnect');
    self.client.end();
    return libQ.resolve();
};

MQTTHandler.prototype.handleError = function (fnName, err) {
    const self = this;
    const errFnName = fnName + '::handleError';

    self.pUtil.announceFn(errFnName);

    const errPrefix = 'FYI: ';
    const userUndefined = 'Username undefined!';
    const passUndefined = 'Password undefined!';

    const user = self.serverOptions.username;
    const pass = self.serverOptions.password;

    let errMsg = '';
    if (typeof(user) === 'undefined' || user.trim().length == 0) {
        errMsg = errPrefix + userUndefined;
    }
    if (typeof(pass) === 'undefined' || pass.trim().length == 0) {
        errMsg = (errMsg.length > 0) ?
            errMsg + '\n' + errPrefix + passUndefined :
            errPrefix + passUndefined;
    }
    
    self.client.end();
    self.pUtil.logError(errFnName, errMsg, err);
    self.commandRouter.pushToastMessage('error', 'MQTT Error', err.message);

    if (errMsg.length > 0) {
        self.pUtil.timeOutToast(
            fnName, 'warning', 'MQTT Options', errMsg, 5000);
    }
    return self.pUtil.generalReject(errFnName, errMsg, err);
};

MQTTHandler.prototype.publishData = function (data, dataName) {
	const self = this;
    const fnName = 'publishData';
    const payload = JSON.stringify(data);
    const topic = mqttTopic(dataName);

    if (self.client.connected) {
        self.client.publish(topic, payload);
        
        self.pUtil.logInfo(fnName, 'Published ' + dataName + ' to ' +
            self.mqttUri + ':' + self.serverOptions.port +
            ' topic: ' + topic);
    }
    else {
        self.pUtil.logError(fnName, 'Not connected to MQTT Server! Payload not sent.');
    }

    return libQ.resolve();
};

module.exports.MQTTHandler = MQTTHandler;
