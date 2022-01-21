#!/bin/bash

echo "Installing MiniDLNA"
sudo apt-get update
sudo apt-get -y install minidlna
sudo systemctl disable minidlna.service
sudo systemctl stop minidlna.service
sudo rm /etc/minidlna.conf
sudo rm /data/minidlna.conf

minidlnad=$(whereis -b minidlnad | cut -d ' ' -f2)
echo "Creating systemd unit /etc/systemd/system/minidlna.service"
sudo echo "[Unit]
Description=MiniDLNA lightweight DLNA/UPnP-AV server
Documentation=man:minidlnad(1) man:minidlna.conf(5)
After=local-fs.target remote-fs.target nss-lookup.target network.target

[Service]
User=volumio
Group=volumio

Environment=CONFIGFILE=/data/minidlna.conf
Environment=DAEMON_OPTS=
EnvironmentFile=-/etc/default/minidlna

RuntimeDirectory=minidlna
PIDFile=/run/minidlna/minidlna.pid
ExecStart=$minidlnad -f \$CONFIGFILE -P /run/minidlna/minidlna.pid \$DAEMON_OPTS

[Install]
WantedBy=multi-user.target" > /etc/systemd/system/minidlna.service
sudo systemctl daemon-reload

echo "Setting values for \"network_interface\" and \"model_number\" in /data/plugins/miscellanea/minidlna/config.json"
sed -i "/\"value\": \"eth0,wlan0\"/s/\"eth0,wlan0\"/\"$(ip -o link show | grep -v ": lo:" | cut -s -d":" -f2 | cut -s -d" " -f2 | tr "[:cntrl:]" "," | head --bytes -1)\"/1" /data/plugins/miscellanea/minidlna/config.json
sed -i "/\"value\": \"Volumio Edition\"/s/\"Volumio Edition\"/\"$($minidlnad -V | tr -d "[:cntrl:]")\"/1" /data/plugins/miscellanea/minidlna/config.json

echo "Setting permissions to MiniDLNA folders"
sudo chown -R volumio:volumio /var/cache/minidlna/

echo "plugininstallend"
