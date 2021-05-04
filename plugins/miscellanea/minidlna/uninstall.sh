#!/bin/bash

echo "Removing dependencies"
sudo apt-get -y purge --auto-remove minidlna

echo "Deleting /data/minidlna.conf"
sudo rm /data/minidlna.conf

echo "Deleting systemd unit /etc/systemd/system/minidlna.service"
sudo rm /etc/systemd/system/minidlna.service
sudo systemctl daemon-reload

echo "Done"
echo "pluginuninstallend"
