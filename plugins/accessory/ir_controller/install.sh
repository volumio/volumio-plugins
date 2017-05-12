#!/bin/bash

echo "Installing LIRC"
apt-get update
apt-get -y install lirc

echo "Creating lircrc file"
touch /etc/lirc/lircrc

#requred to end the plugin install
echo "plugininstallend"
