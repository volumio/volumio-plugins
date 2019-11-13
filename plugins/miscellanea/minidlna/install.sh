#!/bin/bash

echo "Installing miniDLNA dependencies"
sudo apt-get update
sudo apt-get -y install minidlna
sudo rm /etc/minidlna.conf

echo "Creating systemd unit /etc/systemd/system/minidlna.service"
sudo install -D -m u=rw,go=r /data/plugins/miscellanea/minidlna/minidlna.service /etc/systemd/system/minidlna.service
systemctl daemon-reload

echo "Setting values for \"network_interface\" and \"model_number\" in /data/plugins/miscellanea/minidlna/config.json"
sed -i "/\"value\": \"eth0,wlan0\"/s/\"eth0,wlan0\"/\"$(ip -o link show | grep -v ": lo:" | cut -s -d":" -f2 | cut -s -d" " -f2 | tr "[:cntrl:]" "," | head --bytes -1)\"/1" /data/plugins/miscellanea/minidlna/config.json
sed -i "/\"value\": \"Volumio Edition\"/s/\"Volumio Edition\"/\"$(minidlnad -V | tr -d "[:cntrl:]")\"/1" /data/plugins/miscellanea/minidlna/config.json

echo "plugininstallend"
