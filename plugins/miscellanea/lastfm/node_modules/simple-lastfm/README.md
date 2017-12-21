#Simple-Lastfm

A simple nodejs library to interface with the last.fm API

## Installation
    npm install simple-lastfm

## Examples

First, you'll need to get an API key from last.fm: [http://www.last.fm/api/account](http://www.last.fm/api/account).

Once you have your API key and API secret, you'll need to generate a session key, after which you can then start to scrobble:

```js
var Lastfm = require('simple-lastfm');

var lastfm = new Lastfm({
	api_key: 'xxx',
	api_secret: 'xxx',
	username: 'xxx',
	password: 'xxx'
});

lastfm.getSessionKey(function(result) {
	console.log("session key = " + result.session_key);
	if(result.success) {
		lastfm.scrobbleNowPlayingTrack({
			artist: 'Ratatat',
			track: 'Seventeen Years',
			callback: function(result) {
				console.log("in callback, finished: ", result);
			}
		});
		lastfm.scrobbleTrack({
			artist: 'Bonobo',
			track: 'Black Sands',
			callback: function(result) {
				console.log("in callback, finished: ", result);
			}
		});
		lastfm.loveTrack({
			artist: 'Electrelane',
			track: 'Suitcase',
			callback: function(result) {
				console.log("in callback, finished: ", result);
			}
		});
		lastfm.unloveTrack({
			artist: 'something crap',
			track: 'no thanks',
			callback: function(result) {
				console.log("in callback, finished: ", result);
			}
		});
	} else {
		console.log("Error: " + result.error);
	}
});
```

#Documentation

### init ( options )
options must be an object with the following required keys:

* `api_key`
* `api_secret`
* `username`
* `password`

Optional parameters:

* `session_key`
* `debug`

I recommend you save the session key and reuse it when possible. Debug should be true or false. By default it is false. Set it to true to have some console commands outputted.

### getSessionKey ( callback )
callback: A function which receives a single object. On success, this object looks like:

```js
	{
		success: true,
		session_key: 'xxx'
	}
```

On failure:

```js
	{
		success: false,
		error: 'A text description of the error from last.fm'
	}
```

Note:Right now 
When a session key is successfully received, it automatically gets saved into the lastfm instance (in the above code, you could access it as lastfm.session_key)


### scrobbleTrack ( options )
Required parameters:

* `artist`
* `track`

Optional parameters:

* `callback`: A function which receives a single object, of the form { success: true|false[, error: 'text description of the error']}.
* `timestamp`: The timestamp for this scrobble. If omitted, uses the current date/time. Use number of seconds (NOT milliseconds!) since the UNIX epoch.

### loveTrack (options)
Required parameters:

* `artist`
* `track`

Optional parameters:

* `callback`: A function which receives a single object, of the form { success: true|false[, error: 'text description of the error']}.

### unloveTrack (options)
Required parameters:

* `artist`
* `track`

Optional parameters:

* `callback`: A function which receives a single object, of the form { success: true|false[, error: 'text description of the error']}.

### getArtistInfo (options)
Required parameters:

* `artist`

Optional parameters:

* `callback`: A function which receives a single object, of the form { success: true|false[, artistInfo: {}, error: 'text description of the error']}.

### getTrackInfo (options)
Required parameters:

* `artist`
* `track`

Optional parameters:

* `callback`: A function which receives a single object, of the form { success: true|false[, trackInfo: {}, error: 'text description of the error']}.

### getTags (options)
Required parameters:

* `artist`

Optional parameters:

* `track`
* `callback`: A function which receives a single object, of the form { success: true|false[, tags: {}, error: 'text description of the error']}.

### getPlays (options)
Required parameters:

* `artist`

Optional parameters:

* `track`: The name of the track. If ommitted, method will return number of artist plays.
* `callback`: A function which receives a single object, of the form { success: true|false[, plays: #, error: 'text description of the error']}.

