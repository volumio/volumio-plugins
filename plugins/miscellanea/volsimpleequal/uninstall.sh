#!/bin/bash

echo "Unistalling volsimpleequal dependencies"

echo "Removing volsimpleequal"

systemctl stop volsimpleequal

sudo rm /etc/systemd/system/volsimpleequal.service

echo "Done"
echo "pluginuninstallend"