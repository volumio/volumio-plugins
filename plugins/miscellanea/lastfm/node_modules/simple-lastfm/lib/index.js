var http = require('http');
var crypto = require('crypto');
var xml2js = require('xml2js');
var querystring = require('querystring');
var $ = require('jquery');

var Lastfm = function(options) {
	options = options || {};
	var api_key;
	var api_secret;
	var username;
	var password;
	var session_key;
	
	var self = this;
	var _isTheMethodCaller = false;

	this.debug = options.debug || false;
	
	this.api_key = options.api_key;
	if(options.api_secret != undefined && options.api_secret != '')
		this.api_secret = options.api_secret;
		if(options.username != undefined && options.username != '')
	this.username = options.username;
		if(options.password != undefined && options.password != '')
	this.password = options.password;
	if(options.session_key != undefined && options.session_key != '')
		this.session_key = options.session_key;

	// Privileged method - available to public methods but not to the instance itself.
	self._getInfo = function(opt) {
		if(!self._isTheMethodCaller) throw new Error('Security exception.');
		try {
			if(opt.artist == undefined || opt.artist == '' && typeof opt.callback == 'function') {
				opt.callback({
					'@': {status: 'error'},
					error: {'#': 'Artist not specified.'}
				});
			} else {
				http.get({
					host: 'ws.audioscrobbler.com',
					port: 80,
					path: '/2.0/?method=' + (opt.track != undefined && opt.track != '' ? 'track' : 'artist') + '.getinfo&api_key=' + this.api_key + '&autocorrect=1&username=' + this.username + '&artist=' + encodeURIComponent(opt.artist) + (opt.track == undefined || opt.track == '' ? '' : '&track=' + encodeURIComponent(opt.track))
				}, function(res) {
					var body = '';
					res.on('data', function(chunk) {
						body += chunk;
					});
					res.on('end', function() {
						var parser = new xml2js.Parser(xml2js.defaults["0.1"]);
						parser.parseString(body, function(err, result) {
							if (typeof opt.callback == 'function') {
								opt.callback(result);
							}
						});
					});
				});
			}
		} catch(e) {
			if(this.debug)
				console.log("Exception getting track info: ", e);
		}
	};
};

// Left for backwards compatibility
Lastfm.prototype.init = function(options) {
	this.api_key = options.api_key;
	if(options.api_secret != undefined && options.api_secret != '')
		this.api_secret = options.api_secret;
		if(options.username != undefined && options.username != '')
	this.username = options.username;
		if(options.password != undefined && options.password != '')
	this.password = options.password;
	if(options.session_key != undefined && options.session_key != '')
		this.session_key = options.session_key;
};

Lastfm.prototype.getSessionKey = function(callback) {
	var authToken = md5(this.username + md5(this.password));
	var sig = 'api_key' + this.api_key + 'authToken' + authToken + 'methodauth.getMobileSessionusername' + this.username + this.api_secret;
	var api_sig = md5(sig);
	var lastfmObj = this;
	http.get({
		host: 'ws.audioscrobbler.com',
		port: 80,
		path: '/2.0/?method=auth.getMobileSession&' +
		'username=' + this.username + '&' + 
		'authToken=' + authToken + '&' +
		'api_key=' + this.api_key + '&' +
		'api_sig=' + api_sig
	}, function(res) {
		var body = '';
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function() {
			try {
				var parser = new xml2js.Parser(xml2js.defaults["0.1"]);
				parser.parseString(body, function(err, result) {
					var ret = {
						success: result['@'].status == 'ok'
					};
					if(ret.success) {
						ret.session_key = result.session.key;
						lastfmObj.session_key = result.session.key;
					} else
						ret.error = result.error['#'];
					if(typeof callback == 'function') {
						callback(ret);
					}
				});
			} catch(e) {
				if(lastfmObj.debug)
					console.log("Exception: ", e);
			}
		});
	});
};

Lastfm.prototype.scrobbleTrack = function(opt) {
	var options = $.extend(opt || {}, {method: 'track.scrobble'});
	this.doScrobble(options);
};

Lastfm.prototype.loveTrack = function(opt) {
	var options = $.extend(opt || {}, {method: 'track.love'});
	this.doScrobble(options);
};

Lastfm.prototype.unloveTrack = function(opt) {
	var options = $.extend(opt || {}, {method: 'track.unlove'});
	this.doScrobble(options);
};

Lastfm.prototype.scrobbleNowPlayingTrack = function(opt) {
	var options = $.extend(opt || {}, {method: 'track.updateNowPlaying'});
	this.doScrobble(options);
};

Lastfm.prototype.doScrobble = function(options) {
	if(this.debug)
		console.log("Starting scrobbleTrack: ", options);	
	options = options || {};
	if((this.api_secret == undefined || this.api_secret == '') && typeof options.callback == 'function') {
		options.callback({
			success: false,
			error: 'API Secret not specified.'
		});
	}
	if((this.username == undefined || this.username == '') && typeof options.callback == 'function') {
		options.callback({
			success: false,
			error: 'Username not specified.'
		});
	}
	if((this.password == undefined || this.password == '') && typeof options.callback == 'function') {
		options.callback({
			success: false,
			error: 'Password not specified.'
		});
	}

//	session.scrobbled = true;
	options.timestamp = options.timestamp != undefined ? Math.floor(options.timestamp) :  Math.floor(now() / 1000);
	
	//var timestamp =
	
	if(this.debug)
		console.log("Using session key: " + this.session_key + "\n\n");
	var authToken = md5(this.username + md5(this.password));
//	console.log("authToken = " + authToken);
	var sig = 'api_key' + this.api_key + 'artist' + options.artist + 'method' + options.method + 'sk' + this.session_key + 'timestamp' + options.timestamp + 'track' + options.track + this.api_secret;
//	console.log("sig = " + sig);
	var api_sig = md5(sig);
//	console.log("api sig = " + api_sig);
	
	var post_data = querystring.stringify({
		api_key: this.api_key,
		method: options.method,
		sk: this.session_key,
		api_sig: api_sig,
		timestamp: options.timestamp,
		artist: options.artist,
		track: options.track
	});
	
//	console.log("post_data: ", post_data);
	
	var post_options = {
		host: 'ws.audioscrobbler.com',
	      port: '80',
	      path: '/2.0/',
	      method: 'POST',
	      headers: {
	          'Content-Type': 'application/x-www-form-urlencoded',
	          'Content-Length': post_data.length
	      }
	};
	
	var post_req = http.request(post_options, function(res) {
		res.setEncoding('utf8');
		res.on('data', function(chunk) {
//			console.log('Response: ' + chunk);
			var parser = new xml2js.Parser(xml2js.defaults["0.1"]);
			parser.parseString(chunk, function(err, result) {
				try {
					if (result['@'].status == 'ok') {
//						console.log("Track scrobbled (" + options.method + " )");
						if(typeof options.callback == 'function') {
							options.callback({
								success: true
							});
						}
					} else {
						if(typeof options.callback == 'function') {
							options.callback({
								success: false,
								error: result.error['#']
							});
						}
					}
				} catch(e) {
					if(this.debug)
						console.log("Exception parsing scrobble result: ", e);
				}
			});
		});
	});
	post_req.write(post_data);
	post_req.end();
};

Lastfm.prototype.getTrackInfo = function(opt) {
	opt = opt || {};
	if(opt.artist == undefined || opt.artist == '' && typeof opt.callback == 'function') {
		opt.callback({
			success: false,
			error: 'Artist not specified.'
		});
	} else if(opt.track == undefined || opt.track == '' && typeof opt.callback == 'function') {
		opt.callback({
			success: false,
			error: 'Track not specified.'
		});
	} else if(typeof opt.callback == 'function') {
		var the_callback = opt.callback;
		this._isTheMethodCaller = true;
		this._getInfo($.extend(opt, {
			callback: function(result) {
				this._isTheMethodCaller = false;
				if(result['@'].status == 'ok') {
					the_callback({
						success: true,
						trackInfo: result.track
					});
				} else {
					the_callback({
						success: false,
						error: result.error['#']
					});
				}
			}
		}));
	}
};

Lastfm.prototype.getArtistInfo = function(opt) {
	opt = opt || {};
	opt.track = '';
	if(opt.artist == undefined || opt.artist == '' && typeof opt.callback == 'function') {
		opt.callback({
			success: false,
			error: 'Artist not specified.'
		});
	} else if(typeof opt.callback == 'function') {
		var the_callback = opt.callback;
		this._isTheMethodCaller = true;
		this._getInfo($.extend(opt, {
			callback: function(result) {
				this._isTheMethodCaller = false;
				if(result['@'].status == 'ok') {
					the_callback({
						success: true,
						artistInfo: result.artist
					});
				} else {
					the_callback({
						success: false,
						error: result.error['#']
					});
				}
			}
		}));
	}
};

Lastfm.prototype.getTags = function(opt) {
	var the_callback = opt.callback;
	this._isTheMethodCaller = true;
	this._getInfo($.extend(opt, {
		callback: function(result) {
			this._isTheMethodCaller = false;
//			console.log("result: ", result);
			if(typeof the_callback == 'function') {
				if(result['@'].status == 'ok') {
					var tags = opt.track != undefined && opt.track != '' ? result.track.toptags.tag : result.artist.tags.tag;
					if(typeof tags == 'object' && !tags.length)
						tags = [tags];
					var args = {
							success: true,
							tags: tags || [],
							artist: opt.track != undefined && opt.track != '' ? result.track.artist.name : result.artist.name
						};
					if(opt.track != undefined && opt.track != '')
						args.track = result.track.name;
					the_callback(args);
				} else {
					the_callback({
						success: false,
						error: result.error['#']
					});
				}
			}
		}
	}));
};

Lastfm.prototype.getPlays = function(opt) {
	var the_callback = opt.callback;
	this._isTheMethodCaller = true;
	this._getInfo($.extend(opt, {
		callback: function(result) {
			this._isTheMethodCaller = false;
//			console.log("result: ", result);
			if(typeof the_callback == 'function') {
				if(result['@'].status == 'ok') {
					var ret = {
						success: true,
						plays: opt.track != undefined && opt.track != '' ? result.track.userplaycount : result.artist.stats.userplaycount,
						artist: opt.track != undefined && opt.track != '' ? result.track.artist.name : result.artist.name
					};
					if(ret.plays == undefined)
						ret.plays = 0;
					if(opt.track != undefined && opt.track != '')
						ret.track = result.track.name;
					the_callback(ret);
				} else {
					the_callback({
						success: false,
						error: result.error['#']
					});
				}
			}
		}
	}));
};

Lastfm.prototype.getTracks = function(opt) {
//	var the_callback = opt.callback;
	var page = opt.page ? opt.page : 1;
	http.get({
		host: 'ws.audioscrobbler.com',
		port: 80,
		path: '/2.0/?method=user.getartisttracks&page=' + page + '&api_key=' + this.api_key + '&autocorrect=1&user=' + this.username + '&artist=' + encodeURIComponent(opt.artist)
	}, function(res) {
		var body = '';
		res.on('data', function(chunk) {
			body += chunk;
		});
		res.on('end', function() {
			var parser = new xml2js.Parser(xml2js.defaults["0.1"]);
			parser.parseString(body, function(err, result) {
				if (typeof opt.callback == 'function') {
					opt.callback(result);
				}
			});
		});
	});
};

Lastfm.prototype.getAllTracks = function(opt) {
	var lastfm = this;
	var the_callback = opt.callback;
	var tracks = [];
	opt.callback = function(result) {
		if(result['@'].status == 'failed') {
			the_callback({
				success: false,
				reason: result.error['#']
			});
		} else {
			var numPages = result.artisttracks['@'].totalPages;
			for(var i=0;i<result.artisttracks.track.length;i++) {
				if(tracks.indexOf(result.artisttracks.track[i].name) < 0)
					tracks.push(result.artisttracks.track[i].name);
			}
			if(result.artisttracks['@'].page < numPages) {
				opt.page++;
				lastfm.getTracks(opt);
			} else {
				the_callback({success: true, artist: result.artisttracks['@'].artist, tracks: tracks});
			}
		}
	};
	opt.page = 1;
	this.getTracks(opt);
};

function now() {
	return new Date().getTime();
}

function md5(string) {
	return crypto.createHash('md5').update(string, 'utf8').digest("hex");
}

module.exports = Lastfm;
