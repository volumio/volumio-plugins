/*jslint node:true nomen:true*/
'use strict';
var util = require('util'),
    eiscp = require('../eiscp');


// This will output a list of available commands

eiscp.get_commands('main', function (err, cmds) {

    console.log(cmds);
    cmds.forEach(function (cmd) {
        console.log(cmd);
        eiscp.get_command(cmd, function (err, values) {
            console.log(values);
        });
    });
});

