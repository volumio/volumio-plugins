#!/bin/bash
echo "Installing wifireconnect dependencies"

echo "checking if wifireconnect files exists"
if [ ! -f "/usr/local/bin/wifireconnect.sh" ];
	then
		echo "wifireconnect.sh doesn't exist, creating"
		cp /data/plugins/miscellanea/wifireconnect.sh.gz /
		cd /
		sudo tar -xf wifireconnect.sh.gz
		rm /wifireconnect.sh.gz
	else
		echo "wifireconnect.sh already exists"

fi
sudo apt-get update
sudo apt-get install cron

#required to end the plugin install
echo "plugininstallend"
