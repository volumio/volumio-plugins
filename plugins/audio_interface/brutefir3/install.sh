#!/bin/bash

spath=/data/plugins/audio_interface/brutefir
opath=/data/INTERNAL/Dsp

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
		cp $spath/brutefir.service.tar /
		cd /
		sudo tar -xvf brutefir.service.tar
		rm /brutefir.service.tar

echo "creating filters folder and copying demo filters"

mkdir -m 777 $opath
mkdir -m 777 $opath/tools
mkdir -m 777 $opath/filters
mkdir -m 777 $opath/VoBAFfilters
mkdir -m 777 $opath/filter-sources
mkdir -m 777 $opath/target-curves
echo "copying demo flters"
cp $spath/mpdignore $opath/.mpdignore
cp $spath/filters/* $opath/filters/
cp $spath/VoBAFfilters/* $opath/VoBAFfilters
cp $spath/target-curves/* $opath/target-curves/
cp $spath/filter-sources/* $opath/filter-sources/
rm -Rf $spath/filters
rm -Rf $spath/VoBAFfilters
rm -Rf $spath/target-curves
rm -Rf $spath/filters-sources


echo "copying hw detection script"
# Find arch
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "Detected cpu architecture as $cpu"
if [ $cpu = "armv7l" ] || [ $cpu = "aarch64" ] || [ $cpu = "armv6l" ]
then
sudo cp $spath/c/hw_params_arm $spath/hw_params
sudo chmod +x $spath/hw_params
elif [ $cpu = "x86_64" ] || [ $cpu = "i686" ]
then
sudo cp $spath/c/hw_params_x86 $spath/hw_params
sudo chmod +x $spath/hw_params
else
        echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi

#required to end the plugin install
echo "plugininstallend"
