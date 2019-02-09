#!/bin/bash

echo "Installing nanosound cd Dependencies"
sudo apt-get update
# Install the required packages via apt-get
#sudo apt-get -y install

echo "Installing Flask"
sudo apt-get remove python-pip
sudo easy_install pip
sudo pip install Flask
sudo pip install flask_table
sudo pip install flask_cors

echo "Installing memcache"
sudo apt-get install Memcached
sudo pip install pymemcache

echo "Installing VLC"
sudo apt-get update
sudo apt-get install vlc
sudo pip install python-vlc


echo "Installing Audio Libraries"

sudo apt-get install libasound2-plugins

cd /home/volumio/
git clone https://github.com/nanomesher/python-audio-tools.git
sudo apt-get install libcdio-dev  libcdio-paranoia-dev
cd python-audio-tools
sudo make install

echo "Installing NanoSound CD Service"
cd /tmp
wget https://github.com/nanomesher/nanomesher_nanosoundcd_dist/raw/master/packages/nanomesher_nanosoundcd.tar.gz
sudo tar xvf /tmp/nanomesher_nanosoundcd.tar.gz -C /home/volumio
cd /home/volumio/nanomesher_nanosoundcd
sudo chmod 777 nanosoundcd_progressweb
sudo chmod 777 nanosoundcd_web

sudo cp asound/asound.conf /etc


rm /tmp/nanomesher_nanosoundcd.tar.gz


echo "Configuring NanoSound CD Service to autostart"
cd /tmp
wget https://github.com/nanomesher/nanomesher_nanosoundcd_dist/raw/master/packages/nanomesher_nanosoundcd_services.tar.gz
sudo tar xvf /tmp/nanomesher_nanosoundcd_services.tar.gz -C /lib/systemd/system/
rm /tmp/nanomesher_nanosoundcd_services.tar.gz

sudo /bin/systemctl daemon-reload
sudo /bin/systemctl enable nanosoundcd_web
sudo /bin/systemctl enable nanosoundcd_progressweb



# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

#requred to end the plugin install
echo "plugininstallend"
