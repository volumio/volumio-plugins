#!/bin/bash

echo "Uninstalling Virtual Keyboard plugin"

echo "Removing dependencies"
sudo apt-get -y purge --auto-remove matchbox-window-manager matchbox-keyboard

echo "Done"
echo "pluginuninstallend"
