#!/bin/bash

echo "Installing brutefir dependencies"
echo "adding snd_aloop to /etc/module"
echo 'snd_aloop' | sudo tee --append /etc/modules
echo "loading snd_aloop module"
sudo apt-get update
sudo apt-get -y install brutefir
echo "adding brutefir service"
cp brutefir.service.gz /
sudo tar xvf brutefir.service.gz
rm /brutefir.service.gz
echo "Installing brutefir plugin"

#required to end the plugin install
echo "plugininstallend"
