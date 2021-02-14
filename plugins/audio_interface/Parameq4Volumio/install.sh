#!/bin/bash
LIB=/data/plugins/audio_interface/Parameq4Volumio
TARGET = $libasound_module_pcm_cdsp

echo "Installing/Parameq4Volumio dependencies"

echo "remove previous configuration"
if [ ! -f "/data/configuration/audio_interface/Parameq4Volumio/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm -Rf /data/configuration/audio_interface/Parameq4Volumio
fi

		
echo "copying hw detection script"
# Find arch
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "Detected cpu architecture as $cpu"
if [ $cpu = "armv7l" ] || [ $cpu = "aarch64" ] || [ $cpu = "armv6l" ]
then
cd /tmp
wget https://github.com/HEnquist/camilladsp/releases/download/v0.4.2/camilladsp-linux-armv7.tar.gz
tar -xvf camilladsp-linux-armv7.tar.gz -C /tmp
sudo chown volumio camilladsp
sudo chgrp volumio camilladsp
sudo chmod +x camilladsp
mv /tmp/camilladsp $LIB/
rm /tmp/camilladsp-linux-armv7.tar.gz
sudo mv $LIB/arm/libasound_module_pcm_cdsp.so /usr/lib/arm-linux-gnueabihf/alsa-lib/

elif [ $cpu = "x86_64" ] || [ $cpu = "i686" ]
then
cd $LIB
wget https://github.com/HEnquist/camilladsp/releases/download/v0.4.2/camilladsp-linux-amd64.tar.gz
tar -xvf camilladsp-linux-amd64.tar.gz
sudo chmod +x camilladsp
rm camilladsp-linux-armv7.tar.gz

else
    echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi

#required to end the plugin install
echo "plugininstallend"

