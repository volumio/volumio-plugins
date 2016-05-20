#!/bin/bash

echo "Installing "
echo "Installing unmutedigiamp"
echo "Installing WiringPi"
wget http://repo.volumio.org/Volumio2/Binaries/wiringpi_2.24_armhf.deb
sudo dpkg -i wiringpi_2.24_armhf.deb
rm /wiringpi_2.24_armhf.deb

echo "adding gpio group and permissions"
cd /
wget http://repo.volumio.org/Volumio2/Binaries/gpio-admin.tar.gz
sudo tar xvf gpio-admin.tar.gz
sudo rm /gpio-admin.tar.gz
sudo groupadd -f --system gpio
sudo chgrp gpio /usr/local/bin/gpio-admin
sudo chmod u=rwxs,g=rx,o= /usr/local/bin/gpio-admin

echo "adding volumio to gpio group"
sudo adduser volumio gpio 

#requred to end the plugin install
echo "plugininstallend"
