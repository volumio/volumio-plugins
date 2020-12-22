#!/bin/bash

echo "Installing/Dsp4Volumio dependencies"
echo "unload Loopback module if exists"
sudo rmmod snd_aloop
echo "remove previous configuration"
if [ ! -f "/data/configuration/audio_interface/Dsp4Volumio/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm -Rf /data/configuration/audio_interface/Dsp4Volumio
fi

		cp /data/plugins/audio_interface/Dsp4Volumio/camilladsp.service.tar /
		cd /
		sudo tar -xvf camilladsp.service.tar
		rm /camilladsp.service.tar

echo "creating filters folder and copying demo filters"
mkdir -m 777 /data/INTERNAL/Dsp4Volumiofilters
mkdir -m 777 /data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters
mkdir -m 777 /data/INTERNAL/Dsp4Volumiofilters/filter-sources
mkdir -m 777 /data/INTERNAL/Dsp4Volumiofilters/target-curves
echo "copying demo flters"
sudo cp /data/plugins/audio_interface/Dsp4Volumio/filters/* /data/INTERNAL/Dsp4Volumiofilters/
sudo cp /data/plugins/audio_interface/Dsp4Volumio/VoBAFfilters/* /data/INTERNAL/Dsp4Volumiofilters/VoBAFfilters
sudo cp /data/plugins/audio_interface/Dsp4Volumio/target-curves/* /data/INTERNAL/Dsp4Volumiofilters/target-curves/
sudo cp /data/plugins/audio_interface/Dsp4Volumio/filter-sources/* /data/INTERNAL/Dsp4Volumiofilters/filter-sources/
rm -Rf /data/plugins/audio_interface/Dsp4Volumio/filters
echo "copying hw detection script"
# Find arch
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "Detected cpu architecture as $cpu"
if [ $cpu = "armv7l" ] || [ $cpu = "aarch64" ] || [ $cpu = "armv6l" ]
then
sudo cp /data/plugins/audio_interface/Dsp4Volumio/c/hw_params_arm /data/plugins/audio_interface/Dsp4Volumio/hw_params
sudo chmod +x /data/plugins/audio_interface/Dsp4Volumio/hw_params
elif [ $cpu = "x86_64" ] || [ $cpu = "i686" ]
then
sudo cp /data/plugins/audio_interface/Dsp4Volumio/c/hw_params_x86 /data/plugins/audio_interface/Dsp4Volumio/hw_params
sudo chmod +x /data/plugins/audio_interface/Dsp4Volumio/hw_params
else
        echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi

#required to end the plugin install
echo "plugininstallend"
