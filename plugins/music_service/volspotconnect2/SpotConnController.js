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
  }

  parseData (msg) {
    try {
      const data = JSON.parse(msg);
      switch (true) {
        case 'metadata' in data:
          this.emit('metadata', data.metadata);
          break;
        case 'token' in data:
          this.emit('token', data.token);
          break;
        case 'position_ms' in data:
          this.emit('seek', data.position_ms);
          break;
        case 'volume' in data:
          this.emit('volume', data.volume);
          break;
        case 'state' in data:
          this.emit('status', data.state.status);
          break;
        default:
          if (data) this.emit('unknown', data);
      }
    } catch (e) {
      switch (msg) {
        case 'kSpPlaybackNotifyBecameActive':
          this.emit('SessionActive', '');
          break;

        case 'kSpDeviceActive':
          this.emit('DeviceActive', '');
          break;

        case 'kSpSinkActive':
          this.emit('SinkActive', '');
          break;

        case 'kSpDeviceInactive':
          this.emit('DeviceInactive', '');
          break;

        case 'kSpSinkInactive':
          this.emit('SinkInactive', '');
          break;

        case 'kSpPlaybackNotifyBecameInactive':
          this.emit('SessionInactive');
          break;

        default:
          this.emit('unknown', msg);
      }
    }
  }

  sendmsg (msg) {
    // Attempting to send a message back via udp
    logger.debug('FE => ', msg);
    this._udpsource.send(Buffer.from(msg), 5031, 'localhost', (err) =>
      err ? logger.error('Error sending message: ', err) : null
    );
  }

  close () {
    this._udpsource.close();
  }
}

// Simple communication protocol
let msgMap = new Map();

// values:
msgMap.set('HELLO', [0x1]);
msgMap.set('HEARTBEAT', [0x2]);
msgMap.set('GET_TOKEN', [0x3]);
msgMap.set('STOP', [0x4]);

module.exports = {
  SpotConnEvents: SpotConnEvents,
  msgMap: msgMap
};
