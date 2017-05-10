#!/bin/bash

echo "Installing LIRC"
apt-get update
apt-get -y install lirc

#requred to end the plugin install
echo "plugininstallend"
