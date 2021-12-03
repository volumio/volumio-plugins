#!/bin/sh

sudo apt-get install -y build-essential bluetooth bluez libbluetooth-dev libudev-dev

# Optional, give node bt le access
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
