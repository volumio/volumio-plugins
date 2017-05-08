#!/bin/bash

echo "Installing Spop Dependencies"
sudo apt-get update
sudo apt-get -y install libao-dev libglib2.0-dev libjson-glib-1.0-0 libjson-glib-dev libao-common libreadline-dev libsox-dev libsoup2.4-dev libsoup2.4-1 libdbus-glib-1-dev libnotify-dev --no-install-recommends



echo "Installing Spop and libspotify"

DPKG_ARCH=`dpkg --print-architecture`

echo $DPKG_ARCH
cd /tmp 
wget http://repo.volumio.org/Packages/Spop/spop-${DPKG_ARCH}.tar.gz
sudo tar xvf /tmp/spop-${DPKG_ARCH}.tar.gz -C /
rm /tmp/spop-${DPKG_ARCH}.tar.gz

ldconfig
sudo chmod 777 /etc/spopd.conf

#requred to end the plugin install
echo "plugininstallend"
