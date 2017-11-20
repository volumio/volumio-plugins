#!/bin/bash

echo "Unistalling volstereo2mono dependencies"

echo "Removing volstereo2mono"

systemctl stop volstereo2mono

sudo rm /etc/systemd/system/volstereo2mono.service
echo "Done"
echo "pluginuninstallend"
