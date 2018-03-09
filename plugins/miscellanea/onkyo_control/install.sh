#!/bin/bash

echo "Installing onkyo control Dependencies"
sudo apt-get update
# Install the required packages via apt-get
sudo apt-get -y install

# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install


if [ ! -f "/data/configuration/miscellanea/onkyo_control/config.json" ];
	then
		echo "config file doesn't exist, creating it"
		sudo touch /data/configuration/miscellanea/onkyo_control/config.json
	else
		echo "config file exists, removing it"
		sudo rm /data/configuration/miscellanea/onkyo_control/config.json
fi


#requred to end the plugin install
echo "plugininstallend"
