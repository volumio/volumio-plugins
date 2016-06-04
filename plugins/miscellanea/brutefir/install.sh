#!/bin/bash

echo "Installing brutefir dependencies"
sudo apt-get update
sudo apt-get -y install brutefir
echo "adding brutefir service"
mkdir /home/volumio/.config/systemd
mkdir /home/volumio/.config/systemd/user
cp /data/plugins/miscellanea/brutefir/brutefir.service /home/volumio/.config/systemd/user/
echo "Installing brutefir plugin"
#requred to end the plugin install
echo "plugininstallend"
