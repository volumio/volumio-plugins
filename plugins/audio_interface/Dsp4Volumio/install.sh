#!/bin/bash
LIB=/data/plugins/audio_interface/Dsp4Volumio
TARGET = $libasound_module_pcm_cdsp
opath=/data/INTERNAL/Dsp

echo "Installing/Parameq4Volumio dependencies"

echo "remove previous configuration"
if [ ! -f "/data/configuration/audio_interface/Dsp4Volumio/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm -Rf /data/configuration/audio_interface/Dsp4Volumio
fi

sudo apt-get update
sudo apt-get -y install drc

echo "creating filters folder and copying demo filters"

mkdir -m 777 $opath
mkdir -m 777 $opath/tools
mkdir -m 777 $opath/filters
mkdir -m 777 $opath/filter-sources
mkdir -m 777 $opath/target-curves
echo "copying demo flters"
cp $LIB/mpdignore $opath/.mpdignore
cp $LIB/readme.txt $opath/readme.txt
cp $LIB/filters/* $opath/filters/
p $LIB/target-curves/* $opath/target-curves/
cp $LIB/filter-sources/* $opath/filter-sources/
rm -Rf $LIB/filters
rm -Rf $LIB/VoBAFfilters
rm -Rf $LIB/target-curves
rm -Rf $LIB/filters-sources
		
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
sudo cp $LIB/c/hw_params_arm $LIB/hw_params
sudo chmod +x $LIB/hw_params
elif [ $cpu = "x86_64" ]
then
cd $LIB
wget https://github.com/HEnquist/camilladsp/releases/download/v0.4.2/camilladsp-linux-amd64.tar.gz
tar -xvf camilladsp-linux-amd64.tar.gz -C /tmp
sudo chown volumio camilladsp
sudo chgrp volumio camilladsp
sudo chmod +x camilladsp
mv /tmp/camilladsp $LIB/
rm /tmp/camilladsp-linux-armv7.tar.gz
sudo mv $LIB/x86_amd64/libasound_module_pcm_cdsp.so /usr/lib/x86_64-linux-gnu/alsa-lib/
sudo cp $LIB/c/hw_params_x86 $LIB/hw_params
sudo chmod +x $LIB/hw_params
else
    echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi

#required to end the plugin install
echo "plugininstallend"

