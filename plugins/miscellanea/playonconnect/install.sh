#!/bin/bash
echo "Installing playonconnect dependencies"

echo "Checking if playonconnect services exist"
if [ ! -f "/etc/systemd/system/playonconnect.service" ];
	then
		echo "file playonconnect.service doesn't exist, creating"
		cp /data/plugins/system_controller/playonconnect/playonconnect.tar.gz /
		cd /
		sudo tar -xvf playonconnect.tar.gz
		rm /playonconnect.tar.gz
	else
		echo "playonconnect.service removing to install new version !"
		sudo rm /etc/systemd/system/playonconnect*
		cp /data/plugins/system_controller/playonconnect/playonconnect.tar.gz /
		cd /
		sudo tar -xvf playonconnect.tar.gz
		rm /playonconnect.tar.gz
fi

#required to end the plugin install
echo "plugininstallend"
