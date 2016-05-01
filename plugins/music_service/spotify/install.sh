#!/bin/bash

echo "Installing Spop Dependencies"
sudo apt-get update
sudo apt-get -y install libao-dev libglib2.0-dev libjson-glib-1.0-0 libjson-glib-dev libao-common libasound2-dev libreadline-dev libsox-dev libsoup2.4-dev libsoup2.4-1

echo "Installing Spop and libspotify"
cd / 
wget http://repo.volumio.org/Packages/Spop/spop.tar.gz
sudo tar xf /spop.tar.gz
rm /spop.tar.gz


sudo chmod 777 /etc/spopd.conf

#requred to end the plugin install
echo "plugininstallend"
