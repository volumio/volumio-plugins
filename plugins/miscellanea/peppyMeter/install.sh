#!/bin/bash
peppymeterpath=/data/plugins/miscellanea/peppyMeter/peppymeter
spath=/data/plugins/miscellanea/peppyMeter

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

sudo apt-get -y install python3-pygame python3

echo "Installing peppyalsa plugin if needed"
if [ ! -f "/usr/local/lib/libpeppyalsa.so" ];
	then
		sudo apt-get -y install build-essential autoconf automake libtool libasound2-dev libfftw3-dev
		mkdir /tmp/peppyalsa
		git clone https://github.com/project-owner/peppyalsa.git /tmp/peppyalsa

		cd /tmp/peppyalsa
		aclocal && libtoolize
		autoconf && automake --add-missing
		./configure && make
		sudo make install && exit
    else
echo "peppyalsa already installed, nothing to do"
fi

#required to end the plugin install
echo "plugininstallend"
