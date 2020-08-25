#!/bin/bash

echo "Installing volsimpleequal dependencies"

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
sudo apt-get -y install swh-plugins# libasound2-plugin-equal 

#required to end the plugin install
echo "plugininstallend"
