#!/bin/bash

# Uninstall dependendencies
# apt-get remove -y

sudo /bin/systemctl stop nanosound_oled
sudo /bin/systemctl disable nanosound_oled
sudo rm -r /home/volumio/nanosound_oled
sudo rm /lib/systemd/system/nanosound_oled.service

sudo /bin/systemctl daemon-reload

echo "Done"

echo "pluginuninstallend"