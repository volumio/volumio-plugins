#!/bin/bash

echo "Installing nanosound cd Dependencies"
echo "NanoSound CD takes around 15 minutes to install. Please be patient."
sudo apt-get update
# Install the required packages via apt-get
#sudo apt-get -y install

echo "Installing Flask"
sudo apt-get -y remove python-pip
sudo apt-get -y install python-setuptools python-dev
sudo easy_install pip
sudo pip install Flask
sudo pip install flask_table
sudo pip install flask_cors

echo "Installing memcache"
sudo apt-get -y install memcached
sudo pip install pymemcache

echo "Installing VLC"
sudo apt-get -y install vlc
sudo pip install python-vlc

echo "Installing Eject"
sudo apt-get -y install eject

echo "Installing Audio Libraries"

sudo apt-get -y install libasound2-plugins

cd /home/volumio/
git clone https://github.com/nanomesher/python-audio-tools.git
sudo apt-get -y install build-essential libcdio-dev  libcdio-paranoia-dev
cd python-audio-tools
sudo make install

echo "Installing NanoSound CD Service"


echo "Detecting cpu"
cpu=$(lscpu | awk 'FNR == 1 {print $2}')
echo "cpu: " $cpu

cd /tmp
if [ $cpu = "i686" ] || [ $cpu = "x86_64" ]; then
		wget https://github.com/nanomesher/nanomesher_nanosoundcd_dist/raw/master/packages/nanomesher_nanosoundcd_x86.tar.gz
		sudo tar xvf /tmp/nanomesher_nanosoundcd_x86.tar.gz -C /home/volumio/
else
		wget https://github.com/nanomesher/nanomesher_nanosoundcd_dist/raw/master/packages/nanomesher_nanosoundcd.tar.gz
		sudo tar xvf /tmp/nanomesher_nanosoundcd.tar.gz -C /home/volumio/
fi

cd /home/volumio/nanomesher_nanosoundcd
sudo chmod 777 nanosoundcd_progressweb
sudo chmod 777 nanosoundcd_web

if [ $cpu = "i686" ] || [ $cpu = "x86_64" ]; then
		rm /tmp/nanomesher_nanosoundcd_x86.tar.gz
else
		rm /tmp/nanomesher_nanosoundcd.tar.gz		
fi



echo "Configuring alsa devices"
cd /tmp
wget https://github.com/nanomesher/nanomesher_nanosoundcd_dist/raw/master/packages/nanomesher_nanosoundcd_asound.tar.gz
sudo tar xvf /tmp/nanomesher_nanosoundcd_asound.tar.gz -C /etc/
rm /tmp/nanomesher_nanosoundcd_asound.tar.gz


echo "Configuring NanoSound CD Service to autostart"
cd /tmp
wget https://github.com/nanomesher/nanomesher_nanosoundcd_dist/raw/master/packages/nanomesher_nanosoundcd_services.tar.gz
sudo tar xvf /tmp/nanomesher_nanosoundcd_services.tar.gz -C /lib/systemd/system/
rm /tmp/nanomesher_nanosoundcd_services.tar.gz

sudo /bin/systemctl daemon-reload
sudo /bin/systemctl enable nanosoundcd_web
sudo /bin/systemctl enable nanosoundcd_progressweb

sudo /bin/systemctl start nanosoundcd_web
sudo /bin/systemctl start nanosoundcd_progressweb

echo "NanoSound CD installation is completed. Please reboot"

# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

#requred to end the plugin install
echo "plugininstallend"
