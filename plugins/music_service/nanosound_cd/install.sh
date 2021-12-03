#!/bin/bash

echo "Installing nanosound cd Dependencies"
echo "NanoSound CD takes around 15 minutes to install. Please be patient."

HW=$(awk '/VOLUMIO_HARDWARE=/' /etc/*-release | sed 's/VOLUMIO_HARDWARE=//' | sed 's/\"//g')	

if [ "$HW" = "tinkerboard" ];	
then	
   echo "Sorry, Tinkerboard is not supported via repository. Please visit https://nanomesher.com/nanosound-cd-support/ for more detail"	
   echo "plugininstallend"	
fi



sudo apt-get update
# Install the required packages via apt-get
#sudo apt-get -y install

echo "Installing Flask"

cd /home/volumio
#curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
#sudo python get-pip.py

sudo apt-get -y install python-setuptools python-pip python-dev
sudo -H pip install --upgrade pip==20.3.4
sudo pip install Flask==1.1.2
sudo pip install flask_table
sudo pip install flask_cors

echo "Installing memcache"
sudo apt-get -y install memcached
sudo pip install pymemcache==3.4.1

echo "Installing VLC"
sudo apt-get -y install vlc
sudo pip install python-vlc==3.0.11115

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


if [ ! -d "/data/nanosound_cd" ] 
then
    mkdir /data/nanosound_cd
fi

cd /data/nanosound_cd
if [ $cpu = "i686" ] || [ $cpu = "x86_64" ]; then
		wget https://github.com/nanomesher/nanomesher_nanosoundcd_dist/raw/master/packages/nanomesher_nanosoundcd_x86.tar.gz
		sudo tar xvf /data/nanosound_cd/nanomesher_nanosoundcd_x86.tar.gz -C /home/volumio/
else
		wget https://github.com/nanomesher/nanomesher_nanosoundcd_dist/raw/master/packages/nanomesher_nanosoundcd.tar.gz
		sudo tar xvf /data/nanosound_cd/nanomesher_nanosoundcd.tar.gz -C /home/volumio/
fi

cd /home/volumio/nanomesher_nanosoundcd
sudo chmod 777 nanosoundcd_progressweb
sudo chmod 777 nanosoundcd_web

if [ $cpu = "i686" ] || [ $cpu = "x86_64" ]; then
		rm /data/nanosound_cd/nanomesher_nanosoundcd_x86.tar.gz
else
		rm /data/nanosound_cd/nanomesher_nanosoundcd.tar.gz		
fi



echo "Configuring alsa devices"
cd /data/nanosound_cd
wget https://github.com/nanomesher/nanomesher_nanosoundcd_dist/raw/master/packages/nanomesher_nanosoundcd_asound.tar.gz
sudo tar xvf /data/nanosound_cd/nanomesher_nanosoundcd_asound.tar.gz -C /data/nanosound_cd
echo "</data/nanosound_cd/asound.conf>" | sudo tee -a /etc/asound.conf
rm /data/nanosound_cd/nanomesher_nanosoundcd_asound.tar.gz


echo "Configuring NanoSound CD Service to autostart"
wget https://github.com/nanomesher/nanomesher_nanosoundcd_dist/raw/master/packages/nanomesher_nanosoundcd_services.tar.gz
sudo tar xvf /data/nanosound_cd/nanomesher_nanosoundcd_services.tar.gz -C /lib/systemd/system/
rm /data/nanosound_cd/nanomesher_nanosoundcd_services.tar.gz

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
