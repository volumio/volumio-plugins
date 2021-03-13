#!/bin/bash
LIB=/data/plugins/miscellanea/peppyMeter

echo "Installing peppyalsa plugin dependencies"
cp $LIB/peppy.service.tar /
		cd /
		sudo tar -xvf peppy.service.tar
		rm /peppy.service.tar

echo "cloning peppymeter repo"
git clone https://github.com/balbuze/PeppyMeter $LIB/peppymeter
chmod 777 -R $LIB/peppymeter
sudo chown volumio $LIB/peppymeter
sudo chgrp volumio $LIB/peppymeter

echo "installing apt packages"

sudo apt-get -y install python3-pygame python3



echo "Installing peppyalsa plugin if needed"
if [ ! -f "/usr/local/lib/libpeppyalsa.so" ];
	then
		
		echo "copying hw detection script"
		# Find arch
		cpu=$(lscpu | awk 'FNR == 1 {print $2}')
		echo "Detected cpu architecture as $cpu"
		if [ $cpu = "armv7l" ] || [ $cpu = "aarch64" ] || [ $cpu = "armv6l" ]
		then
		sudo mv $LIB/arm/libpeppyalsa.so.0.0.0 /usr/local/lib/
		cd /usr/local/lib/
        sudo ln -s -f libpeppyalsa.so.0.0.0 libpeppyalsa.so
		else
			echo "Sorry, cpu is $cpu and your device is not yet supported !"
			echo "exit now..."
			exit -1
		fi
				#sudo apt-get -y install build-essential autoconf automake libtool libasound2-dev libfftw3-dev
				#mkdir /tmp/peppyalsa
				#git clone https://github.com/project-owner/peppyalsa.git /tmp/peppyalsa

				#cd /tmp/peppyalsa
				#aclocal && libtoolize
				#autoconf && automake --add-missing
				#./configure && make
				#sudo make install && exit
			else
				echo "peppyalsa already installed, nothing to do"
fi

#required to end the plugin install
echo "plugininstallend"
