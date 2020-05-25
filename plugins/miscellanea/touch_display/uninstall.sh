#!/bin/bash

echo "Removing Touch display"

sudo rm /opt/volumiokiosk.sh
sudo rm -rf /data/volumiokiosk
sudo rm /lib/systemd/system/volumio-kiosk.service
if [ -f /etc/X11/xorg.conf.d/95-touch_display-plugin.conf ]; then
  sudo rm /etc/X11/xorg.conf.d/95-touch_display-plugin.conf
fi

echo "Done"
echo "pluginuninstallend"
