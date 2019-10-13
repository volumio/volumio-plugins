# node-dtls-client

[![node](https://img.shields.io/node/v/node-dtls-client.svg) ![npm](https://img.shields.io/npm/v/node-dtls-client.svg)](https://www.npmjs.com/package/node-dtls-client)

[![Build Status](https://img.shields.io/circleci/project/github/AlCalzone/node-dtls-client.svg)](https://circleci.com/gh/AlCalzone/node-dtls-client)
[![Coverage Status](https://img.shields.io/coveralls/github/AlCalzone/node-dtls-client.svg)](https://coveralls.io/github/AlCalzone/node-dtls-client)

USE AT YOUR OWN RISK!

[DTLS](https://en.wikipedia.org/wiki/Datagram_Transport_Layer_Security) protocol implementation for Node.js written in TypeScript. 
This library provides the missing native DTLS support for Node.js client-side applications. It contains no server-side implementation.

Although great care has been taken to properly implement the required encryption and validation, 
there's no explicit protection against TLS attacks. Thus it is not advised to use it for security-critical applications. 
This libary's main goal is to allow using protocols that *require* DTLS.

## Usage

### Establish a secure connection:
```js
var dtls = require("node-dtls-client");

const socket = dtls
	// create a socket and initialize the secure connection
	.createSocket(options /* DtlsOptions */)
	// subscribe events
	.on("connected", () => {/* start sending data */})
	.on("error", (e /* Error */) => { })
	.on("message", (msg /* Buffer */) => { })
	.on("close", () => { })
	;
```

The `DtlsOptions` object looks as follows:
```js
{
	type: "udp4",
	address: "ip or host",
	port: 5684,
	psk: { "psk_hint": "PSK" },
	timeout: 1000, // in ms, optional, minimum 100, default 1000
	ciphers: [ /* ... */ ] // optional array of (D)TLS cipher suites, e.g. ["TLS_PSK_WITH_AES_128_CCM"]
}
```

The `ciphers` property allows specifying which cipher suites should be advertised as supported. If this property is not provided, all supported ciphers are used by default. Use this if you want to force specific cipher suites for the communication.  
The currently supported cipher suites are limited to those with PSK key exchange:

* `"TLS_PSK_WITH_3DES_EDE_CBC_SHA"`
* `"TLS_PSK_WITH_AES_128_CBC_SHA"`
* `"TLS_PSK_WITH_AES_256_CBC_SHA"`
* `"TLS_PSK_WITH_AES_128_CBC_SHA256"`
* `"TLS_PSK_WITH_AES_256_CBC_SHA384"`
* `"TLS_PSK_WITH_AES_128_GCM_SHA256"`
* `"TLS_PSK_WITH_AES_256_GCM_SHA384"`
* `"TLS_PSK_WITH_AES_128_CCM_8"`
* `"TLS_PSK_WITH_AES_256_CCM_8"`

**PRs for other key exchange methods are welcome!**

### Send some data (after the `connected` event was received):
```js
socket.send(data /* Buffer */, [callback]);
```

The events are defined as follows:
- `connected`: A secure connection has been established. Start sending data in the callback
- `error`: An error has happened. This usually means the handshake was not successful
- `message`: The socket received some data.
- `close`: The connection was closed successfully.


## Missing features:
- [x] alert protocol implementation (partially supported)
- [ ] cipher suites with non-PSK key exchange algorithms: `dhe_dss` | `dhe_rsa` | `rsa` | `dh_dss` | `dh_rsa` | `dhe_psk` | `rsa_psk`
- [ ] packet retransmission
- [ ] session renegotiation
- [ ] other compression algorithms except NULL

**PRs adding support for these are welcome!**

## Changelog

### 0.5.6 (2018-11-04)
* (AlCalzone) `node-aead-crypto` is now an optional dependency
* (AlCalzone) Remove `strictPropertyInitialization` since it doesn't work without `strictNullChecks`

### 0.5.4 (2018-05-01)
* (AlCalzone) **Potentially breaking change:** No longer use `node-aead-crypto` on NodeJS 10+

### 0.4.0 (2018-05-01)
* (AlCalzone) Check connection options before creating a new socket
* (AlCalzone) Improve testing setup, use CircleCI for deployment

### 0.3.2 (2018-04-27)
* (AlCalzone) Support NodeJS 10

### 0.3.1 (2018-02-13)
* (AlCalzone) Suppress spurious errors from DNS lookup after the connection has already timed out

### 0.3.0 (2018-02-05)
* (AlCalzone) Fixed cipher parameters of 3DES and 256-bit AES (AEAD) cipher suites.
* (AlCalzone) Added the possibility to limit the cipher suites to use

### 0.2.2 (2017-09-25)
* (AlCalzone) Removed possible sources of infinite loops

### 0.2.1 (2017-09-25)
* (AlCalzone) Fix error handling while trying to connect to a non-available endpoint

### 0.2.0 (2017-09-21)
* (AlCalzone) add partial alert protocol implementation

### 0.1.0 (2017-08-23)
* (AlCalzone) publish to npm

### 0.0.3 (2017-08-09)
* (AlCalzone) bugfixes

### 0.0.2 (2017-08-01)
* (AlCalzone) improved error and timeout handling in the socket wrapper.

### 0.0.1
* (AlCalzone) initial release. 

## Contributors
* https://github.com/thoukydides - Thanks for noticing the errors in the 3DES and 256-bit AES (AEAD) cipher suites.

## License
The MIT License (MIT)

Copyright (c) 2017 AlCalzone <d.griesel@gmx.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
