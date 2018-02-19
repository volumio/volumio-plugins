#!/bin/bash
echo "Uninstalling Kodi configs"

# Remove policies
echo "Removing policies..."
rm /etc/udev/rules.d/99-input.rules
rm /etc/udev/rules.d/10-permissions.rules
rm /etc/ld.so.conf.d/00-vmcs.conf
rm /etc/polkit-1/localauthority/50-local.d/50-kodi-actions.pkla
ldconfig

# Update the GPU memory
echo "Update the GPU memory..."
CONFIG="/boot/config.txt"
echo "Updating GPU memory back to 16MB..."
sed -i -- 's|.*gpu_mem.*|gpu_mem=16|g' $CONFIG

# Remove the systemd unit
echo "Removing the systemd unit..."
rm /etc/systemd/system/kodi.service
systemctl daemon-reload

echo "Uninstalling packages and purging..."
apt-get purge --auto-remove gdb kodi --yes

# Own the files before deleting them
echo "Cleaning up directories..."
chown -R volumio /data/configuration/miscellanea/kodi/
rm -rf /data/configuration/miscellanea/kodi/
userdel -r kodi

# The end...
echo "pluginuninstallend"