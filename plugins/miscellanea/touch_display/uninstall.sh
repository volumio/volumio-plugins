#!/bin/bash

echo "Removing Touch display"

sudo rm /opt/volumiokiosk.sh
sudo rm -rf /data/volumiokiosk
sudo rm /lib/systemd/system/volumio-kiosk.service
if [ -f /etc/udev/rules.d/99-backlight.rules ]; then
  sudo rm /etc/udev/rules.d/99-backlight.rules
fi

echo "Done"
echo "pluginuninstallend"
