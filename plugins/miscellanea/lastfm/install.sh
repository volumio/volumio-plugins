## Template installation script
echo "Installing LastFM and its dependencies..."
INSTALLING="/home/volumio/lastfm.installing"

if [ ! -f $INSTALLING ]; then

	touch $INSTALLING

	# Download LMS 7.9.0
	echo "Downloading installation package..."
	# Perform any kind of wget/apt-get install/dpkg -i/etc.
	
	rm $INSTALLING

	#required to end the plugin install
	echo "plugininstallend"
else
	echo "Plugin is already installing! Not continuing..."
fi
