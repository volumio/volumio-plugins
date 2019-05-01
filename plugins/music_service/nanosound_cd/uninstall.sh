#!/bin/bash

# Uninstall dependendencies
# apt-get remove -y

sudo /bin/systemctl stop nanosoundcd_web
sudo /bin/systemctl stop nanosoundcd_progressweb

sudo /bin/systemctl disable nanosoundcd_web
sudo /bin/systemctl disable nanosoundcd_progressweb

sudo rm /lib/systemd/system/nanosoundcd_progressweb.service
sudo rm /lib/systemd/system/nanosoundcd_web.service
sudo /bin/systemctl daemon-reload

sudo rm -r /home/volumio/nanomesher_nanosoundcd

echo "Done"
echo "pluginuninstallend"