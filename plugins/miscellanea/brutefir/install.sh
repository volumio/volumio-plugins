#!/bin/bash

echo "Installing brutefir dependencies"
echo "adding snd_aloop to /etc/module"
echo 'snd_aloop' | sudo tee --append /etc/modules
echo "loading snd_aloop module"
sudo apt-get update
sudo apt-get -y install brutefir
echo "adding brutefir service"
sudo cp brutefir.service /lib/systemd/system/brutefir.service
echo "enabling brutefir service at startup"
sudo systemctl enable brutefir.service
echo "Installing brutefir plugin"
#requred to end the plugin install
echo "plugininstallend"
