#!/bin/bash
echo "Installing spotify-connect-web dependencies"
libpath=/data/plugins/music_service/volspotconnect2

echo "Detecting cpu"
cpu=$(lscpu | awk 'FNR == 1 {print $2}')

if [ $cpu = "armv6l" ]
then
	cd $libpath
        echo "Cpu is $cpu, downloading required package."
	#wget http://repo.volumio.org/Volumio2/plugins/Volspotconnectchroot.tar.gz
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect2/arch/arm/librespot-arm.xz
	if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf librespot-arm.xz # -C /
			rm librespot-arm.xz
		else
			echo "Failed to download. Stopping installation now"
			exit -1
		fi	
elif [ $cpu = "armv7l" ]
then
	cd $libpath
        echo "Cpu is $cpu, downloading required package."
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect2/arch/armhf/librespot-armhf.xz
	if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf librespot-armhf.xz #-C /
			rm librespot-armhf.xz*
		else
			echo "Failed to download. Stopping installation now"
			exit -1
		fi
elif [ $cpu = "aarch64" ]
then
	cd $libpath
        echo "Cpu is $cpu, downloading required package."
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect2/arch/armhf/librespot-armhf.xz
	if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf librespot-armhf.xz #-C $libpath
			rm librespot-armhf.xz*
		else
			echo "Failed to download. Stopping installation now"
			exit -1
		fi
elif [ $cpu = "x86_64" ]
then
	cd $libpath
        echo "Cpu is $cpu, downloading required package."
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect2/arch/x86/librespot-x86.xz
	if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf librespot-x86.xz #-C /
			rm librespot-x86.xz*
		else
			echo "Failed to download. Stopping installation now"
			exit -1
		fi
elif [ $cpu = "i686" ]
then
	cd $libpath
        echo "Cpu is $cpu, downloading required package."
	wget https://github.com/balbuze/volumio-plugins/raw/master/plugins/music_service/volspotconnect2/arch/x86/librespot-x86.xz
	if [ $? -eq 0 ]
		then
			echo "Extracting data"
			sudo tar -xf librespot.xz #-C /
			rm librespot.xz*
		else
			echo "Failed to download. Stopping installation now"
			exit -1
		fi
else
        echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi

mkdir /dev/shm/volspotconnetc2/cache
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

#required to end the plugin install
echo "plugininstallend"
