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
          default:
            this.emit('unknown', data)
        }
      } catch (e) {
        switch (msg) {
          case 'kSpPlaybackNotifyBecameActive':
            this.emit('SActive', '')
            break;

          case 'kSpDeviveActive':
            this.emit('DActive', '')
            break;

          case 'kSpDeviveInactive':
            this.emit('DInactive', '')
            break;

          case 'kSpPlaybackNotifyBecameInactive':
            this.emit('SInactive')
            break;

          default:
            this.emit('unknown', msg)
        };
      }
    }

  sendmsg(msg){
    // Attempting to send a message back via udp
    self._udpsource.send(msg)

  }
}





module.exports = SpotConnEvents

