'use strict';

var crypto = require('crypto');
var libQ = require('kew');
var cachemanager = require('cache-manager');
var unirest = require('unirest');

module.exports = volusonicApi;

function volusonicApi(log,config) {
	var self = this;
    	var logger = log;
	var cache = cachemanager.caching({ store: 'memory', max: 50000, ttl: config.get('timeOut')});
	
	var cacheGet = function (key) {
		var self = this;
		return cache.get(key);
	};

	var cacheSet = function (key, value) {
		var self = this;
		cache.set(key, value);
	};

	var cacheRemove = function () {
	};

	var cacheReset = function () {
		var self = this;
		cache = cachemanager.caching({ store: 'memory', max: 50000, ttl: config.get('timeOut')});
	};

	var get = function (command, id, params) {
		var self = this;
                var defer = libQ.defer();

                var cached = cacheGet( command + id )  
                .then(function(cached){
                        if ( cached == undefined){
                                cached = submitQuery(command + '?' + params)
                                .then(function(cached){
                                        if (cached['subsonic-response'].status!='failed'){
                                                cacheSet(command + id, cached);
                                        }
                                        defer.resolve(cached);
                                });
                        } 
                        else {
                                defer.resolve(cached);
                        }
                });
                return defer.promise;
	};

	var getAuth = function (user, pass) {
		var self = this;

		var makesalt = function() {
  			var salt = "";
  			var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  			for (var i = 0; i < 5; i++)
    				salt += possible.charAt(Math.floor(Math.random() * possible.length));
  			return salt;
		}

		var salt = makesalt();
		var token = crypto.createHash('md5').update(pass + salt).digest("hex");
		var auth = "u=" + user + "&t=" + token + "&s=" + salt + "&v=1.13.0&f=json&c=volusonic";
		return auth;
	};

	var submitQuery = function (query) {
		var self = this;
		var defer = libQ.defer();

		var uri = config.get('server') + '/rest/' + query + '&' + config.get('auth');
		unirest
			.get(uri)
			.strictSSL(false)
            		.end(function (response) {
                		if (response.ok) {
                    			defer.resolve(response.body);
                		}
                		else {
                    			defer.reject(new Error('submitQuery'));
                		}
            		});
		return defer.promise;

	};
	return {
		cacheGet: cacheGet,
		cacheSet: cacheSet,
		cacheRemove: cacheRemove,
		cacheReset: cacheReset,
		get: get,
		getAuth: getAuth,
		submitQuery: submitQuery
	};

};

