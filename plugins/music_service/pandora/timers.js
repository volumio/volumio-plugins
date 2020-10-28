/* jshint node: true, esversion: 9, unused: false */
'use strict';

var libQ = require('kew');

class Timer {
    constructor(context) {
        this.self = context;
        this.self.commandRouter = context.commandRouter;
        this.timerID = null; // may not be needed
        this.delayStart = false;
        this.logger = (fnName, msg) => {
            this.self.logInfo(
                this.className + '::' + fnName + ': ' + msg
            );
        };
    }

    init() {
        const that = this;
        const fnName = 'init';

        // Nested setTimeout for setInterval
        let interval_loop = () => {
            that.self.siesta(
                function call_siesta() {
                    return that.fn()
                        .fail(err => that.self.generalReject(
                            that.className + ' fn()', err
                        ))
                        .then(() => that.self.siesta(
                            call_siesta, that.className, [], that.interval
                        ))
                        .then(timerID => {
                            that.timerID = timerID;
                            return libQ.resolve();
                        });
            }, that.className, [], that.interval)
                .then(timerID => {
                    that.timerID = timerID;
                    that.self.announceFn(that.className + ': Timer loaded');
                    that.logger(fnName, 'Interval set to ' + that.interval + ' ms');            
                    return libQ.resolve();
                });
        };

        if (!that.delayStart) {
            that.fn()
                .then(interval_loop());
        }
        else interval_loop();

        return libQ.resolve();
    }

    stop() {
        const fnName = 'stop';
        this.logger(fnName, 'Stopping.');
        clearTimeout(this.timerID);

        return libQ.resolve();
    }
}

class ExpireOldTracks extends Timer {
    constructor(context) {
        super(context);

        this.interval = 5 * 60 * 1000; // 5 minutes
        this.className = 'ExpireOldTracks';
        this.fnName = this.className + '::reaper';
        this.delayStart = true;
        this.init();
    }

    fn() {
        const that = this;

        const lifetime = 45 * 60 * 1000; // 45 minutes
        const interval = 10 * 1000; // 10 seconds
        const timeNow = Date.now();

        const Q = that.self.getQueue();
        const curTrack = that.self.getQueueTrack();
        const curUri = (curTrack) ? curTrack.uri : null;
        let victims = Q.filter(
            item => item.service === that.self.serviceName &&
            timeNow - item.fetchTime > lifetime &&
            item.uri !== curUri
        );
        const victimsLen = victims.length;
        const vhFnName = that.fnName + '::voorhees';

        that.self.announceFn(that.fnName);
        that.logger(that.fnName, 'timeNow: ' + timeNow);

        let voorhees = () => {
            // https://en.wikipedia.org/wiki/Jason_Voorhees
            let victim = victims.shift();
            that.self.removeTrack(victim.uri);
            that.logger(
                vhFnName,
                'Expired ' + victim.title +
                ' by ' + victim.artist
            );
            return libQ.resolve();
        };

        if (victims.length > 0) {
            that.logger(that.fnName, 'Expiring ' + victimsLen +
                ' tracks every ' + interval / 1000 + ' seconds');
            for (let i = 0; i < victimsLen; i++) {
                that.self.siesta(
                    voorhees, vhFnName,
                    [], interval * (i + 1)
                );
            }
        }
        else {
            that.logger(that.fnName,
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
        const that = this;
        const fnName = 'heartMonitor';

        that.self.announceFn(fnName);

        return that.self.mpdPlugin.getState()
            .then(state => {
                if (state.status !== 'pause') {
                    if (state.seek == this.lastSeek) {
                        let track = that.self.getQueueTrack();
                        let msg = track.name + ' by ' + track.artist +
                            ' timed out.  Advancing track';
                        that.self.commandRouter.pushToastMessage('info', 'Pandora', msg);
                        that.logger(fnName, msg);
                        return that.self.goPreviousNext('skip')
                            .then(() => that.self.removeTrack(track.uri));
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
        this.init();
    }

    // restart() {
    //     const that = this;

    //     that.logger(that.className, 'Restarting interval timer');

    //     return that.stop()
    //         .then(() => that.init());
    // }

    fn() {
        const that = this;

        that.self.announceFn(that.className);

        return that.self.pandoraHandler.pandoraLoginAndGetStations()
            .fail(err => that.self.generalReject(that.className + '::pandoraLoginAndGetStations', err))
            .then(() => that.self.pandoraHandler.fillStationData());
    }
}

module.exports.ExpireOldTracks = ExpireOldTracks;
module.exports.StreamLifeChecker = StreamLifeChecker;
module.exports.PreventAuthTimeout = PreventAuthTimeout;