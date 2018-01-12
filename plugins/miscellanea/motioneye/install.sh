#!/bin/bash

echo "Installing motioneye Dependencies"
echo "Updating sources ..."
if ! grep -q "deb http://www.deb-multimedia.org jessie main non-free" /etc/apt/sources.list; then
    sudo echo "deb http://www.deb-multimedia.org jessie main non-free" >> /etc/apt/sources.list
fi

echo "apt-get update ..."
sudo  apt-get update
echo "Installing deb-multimedia-keyring ..."
sudo  apt-get --yes --force-yes install deb-multimedia-keyring
echo "apt-get update ..."
sudo apt-get update     # yes, again
echo "Installing motion ffmpeg v4l-utils ..."
sudo apt-get -y install motion ffmpeg v4l-utils
echo "Installing python-pip python-dev curl libssl-dev libcurl4-openssl-dev libjpeg-dev ..."
sudo apt-get -y install python-pip python-dev curl libssl-dev libcurl4-openssl-dev libjpeg-dev
echo "Installing motioneye ..."
sudo pip install motioneye
echo "Making motioneye directory in etc ..."
sudo mkdir -p /etc/motioneye
echo "Copying motioneye.conf ..."
sudo cp /usr/local/share/motioneye/extra/motioneye.conf.sample /etc/motioneye/motioneye.conf
echo "Making motioneye directory in var ..."
sudo mkdir -p /var/lib/motioneye
echo "Copying motioneye.systemd-unit-local ..."
sudo cp /usr/local/share/motioneye/extra/motioneye.systemd-unit-local /etc/systemd/system/motioneye.service
echo "Reloading systemctl ..."
sudo systemctl daemon-reload
sudo systemctl enable motioneye
# systemctl start motioneye






# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

#requred to end the plugin install
echo "plugininstallend"
