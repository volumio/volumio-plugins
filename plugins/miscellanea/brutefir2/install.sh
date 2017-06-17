#!/bin/bash

echo "Installing brutefir dependencies"
echo "unload Loopback module if exists"
sudo rmmod snd_aloop
if ! grep -q 'options snd_aloop index=7' "/etc/modprobe.d/alsa-base.conf";
	then
		echo "adding snd_aloop index=7 to /etc/modprobe.d/alsa-base.conf"
		echo 'options snd_aloop index=7' | tee --append /etc/modprobe.d/alsa-base.conf
	else
		echo "/etc/modprobe.d/alsa-base.conf already contains snd_aloop index=7, nothing to do..."
fi
if ! grep -q snd_aloop "/etc/modules";
	then
		echo "adding snd_aloop to /etc/module"
		echo 'snd_aloop' | tee --append /etc/modules
			else
		echo "/etc/modules already contains snd_aloop, nothing to do..."
fi
echo "re-loading snd-loop now"
echo "loading module now..."
		sudo modprobe snd_aloop
sudo apt-get update
sudo apt-get -y install brutefir bs2b-ladspa
#echo "checking if brutefir service exists"
#if [ ! -f "/etc/systemd/system/brutefir.service" ];
#	then
#		echo "file brutefir.service doesn't exist, creating"
		cp /data/plugins/miscellanea/brutefir/brutefir.service.tar /
		cd /
		sudo tar -xvf brutefir.service.tar
		rm /brutefir.service.tar
#	else
#		echo "File brutefir.service already exists"
 #fi

echo "creating filters folder and copying demo filters"
mkdir -m 777 /data/INTERNAL/brutefirfilters
echo "copying demo flters"
sudo cp /data/plugins/miscellanea/brutefir/filters/* /data/INTERNAL/brutefirfilters/

#required to end the plugin install
echo "plugininstallend"
