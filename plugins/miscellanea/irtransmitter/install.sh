#!/bin/bash

echo "Installing LIRC"
apt-get update
apt-get -y install lirc

# Check why this is here? Is this needed?
#echo "Applying LIRC starting policy"
#systemctl disable lirc.service
#systemctl stop lirc.service

# Make dir for runtime var needed in shellscripts
mkdir -p /run/volumio/ir-tx
chown -hR volumio:volumio /run/volumio
# Write some init values into files
echo 0 > /run/volumio/ir-tx/mute
echo 5 > /run/volumio/ir-tx/volume

#required to end the plugin install
echo "plugininstallend"
