#!/bin/bash
echo "Installing spotify-connect-web dependencies"
sudo apt-get update
sudo apt-get -y install avahi-utils

echo "Detecting cpu"
cpu=$(lscpu | awk 'FNR == 1 {print $2}')

if [ $cpu = "armv6l" ]
then
	SERVICE=volspotconnectchroot
	cd /tmp
        echo "Cpu is Armv6l, downloading required package. Be patient, it could take up to 5min..."
	#wget http://repo.volumio.org/Volumio2/plugins/Volspotconnectchroot.tar.gz
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect/package/Volspotconnectchroot.tar.xz
	if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf Volspotconnectchroot.tar.xz -C /
			rm Volspotconnectchroot.tar.xz*
		else
			echo "Failed to download. Stopping installation now"
			exit -1
		fi	
	
elif [ $cpu = "armv7l" ]
then
	SERVICE=volspotconnect
	cd /tmp      
	echo "Cpu is Armv7l, downloading required package"
	#wget http://repo.volumio.org/Volumio2/plugins/Volspotconnect.tar.gz
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect/package/Volspotconnect.tar.xz
		if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf Volspotconnect.tar.xz -C /
			rm Volspotconnect.tar.xz*

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
		cd /data/plugins/music_service/volspotconnect/
#		cp /data/plugins/music_service/volspotconnect/$SERVICE.service.tar /
#		cd /
		sudo tar -xvf $SERVICE.service.tar -C /
#		rm /$SERVICE.service.tar
	else
		echo "volspotconnect.service already exists. Nothing to do !"
fi

#required to end the plugin install
echo "plugininstallend"
