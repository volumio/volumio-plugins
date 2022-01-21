## SnapCast uninstallation script
echo "Uninstalling SnapCast and its dependencies..."
INSTALLING="/home/volumio/snapcast-plugin.uninstalling"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING

	# Stop Spotify fifo pipe service
	systemctl stop spotififo.service
	systemctl disable spotififo.service

	# Uninstall packages
	dpkg -P snapserver
	dpkg -P snapclient

	# Restore /etc/mpd.conf
	ALSA_ENABLED=$(sed -n "/.*type.*\"alsa\"/{n;p}" /etc/mpd.conf)
	FIFO_ENABLED=$(sed -n "/.*type.*\"fifo\"/{n;p}" /etc/mpd.conf)

	case $ALSA_ENABLED in
	 *enabled*) sed -i -- '/.*type.*alsa.*/!b;n;c\ \ \ \ \ \ \ \ \ \ \ \ \ \ \ \ enabled\ \ \ \ \ \ \ \ \ "yes"' /etc/mpd.conf ;;
	 *) sed -i -- 's|.*type.*alsa.*|&\n\ \ \ \ \ \ \ \ \ \ \ \ \ \ \ \ enabled\ \ \ \ \ \ \ \ \ "yes"|g' /etc/mpd.conf ;;
	esac

	case $FIFO_ENABLED in
	 *enabled*) sed -i -- '/.*type.*fifo.*/!b;n;c\ \ \ \ enabled\ \ \ \ \ \ \ \ \ "no"' /etc/mpd.conf ;;
	 *) sed -i -- 's|.*type.*fifo.*|&\n\ \ \ \ enabled\ \ \ \ \ \ \ \ \ "no"|g' /etc/mpd.conf ;;
	esac
	
	# Restore /etc/asound.conf
	sed -i '/#SNAPCAST/,/#ENDOFSNAPCAST/d' /etc/asound.conf

	# Cleanup systemd units
	systemctl enable /data/plugins/miscellanea/snapcast/spotififo.service
	rm -rf /lib/systemd/system/spotififo.service
	rm /tmp/spotififo

	rm $INSTALLING

	#required to end the plugin uninstall
	echo "pluginuninstallend"
else
	echo "Plugin is already uninstalling! Not continuing..."
fi
