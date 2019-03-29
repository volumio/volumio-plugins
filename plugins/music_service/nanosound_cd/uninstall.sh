#!/bin/bash

# Uninstall dependendencies
# apt-get remove -y

sudo /bin/systemctl stop nanosoundcd_web
sudo /bin/systemctl stop nanosoundcd_progressweb

sudo /bin/systemctl disable nanosoundcd_web
sudo /bin/systemctl disable nanosoundcd_progressweb

rm /home/volumio/nanomesher_nanosoundcd -r

echo "Done"
echo "pluginuninstallend"