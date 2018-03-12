/*jslint node:true nomen:true*/
'use strict';
var util = require('util'),
    eiscp = require('../eiscp');

eiscp.on('debug', util.log);
eiscp.on('error', util.log);

// Discover receviers on network, stop after 2 receviers or 5 seconds

eiscp.discover({devices: 2, timeout: 5}, function (err, result) {
	
	if(err) {
		console.log("Error message: " + result);
	} else {
		console.log("Found these receivers on the local network:");
		console.dir(result);
	}
});

