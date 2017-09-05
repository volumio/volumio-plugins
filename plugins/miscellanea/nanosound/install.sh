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





# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

#requred to end the plugin install
echo "plugininstallend"
