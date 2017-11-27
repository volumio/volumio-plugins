#!/bin/bash

echo "Installing volbinauralfilter dependencies"
echo "unload Loopback module if exists"
sudo rmmod snd_aloop
sudo apt-get update
sudo apt-get -y install bs2b-ladspa 
if [ ! -f "/data/configuration/audio_interface/volbinauralfilter/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm /data/configuration/audio_interface/volbinauralfilter/config.json
fi
echo "Checking if volbinauralfilter services exist"
if [ ! -f "/etc/systemd/system/volbinauralfilter.service" ];
	then
		echo "file volbinauralfilter.service doesn't exist, creating"
		cp /data/plugins/audio_interface/volbinauralfilter/volbinauralfilter.tar.gz /
		cd /
		sudo tar -xvf volbinauralfilter.tar.gz
		rm /volsimpleequal.tar.gz
	else
		echo "volbinauralfilter.service removing to install new version !"
		sudo rm /etc/systemd/system/volbinauralfilter.service
		cp /data/plugins/audio_interface/volbinauralfilter/volbinauralfilter.tar.gz /
		cd /
		sudo tar -xvf volbinauralfilter.tar.gz
		rm /volbinauralfilter.tar.gz
fi
sudo systemctl daemon-reload
#required to end the plugin install
echo "plugininstallend"
