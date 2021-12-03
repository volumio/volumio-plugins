#!/bin/bash

echo "Installing LIRC"
sudo apt-get update
sudo apt-get -y install lirc

echo "Creating lircrc file"
sudo touch /etc/lirc/lircrc
if [ "$(/usr/bin/dpkg -s lirc | /usr/bin/awk -F'[^0-9]*' '/Version: [0-9]+/{if ($2 == 0 && ($3 < 9 || ($3 == 9 && $4 < 4))) $0="legacy"; else $0=""; print $0}')" = "legacy" ]; then
  # for lirc version < 0.9.4
  echo "Applying LIRC starting policy"
  sudo systemctl disable lirc.service
  sudo systemctl stop lirc.service
else
  sudo ln -sf /etc/lirc/lircrc /etc/lirc/irexec.lircrc
  echo "Applying LIRC starting policy"
  sudo systemctl disable lircd.service
  sudo systemctl stop lircd.service
fi

echo "Creating folder for custom LIRC configurations"
sudo mkdir -p -m 777 /data/INTERNAL/ir_controller/configurations
sudo chown volumio:volumio /data/INTERNAL/ir_controller/configurations

#required to end the plugin install
echo "plugininstallend"
