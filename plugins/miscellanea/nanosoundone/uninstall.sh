#!/bin/bash

# Uninstall dependendencies
# apt-get remove -y


sudo /bin/systemctl disable nanosound_lirc
sudo rm /lib/systemd/system/nanosound_lirc.service
sudo /bin/systemctl daemon-reload

echo "Done"

echo "pluginuninstallend"