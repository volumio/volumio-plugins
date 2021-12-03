#!/bin/bash

HW=$(awk '/VOLUMIO_HARDWARE=/' /etc/*-release | sed 's/VOLUMIO_HARDWARE=//' | sed 's/\"//g')
ID=$(awk '/VERSION_ID=/' /etc/*-release | sed 's/VERSION_ID=//' | sed 's/\"//g')

echo "Removing dependencies"
sudo apt-get -y purge --auto-remove fonts-arphic-ukai fonts-arphic-gbsn00lp fonts-unfonts-core
if [ "$HW" = "pi" ]; then # on Raspberry Pi hardware
  sudo apt-mark unhold libraspberrypi0 raspberrypi-bootloader raspberrypi-kernel
  sudo apt-get -y purge --auto-remove chromium-browser openbox xinit libraspberrypi0 raspberrypi-bootloader raspberrypi-kernel
  if [ "$ID" = "8" ]; then
    sudo apt-get -y purge --auto-remove xserver-xorg-legacy
  fi
else # on other hardware
  if [ "$ID" = "8" ]; then
    sudo apt-get -y purge --auto-remove chromium-codecs-ffmpeg-extra chromium-browser openbox xinit
  else
    sudo apt-get -y purge --auto-remove chromium openbox xinit
  fi
fi

echo "Deleting /opt/volumiokiosk.sh"
sudo rm /opt/volumiokiosk.sh

echo "Deleting /data/volumiokiosk"
sudo rm -rf /data/volumiokiosk

echo "Deleting /lib/systemd/system/volumio-kiosk.service"
sudo rm /lib/systemd/system/volumio-kiosk.service

if [ -f /etc/X11/xorg.conf.d/95-touch_display-plugin.conf ]; then
  echo "Deleting /etc/X11/xorg.conf.d/95-touch_display-plugin.conf"
  sudo rm /etc/X11/xorg.conf.d/95-touch_display-plugin.conf
fi

echo "Done"
echo "pluginuninstallend"
