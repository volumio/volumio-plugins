#!/bin/bash
peppymeterpath=/data/plugins/audio_interface/peppyalsapipe/peppymeter

echo "Installing peppyalsa plugin dependencies"
#sudo cp /data/plugins/audio_interface/peppyalsapipe/libpeppyalsa.so /usr/local/lib/

echo "cloning peppymeter repo"
git clone https://github.com/balbuze/PeppyMeter $peppymeterpath

echo "installing apt packages"
sudo apt-get install python3-pygame
sudo apt-get install build-essential autoconf automake libtool libasound2-dev libfftw3-dev

echo "Installing peppyalsa plugin"
mkdir /tmp/peppyalsa
git clone https://github.com/project-owner/peppyalsa.git /tmp/peppyalsa
cd /tmp/peppyalsa
aclocal && libtoolize
autoconf && automake --add-missing
./configure && make
sudo make install


#required to end the plugin install
echo "plugininstallend"
