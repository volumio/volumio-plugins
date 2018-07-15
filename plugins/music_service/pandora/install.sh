#!/bin/bash
BASE_PATH='/data/plugins/music_service/pandora'

echo "Installing Pandora Dependencies"
sudo apt-get update
# Install the required packages via apt-get
# I'm not sure that all of these development libraries are needed, just being safe
sudo apt-get -y install libao-dev libmad0-dev libfaad-dev libgnutls28-dev libjson0-dev libgcrypt11-dev socat libavcodec-dev libavfilter-dev libavformat-dev libcurl4-openssl-dev libjson0-dev

# If you need to differentiate install for armhf and i386 you can get the variable like this
#DPKG_ARCH=`dpkg --print-architecture`
# Then use it to differentiate your install

chmod +x $BASE_PATH/node_modules/pianode/pianobar/pianobar
chmod +x $BASE_PATH/node_modules/pianode/lib/event_converter.sh
# sed path magic
sed -i -E "s#(.*= )/.*(/plugins/.*)#\1/data\2#" $BASE_PATH/node_modules/pianode/pianobar/config
# make sure pianobar outputs to device chosen by Volumio
perl -ne 'print "default_driver=alsa\ndev=$1\nquiet\n" if /\s+device\s+"(.+)"/' /etc/mpd.conf > /home/volumio/.libao

#requred to end the plugin install
echo "plugininstallend"
