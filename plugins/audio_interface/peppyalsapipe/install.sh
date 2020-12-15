#!/bin/bash

echo "Installing peppyalsa plugin dependencies"
sudo cp /data/plugins/audio_interface/peppyalsapipe/libpeppyalsa.so /usr/local/lib/
/usr/bin/mkfifo /data/plugins/audio_interface/peppyalsapipe/myfifopeppy
sudo chmod 777 /data/plugins/audio_interface/peppyalsapipe/myfifopeppy
#required to end the plugin install
echo "plugininstallend"
