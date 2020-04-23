#!/bin/bash

echo "Uninstalling Virtual Keyboard dependencies"

echo "Removing Matchbox window manager and Matchbox keyboard"
sudo apt-get -y purge --auto-remove matchbox-window-manager matchbox-keyboard

echo "Done"
echo "pluginuninstallend"
