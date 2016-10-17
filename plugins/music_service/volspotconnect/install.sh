#!/bin/bash
echo "Installing spotify-connect-web dependencies"
#sudo apt-get update
#sudo apt-get -y install avahi-utils

echo "detecting cpu"
cpu=$(lscpu | awk 'FNR == 1 {print $2}')

if [ $cpu = "armv6l" ]
then
        echo "Cpu is Armv6l, downloading required package"
	wget http://repo.volumio.org/Volumio2/plugins/Volspotconnectchroot.tar.gz
	if [ $? -eq 0 ]
		then
			echo "extracting data"
			sudo tar -xf Volspotconnectchroot.tar.gz -C /
			rm Volspotconnectchroot.tar.gz
		else
			echo "Failed to download. Stopping installation now"
			exit -1
		fi	
	
elif [ $cpu = "armv7l" ]
then
        echo "Cpu is Armv7l, downloading required package"
	wget http://repo.volumio.org/Volumio2/plugins/Volspotconnect.tar.gz
		if [ $? -eq 0 ]
		then
			echo "extracting data"
			sudo tar -xf Volspotconnect.tar.gz -C /
			rm Volspotconnect.tar.gz
		else
			echo "Failed to download. Stopping installation now"
			exit -1
		fi
	
else
        echo "Sorry, your device is not yet supported !"
	echo "exit now..."
	exit -1
fi

echo "checking if volspotconnect service exists"
if [ ! -f "/etc/systemd/system/volspotconnect.service" ];
	then
		echo "file volspotconnect.service doesn't exist, creating"
		cp /data/plugins/music_service/volspotconnect/volspotconnect.service.gz /
		cd /
		sudo tar -xvf volspotconnect.service.gz
		rm /volspotconnect.service.gz
	else
		echo "volspotconnect.service already exists. Nothing to do !"
fi

#required to end the plugin install
echo "plugininstallend"
