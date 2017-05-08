var PassThrough = require('stream').PassThrough;


/**
 * Tests that two readable streams are equal.
 *
 * @param {Readable|Stream} readStream2
 * @param {Readable|Stream} readStream2
 * @param {Function(!Error, Boolean)} callback
 */
module.exports = function streamEqual(origStream1, origStream2, callback) {
  if (typeof callback !== 'function') {
    return streamEqualAsPromised(origStream1, origStream2);
  }
  var readStream1 = origStream1.pipe(new PassThrough({ objectMode: true }));
  var readStream2 = origStream2.pipe(new PassThrough({ objectMode: true }));

  var stream1 = {
    id: 1,
    stream: readStream1,
    data: null,
    pos: 0,
    ended: false,
  };
  var stream2 = {
    id: 2,
    stream: readStream2,
    data: null,
    pos: 0,
    ended: false,
  };
  stream1.read = createRead(stream1, stream2, cleanup);
  stream2.read = createRead(stream2, stream1, cleanup);
  var onend1 = createOnEnd(stream1, stream2, cleanup);
  var onend2 = createOnEnd(stream2, stream1, cleanup);

  function cleanup(err, equal) {
    origStream1.removeListener('error', cleanup);
    readStream1.removeListener('end', onend1);
    readStream1.removeListener('readable', stream1.read);

    origStream2.removeListener('error', cleanup);
    readStream2.removeListener('end', onend2);
    readStream1.removeListener('readable', stream2.read);

    callback(err, equal);
  }

  origStream1.on('error', cleanup);
  readStream1.on('end', onend1);

  origStream2.on('error', cleanup);
  readStream2.on('end', onend2);

  // Start by reading from the first stream.
  stream1.stream.once('readable', stream1.read);
};


/**
 * Tests that two readable streams are equal.
 *
 * @param {Object} readStream1
 * @param {Object} readStream2
 * @return {Promise<Boolean>}
 */
function streamEqualAsPromised(readStream1, readStream2) {
  return new Promise(function (resolve, reject) {
    module.exports(readStream1, readStream2, function (err, result) {
      if (err) {
        return reject(err);
      }

      resolve(result);
    });
  });
}


/**
 * Returns a function that compares emitted `read()` call with that of the
 * most recent `read` call from another stream.
 *
 * @param {Object} stream
 * @param {Object} otherStream
 * @param {Function(Error, Boolean)} callback
 * @return {Function(Buffer|String)}
 */
function createRead(stream, otherStream, callback) {
  return function read() {
    var data = stream.stream.read();
    if (!data) {
      return stream.stream.once('readable', stream.read);
    }

    // Make sure `data` is a buffer.
    if (!Buffer.isBuffer(data)) {
      if (typeof data === 'object') {
        data = JSON.stringify(data);
      } else {
        data = data.toString();
      }
      data = new Buffer(data);
    }

    var newPos = stream.pos + data.length;

    if (stream.pos < otherStream.pos) {
      var minLength = Math.min(data.length, otherStream.data.length);

      var streamData = data.slice(0, minLength);
      stream.data = data.slice(minLength);

      var otherStreamData = otherStream.data.slice(0, minLength);
      otherStream.data = otherStream.data.slice(minLength);

      // Compare.
      for (var i = 0, len = streamData.length; i < len; i++) {
        if (streamData[i] !== otherStreamData[i]) {
          return callback(null, false);
        }
      }

    } else {
      stream.data = data;
    }


    stream.pos = newPos;
    if (newPos > otherStream.pos) {
      if (otherStream.ended) {
        // If this stream is still emitting `data` events but the other has
        // ended, then this is longer than the other one.
        return callback(null, false);
      }

      // If this stream has caught up to the other,
      // read from other one.
      otherStream.read();

    } else {
      stream.read();
    }
  };
}


/**
 * Creates a function that gets called when a stream ends.
 *
 * @param {Object} stream
 * @param {Object} otherStream
 * @param {Function(!Error, Boolean)} callback
 */
function createOnEnd(stream, otherStream, callback) {
  return function onend() {
    stream.ended = true;
    if (otherStream.ended) {
      callback(null, stream.pos === otherStream.pos);
    } else {
      otherStream.read();
    }
  };
}
