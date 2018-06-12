#!/bin/bash

echo "Installing pandora Dependencies"
sudo apt-get update
# Install the required packages via apt-get
sudo apt-get -y install libao-dev libmad0-dev libfaad-dev libgnutls28-dev libjson0-dev libgcrypt11-dev socat libavcodec-dev libavfilter-dev libavformat-dev libcurl4-openssl-dev libjson0-dev

# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

chmod +x /data/plugins/music_service/pandora/node_modules/pianode/pianobar/pianobar
chmod +x /data/plugins/music_service/pandora/node_modules/pianode/lib/event_converter.sh
#requred to end the plugin install
echo "plugininstallend"
