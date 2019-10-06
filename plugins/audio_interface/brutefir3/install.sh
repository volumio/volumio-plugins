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
sudo apt-get -y install brutefir drc
		cp /data/plugins/audio_interface/brutefir/brutefir.service.tar /
		cd /
		sudo tar -xvf brutefir.service.tar
		rm /brutefir.service.tar

echo "creating filters folder and copying demo filters"
mkdir -m 777 /data/INTERNAL/brutefirfilters
mkdir -m 777 /data/INTERNAL/brutefirfilters/VoBAFfilters
mkdir -m 777 /data/INTERNAL/brutefirfilters/filter-sources
mkdir -m 777 /data/INTERNAL/brutefirfilters/target-curves
echo "copying demo flters"
sudo cp /data/plugins/audio_interface/brutefir/filters/* /data/INTERNAL/brutefirfilters/
sudo cp /data/plugins/audio_interface/brutefir/target-curves/* /data/INTERNAL/brutefirfilters/target-curves/
sudo cp /data/plugins/audio_interface/brutefir/filter-sources/* /data/INTERNAL/brutefirfilters/filter-sources/
rm -Rf /data/plugins/audio_interface/brutefir/filters
echo "copying hw detection script"
# Find arch
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "Detected cpu architecture as $cpu"
if [ $cpu = "arm7l" ] || [ $cpu = "aarch64" ] || [ $cpu = "armv61" ]
then
sudo cp /data/plugins/audio_interface/brutefir/c/hw_params_arm /data/plugins/audio_interface/brutefir/hw_params
sudo chmod +x /data/plugins/audio_interface/brutefir/hw_params
elif [ $cpu = "x86_64" ]
then
sudo cp /data/plugins/audio_interface/brutefir/c/hw_params_x86 /data/plugins/audio_interface/brutefir/hw_params
sudo chmod +x /data/plugins/audio_interface/brutefir/hw_params
else
        echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi

#required to end the plugin install
echo "plugininstallend"
