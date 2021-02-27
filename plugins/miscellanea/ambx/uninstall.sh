#!/bin/bash

sudo rm /usr/bin/ambx_set_color

# Uninstall dependendencies
sudo rm /etc/udev/rules.d/10-ambx.rules
sudo pip3 uninstall ambx

echo "Done"
echo "pluginuninstallend"
