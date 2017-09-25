#!/bin/bash
echo "Installing spotify-connect-web dependencies"
libpath=/data/plugins/music_service/volspotconnect2
derrormess="Failed to download. Stopping installation now. Check your connection. Thanks your ISP, check DNS settings in Volumio as it may be the cause"
echo "Detecting cpu"
cpu=$(lscpu | awk 'FNR == 1 {print $2}')

if [ $cpu = "armv6l" ]
then
	cd $libpath
        echo "Cpu is $cpu, downloading required package."
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect2/arch/armhf/librespot-armhf.tar.xz
	if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf librespot-armhf.tar.xz # -C /
			rm librespot-armhf.tar.xz
		else
			echo "$derrormess"
			exit -1
		fi	
elif [ $cpu = "armv7l" ]
then
	cd $libpath
        echo "Cpu is $cpu, downloading required package."
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect2/arch/armhf/librespot-armhf.tar.xz
	if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf librespot-armhf.tar.xz #-C /
			rm librespot-armhf.tar.xz
		else
			echo "$derrormess"
			exit -1
		fi
elif [ $cpu = "aarch64" ]
then
	cd $libpath
        echo "Cpu is $cpu, downloading required package."
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect2/arch/armhf/librespot-armhf.tar.xz
	if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf librespot-armhf.tar.xz #-C $libpath
			rm librespot-armhf.tar.xz
		else
			echo "$derrormess"
			exit -1
		fi
elif [ $cpu = "i686" ]
then
	cd $libpath
        echo "Cpu is $cpu, downloading required package."
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect2/arch/x86/librespot-x86.tar.xz
	if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf librespot-x86.tar.xz #-C /
			rm librespot-x86.tar.xz
		else
			echo "$derrormess"
			exit -1
		fi
else
        echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi

#mkdir /dev/shm/volspotconnetc2/cache
#echo "Checking if volspotconnect2 service exists"
#if [ ! -f "/etc/systemd/system/volspotconnect2.service" ];
#	then
#		echo "file volspotconnect2.service doesn't exist, creating"
		cd /data/plugins/music_service/volspotconnect2/
#		cp /data/plugins/music_service/volspotconnect/volspotconnect.service.tar /
#		cd /
		sudo tar -xvf volspotconnect2.service.tar -C /
#		rm /volspotconnect2.service.tar
#	else
#		echo "volspotconnect2.service already exists. Nothing to do !"
#fi
sudo chmod +x /data/plugins/music_service/volspotconnect2/onstart1.sh
#required to end the plugin install
echo "plugininstallend"
