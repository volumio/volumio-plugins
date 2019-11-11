#!/bin/bash

# Uninstall dependendencies
# apt-get remove -y

rm -Rf /data/configuration/audio_interface/RoonBridge
rm /lib/systemd/system/roonbridge.service

systemctl daemon-reload

echo "Done"
echo "pluginuninstallend"
