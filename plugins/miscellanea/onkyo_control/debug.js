/*jslint node:true nomen:true*/
'use strict';
var util = require('util'),
    eiscp = require('eiscp');

/*
   Connect to receiver and send a command
   Disconnect when response is received
*/

// Will discover receiver automatically
eiscp.connect({
                reconnect: false,
                send_delay: 5000,
                verify_commands: false
            });
// Or connect to a specific IP
//eiscp.connect({host: "10.0.0.5"});

// Prints debugging info to the terminal
eiscp.on("debug", util.log);
// Prints errors to the terminal
eiscp.on("error", util.log);

