#!/bin/bash

echo "Removing Touch display"

sudo rm /opt/volumiokiosk.sh
sudo rm -rf /data/volumiokiosk
sudo rm /lib/systemd/system/volumio-kiosk.service
if [ -f /etc/udev/rules.d/99-backlight.rules ]; then
  sudo rm /etc/udev/rules.d/99-backlight.rules
fi

echo "Resetting screen config"
rm -f /etc/X11/xorg.conf.d/40-libinput.conf
grep -v "Touch Display setting below" /boot/config.txt \
        | grep -v "^display_hdmi_rotate=" \
        | grep -v "^display_lcd_rotate=" \
        > /tmp/reset_rotate_config.txt \
        && mv /tmp/reset_rotate_config.txt /boot/config.txt

echo "Done"
echo "pluginuninstallend"
