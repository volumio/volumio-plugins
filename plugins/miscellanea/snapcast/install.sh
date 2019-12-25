## SnapCast installation script
echo "Installing SnapCast and its dependencies..."
INSTALLING="/home/volumio/snapcast-plugin.installing"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING
	apt-get update
	
	echo "Detecting cpu"
	cpu=$(lscpu | awk 'FNR == 1 {print $2}')
	echo "cpu: " $cpu

	# Download latest SnapCast packages
	mkdir /home/volumio/snapcast
	
	if [ $cpu = "armv6l" ] || [ $cpu = "armv7l" ]; then
		wget $(curl -s https://api.github.com/repos/badaix/snapcast/releases/latest | grep 'armhf' | cut -d\" -f4) -P /home/volumio/snapcast
	elif [ $cpu = "i686" ] || [ $cpu = "x86_64" ]; then
		echo "Still working on x86/x64 support, need to compile the packages."
	else 
		echo "This cpu is not yet supported, you must build the snap*-packages yourself. Detected cpu: " $cpu
	fi

	# Backup old snap* installations
	mv /usr/sbin/snapclient /usr/sbin/snapclient.bak
	mv /usr/sbin/snapserver /usr/sbin/snapserver.bak

	# Install packages (server and client) and dependencies
	for f in /home/volumio/snapcast/snap*.deb; do dpkg -i "$f"; done
	apt-get -f -y install

	# To execute the --version command
	ln -fs /usr/bin/snapclient /usr/sbin/snapclient
	ln -fs /usr/bin/snapserver /usr/sbin/snapserver

	if [ -f "/etc/asound.conf" ];
	then
		# Add or update asound.conf
		if grep -q "snapcast" /etc/asound.conf;
		then
			sed -i '/#SNAPCAST/,/#ENDOFSNAPCAST/d' /etc/asound.conf
		fi
		# Append to /etc/asound.conf
			echo "
	#SNAPCAST
	pcm.!snapcast {
		type plug
		slave.pcm snapConverter
	}

	pcm.snapConverter {
		type rate
		slave {
			pcm writeFile # Direct to the plugin which will write to a file
			format S16_LE
			rate 48000
		}
	}	

	pcm.writeFile {
		type file
		slave.pcm null
		file \"/tmp/snapfifo\"
		format \"raw\"
	}
	#ENDOFSNAPCAST
	" >> /etc/asound.conf
	else
		# Write /etc/asound.conf		
		echo "
	#SNAPCAST
	pcm.!snapcast {
		type plug
		slave.pcm snapConverter
	}
	
	pcm.snapConverter {
		type rate
		slave {
			pcm writeFile # Direct to the plugin which will write to a file
			format S16_LE
			rate 48000
		}
	}

	pcm.writeFile {
		type file
		slave.pcm null
		file \"/tmp/snapfifo\"
		format \"raw\"
	}
	#ENDOFSNAPCAST
	" | sudo tee /etc/asound.conf
	fi
	
	chmod g+w /etc/asound.conf
	
	# Don't touch this if volspotconnect (spotify-connect-web) plugin  is not installed
	if [ -d "/data/plugins/music_service/volspotconnect/spotify-connect-web/etc" ];
	then
		# Add lines
		sed -i -- '/slave.pcm spotoutf/a updateLine' /data/plugins/music_service/volspotconnect/asound.tmpl
		sed -i -- '/slave.pcm spotoutf/a updateLine' /etc/asound.conf
		# Update lines
		sed -i -- 's|slave.pcm spotoutf|#slave.pcm spotoutf|g' /data/plugins/music_service/volspotconnect/asound.tmpl
		sed -i -- 's|updateLine|slave.pcm writeFile|g' /data/plugins/music_service/volspotconnect/asound.tmpl
		sed -i -- 's|slave.pcm spotoutf|#slave.pcm spotoutf|g' /etc/asound.conf
		sed -i -- 's|updateLine|slave.pcm writeFile|g' /etc/asound.conf
		chmod g+w /data/plugins/music_service/volspotconnect/asound.tmpl
	
		# Fix chrooted spotify-connect-web
		if ! grep -q "asound.conf" /data/plugins/music_service/volspotconnect/spotify-connect-web/etc ;
		then
			if [ -f "/data/plugins/music_service/volspotconnect/spotify-connect-web/etc/asound.conf"];
			then				
				rm /data/plugins/music_service/volspotconnect/spotify-connect-web/etc/asound.conf
			fi
			ln -sf /etc/asound.conf /data/plugins/music_service/volspotconnect/spotify-connect-web/etc/asound.conf
		fi
	fi

	# Reload ALSA with the new config
	alsactl restore	

	sed -i -- 's|.*enabled.*|    enabled         "yes"|g' /etc/mpd.conf
	sed -i -- 's|.*format.*|    format          "44100:16:2"|g' /etc/mpd.conf

	# Disable standard output to ALSA
	ALSA_ENABLED=$(sed -n "/.*type.*\"alsa\"/{n;p}" /etc/mpd.conf)

	case $ALSA_ENABLED in
	 *enabled*) sed -i -- '/.*type.*alsa.*/!b;n;c\ \ \ \ \ \ \ \ \ \ \ \ \ \ \ \ enabled\ \ \ \ \ \ \ \ \ "no"' /etc/mpd.conf ;;
	 *) sed -i -- 's|.*type.*alsa.*|&\n\ \ \ \ \ \ \ \ \ \ \ \ \ \ \ \ enabled\ \ \ \ \ \ \ \ \ "no"|g' /etc/mpd.conf ;;
	esac

	# Create the systemd unit file, if it doesn't already exists
	#wget -O /etc/init.d/snapclient https://raw.githubusercontent.com/Saiyato/volumio-snapcast-plugin/master/unit/snapclient
	#wget -O /etc/init.d/snapserver https://raw.githubusercontent.com/Saiyato/volumio-snapcast-plugin/master/unit/snapserver
	#chmod 755 /etc/init.d/snapclient
	#chmod 755 /etc/init.d/snapserver
	systemctl daemon-reload

	# Edit the systemd units
	systemctl enable /data/plugins/miscellanea/snapcast/spotififo.service
	systemctl start spotififo.service
	systemctl disable snapserver.service
	systemctl disable snapclient.service

	systemctl restart mpd
	
	# Remove files and replace them with symlinks
	rm /etc/default/snapclient
	rm /etc/default/snapserver
	
	ln -fs /data/plugins/miscellanea/snapcast/default/snapclient /etc/default/snapclient
	ln -fs /data/plugins/miscellanea/snapcast/default/snapserver /etc/default/snapserver

	sed -i -- 's|^SNAPSERVER_OPTS.*|SNAPSERVER_OPTS="-d -s pipe:///tmp/snapfifo?name=Volumio-MPD\&mode=read&sampleformat=44100:16:2"|g' /data/plugins/miscellanea/snapcast/default/snapserver
	sed -i -- 's|^SNAPCLIENT_OPTS.*|SNAPCLIENT_OPTS="-d -h 127.0.0.1 -s ALSA"|g' /data/plugins/miscellanea/snapcast/default/snapclient
	
	sed -i -- '/slave.pmc spotoutf/a slave.pcm writeFile' /etc/asound.conf
	sed -i -- 's|slave.pmc spotoutf|#slave.pcm spotoutf|g' /etc/asound.conf
	
	systemctl stop snapserver
	systemctl stop snapclient
	
	rm -rf /home/volumio/snapcast
	rm $INSTALLING

	#required to end the plugin install
	echo "plugininstallend"
else
	echo "Plugin is already installing! Not continuing..."
fi
