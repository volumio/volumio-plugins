#!/bin/bash
echo "Installing music services shield Dependencies"

# Find arch
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "Detected cpu architecture as $cpu"
if [ $cpu = "armv7l" ] || [ $cpu = "aarch64" ] || [ $cpu = "armv6l" ]
then
sudo apt-get update
sudo apt-get -y install cpuset
sudo chmod +x /data/plugins/miscellanea/music_services_shield/moveprocess.sh
sudo chmod +x /data/plugins/miscellanea/music_services_shield/moveallprocesses.sh
sudo chmod +x /data/plugins/miscellanea/music_services_shield/usertaskstable.sh
sudo chmod +x /data/plugins/miscellanea/music_services_shield/builduiconfig.sh
sudo chmod +x /data/plugins/miscellanea/music_services_shield/setconfigparameter.sh
sudo chmod +x /data/plugins/miscellanea/music_services_shield/setrtpriority.sh
/data/plugins/miscellanea/music_services_shield/builduiconfig.sh
elif [ $cpu = "x86_64" ] || [ $cpu = "i686" ]
then
sudo apt-get update
sudo apt-get -y install cpuset
sudo chmod +x /data/plugins/miscellanea/music_services_shield/moveprocess.sh
sudo chmod +x /data/plugins/miscellanea/music_services_shield/moveallprocesses.sh
sudo chmod +x /data/plugins/miscellanea/music_services_shield/usertaskstable.sh
sudo chmod +x /data/plugins/miscellanea/music_services_shield/builduiconfig.sh
sudo chmod +x /data/plugins/miscellanea/music_services_shield/setconfigparameter.sh
sudo chmod +x /data/plugins/miscellanea/music_services_shield/setrtpriority.sh
/data/plugins/miscellanea/music_services_shield/builduiconfig.sh
else
        echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi


#required to end the plugin install
echo "plugininstallend"
