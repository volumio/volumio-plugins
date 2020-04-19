'use strict';

var fs = require('fs-extra');
var { exec } = require('child_process');
var { execFileSync } = require('child_process');
var { execSync } = require('child_process');


var dirs = fs.readdirSync(__dirname + "/remotes");
console.log('Read ' + dirs.length + ' files:');
//console.log(dirs);
// Get names for remotes based on their file name
var names = [];
for(var i = 0; i < dirs.length; i++) {
    if (dirs[i].endsWith(".lircd.conf")) {
        names[i] = dirs[i].split(".lircd.conf", 1)[0];
        console.log(dirs[i].split(".lircd.conf",1)[0]);
    }
}
console.log(names);

const fnum = 1;
if (!fs.existsSync(__dirname + "/remotes/" + names[fnum] + ".lircd.conf")) {
    console.log("File not found: " + dirs[fnum]);
} else {
    console.log("Found: \"" + __dirname + "/remotes/" + dirs[fnum] + "\" for " + names[fnum]);
}
// Copy to default location:
//execFileSync("/bin/cp", [__dirname + "/remotes/" + dirs[fnum] , "/etc/lirc/lircd.conf" ] , { uid: 1000, gid: 1000, encoding: 'utf8' });

// Now we have to restart, otherwise lircd does not notice the change in conffig file...
//execSync("sudo /bin/systemctl restart lirc.service", { uid: 1000, gid: 1000 });

//// Work out the name of the remote: use the 'irsend list' command
//const rname = exec('/usr/bin/irsend list "" ""', { uid: 1000, gid: 1000, encoding: 'utf8' });
//// Turns out it sends the outout to stderr; took me ages to figure out...
//rname.stderr.on('data', (data) => {
//    const rn = data.split("irsend: ");
//    console.log(`child stderr:\n${rn[1]}`);
//});

// Same but using callback instead:
const rname = exec('/usr/bin/irsend list "" ""', { uid: 1000, gid: 1000, encoding: 'utf8' },
    function (error, stdout, stderr) {
        if (error != null) {
            console.log('[IR Transmitter] Could not get lirc remote name : ' + error);
//            defer.reject();
        } else {
            const rn = stderr.split("irsend: ");
            var remote = { 'remote': "" , "name": ""};
            remote.remote = rn[1];
            remote.name = rn[1].trim();
            console.log("[IR transmitter] New lirc remote name: " + JSON.stringify(remote));
            //                    defer.resolve();
        }
    });

var data = { 'remotename': { 'value': "val", 'label': "lab" } };
console.log(data);
console.log(data['remotename'], data['remotename']['value']);
