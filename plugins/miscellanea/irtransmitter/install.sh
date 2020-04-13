#!/bin/bash

echo "Installing LIRC"
apt-get update
apt-get -y install lirc

# Check why this is here? Is this needed?
#echo "Applying LIRC starting policy"
#systemctl disable lirc.service
#systemctl stop lirc.service

#required to end the plugin install
echo "plugininstallend"
