#!/bin/bash

echo "Unistalling Brutefir dependencies"

echo "Removing CamillaDsp"
rm -Rf /data/INTERNAL/FusionDsp
rm /usr/lib/arm-linux-gnueabihf/alsa-lib/libasound_module_pcm_cdsp.so 

echo "Done"
echo "pluginuninstallend"