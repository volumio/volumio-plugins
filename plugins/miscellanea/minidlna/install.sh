#!/bin/bash

echo "Installing miniDLNA"
sudo apt-get update
sudo apt-get -y install minidlna
sudo rm /etc/minidlna.conf
sudo rm /data/minidlna.conf

minidlnad=$(whereis -b minidlnad | cut -d ' ' -f2)
echo "Creating systemd unit /etc/systemd/system/minidlna.service"
sudo echo "[Unit]
Description=MiniDLNA UPnP-A/V and DLNA media server
After=syslog.target var-run.mount nss-lookup.target network.target remote-fs.target local-fs.target

[Service]
Type=forking
PIDFile=/var/run/minidlna/minidlnad.pid
ExecStart=$minidlnad -P /var/run/minidlna/minidlnad.pid -f /data/minidlna.conf
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=volumio
User=root
Group=volumio

[Install]
WantedBy=multi-user.target
" > /etc/systemd/system/minidlna.service
sudo systemctl daemon-reload

echo "Setting values for \"network_interface\" and \"model_number\" in /data/plugins/miscellanea/minidlna/config.json"
sed -i "/\"value\": \"eth0,wlan0\"/s/\"eth0,wlan0\"/\"$(ip -o link show | grep -v ": lo:" | cut -s -d":" -f2 | cut -s -d" " -f2 | tr "[:cntrl:]" "," | head --bytes -1)\"/1" /data/plugins/miscellanea/minidlna/config.json
sed -i "/\"value\": \"Volumio Edition\"/s/\"Volumio Edition\"/\"$($minidlnad -V | tr -d "[:cntrl:]")\"/1" /data/plugins/miscellanea/minidlna/config.json

echo "Setting permissions to miniDLNA folders"
sudo chown -R volumio:volumio /var/cache/minidlna/

echo "plugininstallend"
