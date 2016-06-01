#!/bin/bash
echo 'snd_aloop' | sudo tee --append /etc/modules > /dev/null
echo "Installing brutefir dependencies"
sudo apt-get update
sudo apt-get -y install brutefir
echo "Installing brutefir plugin"

#requred to end the plugin install
echo "plugininstallend"
