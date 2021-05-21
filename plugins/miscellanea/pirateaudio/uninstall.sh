#!/bin/bash
papath=/data/plugins/miscellanea/pirateaudio
echo "Uninstall pirate audio dependencies"
# Delete service 
sudo rm -rf /etc/systemd/system/pirateaudio.service
# inform system about deleted service
sudo systemctl daemon-reload

# put backup of userconfig.txt back in place
 cp /boot/userconfig.txt.bak /boot/userconfig.txt

# Uninstall dependendencies
# apt-get remove -y

echo "Done"
echo "pluginuninstallend"