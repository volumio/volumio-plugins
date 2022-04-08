#!/bin/bash

echo "Unistalling Brutefir dependencies"

echo "Removing CamillaDsp"
rm -Rf /data/INTERNAL/FusionDsp

systemctl stop fusiondsp

sudo rm /etc/systemd/system/fusiondsp.service

echo "Done"
echo "pluginuninstallend"