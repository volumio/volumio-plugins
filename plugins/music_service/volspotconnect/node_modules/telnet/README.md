node-telnet
===========
### Telnet implementation for Node.js
[![Build Status](https://secure.travis-ci.org/TooTallNate/node-telnet.png)](http://travis-ci.org/TooTallNate/node-telnet)


This module offers an implementation of the [Telnet Protocol (RFC854)][rfc],
making it possible to write a telnet server that can interact with the various
telnet features.

### Implemented Options:

| **Name**            | **Event**             |**Specification**
|:--------------------|:----------------------|:-------------------------
| Binary transmission | `'transmit binary'`   | [RFC856](http://tools.ietf.org/html/rfc856)
| Echo                | `'echo'`              | [RFC857](http://tools.ietf.org/html/rfc857)
| Suppress Go Ahead   | `'suppress go ahead'` | [RFC858](http://tools.ietf.org/html/rfc858)
| Window Size         | `'window size'`       | [RFC1073](http://tools.ietf.org/html/rfc1073)


Installation
------------

Install with `npm`:

``` bash
$ npm install telnet
```


Examples
--------

``` js
var telnet = require('telnet')

telnet.createServer(function (client) {

  // make unicode characters work properly
  client.do.transmit_binary()

  // make the client emit 'window size' events
  client.do.window_size()

  // listen for the window size events from the client
  client.on('window size', function (e) {
    if (e.command === 'sb') {
      console.log('telnet window resized to %d x %d', e.width, e.height)
    }
  })

  // listen for the actual data from the client
  client.on('data', function (b) {
    client.write(b)
  })

  client.write('connected to Telnet server!')

}).listen(23)
```

And then you can connect to your server using `telnet(1)`

``` bash
$ telnet localhost
connected to Telnet server!
```


License
-------

(The MIT License)

Copyright (c) 2012 Nathan Rajlich &lt;nathan@tootallnate.net&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

[rfc]: http://tools.ietf.org/html/rfc854
