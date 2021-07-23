#!/bin/bash

echo "Installing brutefir dependencies"
echo "unload Loopback module if exists"
sudo rmmod snd_aloop
echo "remove previous configuration"
if [ ! -f "/data/configuration/audio_interface/brutefir/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm /data/configuration/audio_interface/brutefir/config.json
fi


sudo apt-get update
sudo apt-get -y install brutefir #bs2b-ladspa
#echo "checking if brutefir service exists"
#if [ ! -f "/etc/systemd/system/brutefir.service" ];
#	then
#		echo "file brutefir.service doesn't exist, creating"
		cp /data/plugins/audio_interface/brutefir/brutefir.service.tar /
		cd /
		sudo tar -xvf brutefir.service.tar
		rm /brutefir.service.tar
#	else
#		echo "File brutefir.service already exists"
 #fi

echo "creating filters folder and copying demo filters"
mkdir -m 777 /data/INTERNAL/brutefirfilters
echo "copying demo flters"
sudo cp /data/plugins/audio_interface/brutefir/filters/* /data/INTERNAL/brutefirfilters/

#required to end the plugin install
echo "plugininstallend"
