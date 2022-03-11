#!/bin/bash
LIB=/data/plugins/audio_interface/fusiondsp
TARGET = $libasound_module_pcm_cdsp
opath=/data/INTERNAL/FusionDsp


echo "creating filters folder and copying demo filters"


mkdir -m 777 $opath
#mkdir -m 777 $opath/tools
mkdir -m 777 $opath/filters
mkdir -m 777 $opath/filter-sources
mkdir -m 777 $opath/target-curves
mkdir -m 777 $opath/peq
mkdir -m 777 $opath/tools
mkdir -m 777 $opath/hrtf-filters

chmod -R 777 $opath
chown -R volumio $opath
chgrp -R volumio $opath
echo "copying demo flters"
cp $LIB/*EQ.txt $opath/peq/
cp $LIB/mpdignore $opath/.mpdignore
cp $LIB/readme.txt $opath/readme.txt
cp $LIB/filters/* $opath/filters/
cp $LIB/target-curves/* $opath/target-curves/
cp $LIB/filter-sources/* $opath/filter-sources/
#cp -R $LIB/hrtf-filters/* $opath/hrtf-filters/
rm -Rf $LIB/filters
rm -Rf $LIB/target-curves
rm -Rf $LIB/filters-sources
#rm -Rf $LIB/hrtf-filters
		
echo "Installing/fusiondsp dependencies"
sudo apt update
sudo apt -y install python3-aiohttp python3-pip
#for future use.....
cd $LIB
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/audio_interface/FusionDsp/cgui.zip
#mv cgui.zip.ren cgui.zip
miniunzip cgui.zip
sudo chown -R volumio cgui
sudo chgrp -R volumio cgui

cd $LIB
git clone https://github.com/HEnquist/pycamilladsp
sudo chown -R volumio pycamilladsp
sudo chgrp -R volumio pycamilladsp

cd $LIB/pycamilladsp
echo "pycamilladsp pip3 install"
pip3 install .
cd $LIB
git clone https://github.com/HEnquist/pycamilladsp-plot
sudo chown -R volumio pycamilladsp-plot
sudo chgrp -R volumio pycamilladsp-plot

cd $LIB/pycamilladsp-plot
echo "pycamilladsp-plot pip3 install"

pip3 install .
cd $LIB

#echo "remove previous configuration"
#if [ ! -f "/data/configuration/audio_interface/fusiondsp/config.json" ];
#	then
#		echo "file doesn't exist, nothing to do"
#	else
#		echo "File exists removing it"
#		sudo rm -Rf /data/configuration/audio_interface/fusiondsp
#fi

		
echo "copying hw detection script"
# Find arch
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "Detected cpu architecture as $cpu"
if [ $cpu = "armv7l" ] || [ $cpu = "aarch64" ] 
then
cd /tmp
wget https://github.com/HEnquist/camilladsp/releases/download/v0.6.3/camilladsp-linux-armv7.tar.gz
tar -xvf camilladsp-linux-armv7.tar.gz -C /tmp
chown volumio camilladsp
chgrp volumio camilladsp
chmod +x camilladsp
mv /tmp/camilladsp $LIB/
rm /tmp/camilladsp-linux-armv7.tar.gz
sudo cp $LIB/c/hw_params_arm $LIB/hw_params
sudo chmod +x $LIB/hw_params

#sudo apt-get update
sudo apt-get -y install drc

elif [ $cpu = "x86_64" ]
then
cd /tmp
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/audio_interface/FusionDsp/bin/camilladsp-linux-amd64.tar.gz
tar -xvf camilladsp-linux-amd64.tar.gz -C /tmp
chown volumio camilladsp
chgrp volumio camilladsp
chmod +x camilladsp
mv /tmp/camilladsp $LIB/
rm /tmp/camilladsp-linux-amd64.tar.gz
cp $LIB/c/hw_params_amd64 $LIB/hw_params
chmod +x $LIB/hw_params

#sudo apt-get update
sudo apt-get -y install drc

elif [ $cpu = "armv6l" ]
then
cd /tmp
wget https://github.com/balbuze/volumio-plugins/raw/alsa_modular/plugins/audio_interface/FusionDsp/bin/camilladsp-linux-armv6l.tar.gz
tar -xvf camilladsp-linux-armv6l.tar.gz -C /tmp
chown volumio camilladsp
chgrp volumio camilladsp
chmod +x camilladsp
mv /tmp/camilladsp $LIB/
rm /tmp/camilladsp-linux-armv6l.tar.gz
cp $LIB/c/hw_params_armv6l $LIB/hw_params
chmod +x $LIB/hw_params
touch /data/plugins/audio_interface/fusiondsp/cpuarmv6l
else
    echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi

#required to end the plugin install
echo "plugininstallend"

