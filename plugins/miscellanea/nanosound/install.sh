#!/bin/bash

echo "Installing nanosound Dependencies"
sudo apt-get update
# Install the required packages via apt-get

#START OF LIRC
sudo apt-get -y install lirc
echo "Applying LIRC starting policy"
systemctl disable lirc.service
systemctl stop lirc.service

echo "Creating lircrc file"
touch /etc/lirc/lircrc
#END OF LIRC

#START OF python devs
sudo apt-get -y install python-dev python-pip libfreetype6-dev libjpeg-dev
sudo pip install -U pip
sudo -H pip install --upgrade luma.oled
sudo -H pip install --upgrade python-mpd2

#Install OLED service
cd /tmp
wget https://github.com/nanomesher/volumio-plugins/raw/master/nanosound_oled_service.tar.gz
sudo tar xvf /tmp/nanosound_oled_service.tar.gz -C /lib/systemd/system/
rm /tmp/nanosound_oled_service.tar.gz



cd /tmp
wget https://github.com/nanomesher/volumio-plugins/raw/master/nanosound_oled.tar.gz
sudo tar xvf /tmp/nanosound_oled.tar.gz -C /home/volumio
cd /home/volumio/nanosound_oled
sudo chmod 777 nanodac_oled.py
rm /tmp/nanosound_oled.tar.gz

sudo /bin/systemctl daemon-reload
sudo /bin/systemctl enable nanosound_oled

# install LIRC config



# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

#requred to end the plugin install
echo "plugininstallend"
