#!/bin/bash

echo "Installing LIRC"
apt-get update
apt-get -y install lirc --no-install-recommends

echo "Copy hardware config for Raspberry Pi"
cp ./hardware.conf /etc/lirc/
cp ./lircd.conf /etc/lirc/


echo "Installing rules to make sure the device has a consistent name"
cp ./71-lirc.rules /etc/udev/rules.d

# Check why this is here? Is this needed?
#echo "Applying LIRC starting policy"
#systemctl disable lirc.service
#systemctl stop lirc.service

# The following did NOT work, as it seems to get deleted at restarts:
# So would have to do this everytime the plugin is started...
#
# Make dir for runtime var needed in shellscripts
#mkdir -p /run/volumio/ir-tx
#chown -hR volumio:volumio /run/volumio
# Write some init values into files
#echo 0 > /run/volumio/ir-tx/mute
#echo 5 > /run/volumio/ir-tx/volume

#required to end the plugin install
echo "plugininstallend"
