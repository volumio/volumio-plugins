/* jshint node: true, esversion: 9, unused: false */
'use strict';

var libQ = require('kew');

class PUtil {
    constructor (context, infix) {
        this.context = context;
        this.logger = this.context.logger;
        this.commandRouter = this.context.commandRouter;

        if (typeof(infix) !== 'undefined') {
            this.infix = infix + '::';
        } else {
            this.infix = '';
        }
    }

    // Logging helper functions ------------------------------------------
    
    pandoraPrefix (fnName) {
        const self = this;

        return self.datePrefix() + '[Pandora] ' +
            self.infix + fnName + ': ';
    }

    datePrefix () {
        // const self = this;
        return '[' + Date.now() + '] ';
    }

    logInfo (fnName, msg) {
        const self = this;

        self.logger.info(self.pandoraPrefix(fnName) + msg);
    }

    logError (fnName, msg, err) {
        const self = this;
        const errMsg = (typeof(err) === 'undefined') ?
            msg: msg + ': ' + err;

        self.logger.error(self.pandoraPrefix(fnName) + errMsg);
    }

    announceFn (fnName) {
        const self = this;

        self.logger.info(self.datePrefix() +
            'ControllerPandora::' + self.infix + fnName);
    }

    // Callback function wrappers ------------------------------------------

    // Pass in a function to setTimeout()
    // Returns a Promise -- functions arguments go to args
    siesta (fn, fnName, args, ms) {
        const self = this;

        const timerID = setTimeout(() => {
            fn(...args)
                .fail(err => self.generalReject(fnName, err))
                .then(() => libQ.resolve());
        }, ms);

        return libQ.resolve(timerID);
    }

    // Delay a toast message and return a promise
    timeOutToast (fnName, type, title, msg, ms) {
        const self = this;

        return self.siesta(
            // pushToastMessage() == one level deep -- bind one level down
            self.commandRouter.pushToastMessage.bind(self.commandRouter),
            fnName + '::timeOutToast',
            [type, title, msg],
            ms
        );
    }

    // Miscellaneous function wrappers ------------------------------------------

    // Wrapper for libQ.reject
    generalReject (fnName, msg, err) {
        const self = this;

        let rejectMsg = (typeof(err) === 'undefined') ?
            msg : msg + ': ' + err;
        rejectMsg = self.pandoraPrefix(fnName) + rejectMsg;

        return libQ.reject(new Error(rejectMsg));
    }
}

module.exports.PUtil = PUtil;