#!/bin/bash

echo "Unistalling playonconnect"

echo "Removing playonconnect"

systemctl stop playonconnect

sudo rm /etc/systemd/system/playonconnect.*

echo "Done"
echo "pluginuninstallend"