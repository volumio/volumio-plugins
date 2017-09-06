#!/bin/bash

echo "Unistalling wifireconnect"

echo "Removing wifireconnect"

systemctl stop wifireconnect

sudo rm /etc/systemd/system/wifireconnect.*

echo "Done"
echo "pluginuninstallend"