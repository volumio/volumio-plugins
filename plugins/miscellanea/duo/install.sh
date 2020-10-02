#!/bin/bash
echo "Installing DUO and dependencies..."
INSTALLING="/home/volumio/duo-plugin.installing"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING
	# Echo version number, for bug tracking purposes
	echo "## Installing DUO plugin v1.0 ##"
	
	echo "Detecting CPU architecture and Debian version"
	ARCH=$(lscpu | awk 'FNR == 1 {print $2}')
	DEBIAN_VERSION=$(cat /etc/os-release | grep '^VERSION=' | cut -d '(' -f2 | tr -d ')"')
	echo "CPU architecture: " $ARCH
	echo "Debian version: " $DEBIAN_VERSION

	# Download latest compiled DUO package from GitHub
	mkdir /home/volumio/duo
	wget https://github.com/Saiyato/volumio-duo-plugin/raw/master/binaries/duo-unix_1.11.4-1_armhf.deb -P /home/volumio/duo

	# Install packages (server and client) and dependencies
	for f in /home/volumio/duo/duo-unix*.deb; do dpkg -i "$f"; done
	apt-get update && apt-get -f -y install
	chown -R volumio:volumio /etc/duo
		
	# Configure SSH
	echo "Patching SSH daemon configuration..."
	sed '/^ChallengeResponseAuthentication/{h;s/.*/ChallengeResponseAuthentication yes/};${x;/^$/{s//ChallengeResponseAuthentication yes/;H};x}' -i /etc/ssh/sshd_config
	sed '/^PasswordAuthentication /{h;s/.*/PasswordAuthentication  yes/};${x;/^$/{s//PasswordAuthentication yes/;H};x}' -i /etc/ssh/sshd_config
	sed '/^UseDNS/{h;s/.*/UseDNS no/};${x;/^$/{s//UseDNS no/;H};x}' -i /etc/ssh/sshd_config
	
	# Configure PAM modules | removed from setup, because it breaks authentication if DUO is not configured properly
	#if grep -q "^@include common-auth" "/etc/pam.d/sshd"; then
	#	sed '/^@include common-auth.*/a auth  required pam_permit.so' -i /etc/pam.d/sshd
	#	sed '/^@include common-auth.*/a auth  requisite pam_deny.so' -i /etc/pam.d/sshd
	#	sed '/^@include common-auth.*/a auth  [success=1 default=ignore] pam_duo.so' -i /etc/pam.d/sshd
	#	sed 's/^@include common-auth.*/#@include common-auth/g' -i /etc/pam.d/sshd
	#fi
	
	systemctl enable /data/plugins/miscellanea/duo/unit/duo-pam-activator.service
	systemctl start duo-pam-activator.service
	
	# Cleanup files
	echo "Cleaning up after installation..."
	rm -rf /home/volumio/duo
	rm $INSTALLING
	
	#required to end the plugin install
	echo "plugininstallend"

else
	echo "Plugin is already installing! Not continuing, check the log files for any errors during installation."
fi