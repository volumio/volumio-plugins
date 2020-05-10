#!/bin/bash

echo "Installing LIRC"
sudo apt-get update
sudo apt-get -y install lirc --no-install-recommends

echo "Getting current path"
SCRIPT=`readlink -f "$0"`
# Absolute path this script is in
SCRIPTPATH=`dirname "$SCRIPT"`
echo $SCRIPTPATH

echo "Copy hardware config for Raspberry Pi"
sudo cp $SCRIPTPATH/misc/hardware.conf /etc/lirc/
echo "Make sure lircd.conf can be updated without sudo"
sudo touch /etc/lirc/lircd.conf
sudo chmod 666 /etc/lirc/lircd.conf

echo "Installing rules to make sure the device has a consistent name"
sudo cp $SCRIPTPATH/misc/71-lirc.rules /etc/udev/rules.d

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

echo "Make shell scripts executable"
chmod a+x /data/plugins/miscellanea/ir_blaster/scripts/*.sh

#required to end the plugin install
echo "plugininstallend"
