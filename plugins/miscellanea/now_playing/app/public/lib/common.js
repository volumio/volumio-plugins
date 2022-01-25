let pluginVersion, appPort;

function refresh() {
    window.location.reload();
  }

function getSocket(host, data = {}) {
    let socket = io.connect(host, { autoConnect: false });

    if (data.pluginVersion && data.appPort) {
        pluginVersion = `${ data.pluginVersion }`;
        appPort = `${ data.appPort }`;

        socket.on('nowPlayingPluginInfo', info => {
            if (`${ info.appPort }` !== appPort) {
                let href = window.location.href.replace(`:${ appPort }`, `:${ info.appPort }`);
                window.location.href = href;
            }
            else if (info.pluginVersion !== pluginVersion) {
                refresh();
            }
        });

        socket.on('reconnect', () => {
            socket.emit('callMethod', {
                endpoint: 'miscellanea/now_playing',
                method: 'broadcastPluginInfo'
            });
        });
    }
    
    socket.on('nowPlayingRefresh', () => {
      refresh();
    });

    return socket;
}
