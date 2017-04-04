#!/bin/bash

echo "Installing volumio mini-dlna dependencies"
sudo apt-get update
sudo apt-get -y install minidlna
cd /data/plugins/miscellanea/volumiominidlna
sudo tar -xvf volumiominidlna.service.tar -C /
echo "plugininstallend"
