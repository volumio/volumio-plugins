#!/bin/bash

echo "Installing volbinauralfilter dependencies"

sudo apt-get update
sudo apt-get -y install bs2b-ladspa 
if [ ! -f "/data/configuration/audio_interface/volbinauralfilter/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm /data/configuration/audio_interface/volbinauralfilter/config.json
fi

#required to end the plugin install
echo "plugininstallend"
