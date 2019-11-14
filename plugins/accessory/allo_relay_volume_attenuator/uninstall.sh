#!/bin/bash

# Uninstall dependendencies

apt-get remove -y lirc
rm /usr/bin/r_attenu
rm /usr/bin/r_attenuc

echo "Done"
echo "pluginuninstallend"