## SnapCast installation script
echo "Installing SnapCast and its dependencies..."
INSTALLING="/home/volumio/snapcast-plugin.installing"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING
	apt-get update

	# Download latest SnapCast packages
	mkdir /home/volumio/snapcast
	wget $(curl -s https://api.github.com/repos/badaix/snapcast/releases/latest | grep 'armhf' | cut -d\" -f4) -P /home/volumio/snapcast

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
		file \"/tmp/spotififo\"
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
		file \"/tmp/spotififo\"
		format \"raw\"
	}
	#ENDOFSNAPCAST
	" | sudo tee /etc/asound.conf
	fi
	
	# Don't touch this if volspotconnect (spotify-connect-web) plugin  is not installed
	if [ -d "/data/plugins/music_service/volspotconnect/spotify-connect-web/etc" ];
	then
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
	sed -i -- 's|.*format.*|    format          "48000:16:2"|g' /etc/mpd.conf

	# Disable standard output to ALSA
	ALSA_ENABLED=$(sed -n "/.*type.*\"alsa\"/{n;p}" /etc/mpd.conf)

	case $ALSA_ENABLED in
	 *enabled*) sed -i -- '/.*type.*alsa.*/!b;n;c\ \ \ \ \ \ \ \ \ \ \ \ \ \ \ \ enabled\ \ \ \ \ \ \ \ \ "no"' /etc/mpd.conf ;;
	 *) sed -i -- 's|.*type.*alsa.*|&\n\ \ \ \ \ \ \ \ \ \ \ \ \ \ \ \ enabled\ \ \ \ \ \ \ \ \ "no"|g' /etc/mpd.conf ;;
	esac

	# Edit the systemd units
	systemctl enable /data/plugins/miscellanea/snapcast/spotififo.service
	systemctl start spotififo.service
	systemctl disable snapserver.service
	systemctl disable snapclient.service

	systemctl restart mpd

	sed -i -- 's|^SNAPSERVER_OPTS.*|SNAPSERVER_OPTS="-d -s pipe:///tmp/snapfifo?name=Volumio-MPD\&mode=read"|g' /etc/default/snapserver
	sed -i -- 's|^SNAPCLIENT_OPTS.*|SNAPCLIENT_OPTS="-d -h 127.0.0.1 -s ALSA"|g' /etc/default/snapclient
	
	systemctl stop snapserver
	systemctl stop snapclient
	
	rm $INSTALLING

	#required to end the plugin install
	echo "plugininstallend"
else
	echo "Plugin is already installing! Not continuing..."
fi
