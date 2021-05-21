#!/bin/bash

# First remove all configuration, because if DUO uninstall fails and the configuration is still in place, it breaks authentication
sed 's/^ChallengeResponseAuthentication.*/ChallengeResponseAuthentication no/g' -i /etc/ssh/sshd_config
sed 's/^PasswordAuthentication .*/#PasswordAuthentication  yes/g' -i /etc/ssh/sshd_config

echo "Disabled challenge response authentication setting..."

if grep -q "duo" "/etc/pam.d/sshd"; then
	sed '/^auth  required pam_permit.so.*/d' -i /etc/pam.d/sshd
	sed '/^auth  requisite pam_deny.so.*/d' -i /etc/pam.d/sshd
	sed '/^auth  \[success=1 default=ignore\] pam_duo.so.*/d' -i /etc/pam.d/sshd
	sed 's/^#@include common-auth.*/@include common-auth/g' -i /etc/pam.d/sshd
fi

# Uninstall DUO
dpkg --remove duo-unix
apt-get autoremove -y

echo "Removed all DUO module references..."

echo "Done"
echo "pluginuninstallend"