#!/bin/bash

echo "Installing spotify-connect-web dependencies"
sudo apt-get update
sudo apt-get -y install avahi-utils
echo "checking if volspotconnect service exists"
if [ ! -f "/etc/systemd/system/volspotconnect.service" ];
	then
		echo "file volspotconnect.service doesn't exist, creating"
		cp /data/plugins/music_service/volspotconnect/volspotconnect.service.gz /
		cd /
		sudo tar -xvf volspotconnect.service.gz
		rm /volspotconnect.service.gz
	else
		echo "volspotconnect.service already exists"
fi
#required to end the plugin install
echo "plugininstallend"
