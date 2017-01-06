#!/bin/bash
echo "Installing wifireconnect dependencies"

echo "Checking if wifireconnect services exist"
if [ ! -f "/etc/systemd/system/wifireconnect.service" ];
	then
		echo "file wifireconnect.service doesn't exist, creating"
		cp /data/plugins/system_controller/wifireconnect/wifireconnect.tar.gz /
		cd /
		sudo tar -xvf wifireconnect.tar.gz
		rm /wifireconnect.tar.gz
	else
		echo "volspotconnect.service already exists. Nothing to do !"
fi

#required to end the plugin install
echo "plugininstallend"
