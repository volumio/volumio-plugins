#!/bin/bash

echo "Uninstalling miniDLNA dependencies"

echo "Removing miniDLNA"
sudo apt-get -y purge --auto-remove minidlna

echo "Deleting /etc/minidlna.conf"
sudo rm /etc/minidlna.conf

echo "Deleting systemd unit /etc/systemd/system/minidlna.service"
sudo rm /etc/systemd/system/minidlna.service
systemctl daemon-reload

echo "Done"
echo "pluginuninstallend"
