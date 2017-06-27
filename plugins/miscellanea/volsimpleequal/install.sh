#!/bin/bash

echo "Installing volsimpleequal dependencies"

sudo apt-get update
sudo apt-get install libasound2-plugin-equal

#required to end the plugin install
echo "plugininstallend"
