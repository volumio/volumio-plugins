#!/bin/bash

echo "Installing volsimpleequal dependencies"
echo "unload Loopback module if exists"
sudo rmmod snd_aloop
echo "remove previous configuration"
if [ ! -f "/data/configuration/audio_interface/volsimpleequal/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm /data/configuration/audio_interface/volsimpleequal/config.json
fi
if [ ! -f "/home/volumio/.alsaequal.bin" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm /home/volumio/.alsaequal.bin
fi


sudo apt-get update
sudo apt-get -y install libasound2-plugin-equal 
echo "Checking if volsimpleequal services exist"
if [ ! -f "/etc/systemd/system/volsimpleequal.service" ];
	then
		echo "file volsimpleequal.service doesn't exist, creating"
		cp /data/plugins/audio_interface/volsimpleequal/volsimpleequal.tar.gz /
		cd /
		sudo tar -xvf volsimpleequal.tar.gz
		rm /volsimpleequal.tar.gz
	else
		echo "volsimpleequal.service removing to install new version !"
		sudo rm /etc/systemd/system/volsimpleequal.service
		cp /data/plugins/audio_interface/volsimpleequal/volsimpleequal.tar.gz /
		cd /
		sudo tar -xvf volsimpleequal.tar.gz
		rm /volsimpleequal.tar.gz
fi
sudo systemctl daemon-reload
#required to end the plugin install
echo "plugininstallend"
