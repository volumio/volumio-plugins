#!/bin/bash

echo "Installing fmxmtr Dependencies"
sudo apt-get update
# Install the required packages via apt-get

echo "Installing build-essentials"
sudo apt-get -y install build-essential --no-install-recommends

echo "Installing I2C-tools"
sudo apt-get -y install i2c-tools --no-install-recommends

echo "Installing base functionality for working with a Raspberry Pi from Node.js "
npm install raspi --no-install-recommends


# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

#requred to end the plugin install
echo "plugininstallend"
