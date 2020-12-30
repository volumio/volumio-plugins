#!/bin/bash
peppymeterpath=/data/plugins/audio_interface/peppyMeter/peppymeter
spath=/data/plugins/audio_interface/peppyMeter

echo "Installing peppyalsa plugin dependencies"
cp $spath/peppy.service.tar /
		cd /
		sudo tar -xvf peppy.service.tar
		rm /peppy.service.tar

echo "cloning peppymeter repo"
git clone https://github.com/balbuze/PeppyMeter $peppymeterpath
chmod 777 -R $peppymeterpath
sudo chown volumio $peppymeterpath
sudo chgrp volumio $peppymeterpath

echo "installing apt packages"

sudo apt-get install python3-pygame python3
sudo apt-get install build-essential autoconf automake libtool libasound2-dev libfftw3-dev

echo "Installing peppyalsa plugin"
mkdir /tmp/peppyalsa
git clone https://github.com/project-owner/peppyalsa.git /tmp/peppyalsa

cd /tmp/peppyalsa
aclocal && libtoolize
autoconf && automake --add-missing
./configure && make
sudo make install && exit


#required to end the plugin install
echo "plugininstallend"
