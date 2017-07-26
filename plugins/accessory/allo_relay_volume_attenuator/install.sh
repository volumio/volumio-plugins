#!/bin/bash

echo "Installing allo relay volume attenuator Dependencies"

echo "Installing LIRC"
apt-get update
apt-get -y install lirc

echo "Applying LIRC starting policy"
systemctl enable lirc.service
systemctl start lirc.service

echo "Copying config  files"
sudo cp /data/plugins/miscellanea/allo_relay_volume_attenuator/lircd.conf  /etc/lirc/
sudo cp /data/plugins/miscellanea/allo_relay_volume_attenuator/hardware.conf  /etc/lirc/
sudo cp /data/plugins/miscellanea/allo_relay_volume_attenuator/lircrc  /etc/lirc/

sudo cp /data/plugins/miscellanea/allo_relay_volume_attenuator/r_attenu /usr/bin/
sudo chmod a+x /usr/bin/r_attenu
sudo cp /data/plugins/miscellanea/allo_relay_volume_attenuator/r_attenuc /usr/bin/
sudo chmod a+x /usr/bin/r_attenuc

echo "Adding r attenu service"
sudo cp /data/plugins/miscellanea/allo_relay_volume_attenuator/rattenu.service /lib/systemd/system/rattenu.service

#requred to end the plugin install
echo "plugininstallend"