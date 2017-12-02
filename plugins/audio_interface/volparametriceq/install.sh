#!/bin/bash

echo "Installing volparametriceq dependencies"
echo "unload Loopback module if exists"
sudo rmmod snd_aloop
#sudo apt-get update
#sudo apt-get -y install caps
sudo cp /data/plugins/audio_interface/volparametriceq/caps.tar /
cd /
sudo tar xvf caps.tar
sudo rm /caps.tar
if [ ! -f "/data/configuration/audio_interface/volparametriceq/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm /data/configuration/audio_interface/volparametriceq/config.json
fi
echo "Checking if volparametriceq services exist"
if [ ! -f "/etc/systemd/system/volparametriceq.service" ];
	then
		echo "file volparametriceq.service doesn't exist, creating"
		cp /data/plugins/audio_interface/volparametriceq/volparametriceq.tar.gz /
		cd /
		sudo tar -xvf volparametriceq.tar.gz
		rm /volsimpleequal.tar.gz
	else
		echo "volparametriceq.service removing to install new version !"
		sudo rm /etc/systemd/system/volparametriceq.service
		cp /data/plugins/audio_interface/volparametriceq/volparametriceq.tar.gz /
		cd /
		sudo tar -xvf volparametriceq.tar.gz
		rm /volparametriceq.tar.gz
fi
sudo systemctl daemon-reload
#required to end the plugin install
echo "plugininstallend"
