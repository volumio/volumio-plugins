#!/bin/bash
echo "Installing wifireconnect dependencies"

if ! grep -q ^default-lease-time "/etc/dhcp/dhcpd.conf";
	then
		echo "adding default-lease-time"
		echo 'default-lease-time 600;
' | tee --append /etc/dhcp/dhcpd.conf

	else
		echo "/etc/dhcp/dhcpd.conf already ok, nothing to do..."
fi

if ! grep -q ^max-lease-time "/etc/dhcp/dhcpd.conf";
	then
		echo "adding max-lease-time"
		echo 'max-lease-time 3600;
' | tee --append /etc/dhcp/dhcpd.conf

	else
		echo "/etc/dhcp/dhcpd.conf already ok, nothing to do..."
fi

echo "Checking if wifireconnect services exist"
if [ ! -f "/etc/systemd/system/wifireconnect.service" ];
	then
		echo "file wifireconnect.service doesn't exist, creating"
		cp /data/plugins/system_controller/wifireconnect/wifireconnect.tar.gz /
		cd /
		sudo tar -xvf wifireconnect.tar.gz
		rm /wifireconnect.tar.gz
	else
		echo "wifireconnect.service already exists. Nothing to do !"
fi

#required to end the plugin install
echo "plugininstallend"
