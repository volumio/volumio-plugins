#!/bin/bash

echo "Installing LIRC"
sudo apt-get update
sudo apt-get -y install lirc

echo "Applying LIRC starting policy"
sudo systemctl disable lirc.service
sudo systemctl stop lirc.service

echo "Creating lircrc file"
sudo touch /etc/lirc/lircrc
sudo chmod -R 777 /etc/lirc/*

#required to end the plugin install
echo "plugininstallend"
