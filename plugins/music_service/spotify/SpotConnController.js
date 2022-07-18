const dgram = require('dgram');
const EventEmitter = require('events');
const logger = require('./logger');

class SpotConnEvents extends EventEmitter {
  constructor (opts) {
    super();
    this._udpsource = dgram.createSocket('udp4');
    this._udpsource.bind(opts.port);
    this._udpsource.on('error', err => {
      logger.error(err);
    });

    this._udpsource.on('message', msg => {
      this.parseData(msg.toString());
    });
    this.Events = {
      // Daemon state events
      PlaybackActive: Symbol('PlaybackActive'),
      PlaybackInactive: Symbol('PlaybackInactive'),
      DeviceActive: Symbol('DeviceActive'),
      DeviceInactive: Symbol('DeviceInactive'),
      SinkActive: Symbol('SinkActive'),
      SinkInactive: Symbol('SinkInactive'),
      // PLayback events
      Metadata: Symbol('Metadata'),
      Token: Symbol('Token'),
      Seek: Symbol('Seek'),
      Volume: Symbol('Volume'),
      Status: Symbol('Status'),
      // Misc
      Pong: Symbol('Pong'),
      Unknown: Symbol('Unknown'),
      // Responses
      PongPause: Symbol('PongPause')
    };
  }

  parseData (msg) {
    try {
      const data = JSON.parse(msg);
      switch (true) {
        case 'metadata' in data:
          this.emit(this.Events.Metadata, data.metadata);
          break;
        case 'token' in data:
          this.emit(this.Events.Token, data.token);
          break;
        case 'position_ms' in data:
          this.emit(this.Events.Seek, data.position_ms);
          break;
        case 'volume' in data:
          this.emit(this.Events.Volume, data.volume);
          break;
        case 'state' in data:
          this.emit(this.Events.Status, data.state.status);
          break;
        case 'pong' in data:
          this.emit(this.Events.Pong, data.pong); // General
          switch (data.pong) {
            case 'Pause':
              this.emit(this.Events.PongPause);
              break;
          }
          break;

        default:
          if (data) this.emit(this.Events.Unknown, data);
      }
    } catch (e) {
      switch (msg) {
        case 'kSpPlaybackActive':
          this.emit(this.Events.PlaybackActive);
          break;

        case 'kSpPlaybackInactive':
          this.emit(this.Events.PlaybackInactive);
          break;

        case 'kSpDeviceActive':
          this.emit(this.Events.DeviceActive);
          break;

        case 'kSpDeviceInactive':
          this.emit(this.Events.DeviceInactive);
          break;

        case 'kSpSinkActive':
          this.emit(this.Events.SinkActive);
          break;

        case 'kSpSinkInactive':
          this.emit(this.Events.SinkInactive);
          break;

        default:
          // TODO Strip whitespace:
          if (msg) this.emit(this.Events.Unknown, msg, e);
      }
    }
  }

  sendmsg (msg) {
    // Attempting to send a message back via udp
    // logger.debug('FE => ', msg);
    this._udpsource.send(Buffer.from(msg), 5031, 'localhost', (err) =>
      err ? logger.error('Error sending message: ', err) : null
    );
  }

  close () {
    try {
      this._udpsource.close();
    } catch(e) {
      logger.error('Failed to close UDP Socket for Spotify Connect: ' + e );
    }
  }
}

// Simple communication protocol
const msgMap = new Map();

// values:
msgMap.set('Hello', [0x1]);
msgMap.set('HeartBeat', [0x2]);
msgMap.set('ReqToken', [0x3]);
msgMap.set('Pause', [0x4]);
msgMap.set('Play', [0x5]);
msgMap.set('PlayPause', [0x6]);
msgMap.set('Next', [0x7]);
msgMap.set('Prev', [0x8]);
msgMap.set('Volume', [0x9]);

module.exports = {
  SpotConnEvents: SpotConnEvents,
  msgMap: msgMap
};
