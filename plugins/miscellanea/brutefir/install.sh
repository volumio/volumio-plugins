#!/bin/bash

echo "Installing brutefir dependencies"
sudo apt-get update
sudo apt-get -y install brutefir
echo "Installing brutefir plugin"

sudo echo "snd_aloop" > /etc/modules

#requred to end the plugin install
echo "plugininstallend"
