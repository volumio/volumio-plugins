#!/bin/bash
echo "Installing spotify-connect-web dependencies"
sudo apt-get update
sudo apt-get -y install avahi-utils

echo "Detecting cpu"
cpu=$(lscpu | awk 'FNR == 1 {print $2}')

if [ $cpu = "armv6l" ]
then
	SERVICE=volspotconnectchroot
        echo "Cpu is Armv6l, downloading required package. Be very patient, it could take up to 15min..."
	#wget http://repo.volumio.org/Volumio2/plugins/Volspotconnectchroot.tar.gz
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect/package/Volspotconnectchroot.tar.gz
	if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf Volspotconnectchroot.tar.gz -C /
			rm Volspotconnectchroot.tar.gz*
		else
			echo "Failed to download. Stopping installation now"
			exit -1
		fi	
	
elif [ $cpu = "armv7l" ]
then
	SERVICE=volspotconnect        
	echo "Cpu is Armv7l, downloading required package"
	#wget http://repo.volumio.org/Volumio2/plugins/Volspotconnect.tar.gz
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect/package/Volspotconnect.tar.gz
		if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf Volspotconnect.tar.gz -C /
			rm Volspotconnect.tar.gz*

		else
			echo "Failed to download. Stopping installation now"
			exit -1
		fi
	
else
        echo "Sorry, your device is not yet supported !"
	echo "exit now..."
	exit -1
fi

echo "Checking if volspotconnect service exists"
if [ ! -f "/etc/systemd/system/volspotconnect.service" ];
	then
		echo "file volspotconnect.service doesn't exist, creating"
		cp /data/plugins/music_service/volspotconnect/$SERVICE.service.tar /
		cd /
		sudo tar -xvf $SERVICE.service.tar
		rm /$SERVICE.service.tar
	else
		echo "volspotconnect.service already exists. Nothing to do !"
fi

#required to end the plugin install
echo "plugininstallend"
