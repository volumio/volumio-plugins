#!/bin/bash

echo "Installing volsimpleequal dependencies"

echo "remove previous configuration"
if [ ! -f "/data/configuration/audio_interface/volsimpleequal10/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm /data/configuration/audio_interface/volsimpleequal10/config.json
fi

if [ ! -f "/data/configuration/audio_interface/volsimpleequal10/.alsaequal.bin" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm /data/configuration/audio_interface/volsimpleequal10/.alsaequal.bin
fi


sudo apt-get update
sudo apt-get -y install libasound2-plugin-equal

#required to end the plugin install
echo "plugininstallend"
