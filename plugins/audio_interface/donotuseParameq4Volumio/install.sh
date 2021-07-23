#!/bin/bash
LIB=/data/plugins/audio_interface/parameq4volumio
TARGET = $libasound_module_pcm_cdsp

mkdir /data/INTERNAL/parameq4volumio
cp /data/plugins/audio_interface/parameq4volumio/*EQ.txt /data/INTERNAL/parameq4volumio/

#cd $LIB
#mv cgui.zip.ren cgui.zip
#miniunzip cgui.zip
#sudo chown -R volumio cgui
#sudo chgrp -R volumio cgui
#
#
#echo "Installing/parameq4volumio dependencies"
#sudo apt update
#sudo apt -y install python3-aiohttp python3-pip
#
#cd $LIB
#git clone https://github.com/HEnquist/pycamilladsp
#sudo chown -R volumio pycamilladsp
#sudo chgrp -R volumio pycamilladsp
#
#cd $LIB/pycamilladsp
#pip3 install .
#cd $LIB
#git clone https://github.com/HEnquist/pycamilladsp-plot
#sudo chown -R volumio pycamilladsp-plot
#sudo chgrp -R volumio pycamilladsp-plot
#
#cd $LIB/pycamilladsp-plot
#pip3 install .
cd $LIB


echo "remove previous configuration"
if [ ! -f "/data/configuration/audio_interface/parameq4volumio/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm -Rf /data/configuration/audio_interface/parameq4volumio
fi


echo "remove previous configuration"
if [ ! -f "/data/configuration/audio_interface/parameq4volumio/config.json" ];
	then
		echo "file doesn't exist, nothing to do"
	else
		echo "File exists removing it"
		sudo rm -Rf /data/configuration/audio_interface/parameq4volumio
fi

		
echo "copying hw detection script"
# Find arch
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "Detected cpu architecture as $cpu"
if [ $cpu = "armv7l" ] #|| [ $cpu = "aarch64" ] || [ $cpu = "armv6l" ]
then
cd /tmp
wget https://github.com/HEnquist/camilladsp/releases/download/v0.5.1/camilladsp-linux-armv7.tar.gz
#wget https://github.com/HEnquist/camilladsp/releases/download/v0.5.0-s24test/camilladsp-linux-armv7.tar.gz
tar -xvf camilladsp-linux-armv7.tar.gz -C /tmp
sudo chown volumio camilladsp
sudo chgrp volumio camilladsp
sudo chmod +x camilladsp
mv /tmp/camilladsp $LIB/
rm /tmp/camilladsp-linux-armv7.tar.gz
sudo mv $LIB/arm/libasound_module_pcm_cdsp.so /usr/lib/arm-linux-gnueabihf/alsa-lib/

elif [ $cpu = "x86_64" ]
then
cd $LIB
wget https://github.com/HEnquist/camilladsp/releases/download/v0.5.1/camilladsp-linux-amd64.tar.gz
#wget https://github.com/HEnquist/camilladsp/releases/download/v0.5.0-s24test/camilladsp-linux-amd64.tar.gz
tar -xvf camilladsp-linux-amd64.tar.gz -C /tmp
sudo chown volumio camilladsp
sudo chgrp volumio camilladsp
sudo chmod +x camilladsp
mv /tmp/camilladsp $LIB/
rm /tmp/camilladsp-linux-armv7.tar.gz
sudo mv $LIB/x86_amd64/libasound_module_pcm_cdsp.so /usr/lib/x86_64-linux-gnu/alsa-lib/

else
    echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi

#required to end the plugin install
echo "plugininstallend"

