#!/bin/bash

echo "Installing volgrp dependencies"
echo "unload Loopback module if exists"
sudo rmmod snd_aloop
sudo apt-get update
sudo apt-get -y install libasound2-plugins
if [ ! -f "/data/configuration/audio_interface/volgrp/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm /data/configuration/audio_interface/volgrp/config.json
fi
echo "Checking if volgrp services exist"
if [ ! -f "/etc/systemd/system/volgrp.service" ];
	then
		echo "file volgrp.service doesn't exist, creating"
		cp /data/plugins/audio_interface/volgrp/volgrp.tar.gz /
		cd /
		sudo tar -xvf volgrp.tar.gz
		rm /volsimpleequal.tar.gz
	else
		echo "volgrp.service removing to install new version !"
		sudo rm /etc/systemd/system/volgrp.service
		cp /data/plugins/audio_interface/volgrp/volgrp.tar.gz /
		cd /
		sudo tar -xvf volgrp.tar.gz
		rm /volgrp.tar.gz
fi
sudo systemctl daemon-reload
#required to end the plugin install
echo "plugininstallend"
