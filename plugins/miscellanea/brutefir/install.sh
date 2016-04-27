#!/bin/bash

echo "Installing brutefir dependencies"
sudo apt-get update
sudo apt-get -y install brutefir
echo "Installing brutefir plugin"
cd / 
#wget http://repo.volumio.org/Packages/Brutefir/brutefirplug.tar.gz
#tar xf /brutefirplug.tar.gz
#rm /brutefirplug.tar.gz
echo "snd_aloop" > /etc/modules

echo "Done"
