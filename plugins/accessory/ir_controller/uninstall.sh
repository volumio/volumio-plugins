#!/bin/bash

echo "Removing dependencies"
sudo rm /etc/lirc/lircrc
sudo apt-get -y purge --auto-remove lirc

echo "Done"
echo "pluginuninstallend"
