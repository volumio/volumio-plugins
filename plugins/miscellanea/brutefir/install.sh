#!/bin/bash

echo "Installing brutefir dependencies"
sudo apt-get update
sudo apt-get -y install brutefir
echo "adding brutefir service"
# following is to create brutefir.service in user mode
# but can't launch it because can't connect to dbus in this mode
#we have to find a workaround to do this
mkdir /home/volumio/.config/systemd
mkdir /home/volumio/.config/systemd/user
cp /data/plugins/miscellanea/brutefir/brutefir.service /home/volumio/.config/systemd/user/
echo "Installing brutefir plugin"

#required to end the plugin install
echo "plugininstallend"
