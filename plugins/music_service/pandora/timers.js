/* jshint node: true, esversion: 9, unused: false */
'use strict';

var libQ = require('kew');

class Timer {
    constructor(self) {
        this.self = self;
        this.logger = msg => {
            self.logInfo(this.className + msg);
        };
    }

    init() {
        const that = this;

        this.timerID = setInterval(() => {
            that.fn(that.self, that.className);
            if (that.announcement) that.self.announceFn(that.announcement);
        }, that.interval);
        this.logger('::init interval set to ' + this.interval + ' ms');
        return libQ.resolve();
    }

    stop() {
        this.logger(' stopping.');
        clearInterval(this.timerID);
        return libQ.resolve();
    }
}

class ExpireOldTracks extends Timer {
    constructor(self) {
        super(self);

        this.interval = 5 * 60 * 1000; // 5 minutes
        this.className = 'ExpireOldTracks';
        this.announcement = this.className + '::reaper';
        this.init();
    }
        

    fn(self) {
        const that = this;
        const mins_45 = 45 * 60 * 1000;
        const fnName = '::reaper';
        const timeNow = Date.now();

        function hangman() {
            setTimeout(() => {
                let Q = self.getQueue();
                let curTrack = self.getQueueTrack();
                let curUri = null;
                let found = false;

                if (curTrack) { curUri = curTrack.uri; }

                if (Q) {
                    for (let i = 0; i < Q.length; i++) {
                        let item = Q[i];
                        if (item.service === self.serviceName &&
                            (timeNow - item.fetchTime) > mins_45 &&
                            item.uri !== curUri) { // string him up!
                            self.removeTrack(item.uri);
                            that.logger(fnName + ' expired ' +
                                item.title + ' by ' + item.artist);
                            found = true;
                            break;
                        }
                    }
                    if (found === true) { hangman(); }
                }
            }, 10000);
        }

        hangman();
    }
    
}

class StreamLifeChecker extends Timer {
    constructor(self) {
        super(self);

        this.interval = 5000;
        this.className = 'StreamLifeChecker';
    }

    fn(self) {
        const that = this;
        const fnName = '::heartMonitor';

        self.mpdPlugin.getState()
            .then(state => {
                if (state.status !== 'pause') {
                    if (state.seek == this.lastSeek) {
                        let track = self.getQueueTrack();
                        let msg = track.name + ' by ' + track.artist +
                            ' timed out.  Advancing track';
                        self.commandRouter.pushToastMessage('info', 'Pandora', msg);
                        that.logger(fnName + ': ' + msg);
                        return self.goPreviousNext('skip')
                            .then(() => self.removeTrack(track.uri))
                            .then(() => that.stop());
                    }
                }
                this.lastSeek = state.seek;
            });
    }
}

class PreventAuthTimeout extends Timer {
    constructor(self) {
        super(self);

        this.interval = 3 * 60 * 60 * 1000; // 3 hours
        this.className = 'PreventAuthTimeout';
        this.fn(self);
        this.init();
    }

    fn(self) {
        const that = this;
        
        return self.pandoraHandler.pandoraLoginAndGetStations()
            .then(() => self.pandoraHandler.fillStationData())
            .then(() => that.logger(': Refreshed Pandora authorization'));
    }
}

module.exports.ExpireOldTracks = ExpireOldTracks;
module.exports.StreamLifeChecker = StreamLifeChecker;
module.exports.PreventAuthTimeout = PreventAuthTimeout;