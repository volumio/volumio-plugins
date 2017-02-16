#!/bin/bash
echo "Installing spotify-connect-web dependencies"

#echo "Checking if volspotconnect2 service exists"
#if [ ! -f "/etc/systemd/system/volspotconnect2.service" ];
#	then
#		echo "file volspotconnect2.service doesn't exist, creating"
		cd /data/plugins/music_service/volspotconnect2/
#		cp /data/plugins/music_service/volspotconnect/volspotconnect.service.tar /
#		cd /
		sudo tar -xvf volspotconnect2.service.tar -C /
#		rm /volspotconnect2.service.tar
#	else
#		echo "volspotconnect2.service already exists. Nothing to do !"
#fi

#required to end the plugin install
echo "plugininstallend"
