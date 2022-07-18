#!/usr/bin/env bash


echo "Writing systemd unit"

echo "[Unit]
Description=Volspotconnect2 Daemon
After=syslog.target

[Service]
Type=simple
ExecStart=/bin/bash /usr/lib/startconnect.sh
Restart=always
RestartSec=2
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=volumio
User=volumio
Group=volumio

[Install]
WantedBy=multi-user.target" > /lib/systemd/system/volspotconnect.service


echo "Setting permissions"
SPOP_PLUGIN_DATA=/data/plugins/music_service/spop/bin/vollibrespot
if [ -f "$SPOP_PLUGIN_DATA" ]; then
    chmod a+x $SPOP_PLUGIN_DATA
fi

SPOP_PLUGIN_VOLUMIO=/volumio/app/plugins/music_service/spop/bin/vollibrespot
if [ -f "$SPOP_PLUGIN_VOLUMIO" ]; then
    chmod a+x $SPOP_PLUGIN_VOLUMIO
fi

SPOP_USR_BIN=/usr/bin/vollibrespot
if [ -f "$SPOP_USR_BIN" ]; then
    chmod a+x $SPOP_USR_BIN
fi

echo "Writing startconnect unit"

echo '#!/usr/bin/env bash
SPOP_PLUGIN_DATA=/data/plugins/music_service/spop/bin/vollibrespot
if [ -f "$SPOP_PLUGIN_DATA" ]; then
    .$SPOP_PLUGIN_DATA -c /tmp/volspotify.toml
fi

SPOP_PLUGIN_VOLUMIO=/volumio/app/plugins/music_service/spop/bin/vollibrespot
if [ -f "$SPOP_PLUGIN_VOLUMIO" ]; then
    .$SPOP_PLUGIN_VOLUMIO -c /tmp/volspotify.toml
fi

SPOP_USR_BIN=/usr/bin/vollibrespot
if [ -f "$SPOP_USR_BIN" ]; then
    .$SPOP_USR_BIN -c /tmp/volspotify.toml
fi' > /usr/lib/startconnect.sh

chmod a+x /usr/lib/startconnect.sh

#required to end the plugin install
echo "plugininstallend"
