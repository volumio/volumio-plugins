#!/bin/bash

echo "Unistalling gpiobuttons dependencies"

echo "Removing Touch display"

sudo rm /opt/volumiokiosk.sh
sudo rm /lib/systemd/system/volumio-kiosk.service
sudo rm /etc/systemd/system/multi-user.target.wants/volumio-kiosk.service

echo "Done"
echo "pluginuninstallend"
