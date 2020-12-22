#!/bin/bash
#pipepath=/data/plugins/audio_interface/peppyalsapipe/myfifopeppy
#peppymeterpath=/data/plugins/audio_interface/peppyalsapipe/peppymeter

echo "Installing peppyalsa plugin dependencies"
sudo cp /data/plugins/audio_interface/peppyalsapipe/libpeppyalsa.so /usr/local/lib/
#/usr/bin/mkfifo $pipepath
#sudo chmod 777 $pipepath
#sudo chown volumio $pipepath
#sudo chgrp volumio $pipepath

echo "cloning peppymeter repo"
#git clone https://github.com/project-owner/PeppyMeter.git $peppymeterpath

echo "installing pyton3-pygame"
#sudo apt-get install python3-pygame

#required to end the plugin install
echo "plugininstallend"
