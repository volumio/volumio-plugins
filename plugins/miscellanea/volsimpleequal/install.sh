#!/bin/bash

echo "Installing volsimpleequal dependencies"
echo "unload Loopback module if exists"
sudo rmmod snd_aloop

sudo apt-get update
sudo apt-get install libasound2-plugin-equal

#required to end the plugin install
echo "plugininstallend"
