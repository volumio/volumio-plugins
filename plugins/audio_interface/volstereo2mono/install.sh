#!/bin/bash

echo "Installing volstereo2mono dependencies"
echo "unload Loopback module if exists"
sudo rmmod snd_aloop
#sudo apt-get update
#sudo apt-get -y install libasound2-plugin-equal 

echo "Checking if volstereo2mono services exist"
if [ ! -f "/etc/systemd/system/volstereo2mono.service" ];
	then
		echo "file volstereo2mono.service doesn't exist, creating"
		cp /data/plugins/audio_interface/volstereo2mono/volstereo2mono.tar.gz /
		cd /
		sudo tar -xvf volstereo2mono.tar.gz
		rm /volstereo2mono.tar.gz
	else
		echo "volstereo2monot.service removing to install new version !"
		sudo rm /etc/systemd/system/volstereo2mono.service
		cp /data/plugins/audio_interface/volstereo2mono/volstereo2mono.tar.gz /
		cd /
		sudo tar -xvf volstereo2mono.tar.gz
		rm /volstereo2mono.tar.gz
fi
sudo systemctl daemon-reload
#required to end the plugin install
echo "plugininstallend"
