#!/bin/bash

echo "Installing Matchbox window manager and Matchbox keyboard"
sudo apt-get update
sudo apt-get -y install matchbox-window-manager matchbox-keyboard

#required to end the plugin install
echo "plugininstallend"
