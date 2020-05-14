# volumio-plugins

## VSCode setup
To set up Visual Studio Code for debugging plugin development, copy the code from your Volumio2 system to a local workspace:

```bash
cd [your workspace directory]
# maybe change this to a mount...
scp -r volumio@[volumio IP or Host]:/volumio/* .
mkdir .vscode
# for debugging
echo '{
  "version": "0.2.0",
  "configurations": [ {
  "type": "node",
  "request": "attach",
  "name": "Volumio2 Debugger",
  "address": "localhost",
  "port": "9229",
  "localRoot": "${workspaceFolder}/source",
  "remoteRoot": "/"
  }
]
}' > .vscode/launch.js
```

### Running in debug mode

You may need a few changes to cleanly debug. In the file `./app/index.js`

```javascript
    // look for the logger instantiation
    this.logger = new (winston.Logger)({
            transports: [
                    new (winston.transports.Console)(),
                    new (winston.transports.File)({
                            filename: logfile,
                            json: false
                    })
            ]
    });
    // enable winston debugging
    this.logger.level = 'debug';
```

In the file `./app/plugins/miscellanea/albumart/index.js`, you may need to modify the forked album art server
to run on a different port:

```javascript
    //Starting server
    var albumartServerCmdArray = [self.config.get('port'),self.config.get('folder')];
    var pExecArgv = process.execArgv;
    if (typeof v8debug === 'object' || /--debug|--inspect/.test(process.execArgv.join(' '))) {
        pExecArgv = ['--inspect-brk=19229'];
    }
    var albumartServer = fork(__dirname+'/serverStartup.js', albumartServerCmdArray, { execArgv: pExecArgv });
```

Connect to your volumio box/vm and start up in debug mode

```bash
ssh -L 9229:localhost:9229 volumio@[volumio IP or Host]
sudo systemctl stop volumio.service
node --inspect-brk /volumio/index.js
```
