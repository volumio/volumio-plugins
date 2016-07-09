#!/bin/bash

echo "Installing spotify-connect-web dependencies"
sudo apt-get update
sudo apt-get -y install avahi-utils
#required to end the plugin install
echo "plugininstallend"
