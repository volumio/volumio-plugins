#!/bin/bash

echo "Unistalling volspotconnect2 dependencies"

echo "Removing volspotconnect2"

systemctl stop volspotconnect2

sudo rm /etc/systemd/system/volspotconnect2.service
rm /data/configuration/music_service/volspotconnect2/config.json

echo "Done"
echo "pluginuninstallend"
