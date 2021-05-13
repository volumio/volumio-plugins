#!/bin/bash

echo "Removing dependencies"
sudo rm /etc/lirc/lircrc
sudo apt-get -y purge --auto-remove lirc

echo "Removing folder for custom LIRC configurations"
sudo rm -r /data/ir_controller

echo "Done"
echo "pluginuninstallend"
