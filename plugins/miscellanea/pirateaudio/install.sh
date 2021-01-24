#!/bin/bash
echo "Installing pirateaudio dependencies"
# set path
papath=/data/plugins/miscellanea/pirateaudio

echo "Installing pirateaudio service"
# Copy service to the right place
cp $papath/pirateaudio.service /etc/systemd/system/
# change file permission
sudo chmod 644 /etc/systemd/system/pirateaudio.service
# inform system about new service
sudo systemctl daemon-reload

# Install the required packages via apt-get
echo "Installing apt-get dependencies"
sudo apt-get update
sudo apt-get -y install python-rpi.gpio python-spidev python-pip python-pil python-numpy --no-install-recommends
echo "Installing pip dependencies"
sudo pip install st7789 socketIO-client

# do changes to userconfig for pirate audio hat
echo "userconfig.txt: deleting pirate audio plugin parameters from earlier installations"
sudo sed -i '/### End of parameters for pirateaudio plugin ###/d' /boot/userconfig.txt
sudo sed -i '/gpio=13=op,dl/d' /boot/userconfig.txt
sudo sed -i '/gpio=20=pu/d' /boot/userconfig.txt
sudo sed -i '/gpio=16=pu/d' /boot/userconfig.txt
sudo sed -i '/### Fix for Button X, Y of pirate audio ###/d' /boot/userconfig.txt
sudo sed -i '/dtparam=spi=on/d' /boot/userconfig.txt
sudo sed -i '/gpio=25=op,dh/d' /boot/userconfig.txt
sudo sed -i '/dtoverlay=hifiberry-dac/d' /boot/userconfig.txt
sudo sed -i '/### Start of parameters for pirateaudio plugin ###/d' /boot/userconfig.txt

echo "userconfig.txt: adding parameters"
sudo sed -i.bak '1 i\### End of parameters for pirateaudio plugin ###' /boot/userconfig.txt
# sudo sed -i '1 i\gpio=20=pu' /boot/userconfig.txt
# sudo sed -i '1 i\gpio=16=pu' /boot/userconfig.txt
# sudo sed -i '1 i\### Fix for Button X, Y of pirate audio ###' /boot/userconfig.txt
sudo sed -i '1 i\gpio=13=op,dl' /boot/userconfig.txt
sudo sed -i '1 i\gpio=25=op,dh' /boot/userconfig.txt
sudo sed -i '1 i\dtparam=spi=on' /boot/userconfig.txt
# sudo sed -i '1 i\dtoverlay=hifiberry-dac' /boot/userconfig.txt
sudo sed -i '1 i\### Start of parameters for pirateaudio plugin ###' /boot/userconfig.txt

# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

#requred to end the plugin install
echo "plugininstallend"
