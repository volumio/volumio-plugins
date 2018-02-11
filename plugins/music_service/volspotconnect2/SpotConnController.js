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

  parseData(data) {
    // Quick and dirty JSON check
    try {
      const metadata = JSON.parse(data);
      this.emit('metadata', metadata);
    } catch (e) {
      switch (data) {
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
          this.emit('unknown', data)
      };
    }
  }

  sendmsg(msg){
    // Attempting to send a message back via udp
    self._udpsource.send(msg)

  }
}





module.exports = SpotConnEvents

