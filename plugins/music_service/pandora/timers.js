/* jshint node: true, esversion: 9, unused: false */
'use strict';

var libQ = require('kew');
const { serviceName } = require('./common');
const {PUtil} = require('./helpers');

class Timer {
    constructor(context) {
        this.context = context;
        this.logger = context.logger;
        this.commandRouter = context.commandRouter;
        this.timerID = null; // may not be needed
        this.delayStart = false;
        this.active = false;
    }

    init() {
        const self = this;
        const fnName = 'init';
        
        self.active = true;
        self.pUtil = new PUtil(this, this.className);

        // Nested setTimeout for setInterval
        let interval_loop = () => {
            self.pUtil.siesta(
                function call_siesta() {
                    return self.fn()
                        .fail(err => self.pUtil.generalReject(
                            self.className + ' fn()', err
                        ))
                        .then(() => self.pUtil.siesta(
                            call_siesta, self.className, [], self.interval
                        ))
                        .then(timerID => {
                            self.timerID = timerID;
                            return libQ.resolve();
                        });
            }, self.className, [], self.interval)
                .then(timerID => {
                    self.timerID = timerID;
                    self.pUtil.logInfo(fnName, 'Timer loaded');
                    self.pUtil.logInfo(fnName, 'Interval set to ' + self.interval + ' ms');            
                    return libQ.resolve();
                });
        };

        if (!self.delayStart) {
            self.fn()
                .then(interval_loop());
        }
        else interval_loop();

        return libQ.resolve();
    }

    stop() {
        const self = this;
        const fnName = 'stop';

        if (self.active) {
            self.pUtil.logInfo(fnName, 'Stopping.');
            clearTimeout(self.timerID);
        }
        self.active = false;

        return libQ.resolve();
    }
}

class ExpireOldTracks extends Timer {
    constructor(context) {
        super(context);

        this.interval = 5 * 60 * 1000; // 5 minutes
        this.className = 'ExpireOldTracks';
        this.delayStart = true;
    }

    fn() {
        const self = this;

        const lifetime = 45 * 60 * 1000; // 45 minutes
        const interval = 10 * 1000; // 10 seconds
        const timeNow = Date.now();

        const Q = self.context.getQueue();
        const curTrack = self.context.getQueueTrack();
        const curUri = (curTrack) ? curTrack.uri : null;
        let victims = Q.filter(
            item => item.service === serviceName &&
            timeNow - item.fetchTime > lifetime &&
            item.uri !== curUri
        );
        const victimsLen = victims.length;
        const fnName = 'reaper';
        const vhFnName = fnName + '::voorhees';

        self.pUtil.announceFn(fnName);

        let voorhees = () => {
            // https://en.wikipedia.org/wiki/Jason_Voorhees
            let victim = victims.shift();
            self.context.removeTrack(victim.uri);
            self.pUtil.logInfo(
                vhFnName,
                'Expired ' + victim.title +
                ' by ' + victim.artist
            );
            return libQ.resolve();
        };

        if (victims.length > 0) {
            self.pUtil.logInfo(fnName, 'Expiring ' + victimsLen +
                ' tracks every ' + interval / 1000 + ' seconds');
            for (let i = 0; i < victimsLen; i++) {
                self.pUtil.siesta(
                    voorhees, vhFnName,
                    [], interval * (i + 1)
                );
            }
        }
        else {
            self.pUtil.logInfo(fnName,
                'No victims found: ' +
                'Expiring zero tracks.  ' + 
                'Don\'t worry -- Jason will return.');
        }

        return libQ.resolve();
    }
}

class StreamLifeChecker extends Timer {
    constructor(context) {
        super(context);

        this.interval = 5000; // 5 seconds
        this.className = 'StreamLifeChecker';
    }

    fn() {
        const self = this;
        const fnName = 'heartMonitor';

        self.pUtil.announceFn(fnName);

        return self.context.mpdPlugin.getState()
            .then(state => {
                if (state.status !== 'pause') {
                    if (state.seek == this.lastSeek) {
                        let track = self.context.getQueueTrack();
                        let msg = track.name + ' by ' + track.artist +
                            ' timed out.  Advancing track';
                        self.commandRouter.pushToastMessage('info', 'Pandora', msg);
                        self.pUtil.logInfo(fnName, msg);
                        return self.context.goPreviousNext('skip')
                            .then(() => self.context.removeTrack(track.uri));
                    }
                }
                this.lastSeek = state.seek;

                return libQ.resolve();
            });
    }
}

class PreventAuthTimeout extends Timer {
    constructor(context) {
        super(context);

        this.interval = 3 * 60 * 60 * 1000; // 3 hours
        this.className = 'PreventAuthTimeout';
    }

    // restart() {
    //     const self = this;

    //     self.pUtil.logInfo(self.className, 'Restarting interval timer');

    //     return self.stop()
    //         .then(() => self.init());
    // }

    fn() {
        const self = this;

        self.pUtil.announceFn('fn');

        return self.context.pandoraHandler.pandoraLoginAndGetStations()
            .fail(err => self.pUtil.generalReject('pandoraLoginAndGetStations', err))
            .then(() => self.context.pandoraHandler.fillStationData());
    }
}

class StationDataPublisher extends Timer {
    constructor(context) {
        super(context);

        this.interval = 60000; // 1 minute
        this.className = 'StationDataPublisher';
    }

    fn() {
        const self = this;

        self.pUtil.announceFn('fn');

        return self.context.pandoraHandler.publishStationData()
            .fail(err => self.pUtil.generalReject('publishStationData', err));
    }
}


module.exports.ExpireOldTracks = ExpireOldTracks;
module.exports.StreamLifeChecker = StreamLifeChecker;
module.exports.PreventAuthTimeout = PreventAuthTimeout;
module.exports.StationDataPublisher = StationDataPublisher;