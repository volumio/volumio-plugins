'use strict';
//Grab device from mpd.conf
//and create /home/volumio/.libao for pianobar
const fs = require('fs-extra');

let writeLibaoConf = new Promise(function(resolve, reject) {
    fs.readFile('/etc/mpd.conf', 'utf-8',
        //callback function called after read
        function(err, data) {
            if (err) 
                reject(new Error('Could not read mpd.conf'));
            //grab device from /etc/mpd.conf
            var m = data.match(/\s+device\s+"(.+)"/);
            var libaoOut = ['default_driver=alsa',
                            'dev=' + m[1],
                            'quiet\n'].join('\n');
            fs.writeFile('/home/volumio/.libao', libaoOut, 'utf-8',
                //callback function called after write
                function (err) {
                    if (err) 
                        reject(new Error('Could not write to .libao'));
                    resolve('libao configuration written');
            });
    });
});

writeLibaoConf.then(
    result => console.log(result),
    error => console.log(error)
);

module.exports = writeLibaoConf;
