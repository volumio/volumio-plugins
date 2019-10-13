# node-coap-client
Clientside implementation of the CoAP protocol with DTLS support

[![node](https://img.shields.io/node/v/node-coap-client.svg) ![npm](https://img.shields.io/npm/v/node-coap-client.svg)](https://www.npmjs.com/package/node-coap-client)

[![Build Status](https://img.shields.io/circleci/project/github/AlCalzone/node-coap-client.svg)](https://circleci.com/gh/AlCalzone/node-coap-client)
[![Coverage Status](https://img.shields.io/coveralls/github/AlCalzone/node-coap-client.svg)](https://coveralls.io/github/AlCalzone/node-coap-client)

**Note:** If you want to talk to a Trådfri gateway, use https://github.com/AlCalzone/node-tradfri-client instead. That library builds on node-coap-client with some simplifying abstractions.

## Usage
```ts
const coap = require("node-coap-client").CoapClient;
```
The CoAP client provides the following public methods:

* `setSecurityParams` provides the security parameters for a hostname. This has to be called **before** any connection attempts are made.
* `tryToConnect` allows checking if a given resource is available. This also establishes a connection if possible, so the following requests are sped up.
* `request` fires off a one-time request to a given resource and returns the response.
* `observe` subscribes to a resource to be notified on all updates.
* `stopObserving` causes resource updates to no longer be sent.
* `ping` is an inexpensive check if an endpoint is reachable or not.
* `reset` closes pending and existing connections and forgets active requests. Useful to restore a connection after a connection loss.

### `setSecurityParams` - Provide the security parameters for a hostname
In order to access secured resources, you must set the security parameters before firing off a request:
```ts
coap.setSecurityParams(hostname /* string */, params /* SecurityParameters */);
```

The SecurityParameters object looks as follows, for now only PSK key exchanges are supported
```ts
{
    psk: { 
        "identity": "key"
        // ... potentially more psk identities
    }
}
```
To talk to a Trådfri gateway, you need to use `Client_identity` to generate a new DTLS identity and then use that one for further communication. Again, please use [node-tradfri-client](https://github.com/AlCalzone/node-tradfri-client) instead.

### `tryToConnect` - Check if a given resource is available
```ts
coap
    .tryToConnect(target /* string */)
    .then((result /* true or error code or Error instance */) => {
        // do something with the result */ 
    })
    ;
```
The promise resolves with `true` (boolean) when the connection attempt was successful. The connection is then being kept alive, so subsequent requests are sped up. In case of failure, either an `Error` instance or one of the following error codes is returned:
* `"auth failed"`: The authentication failed, most likely due to a wrong PSK
* `"timeout"`: The other party did not respond or the secure connection could not be established in time

**NOTE:** This behavior was changed in v0.6.0 and is a breaking change!  
**NOTE:** Starting with v1.0.0, the `"error"` response code is replaced with the original `Error` instance. This method does not throw/reject but rather **return** the error.

### `request` - Fire off a one-time request to a CoAP resource
```ts
coap
    .request(
        resource /* string */,
        method /* "get" | "post" | "put" | "delete" */,
        [payload /* Buffer */,
        [options /* RequestOptions */]]
    )
    .then(response => { /* handle response */})
    .catch(err => { /* handle error */ })
    ;
```
The resource must be a valid CoAP resource URI, i.e. `coap(s)://hostname:port/path/path/path`.

To customize the request behaviour, pass a `RequestOptions` object as the fourth parameter. In this case, you **have to** provide a payload or pass `null/undefined` as the third parameter. This object looks as follows, **all properties are optional** and default to `true`:
```ts
{
    /** Whether to keep the socket connection alive. Speeds up subsequent requests */
    keepAlive: boolean
    /** Whether we expect a confirmation of the request */
    confirmable: boolean
    /** Whether this message will be retransmitted on loss */
    retransmit: boolean;
}
```
In general, it should not be necessary to set these, as the defaults provide a good, stable base for communication. 
The `confirmable` option determines if a `CON` (confirmable) or a `NON` (non-confirmable) message will be sent. `CON` provokes a response from the other endpoint and is required for retransmission. `NON` is useful if you don't require reliable transmission, e.g. for repeatedly sending sensor data.
The `retransmit` options determines if the CoAP client will try to retransmit confirmable messages that are not acknowledged by the remote endpoint. When the maximum number of retransmits is reached without success, the request promise will be rejected.

The `response` object looks as follows:
```ts
{
    /* The code of this response. For a description see https://tools.ietf.org/html/rfc7252#section-12.1.2 */
    code: MessageCode;
    /* The format of the response, as defined in https://tools.ietf.org/html/rfc7252#section-12.3 */
    format: number;
    /* The body of the response. Is only set if the response is non-empty */
    payload: Buffer;
}
```

The response code is of the type `MessageCode` which has the following properties and methods:
* `major` / `minor`: Return the major and minor part of the message code. For the `Unsupported Content-Format` code, this would be 4 and 15 respectively.
* `value`: Return the raw value as sent in the message header.
* `isEmpty()`: Returns true if this message code represents an empty message
* `isRequest()`: Returns true if this message code represents a request
* `isResponse()`: Returns true if this message code represents a response
* `toString()`: Returns the string representation (e.g. `"2.05"`) as defined in the spec.

### `observe` - Subscribe to a CoAP resource and get notified on all updates
```ts
coap
    .observe(
        resource /* string */,
        method /* "get" | "post" | "put" | "delete" */,
        callback /* function */,
        [payload /* Buffer */,]
        [options /* RequestOptions */]
    )
    .then(() => { /* observing was successfully set up */})
    .catch(err => { /* handle error */ })
    ;
```
See `request` for a description of most parameters. The `observe` method expects a callback function as the third parameter, which is called on the initial response and all updates to the resource. The callback gets passed a `response` object as the only parameter.

### `stopObserving` - Remove subscription to a CoAP resource
```ts
coap.stopObserving(resource /* string */)
```
You have to pass the same resource url you used to start observing earlier. After calling this, the observe callback is no longer invoked.

### `ping` - Ping a CoAP origin
```ts
coap
    .ping(
        target /* string | url | Origin */,
        [timeout /* number, time in ms */]
    )
    .then((success /* boolean */) => { /* handle response */})
    ;
```
Prefer this over custom ping constructs with full-blown requests! The `ping` method uses inexpensive CoAP pings to check the availability of an endpoint and automatically handles success/failure for you.

The target must be a string or url of the form `coap(s)://hostname:port` or an instance of the `Origin` class. The optional timeout (default 5000ms) determines when a ping is deemed as failed.

### `reset` - Invalidate all connection states
```ts
coap.reset(
    [originOrHostname /* string | Origin */]
);
```
After a connection loss or reboot of another endpoint, the currently active connection params might no longer be valid. In this case, use the `reset` method to invalidate the stored connection params, so the next request will use a fresh connection.

This causes all pending connections and requests to be dropped and clears all observations. 

To only reset connections and requests for a specific hostname, pass the hostname or origin as the optional parameter.

## Changelog

#### 1.0.2 (2018-12-29)
* (chrisEff) Update dependencies

#### 1.0.1 (2018-11-04)
* (AlCalzone) Rework the installation procedure. `node-aead-crypto` is now optional.

#### 1.0.0 (2018-07-30)
* (mkovatsc) Add support for the Uri-Query option
* (AlCalzone) `tryToConnect` no longer returns `"error"` when an unexpected error occured but instead **returns** the `Error` instance.

#### 0.7.2 (2018-05-01)
* (AlCalzone) **Potentially breaking change:** Update `node-dtls-client` library.

#### 0.6.2 (2018-04-27)
* (AlCalzone) Add support for NodeJS 10

#### 0.6.1 (2018-03-18)
* (AlCalzone) Treat `"ENOTFOUND"` as `"timeout"` instead of the generic `"error"` for connection purposes

#### 0.6.0 (2018-03-15) - WARNING: BREAKING CHANGE!!!
* (AlCalzone) `tryToConnect` now resolves with either `true` (boolean!) in case of success or one of the following error codes: `"auth failed"`, `"timeout"`, `"error"`

#### 0.5.5 (2018-02-27)
* (AlCalzone) Fix an error when requesting the next block in a blockwise transfer

#### 0.5.4 (2018-02-13)
* (AlCalzone) The hostname in `setSecurityParams` is now treated like the one given to `tryToConnect` (fixes the issue mentioned in #30)

#### 0.5.3 (2018-02-07)
* (AlCalzone) Attempt to fix `TypeError: generator already running` in ioBroker.tradfri

#### 0.5.2 (2018-02-05)
* (AlCalzone) Update DTLS library: Several errors in cipher suites fixed

#### 0.5.1 (2018-01-01)
* (AlCalzone) Use `Map`s instead of dictionary objects
* (AlCalzone) Remove excessive calls to the `concurrencyChanged` handlers

#### 0.5.0 (2017-12-24)
* (AlCalzone) Support receiving block-wise messages

#### 0.4.8 (2017-10-19)
* (AlCalzone) Fixed retransmission

#### 0.4.7 (2017-10-07)
* (AlCalzone) Removed potential sources of infinite loops

#### 0.4.6 (2017-10-02)
* (AlCalzone) Catch potential error in CoapClient.ping()

#### 0.4.4 (2017-09-25)
* (AlCalzone) Bugfixes

#### 0.4.1 (2017-09-23)
* (AlCalzone) Prevent a race condition while creating new connections

#### 0.4.0 (2017-09-23)
* (AlCalzone) Limit the number of concurrent requests

#### 0.3.2 (2017-09-21)
* (AlCalzone) Update DTLS library: Alert protocol support

#### 0.3.1 (2017-09-21)
* (AlCalzone) make keepAlive option actually do something
* (AlCalzone) Add tryToConnect function to preemptively test and connect to a resource

#### 0.3.0 (2017-09-20)
* (AlCalzone) support CoAP ping (empty CON message)

#### 0.2.0 (2017-08-24)
* (bonan & AlCalzone) implemented connection reset
* (bonan) reject response promise when retransmission fails
* (bonan) use debug package instead of console.log

#### 0.1.0 (2017-08-23)
* (AlCalzone) release on npm

#### 0.0.4 (2017-08-09)
* (AlCalzone) bugfixes

#### 0.0.3 (2017-08-01)
* (AlCalzone) reliability improvements

#### 0.0.2 (2017-07-25)
* (AlCalzone) implemented retransmission of lost messages.

#### 0.0.1
* (AlCalzone) initial release. 


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
