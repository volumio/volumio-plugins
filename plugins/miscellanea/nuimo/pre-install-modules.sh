#!/bin/bash

echo "Utility to install prerequisites for Nuimo plugin"
apt-get update
apt-get install -y build-essential bluetooth bluez libbluetooth-dev libudev-dev 

echo "Setting permissions to Node service"
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
sudo setcap cap_net_raw+eip /volumio/index.js
