#!/bin/bash

echo "Installing NanoSoune One Dependencies"
sudo apt-get update
# Install the required packages via apt-get

#START OF LIRC
#sudo apt-get -y install lirc
#echo "Applying LIRC starting policy"
#systemctl disable lirc.service
#systemctl stop lirc.service
#sudo apt-get -y remove lirc

#echo "Creating lircrc file"
#touch /etc/lirc/lircrc
#END OF LIRC

#START OF python devs
sudo apt-get -y install i2c-tools python-smbus python-pip python-dev python-imaging python-rpi.gpio
sudo -H pip install --upgrade pip
sudo -H pip install --upgrade python-mpd2 socketIO-client


#Install OLED service
cd /tmp


wget https://github.com/nanomesher/Nanomesher_NanoSound/raw/master/packages/nanosound_lirc_service.tar.gz
sudo tar xvf /tmp/nanosound_lirc_service.tar.gz -C /lib/systemd/system/
rm /tmp/nanosound_lirc_service.tar.gz




cd /tmp
wget https://github.com/nanomesher/Nanomesher_NanoSound/raw/master/packages/nanosound_oled3.tar.gz
sudo tar xvf /tmp/nanosound_oled3.tar.gz -C /home/volumio
cd /home/volumio/nanosound_oled
sudo chmod 777 *.py
#sudo chmod 777 lircrc
rm /tmp/nanosound_oled3.tar.gz

sudo /bin/systemctl daemon-reload
sudo /bin/systemctl enable nanosound_lirc

# install LIRC config
#cd /tmp
#wget https://github.com/nanomesher/Nanomesher_NanoSound/raw/master/packages/nanosound_lirc.tar.gz
#sudo tar xvf /tmp/nanosound_lirc.tar.gz -C /etc/lirc

#sudo cp /etc/modules /etc/modules_nanosound.bak
#sudo grep -q lirc_dev /etc/modules && sed -i 's/lirc_dev/lirc_dev/' /etc/modules || echo "lirc_dev" >> /etc/modules
#sudo sed --in-place '/lirc_rpi/d' /etc/modules
#sudo echo "lirc_rpi gpio_in_pin=17" >> /etc/modules

sed -i '/lirc_dev/d' /etc/modules
sed -i '/lirc_rpi/d' /etc/modules

sudo curl https://nanomesher.com/download/nanosoundone_shutdown1.sh | bash
#config spi
#sudo sed --in-place '/dtparam=spi=on/d' /boot/config.txt
#sudo sed -i '1 i\dtparam=spi=on' /boot/config.txt

echo "NanoSound plugin install completed"


# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

#requred to end the plugin install
echo "plugininstallend"
