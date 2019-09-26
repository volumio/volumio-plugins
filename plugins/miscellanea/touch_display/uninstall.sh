#!/bin/bash

echo "Removing Touch display"

sudo rm /opt/volumiokiosk.sh
sudo rm -rf /data/volumiokiosk
sudo rm /lib/systemd/system/volumio-kiosk.service

echo "Resetting rotation config"
sudo /usr/local/bin/raspi-rotate-screen normal
sudo rm /etc/X11/xorg.conf.d/99-raspi-rotate.conf

if [ -f /etc/udev/rules.d/99-backlight.rules ]; then
  sudo rm /etc/udev/rules.d/99-backlight.rules
fi

echo "Done"
echo "pluginuninstallend"
