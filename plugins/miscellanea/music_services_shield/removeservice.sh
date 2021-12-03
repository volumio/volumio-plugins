systemctl stop musicservicesshield
systemctl disable musicservicesshield
rm /etc/systemd/system/musicservicesshield.service
systemctl daemon-reload
systemctl reset-failed

