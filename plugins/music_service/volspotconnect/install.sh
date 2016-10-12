#!/bin/bash
echo "detecting cpu"
cpu=$(lscpu | awk 'FNR == 1 {print $2}')

if [ $cpu = "armv6l" ]
then
        echo "Cpu is Armv6l, downloading required package"
	wget http://repo.volumio.org/Volumio2/plugins/Volspotconnectchroot.tar.gz
	sudo tar xvf /tmp/Volspotconnectchroot.tar.gz -C /
	rm /tmp/Volspotconnectchroot.tar.gz
	
elif [ $cpu = "armv7l" ]
then
        echo "Cpu is Armv7l, downloading required package"
	wget http://repo.volumio.org/Volumio2/plugins/Volspotconnect.tar.gz
	sudo tar xvf /tmp/Volspotconnect.tar.gz -C /
	rm /tmp/Volspotconnect.tar.gz
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
		echo "volspotconnect.service already exists"
fi
echo "Installing spotify-connect-web dependencies"
sudo apt-get update
sudo apt-get -y install avahi-utils
#required to end the plugin install
echo "plugininstallend"
