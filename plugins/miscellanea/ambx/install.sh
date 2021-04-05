#!/bin/bash

echo "Installing PyUSB"
sudo apt update
sudo apt -y install python3-pip --no-install-recommends
sudo pip3 install ambx

echo "Installing color change executable"
sudo cp /data/plugins/miscellanea/ambx/10-ambx.rules /etc/udev/rules.d/
sudo udevadm control --reload-rules && sudo udevadm trigger
sudo install -m 755 /data/plugins/miscellanea/ambx/ambx_set_color /usr/bin

echo "plugininstallend"
