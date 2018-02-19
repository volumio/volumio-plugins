fritzbox-callmonitor
====================

node.js TCP Client that emits data for incoming, outgoing, started and ended calls of your FritzBox.

Requirements:
Enable the callmonitor in your Fritzbox  
by entering the following code into your telephone: `#96*5*`

## Install

```npm install node-fritzbox-callmonitor```


## Example

```js
var CallMonitor = require('callmonitor');

var monitor = new CallMonitor('192.168.178.1', 1012);

monitor.on('inbound', function (data) {
  console.log('- Incoming');
  console.log(data);
});

monitor.on('outbound', function (data) {
  console.log('- Outgoing');
  console.log(data);
});

monitor.on('connected', function (data) {
  console.log('- Connection Established');
  console.log(data);
});

monitor.on('disconnected', function (data) {
  console.log('- Connection Ended');
  console.log(data);
});

monitor.on('error', function (error) {
  console.log(error);
}).
```

## LICENSE

(MIT License)

Copyright (c) 2013 Thorsten Basse <himself@tagedieb.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
