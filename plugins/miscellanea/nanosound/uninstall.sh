#!/bin/bash

# Uninstall dependendencies
# apt-get remove -y

sudo /bin/systemctl stop nanosound_oled
sudo /bin/systemctl disable nanosound_oled
sudo /bin/systemctl disable nanosound_lirc
sudo rm -r /home/volumio/nanosound_oled
sudo rm /lib/systemd/system/nanosound_oled.service
sudo rm /lib/systemd/system/nanosound_lirc.service
sudo rm /lib/systemd/system/nanosound_rotary.service

sudo /bin/systemctl daemon-reload

echo "Done"

echo "pluginuninstallend"