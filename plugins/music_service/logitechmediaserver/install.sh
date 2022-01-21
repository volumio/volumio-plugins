## LMS installation script
echo "Installing LMS and its dependencies..."
INSTALLING="/home/volumio/lms-plugin.installing"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING
	
	cpu=$(lscpu | awk 'FNR == 1 {print $2}')
	echo "cpu: " $cpu

	if [ ! -f /usr/sbin/squeezeboxserver ] || [ $1 =  "force" ];
	then
		apt-get update
		
		# Download LMS 7.9.1
		echo "Downloading installation package..."
		if [ ! -d /home/volumio/logitechmediaserver ];
		then
			mkdir /home/volumio/logitechmediaserver
		else
			rm /home/volumio/logitechmediaserver/logitechmediaserver*.deb
		fi
		
		if [ $cpu = "armv6l" ] || [ $cpu = "armv7l" ];
		then
			wget -O /home/volumio/logitechmediaserver/logitechmediaserver_7.9.1_arm.deb http://downloads.slimdevices.com/LogitechMediaServer_v7.9.1/logitechmediaserver_7.9.1_arm.deb
			#wget -O /home/volumio/logitechmediaserver/logitechmediaserver_7.9.2_arm.deb http://downloads-origin.slimdevices.com/nightly/7.9/sc/035da986803908908cb46501efbca6c4d6e93db2/logitechmediaserver_7.9.2~1543258616_arm.deb
		else
			wget -O /home/volumio/logitechmediaserver/logitechmediaserver_7.9.1._all.deb http://downloads.slimdevices.com/LogitechMediaServer_v7.9.1/logitechmediaserver_7.9.1_all.deb
			#wget -O /home/volumio/logitechmediaserver/logitechmediaserver_7.9.2._all.deb http://downloads.slimdevices.com/nightly/7.9/sc/035da986803908908cb46501efbca6c4d6e93db2/logitechmediaserver_7.9.2~1543258616_all.deb
		fi
		
		# Move the binary to the expected directory
		if [ -f /etc/squeezeboxserver ];
		then
			mv /etc/squeezeboxserver /usr/sbin/squeezeboxserver
		fi
		
		# Install package and dependencies
		echo "Installing downloaded package"
		for f in /home/volumio/logitechmediaserver/logitechmediaserver*.deb; do dpkg -i "$f"; done
				
		# Needed for SSL connections; e.g. github
		apt-get install libio-socket-ssl-perl lame unzip -y
		apt-get -f install -y
		
		# Get compiled CPAN for current Perl version and link it; if it doesn't exist
		PERLV=$(perl -v | grep -o "(v[0-9]\.[0-9]\+" | sed "s/(v//;s/)//")
		var=$(awk 'BEGIN{ print "'$PERLV'"<"'5.20'" }')
		if [ "$var" -eq 0 -a ! -e /usr/share/squeezeboxserver/CPAN/arch/$PERLV/arm-linux-gnueabihf-thread-multi-64int/ ]; then
			# get CPAN if not existing
			if [ ! -e /opt/CPAN/$PERLV/arm-linux-gnueabihf-thread-multi-64int/ ]; then
				wget -O /home/volumio/logitechmediaserver/CPAN_PERL_ALL.tar.gz https://github.com/Saiyato/volumio-lms-plugin/raw/master/known_working_versions/CPAN_PERL_ALL.tar.gz
				tar -xvzf /home/volumio/logitechmediaserver/CPAN_PERL_ALL.tar.gz -C /opt/
				echo "Download CPAN for Perl $PERLV"
			fi
			ln -sf /opt/CPAN/$PERLV/arm-linux-gnueabihf-thread-multi-64int/ /usr/share/squeezeboxserver/CPAN/arch/$PERLV/arm-linux-gnueabihf-thread-multi-64int
			echo "Linking CPAN to Perl $PERLV"
			sleep 4
		else
			ln -sf /opt/CPAN/arm-linux-gnueabihf-thread-multi-64int/ /usr/share/squeezeboxserver/CPAN/arch/5.18/
			echo "Linking CPAN to Latest"
		fi
		
		# These directories still use the old name; probably legacy code
		echo "Fixing directory rights"
		mkdir /var/lib/squeezeboxserver
		chown -R volumio:volumio /var/lib/squeezeboxserver
		
		# Add the squeezeboxserver user to the audio group
		usermod -aG audio squeezeboxserver

		# Add the systemd unit
		echo "Adding the systemd unit"
		rm /etc/systemd/system/logitechmediaserver.service	
		wget -O /etc/systemd/system/logitechmediaserver.service https://raw.githubusercontent.com/Saiyato/volumio-lms-plugin/master/unit/logitechmediaserver.service
		
		# Image::Scale fix
		echo "Fixing CPAN Image::Scale..."
		wget -O /opt/CPAN_FIX_IMAGE.zip https://github.com/Saiyato/volumio-lms-plugin/raw/master/known_working_versions/CPAN_FIX_IMAGE.zip
		unzip -o /opt/CPAN_FIX_IMAGE.zip -d /opt/CPAN/arm-linux-gnueabihf-thread-multi-64int
		chmod 774 /opt/CPAN/arm-linux-gnueabihf-thread-multi-64int/auto/Image/Scale/Scale.so
		echo "CPAN image fix completed"	
		
		# Fix Ubuntu interpreter
		ln /lib/arm-linux-gnueabihf/ld-linux.so.3 /lib/ld-linux.so.3
		
		# Audio fix for DSD
		echo "Fixing CPAN DSD playback..."
		wget -O /opt/CPAN_AUDIO_DSD_7.9.tar https://github.com/Saiyato/volumio-lms-plugin/raw/master/known_working_versions/CPAN_AUDIO_DSD_7.9.tar
		tar -xf /opt/CPAN_AUDIO_DSD_7.9.tar -C /opt
		wget -O /opt/DSDPLAYER-BIN.zip https://github.com/Saiyato/volumio-lms-plugin/raw/master/known_working_versions/DSDPLAYER-BIN.zip
		unzip -o /opt/DSDPLAYER-BIN.zip -d /usr/share/squeezeboxserver/Bin/
		echo "CPAN DSD playback fix completed"
		
		# Stop service and fix rights for preference folder
		service logitechmediaserver stop
		
		# Fix rights issue for preference, cache and log directory, needs execute right for prefs
		chmod 744 -R /var/lib/squeezeboxserver		
		
		# Tidy up
		rm -rf /home/volumio/logitechmediaserver
		rm /opt/CPAN_AUDIO_DSD_7.9.tar
		rm /opt/CPAN_FIX_IMAGE.zip
		rm /opt/DSDPLAYER-BIN.zip
		
		# Reload the systemd unit
		systemctl daemon-reload
		
		sleep 3
	else
		echo "A technical error occurred, the plugin already exists, but installation was able to continue. If you just want to install LMS again, try the force parameter: [sh script.sh force]."
	fi
	
	rm $INSTALLING

	#required to end the plugin install
	echo "plugininstallend"
else
	echo "Plugin is already installing! Not continuing..."
fi
