#!/bin/bash

echo "Installing brutefir dependencies"
sudo apt-get update
sudo apt-get -y install brutefir
echo "adding snd_aloop to /etc/module"
echo 'snd_aloop' | tee --append /etc/modules
echo 'trying to load snd_aloop module'
sudo modprobe snd_aloop
echo "adding brutefir service"
cp /data/plugins/miscellanea/brutefir/brutefir.service.gz /
sudo tar -xvf brutefir.service.gz
rm /brutefir.service.gz

#required to end the plugin install
echo "plugininstallend"
