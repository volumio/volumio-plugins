#!/bin/bash

echo "Unistalling volbinauralfilter dependencies"

echo "Removing volbinauralfilter"

systemctl stop volbinauralfilter

sudo rm /etc/systemd/system/volbinauralfilter.service
echo "Done"
echo "pluginuninstallend"
