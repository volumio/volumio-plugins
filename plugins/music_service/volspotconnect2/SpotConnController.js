const dgram = require('dgram');
const EventEmitter = require('events');

class SpotConnEvents extends EventEmitter {
  constructor (opts) {
    super();
    this._udpsource = dgram.createSocket('udp4');
    this._udpsource.bind(opts.port);
    this._udpsource.on('error', err => {
      console.error(err);
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
        default:
          this.emit('unknown', data);
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
    this._udpsource.send(msg);
  }

  close () {
    this._udpsource.close();
  }
}

module.exports = SpotConnEvents;
