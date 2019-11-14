#!/bin/bash

echo "Unistalling volparametriceq dependencies"

echo "Removing volparametriceq"

systemctl stop volparametriceq

sudo rm /etc/systemd/system/volparametriceq.service
echo "Done"
echo "pluginuninstallend"
