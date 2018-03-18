const dgram = require('dgram');
const EventEmitter = require('events');

class SpotConnEvents extends EventEmitter {
  constructor(opts) {
    super()
    var self = this;
    self._udpsource = dgram.createSocket('udp4');
    self._udpsource.bind(opts.port)
    self._udpsource.on('error', function(err) {
      console.log(err);
    });

    self._udpsource.on('message', msg => {

      this.parseData(msg.toString())
    })
  }

  parseData(msg) {
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
        default:
          this.emit('unknown', data)
      }
    } catch (e) {
      switch (msg) {
        case 'kSpPlaybackNotifyBecameActive':
          this.emit('SessionActive', '')
          break;

        case 'kSpDeviceActive':
          this.emit('DeviceActive', '')
          break;

        case 'kSpSinkActive':
          this.emit('SinkActive', '')
          break;

        case 'kSpDeviceInactive':
          this.emit('DeviceInactive', '')
          break;

        case 'kSpSinkInactive':
          this.emit('SinkInactive', '')
          break;

        case 'kSpPlaybackNotifyBecameInactive':
          this.emit('SessionInactive')
          break;

        default:
          this.emit('unknown', msg)
      };
    }
  }

  sendmsg(msg) {
    // Attempting to send a message back via udp
    self._udpsource.send(msg)

  }
}





module.exports = SpotConnEvents
