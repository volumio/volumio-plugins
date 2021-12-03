#!/bin/bash
echo "Installing music services shield Dependencies"

libpath=/data/plugins/miscellanea/music_services_shield
configpath=/data/configuration/miscellanea/music_services_shield

## Removing previous config
if [ -f "${configpath}/config.json" ]; then
  echo "Cleaning old config file"
  sudo rm ${configpath}/config.json
fi

# Find arch
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "Detected cpu architecture as $cpu"
if [ $cpu = "armv7l" ] || [ $cpu = "aarch64" ] || [ $cpu = "armv6l" ]
then
sudo apt-get update
sudo apt-get -y install cpuset
sudo chmod +x ${libpath}/moveprocess.sh
sudo chmod +x ${libpath}/moveallprocesses.sh
sudo chmod +x ${libpath}/usertaskstable.sh
sudo chmod +x ${libpath}/builduiconfig.sh
sudo chmod +x ${libpath}/setconfigparameter.sh
sudo chmod +x ${libpath}/setrtpriority.sh
sudo chmod +x ${libpath}/addservice.sh
sudo chmod +x ${libpath}/removeservice.sh
${libpath}/builduiconfig.sh
sudo ${libpath}/addservice.sh
elif [ $cpu = "x86_64" ] || [ $cpu = "i686" ]
then
sudo apt-get update
sudo apt-get -y install cpuset
sudo chmod +x ${libpath}/moveprocess.sh
sudo chmod +x ${libpath}/moveallprocesses.sh
sudo chmod +x ${libpath}/usertaskstable.sh
sudo chmod +x ${libpath}/builduiconfig.sh
sudo chmod +x ${libpath}/setconfigparameter.sh
sudo chmod +x ${libpath}/setrtpriority.sh
sudo chmod +x ${libpath}/addservice.sh
sudo chmod +x ${libpath}/removeservice.sh
${libpath}/builduiconfig.sh
sudo ${libpath}/addservice.sh
else
        echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi


#required to end the plugin install
echo "plugininstallend"
