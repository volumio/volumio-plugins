#!/bin/bash
echo "Installing systeminfo"

configpath=/data/configuration/miscellanea/Systeminfo

## Removing previous config
if [ ! -f "${configpath}/config.json" ];
then
  echo "Configuration file doesn't exist, nothing to do"
else
  echo "Configuration File exists removing it"
  sudo rm ${configpath}/config.json
fi



# Find arch
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "Detected cpu architecture as $cpu"
if [ $cpu = "armv7l" ] || [ $cpu = "aarch64" ] || [ $cpu = "armv6l" ]
then
sudo cp /data/plugins/miscellanea/Systeminfo/c/hw_params_arm /data/plugins/miscellanea/Systeminfo/hw_params
sudo chmod +x /data/plugins/miscellanea/Systeminfo/hw_params
sudo chmod +x /data/plugins/miscellanea/Systeminfo/firmware.sh
elif [ $cpu = "x86_64" ] || [ $cpu = "i686" ]
then
sudo cp /data/plugins/miscellanea/Systeminfo/c/hw_params_x86 /data/plugins/miscellanea/Systeminfo/hw_params
sudo chmod +x /data/plugins/miscellanea/Systeminfo/hw_params
sudo chmod +x /data/plugins/miscellanea/Systeminfo/firmware.sh
else
        echo "Sorry, cpu is $cpu and your device is not yet supported !"
	echo "exit now..."
	exit -1
fi


#required to end the plugin install
echo "plugininstallend"
