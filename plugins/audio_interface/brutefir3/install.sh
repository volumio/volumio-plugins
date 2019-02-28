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
		sudo rm -Rf /data/configuration/audio_interface/brutefir
fi


sudo apt-get update
sudo apt-get -y install brutefir 
		cp /data/plugins/audio_interface/brutefir/brutefir.service.tar /
		cd /
		sudo tar -xvf brutefir.service.tar
		rm /brutefir.service.tar

echo "creating filters folder and copying demo filters"
mkdir -m 777 /data/INTERNAL/brutefirfilters
echo "copying demo flters"
sudo cp /data/plugins/audio_interface/brutefir/filters/* /data/INTERNAL/brutefirfilters/
rm -Rf /data/plugins/audio_interface/brutefir/filters
#required to end the plugin install
echo "plugininstallend"
